import PlayingCard from './PlayingCard';

export default function TableView({ gameState, username, isPlayerTurn }) {
  const {
    playerHand, aiHand, community, showAICards,
    pot, aiChips, playerChips, aiBet, playerBet,
    aiThinking, playerIsDealer, phase,
  } = gameState;

  const aiIsActive = !isPlayerTurn && aiThinking && !['idle','showdown','gameover'].includes(phase);
  const playerIsActive = isPlayerTurn && !['idle','showdown','gameover'].includes(phase);

  return (
    <div className="table-scene">

      {/* ── AI Seat ── */}
      <div className={`seat seat-ai${aiIsActive ? ' seat-active-ai' : ''}`}>
        <div className="seat-avatar">🤖</div>
        <div className="seat-info">
          <div className="seat-name">
            DEALER BOT
            {!playerIsDealer && <span className="dealer-btn-chip">D</span>}
          </div>
          <div className="seat-chips">{aiChips.toLocaleString()}</div>
          {aiBet > 0 && <div className="seat-bet">Bet: <strong>{aiBet}</strong></div>}
          {aiThinking && (
            <div className="seat-thinking">
              thinking<span className="ai-thinking"><span /><span /><span /></span>
            </div>
          )}
        </div>
      </div>

      {/* ── Oval Table ── */}
      <div className="oval-table">
        <div className="felt-watermark">CR POKER</div>

        {/* AI hole cards */}
        <div className="table-cards table-cards-top">
          {aiHand.length > 0
            ? aiHand.map((card, i) => (
                <PlayingCard key={i} card={card} faceDown={!showAICards} />
              ))
            : <div className="cards-empty-hint" />}
        </div>

        {/* Pot + community */}
        <div className="table-middle">
          {pot > 0 && (
            <div className="table-pot">
              <span className="table-pot-label">Total Pot:</span>
              <span className="table-pot-amount">{pot.toLocaleString()}</span>
            </div>
          )}
          <div className="community-row">
            {community.map((card, i) => (
              <PlayingCard key={i} card={card} faceDown={false} />
            ))}
            {Array.from({ length: Math.max(0, 5 - community.length) }).map((_, i) => (
              <div key={i} className="card-placeholder" />
            ))}
          </div>
        </div>

        {/* Player hole cards */}
        <div className="table-cards table-cards-bottom">
          {playerHand.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={false} large />
          ))}
        </div>
      </div>

      {/* ── Player Seat ── */}
      <div className={`seat seat-player${playerIsActive ? ' seat-active-player' : ''}`}>
        <div className="seat-avatar">🧑</div>
        <div className="seat-info">
          <div className="seat-name">
            {username || 'You'}
            {playerIsDealer && <span className="dealer-btn-chip">D</span>}
          </div>
          <div className="seat-chips">{playerChips.toLocaleString()}</div>
          {playerBet > 0 && <div className="seat-bet">Bet: <strong>{playerBet}</strong></div>}
        </div>
      </div>
    </div>
  );
}
