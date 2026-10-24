import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import type { DiffResult } from './diff';

type Path = { d: string; color: string; key: string };
type LinePair = { left: number; right: number; color: string; key: string };

function pairChangedLines(diff: DiffResult): LinePair[] {
  const previousLeft: (number | undefined)[] = new Array(diff.rows.length + 1);
  const previousRight: (number | undefined)[] = new Array(diff.rows.length + 1);
  let lastLeft: number | undefined;
  let lastRight: number | undefined;
  diff.rows.forEach((row, index) => {
    previousLeft[index] = lastLeft;
    previousRight[index] = lastRight;
    if (row.left !== null) lastLeft = row.left;
    if (row.right !== null) lastRight = row.right;
  });

  const pairs: LinePair[] = [];
  for (const hunk of diff.hunks) {
    const rows = diff.rows.slice(hunk.start, hunk.end);
    const leftRows = rows.filter(row => row.left !== null);
    const rightRows = rows.filter(row => row.right !== null);
    for (let index = 0; index < Math.max(leftRows.length, rightRows.length); index++) {
      const left = leftRows[index];
      const right = rightRows[index];
      const leftLine = left?.left ?? previousLeft[hunk.start];
      const rightLine = right?.right ?? previousRight[hunk.start];
      if (leftLine == null || rightLine == null) continue;
      pairs.push({
        left: leftLine,
        right: rightLine,
        color: left && right ? '#7046b8' : right ? '#27844c' : '#bd4540',
        key: `${hunk.start}-${index}`,
      });
    }
  }
  return pairs;
}

function firstPairAtOrAfter(pairs: LinePair[], line: number): number {
  let low = 0;
  let high = pairs.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (pairs[middle].left < line) low = middle + 1;
    else high = middle;
  }
  return low;
}

function samePaths(previous: Path[], next: Path[]): boolean {
  return previous.length === next.length && previous.every((path, index) =>
    path.key === next[index].key && path.d === next[index].d && path.color === next[index].color);
}

export default function DiffConnectors({ containerRef, editorsRef, diff, peer }: {
  containerRef: RefObject<HTMLDivElement | null>;
  editorsRef: RefObject<(EditorView | null)[]>;
  diff: DiffResult | null;
  peer: number;
}) {
  const [paths, setPaths] = useState<Path[]>([]);
  const linePairs = useMemo(() => diff ? pairChangedLines(diff) : [], [diff]);

  useEffect(() => {
    const container = containerRef.current;
    const leftView = editorsRef.current[0];
    const rightView = editorsRef.current[peer];
    if (!container || !leftView || !rightView || !diff) return;
    let frame = 0;
    const draw = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const bounds = container.getBoundingClientRect();
        const leftPane = container.querySelector<HTMLElement>('[data-side="0"]');
        const rightPane = container.querySelector<HTMLElement>(`[data-side="${peer}"]`);
        if (!leftPane || !rightPane || bounds.width === 0) return;
        const x1 = leftPane.getBoundingClientRect().right - bounds.left;
        const x2 = rightPane.getBoundingClientRect().left - bounds.left;
        if (x2 <= x1) return;

        const leftFirst = leftView.state.doc.lineAt(leftView.viewport.from).number;
        const leftLast = leftView.state.doc.lineAt(leftView.viewport.to).number;
        const rightFirst = rightView.state.doc.lineAt(rightView.viewport.from).number;
        const rightLast = rightView.state.doc.lineAt(rightView.viewport.to).number;
        const next: Path[] = [];
        for (let index = firstPairAtOrAfter(linePairs, leftFirst); index < linePairs.length && linePairs[index].left <= leftLast; index++) {
          const pair = linePairs[index];
          if (pair.right < rightFirst || pair.right > rightLast) continue;
          const leftLine = leftView.state.doc.line(pair.left);
          const rightLine = rightView.state.doc.line(pair.right);
          const a = leftView.coordsAtPos(leftLine.from);
          const b = rightView.coordsAtPos(rightLine.from);
          if (!a || !b) continue;
          const y1 = Math.round(a.top + (a.bottom - a.top) / 2 - bounds.top);
          const y2 = Math.round(b.top + (b.bottom - b.top) / 2 - bounds.top);
          if (y1 < 0 || y2 < 0 || y1 > bounds.height || y2 > bounds.height) continue;
          const bend = Math.min(42, Math.max(12, (x2 - x1) * 0.45));
          const curveHeight = Math.min(18, Math.max(9, Math.abs(y2 - y1) * 0.12));
          const parallel = Math.abs(y2 - y1) <= 2;
          const d = parallel
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1 + bend} ${y1 + curveHeight}, ${x2 - bend} ${y2 - curveHeight}, ${x2} ${y2}`;
          next.push({ d, color: pair.color, key: pair.key });
        }
        setPaths(previous => samePaths(previous, next) ? previous : next);
      });
    };
    const leftScroll = leftView.scrollDOM;
    const rightScroll = rightView.scrollDOM;
    leftScroll.addEventListener('scroll', draw, { passive: true });
    rightScroll.addEventListener('scroll', draw, { passive: true });
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    observer.observe(leftScroll);
    observer.observe(rightScroll);
    draw();
    return () => {
      cancelAnimationFrame(frame);
      leftScroll.removeEventListener('scroll', draw);
      rightScroll.removeEventListener('scroll', draw);
      observer.disconnect();
    };
  }, [containerRef, editorsRef, diff, linePairs, peer]);

  return <svg className="diff-connectors" aria-hidden="true">{paths.map(path => <path key={path.key} d={path.d} stroke={path.color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.82"/>)}</svg>;
}
