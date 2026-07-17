import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type BookingDoctor, type DayAvailability, type BookingAccount } from '../api';
import { CalendarPicker } from '../components/CalendarPicker';
import { AuthModal } from '../components/AuthModal';

type Step = 'doctor' | 'date' | 'confirm' | 'done';

function tenantIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const envId = (import.meta.env.VITE_TENANT_ID as string | undefined) ?? '';
  return params.get('t') ?? localStorage.getItem('booking_tenant') ?? envId;
}

export function BookingFlow() {
  const navigate = useNavigate();
  const [tenantId] = useState(tenantIdFromUrl);

  const [step, setStep] = useState<Step>('doctor');
  const [doctors, setDoctors] = useState<BookingDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedDoctor, setSelectedDoctor] = useState<BookingDoctor | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const [selectedDay, setSelectedDay] = useState<DayAvailability | null>(null);
  const [notes, setNotes] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [account, setAccount] = useState<BookingAccount | null>(() => {
    const s = localStorage.getItem('booking_account');
    return s ? (JSON.parse(s) as BookingAccount) : null;
  });
  const [booking, setBooking] = useState(false);
  const [bookedResult, setBookedResult] = useState<{ tokenNumber: number; doctorName: string; date: string } | null>(null);

  useEffect(() => {
    if (tenantId) localStorage.setItem('booking_tenant', tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) { setLoadingDoctors(false); return; }
    api.doctors(tenantId)
      .then(setDoctors)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoadingDoctors(false));
  }, [tenantId]);

  function selectDoctor(d: BookingDoctor) {
    setSelectedDoctor(d);
    setAvailability([]);
    setSelectedDay(null);
    setLoadingAvail(true);
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    api.availability(d.id, tenantId, today, in60)
      .then(setAvailability)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoadingAvail(false));
    setStep('date');
  }

  function selectDay(day: DayAvailability) {
    if (!day.available) return;
    setSelectedDay(day);
    setStep('confirm');
  }

  async function confirmBooking() {
    if (!selectedDoctor || !selectedDay) return;
    if (!account) { setAuthOpen(true); return; }
    setBooking(true);
    setErrorMsg('');
    try {
      const result = await api.book(selectedDoctor.id, selectedDay.date, notes);
      setBookedResult({ tokenNumber: result.tokenNumber, doctorName: result.doctorName, date: result.appointmentDate });
      setStep('done');
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Booking failed.');
    } finally {
      setBooking(false);
    }
  }

  function handleAuthSuccess(acc: BookingAccount) {
    setAccount(acc);
    localStorage.setItem('booking_account', JSON.stringify(acc));
    setAuthOpen(false);
    window.dispatchEvent(new CustomEvent('booking-auth-changed'));
  }

  const stepIdx = { doctor: 0, date: 1, confirm: 2, done: 3 };

  if (!tenantId) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏥</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: '#2d3748' }}>
          Welcome to Online Booking
        </h2>
        <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
          Please use the booking link provided by your clinic. It looks like:
        </p>
        <div className="alert alert-info" style={{ fontFamily: 'monospace', fontSize: '0.85rem', display: 'inline-block' }}>
          https://posvan.taqaantech.com/book/?t=YOUR_CLINIC_ID
        </div>
        <p style={{ color: '#a0aec0', fontSize: '0.78rem', marginTop: 16 }}>
          Contact your clinic reception to get your personal booking link.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Step indicator */}
      {step !== 'done' && (
        <div className="steps" style={{ marginBottom: 28 }}>
          {['Doctor', 'Date', 'Confirm'].map((label, i) => (
            <Fragment key={label}>
              <div
                className={`step-dot ${stepIdx[step] > i ? 'done' : stepIdx[step] === i ? 'active' : 'pending'}`}
                title={label}
              >
                {stepIdx[step] > i ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div className={`step-line ${stepIdx[step] > i ? 'done' : ''}`} />
              )}
            </Fragment>
          ))}
        </div>
      )}

      {errorMsg && <div className="alert alert-error">{errorMsg} <button style={{marginLeft:8,background:'none',border:'none',cursor:'pointer',fontWeight:700}} onClick={() => setErrorMsg('')}>×</button></div>}

      {/* Step 1: Doctor selection */}
      {step === 'doctor' && (
        <>
          <div className="section-title">Select a Doctor</div>
          <div className="section-sub">Choose the doctor you'd like to see</div>
          {loadingDoctors && <div className="spinner" />}
          {!loadingDoctors && doctors.length === 0 && (
            <div className="alert alert-info">No doctors available for online booking at this time.</div>
          )}
          {doctors.map((d) => (
            <div key={d.id} className="card" style={{ cursor: 'pointer' }} onClick={() => selectDoctor(d)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ebf8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                  🩺
                </div>
                <div style={{ flex: 1 }}>
                  <div className="card-title">{d.name}</div>
                  <div className="card-sub">{d.specialization ?? 'General Practice'}</div>
                  {d.room_number && <div className="card-sub">Room {d.room_number}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {parseFloat(d.consultation_fee) > 0 && (
                    <div style={{ fontWeight: 700, color: '#2b6cb0' }}>${parseFloat(d.consultation_fee).toFixed(2)}</div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#718096' }}>Max {d.max_daily_appointments}/day</div>
                  <div style={{ marginTop: 8 }}>
                    <span className="btn btn-primary btn-sm">Select →</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Step 2: Date selection */}
      {step === 'date' && selectedDoctor && (
        <>
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => setStep('doctor')}>
            ← Back
          </button>
          <div className="section-title">Choose a Date</div>
          <div className="section-sub">
            Dr. {selectedDoctor.name} · Green dates are available for booking
          </div>
          {loadingAvail ? (
            <div className="spinner" />
          ) : (
            <CalendarPicker availability={availability} onSelect={selectDay} />
          )}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.82rem', color: '#718096', display: 'flex', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#3182ce', display: 'inline-block' }} /> Available
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0', display: 'inline-block' }} /> Unavailable / Full
              </span>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedDoctor && selectedDay && (
        <>
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => setStep('date')}>
            ← Back
          </button>
          <div className="section-title">Confirm Appointment</div>

          <div className="token-badge">
            <div className="token-label">Your token number will be</div>
            <div className="token-num">#{selectedDay.nextToken}</div>
            <div className="token-label" style={{ marginTop: 6 }}>
              {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#718096', fontSize: '0.85rem' }}>Doctor</span>
                <span style={{ fontWeight: 600 }}>Dr. {selectedDoctor.name}</span>
              </div>
              {selectedDoctor.specialization && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#718096', fontSize: '0.85rem' }}>Specialization</span>
                  <span>{selectedDoctor.specialization}</span>
                </div>
              )}
              {selectedDoctor.room_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#718096', fontSize: '0.85rem' }}>Room</span>
                  <span>Room {selectedDoctor.room_number}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#718096', fontSize: '0.85rem' }}>Slots filled</span>
                <span>{selectedDay.bookedCount} / {selectedDay.maxAppointments}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <input
              placeholder="Any symptoms or notes for the doctor…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {account ? (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              Booking as <strong>{account.name}</strong> ({account.email})
            </div>
          ) : (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              You need to <strong>login or register</strong> to confirm your booking.
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            disabled={booking}
            onClick={confirmBooking}
          >
            {booking ? 'Booking…' : account ? '✓ Confirm Booking' : 'Login & Confirm →'}
          </button>
        </>
      )}

      {/* Step 4: Done */}
      {step === 'done' && bookedResult && (
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div className="success-icon">✅</div>
          <div className="section-title">Appointment Booked!</div>
          <div className="token-badge" style={{ maxWidth: 320, margin: '20px auto' }}>
            <div className="token-label">Your Token Number</div>
            <div className="token-num">#{bookedResult.tokenNumber}</div>
            <div className="token-label" style={{ marginTop: 6 }}>
              Dr. {bookedResult.doctorName} · {new Date(bookedResult.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: 24 }}>
            Please arrive at the clinic and wait for your token to be called.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => { setStep('doctor'); setSelectedDoctor(null); setSelectedDay(null); setNotes(''); setBookedResult(null); }}>
              Book Another
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/my-appointments')}>
              View My Bookings
            </button>
          </div>
        </div>
      )}

      {authOpen && (
        <AuthModal
          tenantId={tenantId}
          onSuccess={handleAuthSuccess}
          onClose={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
}
