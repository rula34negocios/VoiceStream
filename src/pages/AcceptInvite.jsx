import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, LogIn, AlertCircle } from 'lucide-react';

export default function AcceptInvite() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [canal, setCanal] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    async function cargarDatos() {
      try {
        // 1. Obtener canal por el slug
        const { data: canalData, error } = await supabase
          .from('canales')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error || !canalData) {
          setMensaje('El canal especificado no existe.');
          return;
        }
        setCanal(canalData);

        // 2. Verificar usuario autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUsuario(user);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, [slug]);

  const iniciarSesionConTwitch = () => {
    supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: window.location.href }
    });
  };

  const aceptarModeracion = async () => {
    if (!usuario || !canal) return;
    setCargando(true);

    try {
      // Registrar al usuario como moderador
      const { error } = await supabase
        .from('canal_moderadores')
        .upsert({
          canal_id: canal.id,
          usuario_id: usuario.id,
          estado: 'aprobado'
        });

      if (error) throw error;

      // Redirigir directamente al panel de moderación del canal
      navigate(`/${canal.slug}/mod`);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al aceptar la invitación.');
    } finally {
      setCargando(false);
    }
  };

  if (cargando) return <div className="p-10 text-center text-zinc-400">Cargando invitación...</div>;

  return (
    <div className="min-h-screen bg-brand-dark text-white p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-brand-card p-6 rounded-2xl border border-zinc-800 shadow-xl text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-brand-purple mx-auto animate-pulse" />
        
        <h1 className="text-2xl font-bold">Invitación de Moderación</h1>
        
        {canal && (
          <p className="text-sm text-zinc-300">
            Has sido invitado a moderar el canal de audios de <span className="font-semibold text-brand-purple">{canal.nombre_canal}</span>.
          </p>
        )}

        {mensaje ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{mensaje}</span>
          </div>
        ) : !usuario ? (
          <button
            onClick={iniciarSesionConTwitch}
            className="w-full bg-brand-purple hover:bg-brand-accent text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <LogIn className="w-5 h-5" /> Iniciar Sesión con Twitch para Aceptar
          </button>
        ) : (
          <button
            onClick={aceptarModeracion}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition"
          >
            Aceptar y Abrir Panel de Moderación
          </button>
        )}
      </div>
    </div>
  );
}