import { useEffect } from 'react';

const HAND_RANKINGS = [
  { name: 'Royal Flush',     example: 'A♠ K♠ Q♠ J♠ 10♠', desc: 'A, K, Q, J, 10 all of the same suit. Unbeatable.' },
  { name: 'Straight Flush',  example: '9♥ 8♥ 7♥ 6♥ 5♥',  desc: 'Five consecutive cards of the same suit.' },
  { name: 'Four of a Kind',  example: 'K♠ K♥ K♦ K♣ 3♠',  desc: 'Four cards of the same rank.' },
  { name: 'Full House',      example: 'J♠ J♥ J♦ 7♣ 7♠',  desc: 'Three of a kind plus a pair.' },
  { name: 'Flush',           example: 'A♦ J♦ 8♦ 5♦ 2♦',  desc: 'Any five cards of the same suit.' },
  { name: 'Straight',        example: '8♠ 7♥ 6♦ 5♣ 4♠',  desc: 'Five consecutive cards of any suit.' },
  { name: 'Three of a Kind', example: '7♠ 7♥ 7♦ K♣ 2♠',  desc: 'Three cards of the same rank.' },
  { name: 'Two Pair',        example: 'A♠ A♦ 9♥ 9♣ Q♠',  desc: 'Two different pairs.' },
  { name: 'One Pair',        example: '10♠ 10♣ A♥ 6♦ 3♣', desc: 'Two cards of the same rank.' },
  { name: 'High Card',       example: 'A♠ J♦ 8♣ 5♥ 2♠',  desc: 'No combination — highest card plays.' },
];

export default function RulesModal({ onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={e => e.stopPropagation()}>
        <button className="rules-close" onClick={onClose}>✕</button>

        <div className="rules-header">
          <div className="rules-title">♠ How to Play</div>
          <div className="rules-subtitle">No-Limit Texas Hold'em</div>
        </div>

        <div className="rules-body">

          {/* Goal */}
          <section className="rules-section">
            <h2 className="rules-section-title">The Goal</h2>
            <p>Win chips by making the best 5-card hand at showdown, or by getting all other players to fold. Be the last player with chips to win the game.</p>
          </section>

          {/* Setup */}
          <section className="rules-section">
            <h2 className="rules-section-title">Setup</h2>
            <ul className="rules-list">
              <li>Every player starts with <strong>5,000 chips</strong>.</li>
              <li>A rotating <strong>Dealer button (D)</strong> determines position each hand.</li>
              <li>The two players left of the dealer post forced bets called <strong>blinds</strong> — the Small Blind (S) posts <strong>10</strong> and the Big Blind (B) posts <strong>20</strong>.</li>
            </ul>
          </section>

          {/* How a hand is played */}
          <section className="rules-section">
            <h2 className="rules-section-title">How a Hand is Played</h2>
            <div className="rules-steps">
              <div className="rules-step">
                <span className="rules-step-num">1</span>
                <div>
                  <strong>Pre-Flop</strong> — Each player is dealt <strong>2 private hole cards</strong>. Betting starts with the player left of the Big Blind and goes clockwise.
                </div>
              </div>
              <div className="rules-step">
                <span className="rules-step-num">2</span>
                <div>
                  <strong>The Flop</strong> — Three community cards are dealt face-up in the center of the table. Another round of betting begins.
                </div>
              </div>
              <div className="rules-step">
                <span className="rules-step-num">3</span>
                <div>
                  <strong>The Turn</strong> — A fourth community card is dealt. Another betting round.
                </div>
              </div>
              <div className="rules-step">
                <span className="rules-step-num">4</span>
                <div>
                  <strong>The River</strong> — The fifth and final community card is dealt. Last betting round.
                </div>
              </div>
              <div className="rules-step">
                <span className="rules-step-num">5</span>
                <div>
                  <strong>Showdown</strong> — If two or more players remain, they reveal their cards. The best 5-card hand wins the pot. You may use any combination of your 2 hole cards and the 5 community cards.
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="rules-section">
            <h2 className="rules-section-title">Betting Actions</h2>
            <div className="rules-actions">
              <div className="rules-action">
                <span className="rules-action-name">Fold</span>
                <span className="rules-action-desc">Discard your hand and give up any chips already bet.</span>
              </div>
              <div className="rules-action">
                <span className="rules-action-name">Check</span>
                <span className="rules-action-desc">Pass the action without betting (only when no bet has been made).</span>
              </div>
              <div className="rules-action">
                <span className="rules-action-name">Call</span>
                <span className="rules-action-desc">Match the current bet to stay in the hand.</span>
              </div>
              <div className="rules-action">
                <span className="rules-action-name">Raise</span>
                <span className="rules-action-desc">Increase the bet. All other players must call, re-raise, or fold.</span>
              </div>
              <div className="rules-action">
                <span className="rules-action-name">All-In</span>
                <span className="rules-action-desc">Bet all your remaining chips. You can still win the portion of the pot you can match.</span>
              </div>
            </div>
          </section>

          {/* No-Limit rule */}
          <section className="rules-section">
            <h2 className="rules-section-title">No-Limit</h2>
            <p>In <strong>No-Limit</strong> Hold'em, you can bet any amount up to all of your chips at any time. This makes every decision higher stakes — a single hand can end your game or double your stack.</p>
          </section>

          {/* Hand rankings */}
          <section className="rules-section">
            <h2 className="rules-section-title">Hand Rankings <span className="rules-rank-note">(strongest → weakest)</span></h2>
            <div className="rules-rankings">
              {HAND_RANKINGS.map((h, i) => (
                <div key={i} className="rules-rank-row">
                  <span className="rules-rank-num">{i + 1}</span>
                  <span className="rules-rank-name">{h.name}</span>
                  <span className="rules-rank-example">{h.example}</span>
                  <span className="rules-rank-desc">{h.desc}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
