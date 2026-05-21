import PlayingCard from './PlayingCard';

// Seats go left from the player (standard poker: SB left of dealer, BB left of SB)
const SEAT_POSITIONS = [
  { left: '50%',  top: '91%'  }, // 0: Player — bottom center
  { left: '18%',  top: '80%'  }, // 1: Bot 0  — bottom left  (SB when player is dealer)
  { left: '4%',   top: '50%'  }, // 2: Bot 1  — left          (BB when player is dealer)
  { left: '18%',  top: '18%'  }, // 3: Bot 2  — top left
  { left: '38%',  top: '5%'   }, // 4: Bot 3  — top left-center
  { left: '62%',  top: '5%'   }, // 5: Bot 4  — top right-center
  { left: '82%',  top: '18%'  }, // 6: Bot 5  — top right
  { left: '96%',  top: '50%'  }, // 7: Bot 6  — right
];

function BotSeat({ bot, seat, activeIdx, showCards, dealerSeat, sbSeat, bbSeat }) {
  const isActive = activeIdx === seat;
  const eliminated = bot.chips <= 0 && bot.folded;

  return (
    <div
      className={`seat-outer${isActive ? ' seat-outer-active' : ''}${eliminated ? ' seat-outer-eliminated' : ''}`}
      style={{ left: SEAT_POSITIONS[seat].left, top: SEAT_POSITIONS[seat].top }}
    >
      {/* Bot hole cards above/beside the seat chip */}
      {bot.hand.length > 0 && !bot.folded && (
        <div className="bot-cards">
          {bot.hand.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={!showCards} tiny />
          ))}
        </div>
      )}
      <div className={`seat-chip${bot.folded ? ' seat-chip-folded' : ''}${isActive ? ' seat-chip-active-ai' : ''}`}>
        <div className="seat-chip-name">
          {bot.name}
          {dealerSeat === seat && <span className="dealer-btn-chip">D</span>}
          {sbSeat === seat && <span className="blind-chip sb-chip">S</span>}
          {bbSeat === seat && <span className="blind-chip bb-chip">B</span>}
        </div>
        <div className="seat-chip-stack">{bot.chips.toLocaleString()}</div>
        {bot.bet > 0 && !bot.folded && <div className="seat-chip-bet">{bot.bet}</div>}
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
    activeIdx, dealerSeat, sbSeat, bbSeat, phase,
  } = gameState;

  const playerIsActive = isPlayerTurn && !['idle', 'showdown', 'gameover'].includes(phase);

  return (
    <div className="table-wrap">
      {/* ── Oval felt ── */}
      <div className="oval-table">
        <div className="felt-watermark">CR POKER</div>

        <div className="table-middle">
          {pot > 0 && (
            <div className="table-pot">
              <span className="table-pot-label">Pot:</span>
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

        {/* Player hole cards on the felt */}
        <div className="table-cards table-cards-bottom">
          {playerHand.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={false} large />
          ))}
        </div>
      </div>

      {/* ── Player seat (bottom center) ── */}
      <div
        className={`seat-outer${playerIsActive ? ' seat-outer-active' : ''}${playerFolded ? ' seat-outer-eliminated' : ''}`}
        style={{ left: SEAT_POSITIONS[0].left, top: SEAT_POSITIONS[0].top }}
      >
        <div className={`seat-chip${playerFolded ? ' seat-chip-folded' : ''}${playerIsActive ? ' seat-chip-active-player' : ''}`}>
          <div className="seat-chip-name">
            {username || 'You'}
            {dealerSeat === 0 && <span className="dealer-btn-chip">D</span>}
            {sbSeat === 0 && <span className="blind-chip sb-chip">S</span>}
            {bbSeat === 0 && <span className="blind-chip bb-chip">B</span>}
          </div>
          <div className="seat-chip-stack">{playerChips.toLocaleString()}</div>
          {playerBet > 0 && !playerFolded && <div className="seat-chip-bet">{playerBet}</div>}
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
        />
      ))}
    </div>
  );
}
