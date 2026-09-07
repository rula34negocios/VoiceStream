import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Volume2 } from 'lucide-react';

export default function Overlay() {
  const { slug } = useParams();
  const [audioActual, setAudioActual] = useState(null);
  const [opacidad, setOpacidad] = useState(0);
  const [barrasNivel, setBarrasNivel] = useState(new Array(16).fill(15));

  const colaRef = useRef([]);
  const reproduciendoRef = useRef(false);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    obtenerCanalYSuscribir();

    const desbloquearAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', desbloquearAudio);
    window.addEventListener('keydown', desbloquearAudio);

    return () => {
      window.removeEventListener('click', desbloquearAudio);
      window.removeEventListener('keydown', desbloquearAudio);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [slug]);

  const obtenerCanalYSuscribir = async () => {
    // 1. Obtener los datos del canal
    const { data: canalData, error } = await supabase
      .from('canales')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !canalData) {
      console.error('No se encontró el canal en el Overlay:', error);
      return;
    }

    // 2. Suscripción global a cambios en la tabla 'audios' sin filtros restrictivos
    const canalRealtime = supabase
      .channel(`overlay-realtime-${canalData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audios'
        },
        async (payload) => {
          const nuevoRegistro = payload.new;

          // Validar que el audio pertenezca a este canal y esté APROBADO
          if (nuevoRegistro && nuevoRegistro.canal_id === canalData.id && nuevoRegistro.estado === 'aprobado') {
            
            // Si falta la URL del archivo en el payload, traer el registro completo de la BD
            if (!nuevoRegistro.url_archivo) {
              const { data: audioCompleto } = await supabase
                .from('audios')
                .select('*')
                .eq('id', nuevoRegistro.id)
                .single();

              if (audioCompleto) agregarACola(audioCompleto);
            } else {
              agregarACola(nuevoRegistro);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado de la conexión Realtime en OBS:', status);
      });

    return () => {
      supabase.removeChannel(canalRealtime);
    };
  };

  const agregarACola = (nuevoAudio) => {
    const yaExiste = colaRef.current.some((a) => a.id === nuevoAudio.id);
    if (!yaExiste) {
      colaRef.current.push(nuevoAudio);
      procesarSiguienteAudio();
    }
  };

  const procesarSiguienteAudio = () => {
    if (reproduciendoRef.current || colaRef.current.length === 0) return;

    reproduciendoRef.current = true;
    const siguiente = colaRef.current.shift();
    setAudioActual(siguiente);

    if (audioRef.current) {
      audioRef.current.src = siguiente.url_archivo;
      audioRef.current.load();

      const promise = audioRef.current.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setOpacidad(1);
            iniciarAnalizadorWebAudio();
          })
          .catch((err) => {
            console.warn('Autoplay bloqueado o archivo no reproducible:', err);
            setOpacidad(1);
            setTimeout(() => alTerminarAudio(), 3000);
          });
      }
    }
  };

  const iniciarAnalizadorWebAudio = () => {
    if (!audioRef.current) return;

    try {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;

        const source = audioContextRef.current.createMediaElementSource(audioRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const actualizarVisualizador = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        const niveles = [];
        for (let i = 0; i < 16; i++) {
          const valor = dataArray[i] || 0;
          const porcentaje = Math.max(15, Math.min(100, (valor / 255) * 100));
          niveles.push(porcentaje);
        }
        setBarrasNivel(niveles);
        animFrameRef.current = requestAnimationFrame(actualizarVisualizador);
      };

      actualizarVisualizador();
    } catch (e) {
      console.error('Error al inicializar Web Audio API:', e);
    }
  };

  const alTerminarAudio = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setOpacidad(0);

    setTimeout(() => {
      setAudioActual(null);
      setBarrasNivel(new Array(16).fill(15));
      reproduciendoRef.current = false;
      procesarSiguienteAudio();
    }, 800);
  };

  return (
    <div className="w-screen h-screen bg-transparent flex items-center justify-center p-6 select-none overflow-hidden">
      <audio
        ref={audioRef}
        onEnded={alTerminarAudio}
        className="hidden"
        crossOrigin="anonymous"
        preload="auto"
      />

      <div
        style={{ opacity: opacidad, transition: 'opacity 800ms ease-in-out' }}
        className="relative w-full max-w-xl h-24 bg-zinc-950/90 border-2 border-purple-500/80 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.4)] backdrop-blur-md flex items-center justify-between px-6 overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-between px-8 opacity-20 pointer-events-none">
          {barrasNivel.map((altura, index) => (
            <div
              key={index}
              style={{ height: `${altura}%`, transition: 'height 50ms ease-out' }}
              className="w-2 bg-gradient-to-t from-purple-600 via-indigo-400 to-cyan-300 rounded-full"
            />
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-4 w-full">
          <div className="w-12 h-12 bg-purple-600/30 border border-purple-400/50 rounded-xl flex items-center justify-center text-purple-300 shrink-0">
            <Volume2 className="w-6 h-6 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-xs uppercase tracking-widest text-purple-400 font-bold block">
              VoiceStream Alert
            </span>
            <h2 className="text-lg font-extrabold text-white truncate drop-shadow-md">
              {audioActual?.titulo || 'Reproduciendo audio...'}
            </h2>
          </div>

          <div className="flex items-end gap-1 h-8 shrink-0">
            {barrasNivel.slice(0, 6).map((altura, index) => (
              <div
                key={index}
                style={{ height: `${altura}%`, transition: 'height 60ms ease-out' }}
                className="w-1.5 bg-purple-400 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}