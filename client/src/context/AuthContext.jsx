import { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

//runs once app is load, if JWT token exists in local storage, 
// calls the API to fetch the user's profile and restore the session 
// if toekn is invaild, API call fails and bad token is removed 
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


// login a registered user and called after a successful login API response 
// stores user object in state 
  function signIn(userData, token) {
    localStorage.setItem('token', token);
    setUser(userData);
    setLoading(false);
  }

// local only object with default values isGuest lets app know guests from real accounts 
// no token is stored
  function signInAsGuest() {
    setUser({ username: 'Guest', chips: 5000, wins: 0, losses: 0, isGuest: true });
    setLoading(false);
  }

// clears token from storage and resets user state to null so log out 
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
