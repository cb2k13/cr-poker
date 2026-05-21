import { isRed, getRankName, getSuitSymbol } from '../../utils/poker';

export default function PlayingCard({ card, faceDown = false, large = false, tiny = false }) {
  const cls = `pcard${large ? ' pcard-lg' : ''}${tiny ? ' pcard-tiny' : ''}`;

  if (faceDown || !card) {
    return <div className={`${cls} pcard-back`}><div className="pcard-back-inner" /></div>;
  }

  const red = isRed(card.suit);
  const rank = getRankName(card.rank);
  const suit = getSuitSymbol(card.suit);
  const colorCls = red ? 'pcard-red' : 'pcard-black';

  return (
    <div className={`${cls} pcard-face ${colorCls}`}>
      <div className="pcard-corner pcard-tl">
        <div className="pcard-rank">{rank}</div>
        <div className="pcard-suit-sm">{suit}</div>
      </div>
      <div className="pcard-suit-center">{suit}</div>
      <div className="pcard-corner pcard-br">
        <div className="pcard-rank">{rank}</div>
        <div className="pcard-suit-sm">{suit}</div>
      </div>
    </div>
  );
}
