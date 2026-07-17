import { useState } from 'react';
import { api, type BookingAccount, ApiError } from '../api';

interface Props {
  tenantId: string;
  onSuccess: (account: BookingAccount) => void;
  onClose: () => void;
}

export function AuthModal({ tenantId, onSuccess, onClose }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let result: { token: string; account: BookingAccount };
      if (tab === 'login') {
        result = await api.login(tenantId, email, password);
      } else {
        result = await api.register(tenantId, name, email, password, phone);
      }
      localStorage.setItem('booking_token', result.token);
      localStorage.setItem('booking_account', JSON.stringify(result.account));
      onSuccess(result.account);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {tab === 'login' ? 'Login to Book' : 'Create Account'}
          </h2>
          <button style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#718096' }} onClick={onClose}>×</button>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>Login</button>
          <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>Register</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          {tab === 'register' && (
            <div className="form-group">
              <label>Full Name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoFocus />
            </div>
          )}
          <div className="form-group">
            <label>Email *</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoFocus={tab === 'login'} />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tab === 'register' ? 'At least 6 characters' : '••••••••'} />
          </div>
          {tab === 'register' && (
            <div className="form-group">
              <label>Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8901" />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Login & Confirm →' : 'Register & Confirm →'}
          </button>
        </form>

        {tab === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.85rem', color: '#718096' }}>
            No account?{' '}
            <button style={{ background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setTab('register'); setError(''); }}>
              Register here
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
