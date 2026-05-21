import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { login, register } from '../../utils/api';
import SuitsBackground from './SuitsBackground';

export default function AuthPage() {
  const { signIn, signInAsGuest } = useAuth();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = tab === 'login'
        ? await login(form.username, form.password)
        : await register(form.username, form.password);
      signIn(data, data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg">
      <SuitsBackground />
      <div className="auth-card">
        <div className="auth-logo">♠️</div>
        <div className="auth-title">CR POKER</div>
        <div className="auth-subtitle">No-Limit Texas Hold'em</div>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
            Login
          </button>
          <button className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>
            Register
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              name="username"
              value={form.username}
              onChange={update}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              value={form.password}
              onChange={update}
              placeholder="Enter password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading…' : tab === 'login' ? 'ENTER THE TABLE' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="guest-btn" onClick={signInAsGuest} disabled={loading}>
          Play as Guest
        </button>

        <div style={{ marginTop: 24, padding: '16px', background: 'rgba(212,175,55,0.08)', borderRadius: 10, border: '1px solid rgba(212,175,55,0.2)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 8 }}>HOW TO PLAY</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            Texas Hold'em — You vs AI. Blinds 10/20.
            Each player starts with <strong style={{ color: '#d4af37' }}>5,000 chips</strong>.
            Best 5-card hand wins the pot.
          </div>
        </div>
      </div>
    </div>
  );
}
