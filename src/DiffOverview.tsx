import type { DiffResult } from './diff';

type Props = {
  diff: DiffResult | null;
  leftLabel: string;
  rightLabel: string;
  onSelect: (index: number) => void;
};

export default function DiffOverview({ diff, leftLabel, rightLabel, onSelect }: Props) {
  if (!diff?.hunks.length) return null;
  const total = Math.max(1, diff.rows.length);

  return <section className="diff-overview" aria-label="差分位置マップ">
    <div className="diff-overview-title"><strong>差分位置</strong><span>マーカーをクリックして移動</span></div>
    {[leftLabel, rightLabel].map((label, side) => <div className="diff-overview-row" key={`${side}-${label}`}>
      <span className="diff-overview-label">{side === 0 ? 'A' : 'B'} <b>{label}</b></span>
      <div className="diff-overview-track">
        {diff.hunks.map((hunk, index) => {
          const changedRows = diff.rows.slice(hunk.start, hunk.end);
          const hasLeft = changedRows.some(row => row.left !== null);
          const hasRight = changedRows.some(row => row.right !== null);
          const kind = hasLeft && hasRight ? 'change' : hasLeft ? 'delete' : 'insert';
          const line = diff.rows.slice(0, hunk.start).filter(row => (side === 0 ? row.left : row.right) !== null).length;
          const position = Math.min(100, Math.max(0, (line / total) * 100));
          return <button
            key={`${hunk.start}-${hunk.end}`}
            type="button"
            className={`overview-marker marker-${kind}`}
            style={{ left: `${position}%` }}
            title={`変更 ${index + 1} · ${label}`}
            aria-label={`変更 ${index + 1} の位置へ移動 · ${label}`}
            onClick={() => onSelect(index)}
          />;
        })}
      </div>
    </div>)}
  </section>;
}
