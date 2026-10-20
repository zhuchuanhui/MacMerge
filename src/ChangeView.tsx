import type { DiffResult, Row } from './diff';

type ViewMode = 'side-by-side' | 'fluid' | 'unified';
type ChangePair = { left?: Row; right?: Row };

function pairedRows(diff: DiffResult, start: number, end: number): ChangePair[] {
  const rows = diff.rows.slice(start, end);
  const left = rows.filter(row => row.left !== null);
  const right = rows.filter(row => row.right !== null);
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => ({ left: left[index], right: right[index] }));
}

export default function ChangeView({ mode, diff, leftName, rightName, active, onSelect }: {
  mode: Exclude<ViewMode, 'side-by-side'>; diff: DiffResult | null; leftName: string; rightName: string;
  active: number; onSelect: (index: number) => void;
}) {
  if (!diff) return <section className={`change-view ${mode}`} aria-live="polite"><p className="change-view-empty">比較を準備しています…</p></section>;
  if (!diff.hunks.length) return <section className={`change-view ${mode}`}><p className="change-view-empty">差分はありません</p></section>;

  return <section className={`change-view ${mode}`} aria-label={mode === 'fluid' ? 'Fluid View 差分一覧' : '統合差分一覧'}>
    {diff.hunks.map((hunk, index) => {
      const pairs = pairedRows(diff, hunk.start, hunk.end);
      return <article className={`change-card ${index === active ? 'selected' : ''}`} key={`${hunk.start}-${hunk.end}`} onClick={() => onSelect(index)}>
        <header className="change-card-head"><strong>変更 {index + 1}</strong><span>{leftName} ↔ {rightName}</span></header>
        {mode === 'fluid' ? <div className="fluid-lines"><div className="fluid-column-labels"><span>{leftName}</span><span>{rightName}</span></div>{pairs.map((pair, rowIndex) => <div className="fluid-line-pair" key={rowIndex}>
          <div className={`change-line ${pair.left ? pair.right ? 'line-changed' : 'line-deleted' : 'line-empty'}`}><span className="line-number">{pair.left?.left ?? ''}</span><span className="line-sign">{pair.left ? '−' : ''}</span><code>{pair.left?.text ?? ''}</code></div>
          <div className={`change-line ${pair.right ? pair.left ? 'line-changed' : 'line-inserted' : 'line-empty'}`}><span className="line-number">{pair.right?.right ?? ''}</span><span className="line-sign">{pair.right ? '+' : ''}</span><code>{pair.right?.text ?? ''}</code></div>
        </div>)}</div> : <div className="unified-lines">{pairs.map((pair, rowIndex) => <div className="unified-line-pair" key={rowIndex}>
          {pair.left && <div className={`change-line ${pair.right ? 'line-changed line-old' : 'line-deleted'}`}><span className="file-label">{leftName}</span><span className="line-number">{pair.left.left}</span><span className="line-sign">−</span><code>{pair.left.text}</code></div>}
          {pair.right && <div className={`change-line ${pair.left ? 'line-changed line-new' : 'line-inserted'}`}><span className="file-label">{rightName}</span><span className="line-number">{pair.right.right}</span><span className="line-sign">+</span><code>{pair.right.text}</code></div>}
        </div>)}</div>}
      </article>;
    })}
  </section>;
}
