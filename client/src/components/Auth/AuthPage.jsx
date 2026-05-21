import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { login, register } from '../../utils/api';
import { supabase } from '../../utils/supabase';
import SuitsBackground from './SuitsBackground';

export default function AuthPage() {
  const { signIn, signInAsGuest } = useAuth();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(window.__googleAuthError || '');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Clear the global error after reading it
  if (window.__googleAuthError) window.__googleAuthError = null;

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

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // On success the page redirects — no further action needed here
  }

  return (
    <div className="auth-bg">
      <SuitsBackground />
      <div className="auth-card">
        <div className="auth-logo">♠️</div>
        <div className="auth-title">CR POKER</div>
        <div className="auth-subtitle">Heads-Up Texas Hold'em</div>

        {/* Google sign-in */}
        <button
          className="google-btn"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.4C9.7 35.5 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
        </button>

        <div className="auth-divider"><span>or</span></div>

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
          <button className="btn-primary" type="submit" disabled={loading || googleLoading}>
            {loading ? 'Loading…' : tab === 'login' ? 'ENTER THE TABLE' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button
          className="guest-btn"
          onClick={signInAsGuest}
          disabled={loading || googleLoading}
        >
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
