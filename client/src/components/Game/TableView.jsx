import PlayingCard from './PlayingCard';

// 9 seats: player at bottom, 8 bots going left (SB left of dealer, BB left of SB)
const SEAT_POSITIONS = [
  { left: '50%',  top: '92%'  }, // 0: Player  — bottom center
  { left: '22%',  top: '82%'  }, // 1: Bot 0   — bottom left   (SB when player is dealer)
  { left: '4%',   top: '56%'  }, // 2: Bot 1   — left          (BB when player is dealer)
  { left: '10%',  top: '22%'  }, // 3: Bot 2   — top left
  { left: '34%',  top: '5%'   }, // 4: Bot 3   — top left-center
  { left: '66%',  top: '5%'   }, // 5: Bot 4   — top right-center
  { left: '90%',  top: '22%'  }, // 6: Bot 5   — top right
  { left: '96%',  top: '56%'  }, // 7: Bot 6   — right
  { left: '78%',  top: '82%'  }, // 8: Bot 7   — bottom right
];

function BotSeat({ bot, seat, activeIdx, showCards, dealerSeat, sbSeat, bbSeat, handResult }) {
  const isActive = activeIdx === seat;
  const eliminated = bot.chips <= 0 && bot.folded;
  const isWinner = handResult?.winners?.some(w => w.seat === seat);
  const handInfo = showCards && handResult?.allHands?.find(h => h.seat === seat);

  return (
    <div
      className={`seat-outer${isActive ? ' seat-outer-active' : ''}${eliminated ? ' seat-outer-eliminated' : ''}${isWinner ? ' seat-outer-winner' : ''}`}
      style={{ left: SEAT_POSITIONS[seat].left, top: SEAT_POSITIONS[seat].top }}
    >
      {bot.hand.length > 0 && !bot.folded && (
        <div className="bot-cards">
          {bot.hand.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={!showCards} tiny />
          ))}
        </div>
      )}
      <div className={`seat-chip${bot.folded ? ' seat-chip-folded' : ''}${isActive ? ' seat-chip-active-ai' : ''}${isWinner ? ' seat-chip-winner' : ''}`}>
        <div className="seat-chip-name">
          {bot.name}
          {dealerSeat === seat && <span className="dealer-btn-chip">D</span>}
          {sbSeat === seat && <span className="blind-chip sb-chip">S</span>}
          {bbSeat === seat && <span className="blind-chip bb-chip">B</span>}
        </div>
        <div className="seat-chip-stack">{bot.chips.toLocaleString()}</div>
        {bot.bet > 0 && !bot.folded && <div className="seat-chip-bet">{bot.bet}</div>}
        {handInfo && (
          <div className={`seat-chip-hand${isWinner ? ' seat-chip-hand-winner' : ''}`}>
            {handInfo.handName}
          </div>
        )}
        {bot.folded && <div className="seat-chip-folded-label">FOLDED</div>}
        {isActive && !bot.folded && (
          <div className="seat-thinking-dot"><span /><span /><span /></div>
        )}
      </div>
    </div>
  );
}

export default function TableView({ gameState, username, isPlayerTurn }) {
  const {
    playerHand, bots = [], community, showCards,
    pot, playerChips, playerBet, playerFolded,
    activeIdx, dealerSeat, sbSeat, bbSeat, phase, handResult,
  } = gameState;

  const playerIsActive = isPlayerTurn && !['idle', 'showdown', 'gameover'].includes(phase);
  const playerIsWinner = handResult?.winners?.some(w => w.seat === 0);
  const playerHandInfo = showCards && handResult?.allHands?.find(h => h.seat === 0);

  return (
    <div className="table-wrap">
      {/* ── Oval felt ── */}
      <div className="oval-table">
        <div className="felt-watermark">CR POKER</div>

        <div className="table-middle">
          <div className="community-row">
            {community.map((card, i) => (
              <PlayingCard key={i} card={card} faceDown={false} />
            ))}
            {Array.from({ length: Math.max(0, 5 - community.length) }).map((_, i) => (
              <div key={i} className="card-placeholder" />
            ))}
          </div>
          {pot > 0 && (
            <div className="table-pot">
              <span className="table-pot-label">POT</span>
              <span className="table-pot-amount">{pot.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="table-cards table-cards-bottom">
          {playerHand.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={false} large />
          ))}
        </div>
      </div>

      {/* ── Player seat (bottom center) ── */}
      <div
        className={`seat-outer${playerIsActive ? ' seat-outer-active' : ''}${playerFolded ? ' seat-outer-eliminated' : ''}${playerIsWinner ? ' seat-outer-winner' : ''}`}
        style={{ left: SEAT_POSITIONS[0].left, top: SEAT_POSITIONS[0].top }}
      >
        <div className={`seat-chip${playerFolded ? ' seat-chip-folded' : ''}${playerIsActive ? ' seat-chip-active-player' : ''}${playerIsWinner ? ' seat-chip-winner' : ''}`}>
          <div className="seat-chip-name">
            {username || 'You'}
            {dealerSeat === 0 && <span className="dealer-btn-chip">D</span>}
            {sbSeat === 0 && <span className="blind-chip sb-chip">S</span>}
            {bbSeat === 0 && <span className="blind-chip bb-chip">B</span>}
          </div>
          <div className="seat-chip-stack">{playerChips.toLocaleString()}</div>
          {playerBet > 0 && !playerFolded && <div className="seat-chip-bet">{playerBet}</div>}
          {playerHandInfo && (
            <div className={`seat-chip-hand${playerIsWinner ? ' seat-chip-hand-winner' : ''}`}>
              {playerHandInfo.handName}
            </div>
          )}
          {playerFolded && <div className="seat-chip-folded-label">FOLDED</div>}
        </div>
      </div>

      {/* ── Bot seats ── */}
      {bots.map((bot, i) => (
        <BotSeat
          key={i}
          bot={bot}
          seat={i + 1}
          activeIdx={activeIdx}
          showCards={showCards}
          dealerSeat={dealerSeat}
          sbSeat={sbSeat}
          bbSeat={bbSeat}
          handResult={handResult}
        />
      ))}
    </div>
  );
}
