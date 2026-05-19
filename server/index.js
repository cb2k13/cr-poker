require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — only allow known frontend origins ──────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://cr-poker.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server / curl (no origin header) only in development
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '16kb' }));

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

supabase.from('users').select('id').limit(1)
  .then(() => console.log('✓ Connected to Supabase'))
  .catch(err => console.error('✗ Supabase connection error:', err.message));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

const statsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // ~1 hand per second is plenty
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
app.post('/api/register', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username ≥3 chars, password ≥6 chars' });
  }
  if (username.length > 18) {
    return res.status(400).json({ error: 'Username must be ≤18 chars' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase
      .from('users')
      .insert({ username, password: hash })
      .select('id, username, chips, wins, losses')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Username already taken' });
      throw error;
    }

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: data.username, chips: data.chips, wins: data.wins, losses: data.losses });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
app.post('/api/auth/google', authLimiter, async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) return res.status(400).json({ error: 'Missing token' });

  try {
    const { data: { user: googleUser }, error } = await supabase.auth.getUser(access_token);
    if (error || !googleUser) {
      console.error('getUser failed:', error?.message, error?.status);
      return res.status(401).json({ error: 'Google authentication failed' });
    }

    const authId = googleUser.id;
    const email  = googleUser.email || '';
    const displayName = googleUser.user_metadata?.full_name
      || googleUser.user_metadata?.name
      || email.split('@')[0]
      || 'player';

    const { data: existing } = await supabase
      .from('users')
      .select('id, username, chips, wins, losses')
      .eq('auth_id', authId)
      .single();

    if (existing) {
      const token = jwt.sign({ id: existing.id, username: existing.username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, username: existing.username, chips: existing.chips, wins: existing.wins, losses: existing.losses });
    }

    // New Google user — generate a unique username
    let username = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
    if (username.length < 3) username = ('player' + username).slice(0, 18);
    const { data: taken } = await supabase.from('users').select('username').eq('username', username).single();
    if (taken) username = (username + Math.floor(Math.random() * 9000 + 1000)).slice(0, 18);

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({ username, password: '', auth_id: authId })
      .select('id, username, chips, wins, losses')
      .single();

    if (insertErr) throw insertErr;

    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: newUser.username, chips: newUser.chips, wins: newUser.wins, losses: newUser.losses });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  // Validate inputs before hitting the DB
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    // Timing-safe: always compare even when user not found (prevents timing attacks)
    const hash = user?.password || '$2a$12$invalidhashpaddingtomakeitconstanttime';
    const valid = user && await bcrypt.compare(password, hash);

    if (error || !user || !valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, chips: user.chips, wins: user.wins, losses: user.losses });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────────
app.get('/api/profile', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, chips, wins, losses')
      .eq('id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Update stats + log hand history ──────────────────────────────────────────
const MAX_CHIPS_SWING = 20000; // sanity cap: no single hand can move more than this

app.post('/api/stats', auth, statsLimiter, async (req, res) => {
  const { won, chipsChange = 0, handData } = req.body || {};

  // Validate inputs
  if (typeof won !== 'boolean') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const delta = Number(chipsChange);
  if (!Number.isFinite(delta) || Math.abs(delta) > MAX_CHIPS_SWING) {
    return res.status(400).json({ error: 'Invalid chips value' });
  }

  try {
    const { data: current } = await supabase
      .from('users')
      .select('chips, wins, losses')
      .eq('id', req.user.id)
      .single();

    const newChips  = Math.max(500, (current.chips || 5000) + delta);
    const newWins   = (current.wins   || 0) + (won ? 1 : 0);
    const newLosses = (current.losses || 0) + (won ? 0 : 1);

    const { data, error } = await supabase
      .from('users')
      .update({ chips: newChips, wins: newWins, losses: newLosses })
      .eq('id', req.user.id)
      .select('chips, wins, losses')
      .single();

    if (error) throw error;

    if (handData && typeof handData === 'object') {
      const playerHand = String(handData.playerHand || '').slice(0, 100);
      const aiHand     = String(handData.aiHand     || '').slice(0, 100);
      const potSize    = Number(handData.potSize) || 0;
      const community  = Array.isArray(handData.community)  ? handData.community.slice(0, 5)  : [];
      const playerCards= Array.isArray(handData.playerCards) ? handData.playerCards.slice(0, 2) : [];

      await supabase.from('hand_history').insert({
        user_id:         req.user.id,
        result:          won ? 'win' : 'loss',
        player_hand:     playerHand,
        ai_hand:         aiHand,
        chips_change:    delta,
        pot_size:        potSize,
        community_cards: community,
        player_cards:    playerCards,
      });
    }

    res.json(data);
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('username, chips, wins, losses, win_pct');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`CR Poker server → http://localhost:${PORT}`));
