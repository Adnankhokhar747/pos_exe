import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type BookingAccount } from '../api';

export function Header() {
  const [account, setAccount] = useState<BookingAccount | null>(null);
  const navigate = useNavigate();

  function refresh() {
    const token = localStorage.getItem('booking_token');
    if (!token) { setAccount(null); return; }
    api.me().then(setAccount).catch(() => {
      localStorage.removeItem('booking_token');
      localStorage.removeItem('booking_account');
      setAccount(null);
    });
  }

  useEffect(() => {
    refresh();
    window.addEventListener('booking-auth-changed', refresh);
    return () => window.removeEventListener('booking-auth-changed', refresh);
  }, []);

  function logout() {
    localStorage.removeItem('booking_token');
    localStorage.removeItem('booking_account');
    setAccount(null);
    window.dispatchEvent(new CustomEvent('booking-auth-changed'));
    navigate('/');
  }

  return (
    <div className="header">
      <div className="header-inner">
        <h1>🏥 Book Appointment</h1>
        <div className="header-actions">
          {account ? (
            <>
              <span className="user-badge">👤 {account.name}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/my-appointments')}>
                My Bookings
              </button>
              <button className="btn btn-secondary btn-sm" onClick={logout}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
