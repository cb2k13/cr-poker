require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'crpoker_secret';

// Reflect any origin back — safe because our JWT middleware
// is the actual auth gate. Restrict to specific domains once stable.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Quick connectivity check on startup
supabase.from('users').select('id').limit(1)
  .then(() => console.log('✓ Connected to Supabase'))
  .catch(err => console.error('✗ Supabase connection error:', err.message));

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
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username ≥3 chars, password ≥6 chars' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
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
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) return res.status(400).json({ error: 'Missing token' });

  try {
    // Verify the Supabase access token and get the Google user
    const { data: { user: googleUser }, error } = await supabase.auth.getUser(access_token);
    if (error || !googleUser) return res.status(401).json({ error: 'Invalid Google token' });

    const authId = googleUser.id;
    const email  = googleUser.email || '';
    const displayName = googleUser.user_metadata?.full_name
      || googleUser.user_metadata?.name
      || email.split('@')[0]
      || 'player';

    // Check if this Google account already has a user row
    const { data: existing } = await supabase
      .from('users')
      .select('id, username, chips, wins, losses')
      .eq('auth_id', authId)
      .single();

    if (existing) {
      // Returning Google user — just issue our JWT
      const token = jwt.sign({ id: existing.id, username: existing.username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, username: existing.username, chips: existing.chips, wins: existing.wins, losses: existing.losses });
    }

    // New Google user — generate a unique username
    let username = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'player';
    const { data: taken } = await supabase.from('users').select('username').eq('username', username).single();
    if (taken) username = username + Math.floor(Math.random() * 9000 + 1000);

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
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    // Update last_seen
    await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, chips: user.chips, wins: user.wins, losses: user.losses });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
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
app.post('/api/stats', auth, async (req, res) => {
  const { won, chipsChange = 0, handData } = req.body || {};
  try {
    // Fetch current chips first (Supabase doesn't support arithmetic updates directly)
    const { data: current } = await supabase
      .from('users')
      .select('chips, wins, losses')
      .eq('id', req.user.id)
      .single();

    const newChips = Math.max(500, (current.chips || 5000) + chipsChange);
    const newWins  = (current.wins  || 0) + (won ? 1 : 0);
    const newLosses = (current.losses || 0) + (won ? 0 : 1);

    const { data, error } = await supabase
      .from('users')
      .update({ chips: newChips, wins: newWins, losses: newLosses })
      .eq('id', req.user.id)
      .select('chips, wins, losses')
      .single();

    if (error) throw error;

    // Log hand history if provided
    if (handData) {
      await supabase.from('hand_history').insert({
        user_id:         req.user.id,
        result:          won ? 'win' : 'loss',
        player_hand:     handData.playerHand || '',
        ai_hand:         handData.aiHand     || '',
        chips_change:    chipsChange,
        pot_size:        handData.potSize    || 0,
        community_cards: handData.community  || [],
        player_cards:    handData.playerCards || [],
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

app.listen(PORT, () => console.log(`CR Poker server → http://localhost:${PORT}`));
