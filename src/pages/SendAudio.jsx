import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mic, Square, Send, User, Sparkles } from 'lucide-react';

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
          
          // Verificar si el usuario actual tiene créditos acumulados
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: perfil } = await supabase
              .from('perfiles')
              .select('credito_segundos')
              .eq('id', user.id)
              .maybeSingle();

            if (perfil?.credito_segundos > 0) {
              setCreditoExtra(perfil.credito_segundos);
              setLimiteMaximo(baseSegundos + perfil.credito_segundos);
            } else {
              setLimiteMaximo(baseSegundos);
            }
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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

      // 2. Crear registro en la tabla de audios (Atrapa el error Anti-Spam del Trigger)
      const { error: dbError } = await supabase.from('audios').insert([
        {
          canal_id: canal.id,
          usuario_id: user.id,
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

      // 3. Si usó créditos de tiempo, reiniciar el acumulado en su perfil
      if (creditoExtra > 0) {
        await supabase
          .from('perfiles')
          .update({ credito_segundos: 0 })
          .eq('id', user.id);
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

  if (cargando) return <div className="p-10 text-center">Cargando canal...</div>;
  if (!canal) return <div className="p-10 text-center text-red-500 font-bold">Canal no encontrado.</div>;

  return (
    <div className="min-h-screen bg-brand-dark text-white p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-brand-card p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-1 text-brand-purple">
          VoiceStream
        </h1>
        <p className="text-center text-zinc-400 mb-2 text-sm">
          Enviar audio a <span className="text-white font-semibold">{canal.nombre_canal}</span>
        </p>

        {/* Notificación de Tiempo Extendido si tiene Créditos */}
        {creditoExtra > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 mb-4">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>¡Canje de Twitch detectado! +{creditoExtra}s de grabación disponibles.</span>
          </div>
        )}

        {/* Grabador */}
        <div className="flex flex-col items-center my-6">
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

          <p className="mt-4 text-xl font-mono">
            00:{duracion < 10 ? `0${duracion}` : duracion} / 00:{limiteMaximo < 10 ? `0${limiteMaximo}` : limiteMaximo}
          </p>
        </div>

        {/* Previsualización del audio */}
        {audioUrl && (
          <div className="mb-6 w-full">
            <audio src={audioUrl} controls className="w-full rounded-lg" />
          </div>
        )}

        {/* Formulario de opciones */}
        <div className="space-y-4">
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