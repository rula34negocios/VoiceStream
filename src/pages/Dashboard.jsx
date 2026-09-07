import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Radio, Copy, Check, LogIn, ExternalLink, ShieldCheck, UserCheck, Eye, EyeOff, AlertTriangle, Sparkles, Trash2, Plus } from 'lucide-react';

export default function Dashboard() {
  const [usuario, setUsuario] = useState(null);
  const [canal, setCanal] = useState(null);
  const [moderadores, setModeradores] = useState([]);
  const [paquetes, setPaquetes] = useState([]);
  const [nombreCanal, setNombreCanal] = useState('');
  const [slug, setSlug] = useState('');
  const [copiado, setCopiado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [mostrarEnlaceMod, setMostrarEnlaceMod] = useState(false);

  // Estados para crear paquetes de tiempo
  const [nuevoSegundos, setNuevoSegundos] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState('');

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
        await cargarPaquetes(canalData.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const cargarModeradores = async (canalId) => {
    const { data } = await supabase
      .from('canal_moderadores')
      .select(`
        id,
        estado,
        perfiles:usuario_id (twitch_username, avatar_url)
      `)
      .eq('canal_id', canalId);

    if (data) setModeradores(data);
  };

  const cargarPaquetes = async (canalId) => {
    const { data } = await supabase
      .from('canal_paquetes_tiempo')
      .select('*')
      .eq('canal_id', canalId)
      .order('segundos', { ascending: true });

    if (data) setPaquetes(data);
  };

  const crearPaquete = async (e) => {
    e.preventDefault();
    if (!nuevoSegundos || !nuevoCosto || !canal) return;

    const { error } = await supabase.from('canal_paquetes_tiempo').insert([
      {
        canal_id: canal.id,
        segundos: parseInt(nuevoSegundos),
        costo_puntos: parseInt(nuevoCosto)
      }
    ]);

    if (!error) {
      setNuevoSegundos('');
      setNuevoCosto('');
      await cargarPaquetes(canal.id);
    } else {
      alert('Error al crear el paquete.');
    }
  };

  const eliminarPaquete = async (paqueteId) => {
    const { error } = await supabase
      .from('canal_paquetes_tiempo')
      .delete()
      .eq('id', paqueteId);

    if (!error && canal) {
      await cargarPaquetes(canal.id);
    }
  };

  const iniciarSesionTwitch = () => {
    supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: window.location.origin }
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
      await cargarPaquetes(data.id);
    }
  };

  const copiarTexto = (texto, tipo) => {
    navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    setTimeout(() => setCopiado(''), 2000);
  };

  if (cargando) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-zinc-400">Cargando tu panel...</div>;

  if (!usuario) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
        <div className="bg-brand-card p-8 rounded-2xl border border-zinc-800 text-center max-w-sm w-full space-y-4">
          <Radio className="w-12 h-12 text-brand-purple mx-auto" />
          <h1 className="text-2xl font-bold text-white">VoiceStream</h1>
          <button onClick={iniciarSesionTwitch} className="w-full bg-brand-purple hover:bg-brand-accent text-white font-bold py-3 rounded-xl transition">
            Iniciar Sesión con Twitch
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
          <button onClick={() => supabase.auth.signOut()} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-300">
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
            <button onClick={crearCanal} className="bg-brand-purple hover:bg-brand-accent px-6 py-2.5 rounded-lg font-bold text-sm transition">
              Guardar y Crear Canal
            </button>
          </div>
        ) : (
          <div className="bg-brand-card p-6 rounded-xl border border-zinc-800 space-y-6">
            <div>
              <span className="text-xs text-brand-purple font-bold uppercase tracking-wider">Canal Activo</span>
              <h2 className="text-2xl font-bold">{canal.nombre_canal}</h2>
            </div>

            {/* ENLACES DEL CANAL */}
            <div className="space-y-4">
              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                <p className="text-xs font-semibold text-zinc-300 mb-1">1. Enlace para Espectadores:</p>
                <div className="flex gap-2">
                  <input readOnly value={`${window.location.origin}/${canal.slug}`} className="bg-zinc-950 p-2.5 text-xs rounded-lg border border-zinc-800 flex-1 text-zinc-300 font-mono" />
                  <button onClick={() => copiarTexto(`${window.location.origin}/${canal.slug}`, 'envio')} className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-lg">
                    {copiado === 'envio' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a href={`/${canal.slug}`} target="_blank" rel="noreferrer" className="bg-brand-purple/20 text-brand-purple p-2.5 rounded-lg">
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
                  <a href={`/${canal.slug}/mod`} target="_blank" rel="noreferrer" className="bg-brand-purple/20 text-brand-purple p-2.5 rounded-lg">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* CONFIGURACIÓN DE PAQUETES DE TIEMPO POR PUNTOS */}
            <div className="border-t border-zinc-800 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-purple" /> Configurar Opciones de Puntos por Tiempo
              </h3>
              <p className="text-xs text-zinc-400">
                Añade paquetes para que tus espectadores sepan cuántos puntos cuesta canjear segundos adicionales.
              </p>

              <form onSubmit={crearPaquete} className="flex gap-2">
                <input
                  type="number"
                  placeholder="Segundos (Ej: 15)"
                  value={nuevoSegundos}
                  onChange={(e) => setNuevoSegundos(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs flex-1 text-white focus:outline-none focus:border-brand-purple"
                />
                <input
                  type="number"
                  placeholder="Costo en Puntos (Ej: 300)"
                  value={nuevoCosto}
                  onChange={(e) => setNuevoCosto(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs flex-1 text-white focus:outline-none focus:border-brand-purple"
                />
                <button type="submit" className="bg-brand-purple hover:bg-brand-accent text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Añadir
                </button>
              </form>

              {/* Lista de paquetes creados */}
              <div className="space-y-2 mt-2">
                {paquetes.map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-200">
                      +{pkg.segundos} Segundos de grabación
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-brand-purple font-bold">{pkg.costo_puntos} Puntos</span>
                      <button onClick={() => eliminarPaquete(pkg.id)} className="text-red-500 hover:text-red-400 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN DE INVITACIÓN A MODERADORES */}
            <div className="border-t border-zinc-800 pt-6 space-y-4">
              <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Enlace de Invitación para Moderadores:
                  </p>
                  <button
                    onClick={() => setMostrarEnlaceMod(!mostrarEnlaceMod)}
                    className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition"
                  >
                    {mostrarEnlaceMod ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {mostrarEnlaceMod ? 'Ocultar Enlace' : 'Mostrar Enlace'}
                  </button>
                </div>

                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-amber-200 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>Advertencia:</strong> No muestres este enlace en directo. Cualquier persona que entre podrá registrarse como moderador de tu canal.</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type={mostrarEnlaceMod ? "text" : "password"}
                    readOnly
                    value={`${window.location.origin}/invitacion/${canal.slug}`}
                    className="bg-zinc-950 p-2.5 text-xs rounded-lg border border-zinc-800 flex-1 text-zinc-300 font-mono tracking-widest"
                  />
                  <button
                    onClick={() => copiarTexto(`${window.location.origin}/invitacion/${canal.slug}`, 'invitacion')}
                    className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-lg"
                    title="Copiar Enlace"
                  >
                    {copiado === 'invitacion' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2 text-zinc-300">
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
          </div>
        )}
      </div>
    </div>
  );
}