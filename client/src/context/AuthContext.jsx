import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getProfile } from '../utils/api';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const processingRef = useRef(false);

  // Exchange a Supabase Google session for our own JWT
  async function handleGoogleSession(accessToken) {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const { data } = await axios.post(`${API_BASE}/auth/google`, {
        access_token: accessToken,
      });
      localStorage.setItem('token', data.token);
      setUser(data);
      // Strip OAuth params from the URL bar
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) {
      console.error('Google auth failed:', err.response?.data?.error || err.message);
    } finally {
      processingRef.current = false;
    }
  }

  // On mount: restore session (JWT or active Supabase session)
  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token');

      if (token) {
        // Existing username/password session
        try {
          const data = await getProfile();
          setUser(data);
        } catch {
          localStorage.removeItem('token');
        }
        setLoading(false);
        return;
      }

      // Check if Supabase already has a session (covers OAuth redirect return).
      // getSession() works even after Supabase has cleaned the ?code= from the URL.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handleGoogleSession(session.access_token);
      }

      setLoading(false);
    }

    init();
  }, []);

  // Also catch sign-ins that happen while the app is already loaded
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session && !localStorage.getItem('token')) {
          await handleGoogleSession(session.access_token);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  function signIn(userData, token) {
    localStorage.setItem('token', token);
    setUser(userData);
    setLoading(false);
  }

  async function signOut() {
    localStorage.removeItem('token');
    setUser(null);
    await supabase.auth.signOut();
  }

  function refreshUser(data) {
    setUser(prev => ({ ...prev, ...data }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
