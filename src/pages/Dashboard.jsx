import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Radio, Copy, Check, LogIn, ExternalLink, ShieldCheck, UserCheck } from 'lucide-react';

export default function Dashboard() {
  const [usuario, setUsuario] = useState(null);
  const [canal, setCanal] = useState(null);
  const [moderadores, setModeradores] = useState([]);
  const [nombreCanal, setNombreCanal] = useState('');
  const [slug, setSlug] = useState('');
  const [copiado, setCopiado] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user);
        await cargarDatosCanal(session.user);
      } else {
        setCargando(false);
      }
    });
  }, []);

  const cargarDatosCanal = async (user) => {
    try {
      const { data: canalData } = await supabase
        .from('canales')
        .select('*')
        .eq('propietario_id', user.id)
        .maybeSingle();

      if (canalData) {
        setCanal(canalData);
        await cargarModeradores(canalData.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // Cargar lista de moderadores que aceptaron
  const cargarModeradores = async (canalId) => {
    const { data, error } = await supabase
      .from('canal_moderadores')
      .select(`
        id,
        estado,
        perfiles:usuario_id (twitch_username, avatar_url)
      `)
      .eq('canal_id', canalId);

    if (!error && data) {
      setModeradores(data);
    }
  };

  const iniciarSesionTwitch = () => {
    supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: window.location.origin + '/dashboard' }
    });
  };

  const copiarTexto = (texto, tipo) => {
    navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    setTimeout(() => setCopiado(''), 2000);
  };

  if (cargando) return <div className="p-10 text-center text-zinc-400">Cargando dashboard...</div>;

  if (!usuario) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
        <button onClick={iniciarSesionTwitch} className="bg-brand-purple px-6 py-3 rounded-xl font-bold">
          Iniciar Sesión con Twitch
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {canal && (
          <div className="bg-brand-card p-6 rounded-xl border border-zinc-800 space-y-6">
            <h2 className="text-2xl font-bold">{canal.nombre_canal}</h2>

            {/* Enlace de Invitación para Moderadores */}
            <div className="bg-purple-950/30 p-4 rounded-xl border border-purple-800/40">
              <p className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Enlace para Invitar Moderadores:
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/invitacion/${canal.slug}`}
                  className="bg-zinc-950 p-2.5 text-xs rounded-lg border border-zinc-800 flex-1 text-zinc-300 font-mono"
                />
                <button
                  onClick={() => copiarTexto(`${window.location.origin}/invitacion/${canal.slug}`, 'invitacion')}
                  className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-lg"
                >
                  {copiado === 'invitacion' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Lista de Moderadores Confirmados */}
            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-green-400" /> Moderadores Confirmados ({moderadores.length})
              </h3>
              {moderadores.length === 0 ? (
                <p className="text-xs text-zinc-500">Aún nadie ha aceptado la invitación de moderación.</p>
              ) : (
                <div className="space-y-2">
                  {moderadores.map((mod) => (
                    <div key={mod.id} className="flex items-center gap-3 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                      {mod.perfiles?.avatar_url && (
                        <img src={mod.perfiles.avatar_url} alt="avatar" className="w-6 h-6 rounded-full" />
                      )}
                      <span className="text-xs font-semibold text-zinc-200">
                        {mod.perfiles?.twitch_username || 'Usuario'}
                      </span>
                      <span className="ml-auto text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-bold uppercase">
                        Aceptado
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}