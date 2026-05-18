import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/Auth/AuthPage';
import GamePage from './components/Game/GamePage';

function AppInner() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <div style={{ fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: 24, letterSpacing: 3 }}>
          LOADING…
        </div>
      </div>
    );
  }
  return user ? <GamePage /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
