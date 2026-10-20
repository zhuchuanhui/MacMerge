export type Row = { kind: 'equal' | 'insert' | 'delete'; left: number | null; right: number | null; text: string };
export type DiffResult = { rows: Row[]; hunks: { start: number; end: number }[] };
export type LineMark = { line: number; kind: 'change' | 'insert' | 'delete'; from?: number; to?: number };
export type Gap = { before: number; count: number };
export function linesWithEndings(text: string): string[] { return text.match(/[^\n]*\n|[^\n]+$/g) ?? []; }
export function adoptHunk(texts: [string, string], diff: DiffResult, index: number, source: 0 | 1): [string, string] {
  const h = diff.hunks[index]; if (!h) return texts;
  const target = source === 0 ? 1 : 0;
  const sourceKey = source === 0 ? 'left' : 'right', targetKey = target === 0 ? 'left' : 'right';
  const before = diff.rows.slice(0, h.start);
  const sourceStart = before.filter(row => row[sourceKey] !== null).length;
  const targetStart = before.filter(row => row[targetKey] !== null).length;
  const rows = diff.rows.slice(h.start, h.end);
  const sourceCount = rows.filter(row => row[sourceKey] !== null).length;
  const targetCount = rows.filter(row => row[targetKey] !== null).length;
  const replacement = linesWithEndings(texts[source]).slice(sourceStart, sourceStart + sourceCount);
  const result = linesWithEndings(texts[target]); result.splice(targetStart, targetCount, ...replacement);
  const next: [string, string] = [...texts]; next[target] = result.join(''); return next;
}
export function presentation(diff: DiffResult | null): [{ marks: LineMark[]; gaps: Gap[] }, { marks: LineMark[]; gaps: Gap[] }] {
  const result: [{ marks: LineMark[]; gaps: Gap[] }, { marks: LineMark[]; gaps: Gap[] }] = [{ marks: [], gaps: [] }, { marks: [], gaps: [] }];
  if (!diff) return result;
  for (const h of diff.hunks) {
    const block = diff.rows.slice(h.start, h.end);
    const left = block.filter(r => r.left !== null), right = block.filter(r => r.right !== null);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const a = left[i], b = right[i]; let prefix = 0, suffix = 0;
      if (a && b) { while (prefix < Math.min(a.text.length, b.text.length) && a.text[prefix] === b.text[prefix]) prefix++; while (suffix < Math.min(a.text.length, b.text.length) - prefix && a.text[a.text.length - 1 - suffix] === b.text[b.text.length - 1 - suffix]) suffix++; }
      if (a) result[0].marks.push({ line: a.left!, kind: b ? 'change' : 'delete', from: b ? prefix : undefined, to: b ? a.text.length - suffix : undefined });
      if (b) result[1].marks.push({ line: b.right!, kind: a ? 'change' : 'insert', from: a ? prefix : undefined, to: a ? b.text.length - suffix : undefined });
    }
    for (const side of [0, 1] as const) {
      const count = Math.abs(left.length - right.length);
      if (count && (side === 0 ? left.length < right.length : right.length < left.length)) {
        const key = side === 0 ? 'left' : 'right';
        result[side].gaps.push({ before: diff.rows.slice(0, h.end).filter(r => r[key] !== null).length + 1, count });
      }
    }
  }
  return result;
}
