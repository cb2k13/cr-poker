import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateStats } from '../../utils/api';
import TableView from './TableView';
import GameControls from './GameControls';
import { createDeck, compareHands, getAIAction } from '../../utils/poker';

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const START_CHIPS = 5000;

// ── Pure state transformers ────────────────────────────────────────────────────

function doShowdown(state) {
  const { playerHand, aiHand, community, pot, playerChips, aiChips } = state;
  const result = compareHands(playerHand, aiHand, community);
  let newP = playerChips;
  let newA = aiChips;
  let msg;

  if (result.result === 'player') {
    newP += pot;
    msg = `You win with ${result.playerHand.name}!`;
  } else if (result.result === 'ai') {
    newA += pot;
    msg = `AI wins with ${result.aiHand.name}!`;
  } else {
    newP += Math.floor(pot / 2);
    newA += Math.ceil(pot / 2);
    msg = `Chop! Both have ${result.playerHand.name}`;
  }

  return {
    ...state,
    phase: newP <= 0 || newA <= 0 ? 'gameover' : 'showdown',
    playerChips: newP,
    aiChips: newA,
    pot: 0,
    showAICards: true,
    handResult: result,
    message: msg,
    aiThinking: false,
    playerActed: false,
    aiActed: false,
    handEnded: {
      won: result.result === 'player',
      tied: result.result === 'tie',
      chipsChange: newP - state.handStartChips,
    },
  };
}

function advanceStreet(state) {
  const { phase, deck, community, playerIsDealer } = state;
  const newDeck = [...deck];
  let newCommunity;
  let nextPhase;

  if (phase === 'preflop') {
    nextPhase = 'flop';
    newCommunity = [newDeck.pop(), newDeck.pop(), newDeck.pop()];
  } else if (phase === 'flop') {
    nextPhase = 'turn';
    newCommunity = [...community, newDeck.pop()];
  } else if (phase === 'turn') {
    nextPhase = 'river';
    newCommunity = [...community, newDeck.pop()];
  } else {
    return doShowdown(state);
  }

  const playerGoesFirst = !playerIsDealer;
  return {
    ...state,
    phase: nextPhase,
    deck: newDeck,
    community: newCommunity,
    playerBet: 0,
    aiBet: 0,
    currentBet: 0,
    playerActed: false,
    aiActed: false,
    playerTurn: playerGoesFirst,
    aiThinking: !playerGoesFirst,
    message: '',
  };
}

function initState(playerChips = START_CHIPS) {
  return {
    phase: 'idle',
    deck: [], playerHand: [], aiHand: [], community: [],
    pot: 0, playerChips, aiChips: Math.max(0, START_CHIPS * 2 - playerChips),
    playerBet: 0, aiBet: 0, currentBet: BIG_BLIND, bigBlind: BIG_BLIND,
    playerTurn: true, playerIsDealer: true,
    playerActed: false, aiActed: false,
    showAICards: false, message: '', handResult: null,
    handEnded: null, handStartChips: playerChips,
    aiThinking: false, handNumber: 0,
  };
}

export default function GamePage() {
  const { user, signOut, refreshUser } = useAuth();
  const [gs, setGs] = useState(() => initState(user?.chips || START_CHIPS));
  const aiTimerRef = useRef(null);

  const dealNewHand = useCallback(() => {
    setGs(prev => {
      const reset = prev.phase === 'gameover';
      const pChips = reset ? START_CHIPS : prev.playerChips;
      const aChips = reset ? START_CHIPS : prev.aiChips;
      const playerIsDealer = prev.handNumber === 0 ? true : !prev.playerIsDealer;
      const deck = createDeck();
      const playerHand = [deck.pop(), deck.pop()];
      const aiHand = [deck.pop(), deck.pop()];
      const sbAmt = Math.min(SMALL_BLIND, playerIsDealer ? pChips : aChips);
      const bbAmt = Math.min(BIG_BLIND, playerIsDealer ? aChips : pChips);
      return {
        ...prev,
        phase: 'preflop',
        deck, playerHand, aiHand,
        community: [],
        pot: sbAmt + bbAmt,
        playerChips: playerIsDealer ? pChips - sbAmt : pChips - bbAmt,
        aiChips: playerIsDealer ? aChips - bbAmt : aChips - sbAmt,
        playerBet: playerIsDealer ? sbAmt : bbAmt,
        aiBet: playerIsDealer ? bbAmt : sbAmt,
        currentBet: BIG_BLIND,
        showAICards: false,
        message: '', handResult: null, handEnded: null,
        handStartChips: pChips,
        playerTurn: playerIsDealer,
        playerIsDealer,
        playerActed: false,
        aiActed: false,
        aiThinking: !playerIsDealer,
        handNumber: prev.handNumber + 1,
        bigBlind: BIG_BLIND,
      };
    });
  }, []);

  const scheduleAI = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      setGs(prev => {
        if (prev.playerTurn || !prev.aiThinking) return prev;
        const { aiHand, community, pot, currentBet, aiBet, aiChips, bigBlind } = prev;
        const decision = getAIAction(aiHand, community, pot, currentBet, aiBet, aiChips, bigBlind);
        const base = { ...prev, aiThinking: false, aiActed: true };

        switch (decision.action) {
          case 'fold': {
            const finalChips = prev.playerChips + prev.pot;
            return {
              ...base,
              playerChips: finalChips, pot: 0, phase: 'showdown',
              message: 'AI folds — you win!', showAICards: true,
              handEnded: { won: true, tied: false, chipsChange: finalChips - prev.handStartChips },
            };
          }
          case 'check':
            if (prev.playerActed) return advanceStreet(base);
            return { ...base, playerTurn: true };
          case 'call': {
            const toCall = Math.min(currentBet - aiBet, aiChips);
            const updated = { ...base, aiChips: base.aiChips - toCall, aiBet: base.aiBet + toCall, pot: base.pot + toCall };
            if (prev.phase === 'preflop' && !prev.playerIsDealer && !prev.playerActed) {
              return { ...updated, playerTurn: true };
            }
            return advanceStreet(updated);
          }
          case 'raise': {
            const raiseTotal = Math.min(decision.amount + aiBet, aiChips + aiBet);
            const toAdd = raiseTotal - aiBet;
            return {
              ...base,
              aiChips: base.aiChips - toAdd, aiBet: raiseTotal,
              pot: base.pot + toAdd, currentBet: raiseTotal,
              playerActed: false, playerTurn: true,
            };
          }
          default: return base;
        }
      });
    }, 850 + Math.random() * 850);
  }, []);

  useEffect(() => {
    if (!gs.playerTurn && gs.aiThinking &&
        gs.phase !== 'idle' && gs.phase !== 'showdown' && gs.phase !== 'gameover') {
      scheduleAI();
    }
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [gs.playerTurn, gs.aiThinking, gs.phase, scheduleAI]);

  const handleAction = useCallback((action, amount) => {
    if (action === 'newhand') { dealNewHand(); return; }
    setGs(prev => {
      if (!prev.playerTurn) return prev;
      switch (action) {
        case 'fold':
          return {
            ...prev,
            aiChips: prev.aiChips + prev.pot, pot: 0, phase: 'showdown',
            message: 'You folded — AI wins.', showAICards: true, playerActed: true,
            handEnded: { won: false, tied: false, chipsChange: prev.playerChips - prev.handStartChips },
          };
        case 'check': {
          if (prev.currentBet !== prev.playerBet) return prev;
          const base = { ...prev, playerActed: true };
          if (prev.aiActed) return advanceStreet(base);
          return { ...base, playerTurn: false, aiThinking: true };
        }
        case 'call': {
          const toCall = Math.min(prev.currentBet - prev.playerBet, prev.playerChips);
          const base = { ...prev, playerChips: prev.playerChips - toCall, playerBet: prev.playerBet + toCall, pot: prev.pot + toCall, playerActed: true };
          if (prev.phase === 'preflop' && prev.playerIsDealer && !prev.aiActed) {
            return { ...base, playerTurn: false, aiThinking: true };
          }
          return advanceStreet(base);
        }
        case 'raise': {
          const raiseTotal = Math.min(amount, prev.playerChips + prev.playerBet);
          const toAdd = raiseTotal - prev.playerBet;
          if (toAdd <= 0) return prev;
          return {
            ...prev,
            playerChips: prev.playerChips - toAdd, playerBet: raiseTotal,
            pot: prev.pot + toAdd, currentBet: raiseTotal,
            playerActed: true, aiActed: false,
            playerTurn: false, aiThinking: true,
          };
        }
        default: return prev;
      }
    });
  }, [dealNewHand]);

  const refreshUserRef = useRef(refreshUser);
  const processedHandRef = useRef(null);
  useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  useEffect(() => {
    if (!gs.handEnded || !user || gs.handEnded === processedHandRef.current) return;
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

      {/* Navbar */}
      <nav className="game-nav">
        <div className="game-nav-left">
          <span className="navbar-logo">♠ CR POKER</span>
          <span className="navbar-stat">Hand <strong>#{gs.handNumber}</strong></span>
          <span className="navbar-stat">W: <strong>{user?.wins ?? 0}</strong> | L: <strong>{user?.losses ?? 0}</strong></span>
        </div>
        <div className="game-nav-right">
          <span className="phase-pill">{phaseLabel}</span>
          <button className="btn-logout" onClick={signOut}>Logout</button>
        </div>
      </nav>

      {/* Main table area */}
      <main className="game-main">
        <TableView gameState={gs} username={user?.username} isPlayerTurn={isPlayerTurn} />

        {/* Message */}
        {gs.message && !['gameover'].includes(gs.phase) && (
          <div className="message-banner">
            <div className="message-text">{gs.message}</div>
            {gs.handResult && (
              <div className="message-sub">
                Your hand: <strong>{gs.handResult.playerHand?.name}</strong>
                {gs.handResult.result !== 'player' && <> | AI: <strong>{gs.handResult.aiHand?.name}</strong></>}
              </div>
            )}
          </div>
        )}

        {/* Game over overlay */}
        {gs.phase === 'gameover' && (
          <div className="winner-overlay">
            <div className="winner-card">
              <div className="winner-emoji">{gs.playerChips > 0 ? '🏆' : '💀'}</div>
              <div className="winner-title">{gs.playerChips > 0 ? 'YOU WIN!' : 'GAME OVER'}</div>
              <div className="winner-hand">
                {gs.playerChips > 0
                  ? `You bankrupted the AI with ${gs.playerChips.toLocaleString()} chips!`
                  : 'The AI took all your chips. Better luck next time!'}
              </div>
              <button className="btn-play-again" onClick={dealNewHand}>PLAY AGAIN</button>
            </div>
          </div>
        )}
      </main>

      {/* Controls */}
      <GameControls gameState={gs} onAction={handleAction} disabled={!isPlayerTurn || gs.aiThinking} />
    </div>
  );
}
