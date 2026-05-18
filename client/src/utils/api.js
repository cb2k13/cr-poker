import axios from 'axios';

// In dev: Vite proxies /api → localhost:3001
// In production: VITE_API_URL points to the Render backend
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const register = (username, password) =>
  api.post('/register', { username, password }).then(r => r.data);

export const login = (username, password) =>
  api.post('/login', { username, password }).then(r => r.data);

export const getProfile = () =>
  api.get('/profile').then(r => r.data);

export const updateStats = (won, chipsChange) =>
  api.post('/stats', { won, chipsChange }).then(r => r.data);

export const getLeaderboard = () =>
  api.get('/leaderboard').then(r => r.data);
