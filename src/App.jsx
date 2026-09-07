import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import SendAudio from './pages/SendAudio';
import Moderation from './pages/Moderation';
import Overlay from './pages/Overlay';
import AcceptInvite from './pages/AcceptInvite';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/invitacion/:slug" element={<AcceptInvite />} />
      <Route path="/:slug" element={<SendAudio />} />
      <Route path="/:slug/mod" element={<Moderation />} />
      <Route path="/:slug/overlay" element={<Overlay />} />
      {/* Redirección por defecto si la ruta no existe */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}