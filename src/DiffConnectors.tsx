import { useEffect, useState, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import type { DiffResult } from './diff';

type Path = { d: string; color: string; key: string };

export default function DiffConnectors({ containerRef, editorsRef, diff, peer }: {
  containerRef: RefObject<HTMLDivElement | null>;
  editorsRef: RefObject<(EditorView | null)[]>;
  diff: DiffResult | null;
  peer: number;
}) {
  const [paths, setPaths] = useState<Path[]>([]);
  useEffect(() => {
    const container = containerRef.current;
    const leftView = editorsRef.current[0];
    const rightView = editorsRef.current[peer];
    if (!container || !leftView || !rightView || !diff) return;
    let frame = 0;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = container.getBoundingClientRect();
        const leftPane = container.querySelector<HTMLElement>('[data-side="0"]');
        const rightPane = container.querySelector<HTMLElement>(`[data-side="${peer}"]`);
        if (!leftPane || !rightPane || bounds.width === 0) return;
        const x1 = leftPane.getBoundingClientRect().right - bounds.left;
        const x2 = rightPane.getBoundingClientRect().left - bounds.left;
        if (x2 <= x1) return;
        const next: Path[] = [];
        for (const hunk of diff.hunks) {
          const changes = diff.rows.slice(hunk.start, hunk.end);
          const leftRows = changes.filter(row => row.left !== null);
          const rightRows = changes.filter(row => row.right !== null);
          for (let index = 0; index < Math.max(leftRows.length, rightRows.length); index++) {
            const left = leftRows[index], right = rightRows[index];
            const leftLine = left?.left ?? diff.rows.slice(0, hunk.start).reverse().find(row => row.left !== null)?.left;
            const rightLine = right?.right ?? diff.rows.slice(0, hunk.start).reverse().find(row => row.right !== null)?.right;
            if (leftLine == null || rightLine == null) continue;
            const a = leftView.coordsAtPos(leftView.state.doc.line(Math.min(leftLine, leftView.state.doc.lines)).from);
            const b = rightView.coordsAtPos(rightView.state.doc.line(Math.min(rightLine, rightView.state.doc.lines)).from);
            if (!a || !b) continue;
            const y1 = a.top + (a.bottom - a.top) / 2 - bounds.top;
            const y2 = b.top + (b.bottom - b.top) / 2 - bounds.top;
            if (y1 < 0 || y2 < 0 || y1 > bounds.height || y2 > bounds.height) continue;
            const bend = Math.min(42, Math.max(12, (x2 - x1) * 0.45));
            const parallel = Math.abs(y2 - y1) <= 2;
            const curveHeight = Math.min(18, Math.max(9, Math.abs(y2 - y1) * 0.12));
            const color = left && right ? '#7046b8' : right ? '#27844c' : '#bd4540';
            const d = parallel
              ? `M ${x1} ${y1} L ${x2} ${y2}`
              : `M ${x1} ${y1} C ${x1 + bend} ${y1 + curveHeight}, ${x2 - bend} ${y2 - curveHeight}, ${x2} ${y2}`;
            next.push({ d, color, key: `${hunk.start}-${index}` });
            if (next.length >= 100) break;
          }
          if (next.length >= 100) break;
        }
        setPaths(next);
      });
    };
    const leftScroll = leftView.scrollDOM, rightScroll = rightView.scrollDOM;
    leftScroll.addEventListener('scroll', draw, { passive: true }); rightScroll.addEventListener('scroll', draw, { passive: true });
    const observer = new ResizeObserver(draw); observer.observe(container); observer.observe(leftScroll); observer.observe(rightScroll);
    draw();
    return () => { cancelAnimationFrame(frame); leftScroll.removeEventListener('scroll', draw); rightScroll.removeEventListener('scroll', draw); observer.disconnect(); };
  }, [containerRef, editorsRef, diff, peer]);
  return <svg className="diff-connectors" aria-hidden="true">{paths.map(path => <path key={path.key} d={path.d} stroke={path.color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.82"/>)}</svg>;
}
