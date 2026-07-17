import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BookingFlow } from './pages/BookingFlow';
import { MyAppointmentsPage } from './pages/MyAppointmentsPage';
import { Header } from './components/Header';

const base = (import.meta.env.VITE_BASE_URL as string) || '/book/';

export function App() {
  return (
    <BrowserRouter basename={base}>
      <Header />
      <Routes>
        <Route path="/" element={<BookingFlow />} />
        <Route path="/my-appointments" element={<MyAppointmentsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
