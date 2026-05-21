const SUITS = ['h', 'd', 'c', 's'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const getRankName = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
export const getSuitSymbol = s => ({ h: '♥', d: '♦', c: '♣', s: '♠' }[s]);
export const isRed = s => s === 'h' || s === 'd';

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === k) return [arr];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function checkStraight(sortedDesc) {
  const unique = [...new Set(sortedDesc)];
  for (let i = 0; i <= unique.length - 5; i++) {
    const s = unique.slice(i, i + 5);
    if (s[0] - s[4] === 4) return s[0];
  }
  if ([14, 5, 4, 3, 2].every(r => unique.includes(r))) return 5;
  return false;
}

function evaluateHand5(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  const straight = checkStraight(ranks);
  const freq = {};
  ranks.forEach(r => (freq[r] = (freq[r] || 0) + 1));
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const counts = entries.map(([, c]) => c);
  const byFreq = entries.map(([r]) => +r);

  if (isFlush && straight) return { rank: 8, tb: [straight], name: straight === 14 ? 'Royal Flush' : 'Straight Flush' };
  if (counts[0] === 4) return { rank: 7, tb: byFreq, name: 'Four of a Kind' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 6, tb: byFreq, name: 'Full House' };
  if (isFlush) return { rank: 5, tb: ranks, name: 'Flush' };
  if (straight) return { rank: 4, tb: [straight], name: 'Straight' };
  if (counts[0] === 3) return { rank: 3, tb: byFreq, name: 'Three of a Kind' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 2, tb: byFreq, name: 'Two Pair' };
  if (counts[0] === 2) return { rank: 1, tb: byFreq, name: 'One Pair' };
  return { rank: 0, tb: ranks, name: 'High Card' };
}

export function cmpHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tb.length, b.tb.length); i++) {
    const d = (a.tb[i] || 0) - (b.tb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Returns { winners, allEvaluated } — winners are the tied-best hands
export function getWinners(players, community) {
  const allEvaluated = players.map(p => ({ ...p, eval: bestHand([...p.hand, ...community]) }));
  let best = allEvaluated[0].eval;
  for (const e of allEvaluated) if (cmpHands(e.eval, best) > 0) best = e.eval;
  return { winners: allEvaluated.filter(e => cmpHands(e.eval, best) === 0), allEvaluated };
}

export function bestHand(cards) {
  if (cards.length === 5) return evaluateHand5(cards);
  return combinations(cards, 5).reduce((best, combo) => {
    const cur = evaluateHand5(combo);
    return cmpHands(cur, best) > 0 ? cur : best;
  }, evaluateHand5(combinations(cards, 5)[0]));
}


// AI strategy
function preFlopStrength([c1, c2]) {
  const [hi, lo] = [c1, c2].sort((a, b) => b.rank - a.rank);
  if (hi.rank === lo.rank) return 0.5 + ((hi.rank - 2) / 12) * 0.45;
  let s = ((hi.rank - 2) / 12) * 0.3 + ((lo.rank - 2) / 12) * 0.15;
  if (hi.suit === lo.suit) s += 0.06;
  if (Math.abs(hi.rank - lo.rank) === 1) s += 0.05;
  return Math.min(s, 0.92);
}

function postFlopStrength(hand, community) {
  const h = bestHand([...hand, ...community]);
  return Math.min(h.rank / 8 + (h.tb[0] || 0) / 112, 1);
}

export function getAIAction(aiHand, community, pot, currentBet, aiBet, aiChips, bigBlind) {
  const toCall = Math.min(currentBet - aiBet, aiChips);
  const strength = community.length === 0
    ? preFlopStrength(aiHand)
    : postFlopStrength(aiHand, community);

  const bluff = Math.random() < 0.11;
  const eff = bluff ? Math.min(strength + 0.35, 1) : strength;

  if (toCall <= 0) {
    if (eff > 0.52 || bluff) {
      const bet = Math.min(Math.max(Math.floor(pot * (0.5 + eff * 0.8)), bigBlind), aiChips);
      return { action: 'raise', amount: bet };
    }
    return { action: 'check' };
  }

  const potOdds = toCall / (pot + toCall);
  if (eff > 0.75) {
    if (Math.random() > 0.45 && aiChips > currentBet * 2) {
      const raise = Math.min(currentBet * 2 + Math.floor(pot * 0.5), aiChips);
      return { action: 'raise', amount: raise };
    }
    return { action: 'call' };
  }
  if (eff > potOdds - 0.05) return { action: 'call' };
  return { action: 'fold' };
}

// Canvas card texture
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function createCardTexture(card, faceDown = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 358;
  const ctx = canvas.getContext('2d');

  if (faceDown) {
    const g = ctx.createLinearGradient(0, 0, 256, 358);
    g.addColorStop(0, '#1a237e');
    g.addColorStop(1, '#283593');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, 256, 358, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    roundRect(ctx, 10, 10, 236, 338, 14);
    ctx.stroke();
    // grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      for (let j = 0; j < 26; j++) {
        ctx.save();
        ctx.translate(20 + i * 13, 16 + j * 13);
        ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('♠ POKER ♠', 128, 186);
    return canvas;
  }

  const red = card.suit === 'h' || card.suit === 'd';
  const color = red ? '#cc0000' : '#111111';
  const suitSym = getSuitSymbol(card.suit);
  const rankStr = getRankName(card.rank);

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, 256, 358, 20);
  ctx.fill();
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, 254, 356, 20);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(rankStr, 14, 56);
  ctx.font = '32px Arial, sans-serif';
  ctx.fillText(suitSym, 18, 88);

  ctx.save();
  ctx.translate(256, 358);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(rankStr, 14, 56);
  ctx.font = '32px Arial, sans-serif';
  ctx.fillText(suitSym, 18, 88);
  ctx.restore();

  ctx.fillStyle = color;
  ctx.font = '110px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(suitSym, 128, 215);

  return canvas;
}
