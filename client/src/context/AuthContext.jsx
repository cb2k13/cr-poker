import { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const data = await getProfile();
          setUser(data);
        } catch {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  function signIn(userData, token) {
    localStorage.setItem('token', token);
    setUser(userData);
    setLoading(false);
  }

  function signInAsGuest() {
    setUser({ username: 'Guest', chips: 5000, wins: 0, losses: 0, isGuest: true });
    setLoading(false);
  }

  function signOut() {
    localStorage.removeItem('token');
    setUser(null);
  }

  function refreshUser(data) {
    setUser(prev => ({ ...prev, ...data }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInAsGuest, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
