import { useState } from 'react';

export default function GameControls({ gameState, onAction, disabled }) {
  const [raiseAmt, setRaiseAmt] = useState('');
  const { phase, currentBet, playerBet, playerChips, pot, bigBlind = 20 } = gameState;

  const toCall = Math.min(currentBet - playerBet, playerChips);
  const canCheck = currentBet === playerBet;
  const canCall = toCall > 0 && toCall < playerChips;
  const canRaise = playerChips > toCall;
  const minRaise = Math.max(bigBlind, currentBet * 2 - playerBet);

  function handleRaise() {
    const amt = parseInt(raiseAmt);
    if (!amt || amt < minRaise) {
      setRaiseAmt(String(minRaise));
      return;
    }
    onAction('raise', Math.min(amt, playerChips));
    setRaiseAmt('');
  }

  function handleAllIn() {
    onAction('raise', playerChips);
    setRaiseAmt('');
  }

  const isIdle = phase === 'idle' || phase === 'gameover';
  const isPlaying = phase !== 'idle' && phase !== 'gameover' && phase !== 'showdown';

  if (isIdle) {
    return (
      <div className="game-controls">
        <button className="action-btn btn-new-hand" onClick={() => onAction('newhand')}>
          {phase === 'gameover' ? 'NEW GAME' : 'DEAL CARDS'}
        </button>
      </div>
    );
  }

  if (phase === 'showdown') {
    return (
      <div className="game-controls">
        <button className="action-btn btn-new-hand" onClick={() => onAction('newhand')}>
          NEXT HAND
        </button>
      </div>
    );
  }

  return (
    <div className="game-controls">
      {/* Fold */}
      <button
        className="action-btn btn-fold"
        onClick={() => onAction('fold')}
        disabled={disabled}
      >
        FOLD
      </button>

      {/* Check or Call */}
      {canCheck ? (
        <button
          className="action-btn btn-check"
          onClick={() => onAction('check')}
          disabled={disabled}
        >
          CHECK
        </button>
      ) : (
        <button
          className="action-btn btn-call"
          onClick={() => onAction('call')}
          disabled={disabled || !canCall && playerChips <= toCall}
        >
          {playerChips <= toCall ? `ALL IN +${playerChips}` : `CALL ${toCall}`}
        </button>
      )}

      {/* Raise bet */}
      {canRaise && (
        <div className="raise-row">
          <div className="raise-input-group">
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>$</span>
            <input
              className="raise-input"
              type="number"
              value={raiseAmt}
              onChange={e => setRaiseAmt(e.target.value)}
              placeholder={minRaise}
              min={minRaise}
              max={playerChips}
              disabled={disabled}
              onKeyDown={e => e.key === 'Enter' && handleRaise()}
            />
          </div>
          <button
            className="action-btn btn-raise"
            onClick={handleRaise}
            disabled={disabled}
          >
            BET
          </button>
          <button
            className="action-btn btn-raise"
            onClick={handleAllIn}
            disabled={disabled}
            style={{ background: 'linear-gradient(135deg,#ff6f00,#e65100)', minWidth: 90 }}
          >
            ALL IN
          </button>
        </div>
      )}
    </div>
  );
}
