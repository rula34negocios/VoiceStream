import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Radio, Mic, Shield, ExternalLink, LogIn } from 'lucide-react';

export default function Home() {
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUsuario(user);
    });
  }, []);

  const iniciarSesionConTwitch = () => {
    supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white flex flex-col justify-between p-6">
      <header className="max-w-4xl mx-auto w-full flex justify-between items-center py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xl font-bold text-brand-purple">
          <Radio className="w-6 h-6" /> VoiceStream
        </div>
        {usuario ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-brand-purple hover:bg-brand-accent px-4 py-2 rounded-xl font-bold text-sm transition"
          >
            Ir a mi Dashboard
          </button>
        ) : (
          <button
            onClick={iniciarSesionConTwitch}
            className="bg-brand-purple hover:bg-brand-accent px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition"
          >
            <LogIn className="w-4 h-4" /> Iniciar Sesión
          </button>
        )}
      </header>

      <main className="max-w-3xl mx-auto text-center my-auto space-y-6">
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
            <p className="text-xs text-zinc-400">Los viewers pueden enviar audios de voz con límite de tiempo y tiempo extendido mediante puntos de Twitch.</p>
          </div>
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Shield className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">Moderación en Vivo</h3>
            <p className="text-xs text-zinc-400">Filtro anti-spam y panel de control directo para ti y tus moderadores antes de salir al aire.</p>
          </div>
          <div className="bg-brand-card p-5 rounded-xl border border-zinc-800 space-y-2">
            <Radio className="w-6 h-6 text-brand-purple" />
            <h3 className="font-bold">OBS Overlay</h3>
            <p className="text-xs text-zinc-400">Widget transparente con ecualizador de audio que procesa las alertas secuencialmente.</p>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-500 py-4 border-t border-zinc-800">
        VoiceStream • Plataforma Serverless para Streamers
      </footer>
    </div>
  );
}