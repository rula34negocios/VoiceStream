import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Radio, Mic, Shield, LogIn, LayoutDashboard, PlusCircle, LogOut, ChevronDown, BellCheck } from 'lucide-react';

export default function Home() {
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [miCanal, setMiCanal] = useState(null);
  const [canalesMod, setCanalesMod] = useState([]);
  const [invitacionesPendientes, setInvitacionesPendientes] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);

  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user);
        await cargarInformacionUsuario(session.user);
      } else {
        setCargando(false);
      }
    });

    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  const cargarInformacionUsuario = async (user) => {
    try {
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setPerfil(perfilData);

      const { data: canalData } = await supabase
        .from('canales')
        .select('*')
        .eq('propietario_id', user.id)
        .maybeSingle();
      setMiCanal(canalData);

      // ERROR SOLUCIONADO: Se eliminó la petición de la columna 'id' que no existe en canal_moderadores
      const { data: modsData, error: modsError } = await supabase
        .from('canal_moderadores')
        .select('estado, canal_id')
        .eq('usuario_id', user.id);

      if (modsError) {
        console.error('Error cargando moderadores:', modsError);
      }

      const mods = modsData || [];
      const idsAprobados = mods.filter(m => m.estado === 'aprobado').map(m => m.canal_id);
      const pendientesRaw = mods.filter(m => m.estado === 'pendiente');

      if (idsAprobados.length > 0) {
        const { data: canalesAprobados } = await supabase
          .from('canales')
          .select('id, nombre_canal, slug')
          .in('id', idsAprobados);
        
        setCanalesMod(canalesAprobados || []);
      } else {
        setCanalesMod([]);
      }

      if (pendientesRaw.length > 0) {
        const idsPend = pendientesRaw.map(m => m.canal_id);
        const { data: canalesPendientes } = await supabase
          .from('canales')
          .select('id, nombre_canal, slug')
          .in('id', idsPend);

        const filtrados = pendientesRaw.map(p => ({
          ...p,
          canales: (canalesPendientes || []).find(c => c.id === p.canal_id)
        }));
        setInvitacionesPendientes(filtrados);
      } else {
        setInvitacionesPendientes([]);
      }

    } catch (err) {
      console.error('Error general cargando usuario:', err);
    } finally {
      setCargando(false);
    }
  };

  // ERROR SOLUCIONADO: Actualizamos buscando por 'canal_id' y 'usuario_id', no por 'id'
  const aceptarInvitacion = async (canalId, slug) => {
    const { error } = await supabase
      .from('canal_moderadores')
      .update({ estado: 'aprobado' })
      .eq('canal_id', canalId)
      .eq('usuario_id', usuario.id);

    if (!error) {
      navigate(`/${slug}/mod`);
    } else {
      console.error("Error al aceptar invitación:", error);
    }
  };

  const iniciarSesionConTwitch = () => {
    supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: window.location.origin }
    });
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setPerfil(null);
    setMiCanal(null);
    setCanalesMod([]);
    setInvitacionesPendientes([]);
    setMenuAbierto(false);
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col justify-between p-6">
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center py-4 border-b border-zinc-800">
        <div onClick={() => navigate('/')} className="flex items-center gap-2 text-xl font-bold text-brand-purple cursor-pointer select-none">
          <Radio className="w-6 h-6" /> VoiceStream
        </div>

        {!usuario ? (
          <button onClick={iniciarSesionConTwitch} className="bg-brand-purple hover:bg-brand-accent px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition">
            <LogIn className="w-4 h-4" /> Iniciar Sesión con Twitch
          </button>
        ) : (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuAbierto(!menuAbierto)} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-brand-purple/50 px-3 py-1.5 rounded-full transition">
              <img src={perfil?.avatar_url || usuario.user_metadata?.avatar_url || 'https://via.placeholder.com/40'} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-purple-500/40" />
              <span className="text-sm font-bold text-zinc-200">{perfil?.twitch_username || usuario.user_metadata?.name}</span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>

            {menuAbierto && (
              <div className="absolute right-0 mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Administración</div>
                {miCanal ? (
                  <button onClick={() => { setMenuAbierto(false); navigate('/dashboard'); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 rounded-xl transition">
                    <LayoutDashboard className="w-4 h-4 text-purple-400" /> Dashboard de {miCanal.nombre_canal}
                  </button>
                ) : (
                  <button onClick={() => { setMenuAbierto(false); navigate('/dashboard'); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-brand-purple hover:bg-purple-500/10 rounded-xl transition">
                    <PlusCircle className="w-4 h-4" /> Crear mi Canal de Audios
                  </button>
                )}

                <div className="border-t border-zinc-900 my-1"></div>

                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Moderación</div>
                
                {miCanal && (
                  <button onClick={() => { setMenuAbierto(false); navigate(`/${miCanal.slug}/mod`); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 rounded-xl transition">
                    <Shield className="w-4 h-4 text-purple-400" /> Moderar {miCanal.nombre_canal} (Mío)
                  </button>
                )}

                {canalesMod.length > 0 ? (
                  canalesMod.map((canal) => (
                    <button key={canal.slug} onClick={() => { setMenuAbierto(false); navigate(`/${canal.slug}/mod`); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 rounded-xl transition">
                      <Shield className="w-4 h-4 text-green-400" /> Moderar {canal.nombre_canal}
                    </button>
                  ))
                ) : (
                  !miCanal && <div className="px-3 py-1 text-[11px] text-zinc-500 italic">No moderas ningún canal aún.</div>
                )}

                <div className="border-t border-zinc-900 my-1"></div>

                <button onClick={cerrarSesion} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition">
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto text-center my-auto space-y-6 py-8">
        {invitacionesPendientes.length > 0 && (
          <div className="bg-purple-950/40 border border-purple-500/50 p-4 rounded-2xl max-w-md mx-auto text-left mb-6 space-y-3 shadow-lg">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
              <BellCheck className="w-5 h-5 text-purple-400" /> Invitación de Moderación Pendiente
            </div>
            {invitacionesPendientes.map((inv) => (
              <div key={inv.canal_id} className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-xs text-zinc-200 font-semibold">{inv.canales?.nombre_canal}</span>
                <button onClick={() => aceptarInvitacion(inv.canal_id, inv.canales?.slug)} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition">
                  Aceptar e ir a Moderación
                </button>
              </div>
            ))}
          </div>
        )}

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">Alertas de Voz en Tiempo Real para tu Stream</h1>
        <p className="text-zinc-400 text-base md:text-lg">Permite que tus espectadores envíen audios cortos en directo, modéralos al instante y reprodúcelos en tu OBS con visualizador dinámico.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left mt-8">
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Mic className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">Graba y Envía</h3>
            <p className="text-xs text-zinc-400">Los espectadores graban y envían notas de voz con límite de tiempo.</p>
          </div>
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Shield className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">Moderación en Vivo</h3>
            <p className="text-xs text-zinc-400">Filtro anti-spam y panel directo para ti y tu equipo de moders.</p>
          </div>
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Radio className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">OBS Overlay</h3>
            <p className="text-xs text-zinc-400">Widget transparente con ecualizador de ondas para tu OBS.</p>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-500 py-4 border-t border-zinc-800">
        VoiceStream • Plataforma Serverless para Streamers
      </footer>
    </div>
  );
}