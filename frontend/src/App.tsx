import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminPanel from './pages/AdminPanel';
import Catalog from './pages/Catalog';
import ClientCabinet from './pages/ClientCabinet';
import Landing from './pages/Landing';
import Login from './pages/Login';
import PsychologistCabinet from './pages/PsychologistCabinet';
import PsychologistProfile from './pages/PsychologistProfile';
import Register from './pages/Register';

/** Маршрути відповідають розділам SPA з компонентної діаграми (лаб. 2): публічні сторінки, кабінети, адмін-панель. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/psychologists/:id" element={<PsychologistProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/cabinet" element={<ProtectedRoute role="CLIENT"><ClientCabinet /></ProtectedRoute>} />
        <Route path="/psychologist" element={<ProtectedRoute role="PSYCHOLOGIST"><PsychologistCabinet /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminPanel /></ProtectedRoute>} />
        <Route path="*" element={<p>Сторінку не знайдено.</p>} />
      </Route>
    </Routes>
  );
}
