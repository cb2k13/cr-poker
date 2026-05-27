import { useEffect, useState } from 'react';

// Mirror of SEAT_POSITIONS from TableView, expressed as fractions [0,1]
const SEAT_FRAC = [
  { x: 0.50, y: 0.92 }, // 0: Player
  { x: 0.22, y: 0.82 }, // 1
  { x: 0.04, y: 0.56 }, // 2
  { x: 0.10, y: 0.22 }, // 3
  { x: 0.34, y: 0.05 }, // 4
  { x: 0.66, y: 0.05 }, // 5
  { x: 0.90, y: 0.22 }, // 6
  { x: 0.96, y: 0.56 }, // 7
  { x: 0.78, y: 0.82 }, // 8
];

const POT_FRAC = { x: 0.50, y: 0.46 };

const CHIP_COLORS = [
  { min: 1000, bg: '#FFD700', border: '#A8860B' },
  { min: 500,  bg: '#9B59B6', border: '#6C3483' },
  { min: 100,  bg: '#2C3E50', border: '#1A252F' },
  { min: 25,   bg: '#27AE60', border: '#1A7A42' },
  { min: 10,   bg: '#2980B9', border: '#1A5276' },
  { min: 5,    bg: '#E74C3C', border: '#A93226' },
  { min: 0,    bg: '#ECF0F1', border: '#95A5A6' },
];

function chipColor(amount) {
  return CHIP_COLORS.find(c => amount >= c.min) ?? CHIP_COLORS[CHIP_COLORS.length - 1];
}

function FlyingChip({ event, tableW, tableH, onDone }) {
  const fromFrac = event.fromSeat !== null ? SEAT_FRAC[event.fromSeat] : POT_FRAC;
  const toFrac   = event.toSeat   !== null ? SEAT_FRAC[event.toSeat]   : POT_FRAC;

  const fx = fromFrac.x * tableW;
  const fy = fromFrac.y * tableH;
  const dx = (toFrac.x - fromFrac.x) * tableW;
  const dy = (toFrac.y - fromFrac.y) * tableH;

  const c = chipColor(event.amount ?? 20);
  const toWinner = event.toSeat !== null;

  return (
    <div
      className={`chip-fly${toWinner ? ' chip-fly-win' : ''}`}
      style={{
        left: fx,
        top: fy,
        '--dx': `${dx}px`,
        '--dy': `${dy}px`,
        background: c.bg,
        borderColor: c.border,
        animationDelay: event.delay ? `${event.delay}ms` : '0ms',
      }}
      onAnimationEnd={onDone}
    />
  );
}

export default function ChipAnimationLayer({ events, onEventDone, containerRef }) {
  const [tableSize, setTableSize] = useState({ w: 900, h: 520 });

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setTableSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setTableSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, [containerRef]);

  return events.map(ev => (
    <FlyingChip
      key={ev.id}
      event={ev}
      tableW={tableSize.w}
      tableH={tableSize.h}
      onDone={() => onEventDone(ev.id)}
    />
  ));
}
