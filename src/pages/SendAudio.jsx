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
  
  // Estado para el límite dinámico de grabación (Tiempo Base + Créditos)
  const [limiteMaximo, setLimiteMaximo] = useState(10);
  const [creditoExtra, setCreditoExtra] = useState(0);
  const [usuario, setUsuario] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Cargar canal y consultar créditos acumulados del usuario
  useEffect(() => {
    async function obtenerCanalYCreditos() {
      try {
        const { data: canalData, error } = await supabase
          .from('canales')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error || !canalData) {
          setMensajeStatus('El canal no existe.');
        } else {
          setCanal(canalData);
          const baseSegundos = canalData.duracion_base_segundos || 10;
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUsuario(user);
            const { data: perfil } = await supabase
              .from('perfiles')
              .select('credito_segundos')
              .eq('id', user.id)
              .maybeSingle();

            const extra = perfil?.credito_segundos || 0;
            setCreditoExtra(extra);
            setLimiteMaximo(baseSegundos + extra);
          } else {
            setLimiteMaximo(baseSegundos);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    obtenerCanalYCreditos();
  }, [slug]);

  // Simular canje de Bits o Puntos del Canal por +10 segundos extra
  const canjearPuntosPorTiempo = async () => {
    if (!usuario) {
      alert('Debes iniciar sesión para canjear tiempo extra.');
      return;
    }

    const nuevoExtra = creditoExtra + 10;
    const baseSegundos = canal.duracion_base_segundos || 10;

    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ credito_segundos: nuevoExtra })
        .eq('id', usuario.id);

      if (error) throw error;

      setCreditoExtra(nuevoExtra);
      setLimiteMaximo(baseSegundos + nuevoExtra);
      setMensajeStatus('¡Has canjeado con éxito +10s de grabación!');
      setTimeout(() => setMensajeStatus(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al procesar el canje de puntos.');
    }
  };

  // Detener Grabación de forma limpia
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

  // Iniciar Grabación de Audio con el límite dinámico calculado
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

  // Enviar Audio a Supabase
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

      // 1. Subir archivo al Storage
      const nombreArchivo = `${canal.id}/${Date.now()}.webm`;
      const { error: storageError } = await supabase.storage
        .from('audios')
        .upload(nombreArchivo, audioBlob, { contentType: 'audio/webm' });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from('audios')
        .getPublicUrl(nombreArchivo);

      // 2. Crear registro en la tabla de audios
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
          setMensajeStatus('Has alcanzado el límite de 3 audios pendientes. Espera a que los moderen.');
          return;
        }
        throw dbError;
      }

      // 3. Si usó créditos de tiempo, reiniciar el acumulado en su perfil tras el envío
      if (creditoExtra > 0) {
        await supabase
          .from('perfiles')
          .update({ credito_segundos: 0 })
          .eq('id', usuario.id);
        setCreditoExtra(0);
        setLimiteMaximo(canal.duracion_base_segundos || 10);
      }

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

        {/* Sección de Canje de Puntos / Bits por Tiempo Extra */}
        <div className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" /> Extender Tiempo
            </span>
            <p className="text-[11px] text-zinc-400">Canjea Puntos / Bits (+10s)</p>
          </div>
          <button
            onClick={canjearPuntosPorTiempo}
            className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-2 rounded-lg transition"
          >
            Canjear (+10s)
          </button>
        </div>

        {/* Notificación de Tiempo Extendido Activo */}
        {creditoExtra > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>¡Tienes +{creditoExtra}s de grabación extra activos!</span>
          </div>
        )}

        {/* Grabador */}
        <div className="flex flex-col items-center my-4">
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

        {/* Previsualización del audio */}
        {audioUrl && (
          <div className="w-full">
            <audio src={audioUrl} controls className="w-full rounded-lg" />
          </div>
        )}

        {/* Formulario de opciones */}
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