import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importación de Páginas
import SendAudio from './pages/SendAudio';
import Moderation from './pages/Moderation';
import Overlay from './pages/Overlay';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Panel del Streamer */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Rutas por Canal de Streamer */}
        <Route path="/:slug" element={<SendAudio />} />
        <Route path="/:slug/mod" element={<Moderation />} />
        <Route path="/:slug/overlay" element={<Overlay />} />

        {/* Página Principal por defecto */}
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}