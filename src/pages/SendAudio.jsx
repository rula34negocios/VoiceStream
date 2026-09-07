import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mic, Square, Send, User, Sparkles, Coins } from 'lucide-react';

export default function SendAudio() {
  const { slug } = useParams();
  const [canal, setCanal] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [grabando, setGrabando] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duracion, setDuracion] = useState(0);
  const [titulo, setTitulo] = useState('');
  const [esAnonimo, setEsAnonimo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeStatus, setMensajeStatus] = useState('');
  
  // Estados para Puntos y Paquetes de Tiempo
  const [usuario, setUsuario] = useState(null);
  const [puntosEspectador, setPuntosEspectador] = useState(0);
  const [paquetesTiempo, setPaquetesTiempo] = useState([]);
  const [limiteMaximo, setLimiteMaximo] = useState(10);
  const [creditoExtra, setCreditoExtra] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    async function obtenerDatosCanalYUsuario() {
      try {
        const { data: canalData, error } = await supabase
          .from('canales')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error || !canalData) {
          setMensajeStatus('El canal no existe.');
          return;
        }

        setCanal(canalData);
        const baseSegundos = canalData.duracion_base_segundos || 10;
        setLimiteMaximo(baseSegundos);

        // Cargar paquetes configurados por el streamer
        const { data: pkgs } = await supabase
          .from('canal_paquetes_tiempo')
          .select('*')
          .eq('canal_id', canalData.id)
          .order('segundos', { ascending: true });

        setPaquetesTiempo(pkgs || []);

        // Obtener usuario autenticado y su saldo de puntos en este canal
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUsuario(user);

          const { data: saldoData } = await supabase
            .from('espectador_puntos')
            .select('*')
            .eq('canal_id', canalData.id)
            .eq('usuario_id', user.id)
            .maybeSingle();

          if (saldoData) {
            setPuntosEspectador(saldoData.puntos);
          } else {
            // Si no tiene registro, inicializamos con 1000 puntos de prueba en este canal
            await supabase.from('espectador_puntos').insert([
              { canal_id: canalData.id, usuario_id: user.id, puntos: 1000 }
            ]);
            setPuntosEspectador(1000);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    obtenerDatosCanalYUsuario();
  }, [slug]);

  // Canjear puntos por tiempo extra
  const canjearPaquete = async (pkg) => {
    if (!usuario) {
      alert('Debes iniciar sesión con Twitch para canjear puntos.');
      return;
    }

    if (puntosEspectador < pkg.costo_puntos) {
      alert('No tienes suficientes puntos en este canal para este paquete.');
      return;
    }

    const nuevosPuntos = puntosEspectador - pkg.costo_puntos;
    const nuevoExtra = creditoExtra + pkg.segundos;
    const baseSegundos = canal.duracion_base_segundos || 10;

    try {
      // Actualizar saldo de puntos en la base de datos
      await supabase
        .from('espectador_puntos')
        .update({ puntos: nuevosPuntos })
        .eq('canal_id', canal.id)
        .eq('usuario_id', usuario.id);

      setPuntosEspectador(nuevosPuntos);
      setCreditoExtra(nuevoExtra);
      setLimiteMaximo(baseSegundos + nuevoExtra);
      setMensajeStatus(`¡Canje exitoso! +${pkg.segundos}s añadidos a tu grabación.`);
      setTimeout(() => setMensajeStatus(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Error al procesar el canje de puntos.');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setGrabando(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const iniciarGrabacion = async () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuracion(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current.start(100);
      setGrabando(true);

      let segundosTranscurridos = 0;
      timerRef.current = setInterval(() => {
        segundosTranscurridos += 1;
        setDuracion(segundosTranscurridos);

        if (segundosTranscurridos >= limiteMaximo) {
          detenerGrabacion();
        }
      }, 1000);

    } catch (err) {
      alert('Debes permitir el acceso al micrófono para grabar.');
    }
  };

  const enviarAudio = async () => {
    if (!audioBlob || !canal) return;
    setEnviando(true);
    setMensajeStatus('');

    try {
      if (!usuario) {
        alert('Debes iniciar sesión con Twitch para enviar audios.');
        setEnviando(false);
        return;
      }

      const nombreArchivo = `${canal.id}/${Date.now()}.webm`;
      const { error: storageError } = await supabase.storage
        .from('audios')
        .upload(nombreArchivo, audioBlob, { contentType: 'audio/webm' });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from('audios')
        .getPublicUrl(nombreArchivo);

      const { error: dbError } = await supabase.from('audios').insert([
        {
          canal_id: canal.id,
          usuario_id: usuario.id,
          titulo: titulo.trim() || 'Anónimo',
          url_archivo: urlData.publicUrl,
          duracion_segundos: duracion,
          es_anonimo: esAnonimo,
          estado: 'pendiente'
        }
      ]);

      if (dbError) {
        if (dbError.message.includes('límite de 3 audios')) {
          setMensajeStatus('Has alcanzado el límite de 3 audios pendientes.');
          return;
        }
        throw dbError;
      }

      // Limpiar crédito extra consumido
      setCreditoExtra(0);
      setLimiteMaximo(canal.duracion_base_segundos || 10);
      setMensajeStatus('¡Audio enviado a revisión con éxito!');
      setAudioBlob(null);
      setAudioUrl(null);
      setTitulo('');
      setDuracion(0);

    } catch (err) {
      console.error(err);
      setMensajeStatus('Ocurrió un error al enviar el audio.');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <div className="p-10 text-center text-zinc-400">Cargando canal...</div>;
  if (!canal) return <div className="p-10 text-center text-red-500 font-bold">Canal no encontrado.</div>;

  return (
    <div className="min-h-screen bg-brand-dark text-white p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-brand-card p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
        <h1 className="text-2xl font-bold text-center text-brand-purple">
          VoiceStream
        </h1>
        <p className="text-center text-zinc-400 text-sm">
          Enviar audio a <span className="text-white font-semibold">{canal.nombre_canal}</span>
        </p>

        {/* WIDGET DE SALDO DE PUNTOS */}
        <div className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-purple/20 flex items-center justify-center text-brand-purple">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Tus Puntos en el Canal</span>
              <span className="text-sm font-extrabold text-white">{puntosEspectador} Puntos</span>
            </div>
          </div>
          {!usuario && (
            <span className="text-[10px] text-amber-400 font-semibold">Inicia sesión</span>
          )}
        </div>

        {/* LISTA DE PAQUETES DE TIEMPO CONFIGURADOS POR EL STREAMER */}
        {paquetesTiempo.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-300 block uppercase tracking-wider">
              Canjear Puntos por Tiempo Extra:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {paquetesTiempo.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => canjearPaquete(pkg)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-3 rounded-xl text-left transition space-y-1"
                >
                  <div className="text-xs font-bold text-brand-purple">+{pkg.segundos} Segundos</div>
                  <div className="text-[11px] text-amber-400 font-semibold">{pkg.costo_puntos} Puntos</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {creditoExtra > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>¡+{creditoExtra}s de grabación extra activos para este envío!</span>
          </div>
        )}

        {/* Grabador */}
        <div className="flex flex-col items-center my-2">
          {!grabando ? (
            <button
              onClick={iniciarGrabacion}
              className="w-24 h-24 bg-brand-purple hover:bg-brand-accent rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
            >
              <Mic className="w-10 h-10 text-white" />
            </button>
          ) : (
            <button
              onClick={detenerGrabacion}
              className="w-24 h-24 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg animate-pulse"
            >
              <Square className="w-10 h-10 text-white" />
            </button>
          )}

          <p className="mt-3 text-lg font-mono">
            00:{duracion < 10 ? `0${duracion}` : duracion} / 00:{limiteMaximo < 10 ? `0${limiteMaximo}` : limiteMaximo}
          </p>
        </div>

        {audioUrl && (
          <div className="w-full">
            <audio src={audioUrl} controls className="w-full rounded-lg" />
          </div>
        )}

        {/* Formulario */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Título o Mensaje (Opcional)</label>
            <input
              type="text"
              placeholder="Ej: Saludos desde el chat!"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-brand-purple"
            />
          </div>

          <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
            <span className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-400" /> Enviar como Anónimo
            </span>
            <input
              type="checkbox"
              checked={esAnonimo}
              onChange={(e) => setEsAnonimo(e.target.checked)}
              className="w-4 h-4 accent-brand-purple rounded cursor-pointer"
            />
          </div>

          <button
            disabled={!audioBlob || enviando}
            onClick={enviarAudio}
            className="w-full bg-brand-purple hover:bg-brand-accent disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Send className="w-4 h-4" />
            {enviando ? 'Enviando...' : 'Enviar Audio'}
          </button>

          {mensajeStatus && (
            <p className="text-center text-sm font-medium text-brand-purple mt-2">
              {mensajeStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}