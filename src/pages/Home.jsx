import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Radio, Mic, Shield, LogIn, LayoutDashboard, ShieldCheck, PlusCircle, LogOut, ChevronDown } from 'lucide-react';

export default function Home() {
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [miCanal, setMiCanal] = useState(null);
  const [canalesMod, setCanalesMod] = useState([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);

  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Cerrar menú al hacer clic fuera
    const handleClickAfuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);

    // Cargar datos del usuario
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
      // 1. Perfil de Twitch
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      setPerfil(perfilData);

      // 2. Comprobar si el usuario es dueño de algún canal
      const { data: canalData } = await supabase
        .from('canales')
        .select('*')
        .eq('propietario_id', user.id)
        .maybeSingle();

      setMiCanal(canalData);

      // 3. Comprobar canales donde es moderador
      const { data: modData } = await supabase
        .from('canal_moderadores')
        .select(`
          canal_id,
          canales:canal_id (nombre_canal, slug)
        `)
        .eq('usuario_id', user.id)
        .eq('estado', 'aprobado');

      if (modData) {
        setCanalesMod(modData.map((m) => m.canales));
      }
    } catch (err) {
      console.error('Error cargando usuario:', err);
    } finally {
      setCargando(false);
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
    setMenuAbierto(false);
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col justify-between p-6">
      {/* Encabezado */}
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center py-4 border-b border-zinc-800">
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-xl font-bold text-brand-purple cursor-pointer select-none"
        >
          <Radio className="w-6 h-6" /> VoiceStream
        </div>

        {/* Botón Login o Menú Desplegable con Foto */}
        {!usuario ? (
          <button
            onClick={iniciarSesionConTwitch}
            className="bg-brand-purple hover:bg-brand-accent px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition"
          >
            <LogIn className="w-4 h-4" /> Iniciar Sesión con Twitch
          </button>
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-brand-purple/50 px-3 py-1.5 rounded-full transition"
            >
              <img
                src={perfil?.avatar_url || usuario.user_metadata?.avatar_url || 'https://via.placeholder.com/40'}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-purple-500/50 object-cover"
              />
              <span className="text-sm font-bold text-zinc-200">
                {perfil?.twitch_username || usuario.user_metadata?.name || 'Mi Cuenta'}
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>

            {/* Menú Desplegable */}
            {menuAbierto && (
              <div className="absolute right-0 mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                
                {/* Opción 1: Dashboard / Crear Canal */}
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Administración
                </div>
                {miCanal ? (
                  <button
                    onClick={() => { setMenuAbierto(false); navigate('/dashboard'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 rounded-xl transition"
                  >
                    <LayoutDashboard className="w-4 h-4 text-purple-400" /> Dashboard de {miCanal.nombre_canal}
                  </button>
                ) : (
                  <button
                    onClick={() => { setMenuAbierto(false); navigate('/dashboard'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-brand-purple hover:bg-purple-500/10 rounded-xl transition"
                  >
                    <PlusCircle className="w-4 h-4" /> Crear mi Canal de Audios
                  </button>
                )}

                <div className="border-t border-zinc-900 my-1"></div>

                {/* Opción 2: Moderación */}
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Moderación
                </div>
                {canalesMod.length > 0 ? (
                  canalesMod.map((canal) => (
                    <button
                      key={canal.slug}
                      onClick={() => { setMenuAbierto(false); navigate(`/${canal.slug}/mod`); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 rounded-xl transition"
                    >
                      <Shield className="w-4 h-4 text-green-400" /> Moderar {canal.nombre_canal}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-1 text-[11px] text-zinc-500 italic">
                    No moderas ningún canal aún.
                  </div>
                )}

                <div className="border-t border-zinc-900 my-1"></div>

                {/* Opción 3: Cerrar Sesión */}
                <button
                  onClick={cerrarSesion}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Contenido de la Landing Page */}
      <main className="max-w-3xl mx-auto text-center my-auto space-y-6 py-12">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Alertas de Voz en Tiempo Real para tu Stream
        </h1>
        <p className="text-zinc-400 text-base md:text-lg">
          Permite que tus espectadores envíen audios cortos en directo, modéralos al instante y reprodúcelos en tu OBS con visualizador dinámico.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left mt-8">
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Mic className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">Graba y Envía</h3>
            <p className="text-xs text-zinc-400">
              Los espectadores graban y envían notas de voz con límite de tiempo.
            </p>
          </div>
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Shield className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">Moderación en Vivo</h3>
            <p className="text-xs text-zinc-400">
              Filtro anti-spam y panel directo para ti y tu equipo de moders.
            </p>
          </div>
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Radio className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">OBS Overlay</h3>
            <p className="text-xs text-zinc-400">
              Widget transparente con ecualizador de ondas para tu OBS.
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-500 py-4 border-t border-zinc-800">
        VoiceStream • Plataforma Serverless para Streamers
      </footer>
    </div>
  );
}