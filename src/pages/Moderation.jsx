import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Check, X, Shield, Trash2, UserPlus, Volume2, Star, Heart, Play, Home } from 'lucide-react';

export default function Moderation() {
  const navigate = useNavigate();
  const { slug } = useParams();
  
  const [canal, setCanal] = useState(null);
  const [audios, setAudios] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [moderadores, setModeradores] = useState([]);
  const [nuevoModUsername, setNuevoModUsername] = useState('');
  const [esPropietario, setEsPropietario] = useState(false);
  const [invitacionPendiente, setInvitacionPendiente] = useState(false);
  const [esModeradorAprobado, setEsModeradorAprobado] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [verFavoritosTab, setVerFavoritosTab] = useState(false);

  useEffect(() => {
    inicializarPanel();
  }, [slug]);

  const inicializarPanel = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUsuarioActual(user);

      const { data: canalData } = await supabase
        .from('canales')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!canalData) return;
      setCanal(canalData);

      if (user) {
        if (canalData.propietario_id === user.id) {
          setEsPropietario(true);
          setEsModeradorAprobado(true);
        } else {
          const { data: modData } = await supabase
            .from('canal_moderadores')
            .select('*')
            .eq('canal_id', canalData.id)
            .eq('usuario_id', user.id)
            .maybeSingle();

          if (modData) {
            if (modData.estado === 'aprobado') setEsModeradorAprobado(true);
            if (modData.estado === 'pendiente') setInvitacionPendiente(true);
          }
        }
      }

      cargarAudiosPendientes(canalData.id);
      cargarFavoritos(canalData.id);
      cargarModeradores(canalData.id);

      const canalRealtime = supabase
        .channel(`audios-mod-${canalData.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audios', filter: `canal_id=eq.${canalData.id}` }, () => {
          cargarAudiosPendientes(canalData.id);
        })
        .subscribe();

      return () => supabase.removeChannel(canalRealtime);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const cargarAudiosPendientes = async (canalId) => {
    const { data } = await supabase
      .from('audios')
      .select('*, perfiles(twitch_username)')
      .eq('canal_id', canalId)
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending: true });

    setAudios(data || []);
  };

  const cargarFavoritos = async (canalId) => {
    const { data } = await supabase
      .from('favoritos')
      .select('*')
      .eq('canal_id', canalId)
      .order('creado_en', { ascending: false });

    setFavoritos(data || []);
  };

  const cargarModeradores = async (canalId) => {
    const { data } = await supabase
      .from('canal_moderadores')
      .select('usuario_id, estado, perfiles(twitch_username)')
      .eq('canal_id', canalId);

    setModeradores(data || []);
  };

  const cambiarEstadoAudio = async (audioId, nuevoEstado) => {
    await supabase.from('audios').update({ estado: nuevoEstado }).eq('id', audioId);
    setAudios((prev) => prev.filter((a) => a.id !== audioId));
  };

  const guardarFavorito = async (audio) => {
    if (favoritos.length >= 15) {
      alert('Has alcanzado el límite máximo de 15 audios favoritos.');
      return;
    }

    const { data, error } = await supabase.from('favoritos').insert([
      {
        canal_id: canal.id,
        usuario_id: usuarioActual.id,
        titulo: audio.titulo,
        url_archivo: audio.url_archivo,
        duracion_segundos: audio.duracion_segundos
      }
    ]).select().single();

    if (!error && data) {
      setFavoritos((prev) => [data, ...prev]);
      alert('¡Audio guardado en Favoritos!');
    } else {
      alert('Error al guardar el favorito.');
    }
  };

  const eliminarFavorito = async (favId) => {
    await supabase.from('favoritos').delete().eq('id', favId);
    setFavoritos((prev) => prev.filter((f) => f.id !== favId));
  };

  const enviarFavoritoAObs = async (fav) => {
    if (!canal || !usuarioActual) return;

    const { error } = await supabase.from('audios').insert([
      {
        canal_id: canal.id,
        usuario_id: usuarioActual.id,
        titulo: `[Favorito] ${fav.titulo}`,
        url_archivo: fav.url_archivo,
        duracion_segundos: fav.duracion_segundos,
        es_anonimo: false,
        estado: 'aprobado'
      }
    ]);

    if (!error) {
      alert(`¡"${fav.titulo}" se está reproduciendo en OBS!`);
    } else {
      console.error(error);
      alert('Error al enviar el audio a OBS.');
    }
  };

  const responderInvitacion = async (aceptar) => {
    if (aceptar) {
      await supabase
        .from('canal_moderadores')
        .update({ estado: 'aprobado' })
        .eq('canal_id', canal.id)
        .eq('usuario_id', usuarioActual.id);
      setEsModeradorAprobado(true);
    } else {
      await supabase
        .from('canal_moderadores')
        .delete()
        .eq('canal_id', canal.id)
        .eq('usuario_id', usuarioActual.id);
    }
    setInvitacionPendiente(false);
  };

  const enviarInvitacionMod = async () => {
    if (!nuevoModUsername.trim() || !canal) return;

    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('id')
      .eq('twitch_username', nuevoModUsername.trim().toLowerCase())
      .maybeSingle();

    if (!perfilData) {
      alert('El usuario debe haber iniciado sesión en VoiceStream al menos una vez.');
      return;
    }

    const { error } = await supabase.from('canal_moderadores').insert([
      { canal_id: canal.id, usuario_id: perfilData.id, estado: 'pendiente' }
    ]);

    if (!error) {
      setNuevoModUsername('');
      cargarModeradores(canal.id);
      alert('Invitación de moderador enviada.');
    }
  };

  const eliminarModerador = async (usuarioId) => {
    await supabase
      .from('canal_moderadores')
      .delete()
      .eq('canal_id', canal.id)
      .eq('usuario_id', usuarioId);

    cargarModeradores(canal.id);
  };

  if (cargando) return <div className="p-10 text-center text-zinc-400">Cargando moderación...</div>;
  if (!canal) return <div className="p-10 text-center text-red-500">Canal no encontrado.</div>;

  return (
    <div className="min-h-screen bg-brand-dark text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {invitacionPendiente && (
          <div className="bg-brand-purple/20 border border-brand-purple p-4 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">¡Invitación de Moderación!</h3>
              <p className="text-xs text-zinc-300">Te han invitado a ser moderador del canal <span className="font-semibold">{canal.nombre_canal}</span>.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => responderInvitacion(true)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                Aceptar
              </button>
              <button onClick={() => responderInvitacion(false)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                Rechazar
              </button>
            </div>
          </div>
        )}

        {/* Encabezado con Botón de Inicio */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-2 rounded-xl border border-zinc-800 text-xs font-semibold transition"
            >
              <Home className="w-4 h-4 text-brand-purple" />
              <span>Inicio</span>
            </button>

            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-brand-purple" /> Moderación: {canal.nombre_canal}
            </h1>
          </div>

          <button
            onClick={() => setVerFavoritosTab(!verFavoritosTab)}
            className="bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
          >
            <Star className="w-4 h-4 fill-amber-400" />
            Favoritos ({favoritos.length}/15)
          </button>
        </div>

        {verFavoritosTab && (
          <div className="bg-brand-card border border-amber-500/30 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-400" /> Colección de Audios Favoritos ({favoritos.length}/15)
            </h3>
            {favoritos.length === 0 ? (
              <p className="text-xs text-zinc-500">No hay audios guardados en favoritos.</p>
            ) : (
              <div className="grid gap-3">
                {favoritos.map((fav) => (
                  <div key={fav.id} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-white flex-1">{fav.titulo}</span>
                    <audio src={fav.url_archivo} controls className="h-8 w-48" />
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => enviarFavoritoAObs(fav)}
                        className="bg-brand-purple hover:bg-brand-accent text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Enviar a OBS
                      </button>

                      <button onClick={() => eliminarFavorito(fav.id)} className="text-red-500 hover:text-red-400 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {esModeradorAprobado ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Volume2 className="text-brand-purple" /> Pendientes por Revisar ({audios.length})
            </h2>

            {audios.length === 0 ? (
              <div className="bg-brand-card border border-zinc-800 p-8 rounded-xl text-center text-zinc-500">
                No hay audios pendientes en la cola.
              </div>
            ) : (
              <div className="grid gap-4">
                {audios.map((audio) => (
                  <div key={audio.id} className="bg-brand-card border border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{audio.titulo}</span>
                        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                          {audio.es_anonimo ? 'Anónimo' : `@${audio.perfiles?.twitch_username || 'Usuario'}`}
                        </span>
                      </div>
                      <audio src={audio.url_archivo} controls className="w-full mt-2 h-8" />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => guardarFavorito(audio)}
                        title="Guardar en Favoritos"
                        className="bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black p-3 rounded-xl transition"
                      >
                        <Heart className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => cambiarEstadoAudio(audio.id, 'aprobado')}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl flex items-center gap-1 font-semibold transition text-sm"
                      >
                        <Check className="w-4 h-4" /> Aprobar
                      </button>
                      <button
                        onClick={() => cambiarEstadoAudio(audio.id, 'rechazado')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl flex items-center gap-1 font-semibold transition text-sm"
                      >
                        <X className="w-4 h-4" /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-brand-card p-6 rounded-xl text-center text-zinc-400">
            Debes ser moderador del canal para revisar la cola de audios.
          </div>
        )}

        {esPropietario && (
          <div className="bg-brand-card border border-zinc-800 p-6 rounded-xl space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UserPlus className="text-brand-purple" /> Moderadores del Canal
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre de usuario de Twitch del Mod"
                value={nuevoModUsername}
                onChange={(e) => setNuevoModUsername(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm flex-1 focus:outline-none focus:border-brand-purple"
              />
              <button onClick={enviarInvitacionMod} className="bg-brand-purple hover:bg-brand-accent px-4 py-2 rounded-lg font-semibold text-sm">
                Enviar Invitación
              </button>
            </div>

            <div className="space-y-2 mt-4">
              {moderadores.map((mod) => (
                <div key={mod.usuario_id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">@{mod.perfiles?.twitch_username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${mod.estado === 'aprobado' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {mod.estado === 'aprobado' ? 'Activo' : 'Invitación Pendiente'}
                    </span>
                  </div>
                  <button onClick={() => eliminarModerador(mod.usuario_id)} className="text-red-500 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}