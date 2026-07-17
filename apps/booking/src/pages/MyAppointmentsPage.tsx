import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MyAppointment, ApiError } from '../api';
import { AuthModal } from '../components/AuthModal';
import type { BookingAccount } from '../api';

export function MyAppointmentsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const envId = (import.meta.env.VITE_TENANT_ID as string | undefined) ?? '';
  const tenantId = localStorage.getItem('booking_tenant') ?? envId;

  // No tenantId means patient arrived directly without a clinic link — send back
  useEffect(() => {
    if (!tenantId) navigate('/', { replace: true });
  }, [tenantId, navigate]);

  function load() {
    const token = localStorage.getItem('booking_token');
    if (!token) { setLoading(false); setAuthOpen(true); return; }
    api.myAppointments()
      .then(setAppointments)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) { setAuthOpen(true); }
        else setError(e instanceof Error ? e.message : 'Failed to load.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (tenantId) load();
  }, []);

  async function cancelAppt(id: string) {
    if (!confirm('Cancel this appointment?')) return;
    setCancellingId(id);
    try {
      await api.cancel(id);
      setSuccessMsg('Appointment cancelled.');
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelled' } : a));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not cancel.');
    } finally {
      setCancellingId(null);
    }
  }

  function chipClass(status: string): string {
    const map: Record<string, string> = {
      booked: 'chip chip-booked',
      confirmed: 'chip chip-confirmed',
      completed: 'chip chip-completed',
      cancelled: 'chip chip-cancelled',
      no_show: 'chip chip-no_show',
    };
    return map[status] ?? 'chip';
  }

  function handleAuthSuccess(acc: BookingAccount) {
    localStorage.setItem('booking_account', JSON.stringify(acc));
    setAuthOpen(false);
    window.dispatchEvent(new CustomEvent('booking-auth-changed'));
    setLoading(true);
    load();
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
        <h2 className="section-title" style={{ margin: 0 }}>My Appointments</h2>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {loading && <div className="spinner" />}

      {!loading && !authOpen && appointments.length === 0 && (
        <div className="alert alert-info">
          You have no appointments yet.
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate('/')}>
            Book Now
          </button>
        </div>
      )}

      {appointments.map((a) => (
        <div key={a.id} className="card">
          <div className="appt-row">
            <div className="appt-token">#{a.tokenNumber}</div>
            <div className="appt-info">
              <div className="appt-doctor">Dr. {a.doctor?.name ?? '—'}</div>
              {a.doctor?.specialization && <div className="appt-date">{a.doctor.specialization}</div>}
              <div className="appt-date">
                {new Date(a.appointmentDate + 'T00:00:00').toLocaleDateString('en', {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                })}
                {a.doctor?.roomNumber && ` · Room ${a.doctor.roomNumber}`}
              </div>
              {a.notes && <div className="appt-date" style={{ fontStyle: 'italic', marginTop: 4 }}>"{a.notes}"</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              <span className={chipClass(a.status)}>{a.status.replace('_', ' ')}</span>
              {(a.status === 'booked' || a.status === 'confirmed') && (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={cancellingId === a.id}
                  onClick={() => cancelAppt(a.id)}
                >
                  {cancellingId === a.id ? '…' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {authOpen && tenantId && (
        <AuthModal tenantId={tenantId} onSuccess={handleAuthSuccess} onClose={() => navigate('/')} />
      )}
    </div>
  );
}
