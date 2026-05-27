import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateStats } from '../../utils/api';
import TableView from './TableView';
import GameControls from './GameControls';
import { createDeck, getWinners, getAIAction, BOT_PERSONALITIES } from '../../utils/poker';
import { useSounds } from '../../utils/useSounds';
import RulesModal from '../Rules/RulesModal';

// starting blinds for players and other starters 
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const START_CHIPS = 5000;
const NUM_SEATS = 9;
// First names of legendary poker players
const BOT_NAMES = ['Doyle', 'Phil', 'Daniel', 'Stu', 'Johnny', 'Chris', 'Gus', 'Tom'];

function makeBot(name) {
  return { name, chips: START_CHIPS, hand: [], bet: 0, folded: false, personality: BOT_PERSONALITIES[name] ?? {} };
}

// ── Seat helpers ───────────────────────────────────────────────────────────────

function getSeatChips(s, seat) { return seat === 0 ? s.playerChips : s.bots[seat - 1].chips; }
function getSeatBet(s, seat) { return seat === 0 ? s.playerBet : s.bots[seat - 1].bet; }
function isFolded(s, seat) { return seat === 0 ? s.playerFolded : s.bots[seat - 1].folded; }

function activeSeatCount(s) {
  let n = 0;
  for (let i = 0; i < NUM_SEATS; i++) if (!isFolded(s, i)) n++;
  return n;
}

function nextSeatFrom(from, predicate) {
  for (let i = 1; i <= NUM_SEATS; i++) {
    const s = (from + i) % NUM_SEATS;
    if (predicate(s)) return s;
  }
  return -1;
}

function nextToAct(state) {
  const { activeIdx, currentBet } = state;
  for (let i = 1; i <= NUM_SEATS; i++) {
    const s = (activeIdx + i) % NUM_SEATS;
    if (isFolded(state, s)) continue;
    if (getSeatChips(state, s) <= 0) continue;
    if (!state.actedSeats[s] || getSeatBet(state, s) < currentBet) return s;
  }
  return -1;
}

// ── Showdown / street logic ────────────────────────────────────────────────────

function awardPotToSole(state) {
  let winner = -1;
  for (let i = 0; i < NUM_SEATS; i++) { if (!isFolded(state, i)) { winner = i; break; } }
  const newBots = state.bots.map(b => ({ ...b }));
  let newPlayerChips = state.playerChips;
  if (winner === 0) newPlayerChips += state.pot;
  else newBots[winner - 1].chips += state.pot;
  const winnerName = winner === 0 ? 'You win' : `${state.bots[winner - 1].name} wins`;
  const gameover = newPlayerChips <= 0 || newBots.every(b => b.chips <= 0);
  return {
    ...state,
    playerChips: newPlayerChips, bots: newBots, pot: 0,
    phase: gameover ? 'gameover' : 'showdown',
    showCards: true,
    message: `${winnerName} — everyone else folded!`,
    handResult: { winners: [{ seat: winner, handName: '' }] },
    handEnded: { won: winner === 0, tied: false, chipsChange: newPlayerChips - state.handStartChips },
  };
}

function doShowdown(state) {
  const contestants = [];
  if (!state.playerFolded) contestants.push({ seat: 0, hand: state.playerHand });
  state.bots.forEach((b, i) => { if (!b.folded) contestants.push({ seat: i + 1, hand: b.hand }); });
  if (contestants.length === 1) return awardPotToSole(state);

  const { winners, allEvaluated } = getWinners(contestants, state.community);
  const share = Math.floor(state.pot / winners.length);
  const remainder = state.pot - share * winners.length;
  const newBots = state.bots.map(b => ({ ...b }));
  let newPlayerChips = state.playerChips;
  winners.forEach((w, idx) => {
    const amount = share + (idx === 0 ? remainder : 0);
    if (w.seat === 0) newPlayerChips += amount;
    else newBots[w.seat - 1].chips += amount;
  });
  const playerWon = winners.some(w => w.seat === 0);
  const playerTied = playerWon && winners.length > 1;
  const winnerNames = winners.map(w => w.seat === 0 ? 'You' : state.bots[w.seat - 1].name).join(' & ');
  const handName = winners[0].eval.name;
  let msg;
  if (playerWon && !playerTied) msg = `You win with ${handName}!`;
  else if (playerTied) msg = `Split pot — ${winnerNames} tie with ${handName}`;
  else msg = `${winnerNames} wins with ${handName}`;
  const gameover = newPlayerChips <= 0 || newBots.every(b => b.chips <= 0);
  return {
    ...state,
    playerChips: newPlayerChips, bots: newBots, pot: 0,
    phase: gameover ? 'gameover' : 'showdown',
    showCards: true, message: msg,
    handResult: {
      winners: winners.map(w => ({ seat: w.seat, handName: w.eval.name })),
      allHands: allEvaluated.map(e => ({ seat: e.seat, handName: e.eval.name })),
    },
    handEnded: { won: playerWon, tied: playerTied, chipsChange: newPlayerChips - state.handStartChips },
  };
}

function advanceStreet(state) {
  const { phase, deck, community, dealerSeat } = state;
  const newDeck = [...deck];
  let newCommunity, nextPhase;
  if (phase === 'preflop') { nextPhase = 'flop'; newCommunity = [newDeck.pop(), newDeck.pop(), newDeck.pop()]; }
  else if (phase === 'flop') { nextPhase = 'turn'; newCommunity = [...community, newDeck.pop()]; }
  else if (phase === 'turn') { nextPhase = 'river'; newCommunity = [...community, newDeck.pop()]; }
  else return doShowdown(state);

  const newBots = state.bots.map(b => ({ ...b, bet: 0 }));
  const interim = { ...state, bots: newBots, playerBet: 0, currentBet: 0 };
  // Skip betting entirely if cards are already revealed (all-in runout)
  const runout = state.showCards || shouldRevealCards(interim);
  const first = runout ? -1 : nextSeatFrom(dealerSeat, s => !isFolded(interim, s) && getSeatChips(interim, s) > 0);
  return {
    ...state, phase: nextPhase, deck: newDeck, community: newCommunity,
    playerBet: 0, bots: newBots, currentBet: 0,
    actedSeats: Array(NUM_SEATS).fill(false),
    activeIdx: first, playerTurn: first === 0,
    showCards: runout, message: '',
  };
}

// Return chips that no opponent could match (uncalled portion of an over-bet)
function returnUncalledBets(state) {
  const active = [];
  if (!state.playerFolded) active.push({ seat: 0, bet: state.playerBet });
  state.bots.forEach((b, i) => { if (!b.folded) active.push({ seat: i + 1, bet: b.bet }); });
  if (active.length <= 1) return state;

  let newPlayerChips = state.playerChips;
  let newPot = state.pot;
  const newBots = state.bots.map(b => ({ ...b }));

  for (const p of active) {
    const maxOtherBet = Math.max(...active.filter(q => q.seat !== p.seat).map(q => q.bet));
    const excess = Math.max(0, p.bet - maxOtherBet);
    if (excess > 0) {
      if (p.seat === 0) newPlayerChips += excess;
      else newBots[p.seat - 1].chips += excess;
      newPot -= excess;
    }
  }
  return { ...state, playerChips: newPlayerChips, bots: newBots, pot: newPot };
}

// Cards flip face-up when ≤1 player still has chips to bet with
function shouldRevealCards(state) {
  let withChips = 0;
  for (let i = 0; i < NUM_SEATS; i++) {
    if (!isFolded(state, i) && getSeatChips(state, i) > 0) withChips++;
  }
  return withChips <= 1;
}

function afterAction(state) {
  if (activeSeatCount(state) <= 1) return awardPotToSole(state);
  const next = nextToAct(state);
  if (next === -1) {
    // Betting round complete — return any uncalled chips, then check for runout
    const settled = returnUncalledBets(state);
    const base = shouldRevealCards(settled) ? { ...settled, showCards: true } : settled;
    return advanceStreet(base);
  }
  return { ...state, activeIdx: next, playerTurn: next === 0 };
}

// ── Initial state ──────────────────────────────────────────────────────────────

function initState(playerChips = START_CHIPS) {
  return {
    phase: 'idle', deck: [], community: [], pot: 0,
    currentBet: BIG_BLIND, bigBlind: BIG_BLIND,
    dealerSeat: 0, sbSeat: 1, bbSeat: 2,
    activeIdx: 0, playerTurn: true,
    playerHand: [], playerChips, playerBet: 0, playerFolded: false,
    bots: BOT_NAMES.map(makeBot),
    actedSeats: Array(NUM_SEATS).fill(false),
    showCards: false, message: '', handResult: null, handEnded: null,
    handStartChips: playerChips, handNumber: 0,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { user, signOut, refreshUser } = useAuth();
  const [gs, setGs] = useState(() => initState(user?.chips || START_CHIPS));
  const [showRules, setShowRules] = useState(false);

  const dealNewHand = useCallback(() => {
    setGs(prev => {
      const reset = prev.phase === 'gameover';
      let pChips = reset ? START_CHIPS : prev.playerChips;
      let bots = prev.bots.map(b => ({
        name: b.name,
        chips: reset ? START_CHIPS : b.chips,
        hand: [], bet: 0, folded: false, personality: b.personality,
      }));

      // Rotate dealer to next seat with chips
      let dealerSeat = prev.dealerSeat;
      if (prev.handNumber > 0) {
        for (let i = 1; i <= NUM_SEATS; i++) {
          const s = (prev.dealerSeat + i) % NUM_SEATS;
          if ((s === 0 ? pChips : bots[s - 1].chips) > 0) { dealerSeat = s; break; }
        }
      }

      const nextWithChips = (from) => {
        for (let i = 1; i <= NUM_SEATS; i++) {
          const s = (from + i) % NUM_SEATS;
          if ((s === 0 ? pChips : bots[s - 1].chips) > 0) return s;
        }
        return -1;
      };

      const sbSeat = nextWithChips(dealerSeat);
      const bbSeat = nextWithChips(sbSeat);
      const utg = nextWithChips(bbSeat);

      // Post blinds
      let pot = 0;
      let pBet = 0;
      const postBlind = (seat, amount) => {
        const chips = seat === 0 ? pChips : bots[seat - 1].chips;
        const actual = Math.min(amount, chips);
        if (seat === 0) { pChips -= actual; pBet = actual; }
        else { bots[seat - 1].chips -= actual; bots[seat - 1].bet = actual; }
        pot += actual;
      };
      postBlind(sbSeat, SMALL_BLIND);
      postBlind(bbSeat, BIG_BLIND);

      // Deal cards
      const deck = createDeck();
      const playerHand = [deck.pop(), deck.pop()];
      bots = bots.map(b => ({
        ...b,
        hand: b.chips > 0 ? [deck.pop(), deck.pop()] : [],
        folded: b.chips <= 0,
      }));

      return {
        phase: 'preflop', deck, community: [], pot,
        currentBet: BIG_BLIND, bigBlind: BIG_BLIND,
        dealerSeat, sbSeat, bbSeat,
        activeIdx: utg, playerTurn: utg === 0,
        playerHand, playerChips: pChips, playerBet: pBet, playerFolded: pChips <= 0,
        bots, actedSeats: Array(NUM_SEATS).fill(false),
        showCards: false, message: '', handResult: null, handEnded: null,
        handStartChips: pChips,
        handNumber: prev.handNumber + 1,
      };
    });
  }, []);

  // ── Sound effects ────────────────────────────────────────────────────────────
  const { playDeal, playChip, playWin, playFold } = useSounds();
  const prevHandNumberRef = useRef(0);
  const prevPhaseRef = useRef('idle');
  const prevPotRef = useRef(0);

  useEffect(() => {
    if (gs.handNumber > prevHandNumberRef.current) {
      playDeal();
      setTimeout(playDeal, 140);
      prevHandNumberRef.current = gs.handNumber;
    }
  }, [gs.handNumber, playDeal]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = gs.phase;
    if (prev === gs.phase) return;
    if (gs.phase === 'flop') {
      playDeal();
      setTimeout(playDeal, 130);
      setTimeout(playDeal, 260);
    } else if (gs.phase === 'turn' || gs.phase === 'river') {
      playDeal();
    }
  }, [gs.phase, playDeal]);

  useEffect(() => {
    if (gs.pot > prevPotRef.current) playChip();
    prevPotRef.current = gs.pot;
  }, [gs.pot, playChip]);

  useEffect(() => {
    if (gs.handEnded?.won) playWin();
  }, [gs.handEnded, playWin]);

  // ── All-in runout: auto-advance streets when nobody has chips to bet ─────────
  const runoutTimerRef = useRef(null);
  useEffect(() => {
    if (gs.activeIdx !== -1) return;
    if (['idle', 'showdown', 'gameover'].includes(gs.phase)) return;
    runoutTimerRef.current = setTimeout(() => {
      setGs(prev => {
        if (prev.activeIdx !== -1 || ['idle', 'showdown', 'gameover'].includes(prev.phase)) return prev;
        return advanceStreet(prev);
      });
    }, 1100);
    return () => clearTimeout(runoutTimerRef.current);
  }, [gs.activeIdx, gs.phase]);

  // ── Bot AI turns ─────────────────────────────────────────────────────────────
  const aiTimerRef = useRef(null);
  useEffect(() => {
    if (gs.activeIdx <= 0) return;  // 0 = player, -1 = all-in runout
    if (['idle', 'showdown', 'gameover'].includes(gs.phase)) return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      setGs(prev => {
        if (prev.activeIdx <= 0) return prev;
        const seat = prev.activeIdx;
        const botIdx = seat - 1;
        const bot = prev.bots[botIdx];
        if (!bot || bot.folded || bot.chips <= 0) return afterAction(prev);

        const { action, amount } = getAIAction(
          bot.hand, prev.community, prev.pot, prev.currentBet, bot.bet, bot.chips, prev.bigBlind, bot.personality
        );

        const newBots = prev.bots.map(b => ({ ...b }));
        let newState = { ...prev };

        if (action === 'fold') {
          newBots[botIdx].folded = true;
          const acted = [...prev.actedSeats]; acted[seat] = true;
          newState = { ...prev, bots: newBots, actedSeats: acted };

        } else if (action === 'check') {
          const acted = [...prev.actedSeats]; acted[seat] = true;
          newState = { ...prev, actedSeats: acted };

        } else if (action === 'call') {
          const toCall = Math.min(prev.currentBet - bot.bet, bot.chips);
          newBots[botIdx].chips -= toCall;
          newBots[botIdx].bet += toCall;
          const acted = [...prev.actedSeats]; acted[seat] = true;
          newState = { ...prev, bots: newBots, pot: prev.pot + toCall, actedSeats: acted };

        } else if (action === 'raise') {
          const raiseTotal = Math.min(amount + bot.bet, bot.chips + bot.bet);
          const toAdd = raiseTotal - bot.bet;
          newBots[botIdx].chips -= toAdd;
          newBots[botIdx].bet = raiseTotal;
          const acted = Array(NUM_SEATS).fill(false); acted[seat] = true;
          newState = { ...prev, bots: newBots, pot: prev.pot + toAdd, currentBet: raiseTotal, actedSeats: acted };
        }

        return afterAction(newState);
      });
    }, 600 + Math.random() * 700);

    return () => clearTimeout(aiTimerRef.current);
  }, [gs.activeIdx, gs.phase, gs.playerTurn]);

  // ── Player actions ───────────────────────────────────────────────────────────
  const handleAction = useCallback((action, amount) => {
    if (action === 'newhand') { dealNewHand(); return; }
    if (action === 'fold') playFold();
    else if (action === 'call' || action === 'raise') playChip();
    setGs(prev => {
      if (!prev.playerTurn) return prev;
      const acted = [...prev.actedSeats];

      if (action === 'fold') {
        acted[0] = true;
        return afterAction({ ...prev, playerFolded: true, actedSeats: acted });
      }
      if (action === 'check') {
        if (prev.currentBet !== prev.playerBet) return prev;
        acted[0] = true;
        return afterAction({ ...prev, actedSeats: acted });
      }
      if (action === 'call') {
        const toCall = Math.min(prev.currentBet - prev.playerBet, prev.playerChips);
        acted[0] = true;
        return afterAction({
          ...prev,
          playerChips: prev.playerChips - toCall,
          playerBet: prev.playerBet + toCall,
          pot: prev.pot + toCall,
          actedSeats: acted,
        });
      }
      if (action === 'raise') {
        const raiseTotal = Math.min(amount, prev.playerChips + prev.playerBet);
        const toAdd = raiseTotal - prev.playerBet;
        if (toAdd <= 0) return prev;
        const newActed = Array(NUM_SEATS).fill(false); newActed[0] = true;
        return afterAction({
          ...prev,
          playerChips: prev.playerChips - toAdd,
          playerBet: raiseTotal,
          pot: prev.pot + toAdd,
          currentBet: raiseTotal,
          actedSeats: newActed,
        });
      }
      return prev;
    });
  }, [dealNewHand, playFold, playChip]);

  // ── Stats persistence ────────────────────────────────────────────────────────
  const refreshUserRef = useRef(refreshUser);
  const processedHandRef = useRef(null);
  useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  useEffect(() => {
    if (!gs.handEnded || !user || user.isGuest || gs.handEnded === processedHandRef.current) return;
    processedHandRef.current = gs.handEnded;
    const { won, tied, chipsChange } = gs.handEnded;
    if (tied) return;
    updateStats(won, chipsChange)
      .then(data => refreshUserRef.current(data))
      .catch(err => console.error('Stats update failed:', err?.response?.data?.error || err.message));
  }, [gs.handEnded, user]);

  const isPlayerTurn = gs.playerTurn && !['idle', 'showdown', 'gameover'].includes(gs.phase);
  const phaseLabel = { idle: 'WELCOME', preflop: 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN', gameover: 'GAME OVER' }[gs.phase] || gs.phase.toUpperCase();

  return (
    <div className="game-layout">
      <nav className="game-nav">
        <div className="game-nav-left">
          <span className="navbar-logo">♠ CR POKER</span>
          <span className="navbar-stat">Hand <strong>#{gs.handNumber}</strong></span>
          <span className="navbar-stat">W: <strong>{user?.wins ?? 0}</strong> | L: <strong>{user?.losses ?? 0}</strong></span>
          <button className="btn-rules" onClick={() => setShowRules(true)}>Rules</button>
        </div>
        <div className="game-nav-right">
          <span className="phase-pill">{phaseLabel}</span>
          <button className="btn-logout" onClick={signOut}>Logout</button>
        </div>
      </nav>

      <main className="game-main">
        <TableView gameState={gs} username={user?.username} isPlayerTurn={isPlayerTurn} />

        {gs.message && !['gameover'].includes(gs.phase) && (
          <div className="message-banner">
            <div className="message-text">{gs.message}</div>
          </div>
        )}

        {gs.phase === 'gameover' && (
          <div className="winner-overlay">
            <div className="winner-card">
              <div className="winner-emoji">{gs.playerChips > 0 ? '🏆' : '💀'}</div>
              <div className="winner-title">{gs.playerChips > 0 ? 'YOU WIN!' : 'GAME OVER'}</div>
              <div className="winner-hand">
                {gs.playerChips > 0
                  ? `You took everyone's chips with ${gs.playerChips.toLocaleString()}!`
                  : 'You lost all your chips. Better luck next time!'}
              </div>
              <button className="btn-play-again" onClick={dealNewHand}>PLAY AGAIN</button>
            </div>
          </div>
        )}
      </main>

      <GameControls gameState={gs} onAction={handleAction} disabled={!isPlayerTurn} />
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
