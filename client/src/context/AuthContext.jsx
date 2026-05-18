import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getProfile } from '../utils/api';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const handlingRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (token) {
      // Existing username/password session
      getProfile()
        .then(data => setUser(data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
      return;
    }

    // Detect if we're returning from a Google OAuth redirect.
    // Supabase appends tokens to the URL hash: #access_token=...
    // PKCE flow uses query param: ?code=...
    const isOAuthReturn =
      window.location.hash.includes('access_token') ||
      window.location.search.includes('code=');

    if (!isOAuthReturn) {
      // Normal load with no active auth — show login page
      setLoading(false);
    }
    // If it IS an OAuth return, keep loading=true so the user
    // never sees the login page. onAuthStateChange will resolve it.
  }, []);

  // Handle Supabase OAuth session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session && !localStorage.getItem('token')) {
          if (handlingRef.current) return;
          handlingRef.current = true;
          try {
            const { data } = await axios.post('/api/auth/google', {
              access_token: session.access_token,
            });
            localStorage.setItem('token', data.token);
            setUser(data);
            // Clean the OAuth tokens out of the URL without a page reload
            window.history.replaceState(null, '', window.location.pathname);
          } catch (err) {
            console.error('Google sign-in error:', err.response?.data?.error || err.message);
          } finally {
            setLoading(false);
            handlingRef.current = false;
          }
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
