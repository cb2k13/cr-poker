import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

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
