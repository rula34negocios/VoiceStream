import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Radio, Copy, Check, LogIn, ExternalLink } from 'lucide-react';

export default function Dashboard() {
  const [usuario, setUsuario] = useState(null);
  const [canal, setCanal] = useState(null);
  const [nombreCanal, setNombreCanal] = useState('');
  const [slug, setSlug] = useState('');
  const [copiado, setCopiado] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Escuchar el estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUsuario(session.user);
        await asegurarPerfilYCanal(session.user);
      } else {
        setUsuario(null);
        setCanal(null);
        setCargando(false);
      }
    });

    // Comprobar sesión al cargar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user);
        await asegurarPerfilYCanal(session.user);
      } else {
        setCargando(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const asegurarPerfilYCanal = async (user) => {
    try {
      // 1. Verificar si existe el perfil, si no, crearlo manualmente
      const { data: perfilExistente } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!perfilExistente) {
        const username = user.user_metadata?.preferred_username || user.user_metadata?.name || 'Usuario_Twitch';
        const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
        
        await supabase.from('perfiles').insert([
          { id: user.id, twitch_username: username, avatar_url: avatar, rol: 'propietario' }
        ]);
      }

      // 2. Cargar canal si ya lo creó
      const { data: canalData } = await supabase
        .from('canales')
        .select('*')
        .eq('propietario_id', user.id)
        .maybeSingle();

      if (canalData) setCanal(canalData);
    } catch (err) {
      console.error("Error asegurando perfil:", err);
    } finally {
      setCargando(false);
    }
  };

  const iniciarSesionTwitch = () => {
    supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: window.location.origin + '/dashboard' }
    });
  };

  const crearCanal = async () => {
    if (!nombreCanal || !slug || !usuario) return;

    const { data, error } = await supabase.from('canales').insert([
      {
        propietario_id: usuario.id,
        nombre_canal: nombreCanal,
        slug: slug.toLowerCase().trim().replace(/\s+/g, '-'),
        duracion_base_segundos: 10
      }
    ]).select().single();

    if (error) {
      alert('Error al crear el canal: ' + error.message);
    } else if (data) {
      setCanal(data);
    }
  };

  const copiarTexto = (texto, tipo) => {
    navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    setTimeout(() => setCopiado(''), 2000);
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-zinc-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mb-4"></div>
        Cargando tu panel...
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
        <div className="bg-brand-card p-8 rounded-2xl border border-zinc-800 text-center max-w-sm w-full space-y-4">
          <Radio className="w-12 h-12 text-brand-purple mx-auto" />
          <h1 className="text-2xl font-bold text-white">VoiceStream</h1>
          <p className="text-sm text-zinc-400">Plataforma de audios en tiempo real para tu stream.</p>
          <button
            onClick={iniciarSesionTwitch}
            className="w-full bg-brand-purple hover:bg-brand-accent text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <LogIn className="w-5 h-5" /> Iniciar Sesión con Twitch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="text-brand-purple" /> Dashboard de VoiceStream
          </h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300"
          >
            Cerrar Sesión
          </button>
        </div>

        {!canal ? (
          <div className="bg-brand-card p-6 rounded-xl border border-zinc-800 space-y-4">
            <h2 className="text-xl font-semibold">Crea tu Canal de Audios</h2>
            <div>
              <label className="text-xs text-zinc-400">Nombre del Canal</label>
              <input
                type="text"
                placeholder="Ej: Canal de Rula"
                value={nombreCanal}
                onChange={(e) => setNombreCanal(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 mt-1 text-sm focus:outline-none focus:border-brand-purple"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Identificador URL (Slug)</label>
              <input
                type="text"
                placeholder="Ej: rula"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 mt-1 text-sm focus:outline-none focus:border-brand-purple"
              />
              <p className="text-xs text-zinc-500 mt-1">Tu enlace público será: {window.location.origin}/{slug || 'tu-slug'}</p>
            </div>
            <button
              onClick={crearCanal}
              className="bg-brand-purple hover:bg-brand-accent px-6 py-2.5 rounded-lg font-bold text-sm transition"
            >
              Guardar y Crear Canal
            </button>
          </div>
        ) : (
          <div className="bg-brand-card p-6 rounded-xl border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-brand-purple font-bold uppercase tracking-wider">Canal Activo</span>
                <h2 className="text-2xl font-bold">{canal.nombre_canal}</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                <p className="text-xs font-semibold text-zinc-300 mb-1">1. Enlace para Espectadores:</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}/${canal.slug}`} className="bg-zinc-950 p-2.5 text-xs rounded-lg border border-zinc-800 flex-1 text-zinc-300 font-mono" />
                  <button onClick={() => copiarTexto(`${window.location.origin}/${canal.slug}`, 'envio')} className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-lg">
                    {copiado === 'envio' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a href={`/${canal.slug}`} target="_blank" rel="noreferrer" className="bg-brand-purple/20 text-brand-purple hover:bg-brand-purple hover:text-white p-2.5 rounded-lg transition">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                <p className="text-xs font-semibold text-zinc-300 mb-1">2. Enlace para OBS (Overlay Transparente):</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}/${canal.slug}/overlay`} className="bg-zinc-950 p-2.5 text-xs rounded-lg border border-zinc-800 flex-1 text-zinc-300 font-mono" />
                  <button onClick={() => copiarTexto(`${window.location.origin}/${canal.slug}/overlay`, 'obs')} className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-lg">
                    {copiado === 'obs' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                <p className="text-xs font-semibold text-zinc-300 mb-1">3. Panel de Moderación:</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}/${canal.slug}/mod`} className="bg-zinc-950 p-2.5 text-xs rounded-lg border border-zinc-800 flex-1 text-zinc-300 font-mono" />
                  <button onClick={() => copiarTexto(`${window.location.origin}/${canal.slug}/mod`, 'mod')} className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-lg">
                    {copiado === 'mod' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a href={`/${canal.slug}/mod`} target="_blank" rel="noreferrer" className="bg-brand-purple/20 text-brand-purple hover:bg-brand-purple hover:text-white p-2.5 rounded-lg transition">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}