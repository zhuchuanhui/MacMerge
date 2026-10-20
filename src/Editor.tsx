import { useEffect, useRef } from 'react';
import { EditorState, RangeSetBuilder, StateEffect, StateField, type RangeSet } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, WidgetType, gutter, keymap, lineNumbers, highlightActiveLine, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import type { Gap, LineMark } from './diff';
class GapWidget extends WidgetType {
  constructor(readonly count: number) { super(); }
  eq(other: GapWidget) { return other.count === this.count; }
  toDOM() { const el = document.createElement('div'); el.className = 'diff-gap'; el.style.height = `${this.count * 24}px`; el.setAttribute('aria-hidden', 'true'); return el; }
}
const setMarks = StateEffect.define<{ marks: LineMark[]; gaps: Gap[]; active: number[] }>();
class DiffMarker extends GutterMarker {
  constructor(readonly kind: LineMark['kind']) { super(); }
  toDOM() { const el = document.createElement('span'); el.className = `diff-marker marker-${this.kind}`; el.textContent = this.kind === 'insert' ? '+' : this.kind === 'delete' ? '−' : '~'; return el; }
  eq(other: DiffMarker) { return this.kind === other.kind; }
}
const diffMarkers = StateField.define<RangeSet<GutterMarker>>({
  create: () => new RangeSetBuilder<GutterMarker>().finish(),
  update(value, transaction) {
    const effect = transaction.effects.find(e => e.is(setMarks));
    if (!effect) return value.map(transaction.changes);
    const builder = new RangeSetBuilder<GutterMarker>(); const doc = transaction.state.doc;
    for (const mark of effect.value.marks) if (mark.line <= doc.lines) builder.add(doc.line(mark.line).from, doc.line(mark.line).from, new DiffMarker(mark.kind));
    return builder.finish();
  },
  provide: field => gutter({ class: 'diff-gutter', markers: view => view.state.field(field) })
});
const decorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    const effect = transaction.effects.find(e => e.is(setMarks));
    if (!effect) return value.map(transaction.changes);
    const { marks, gaps, active } = effect.value; const doc = transaction.state.doc; const ranges = [];
    for (const mark of marks) {
      if (mark.line > doc.lines) continue; const line = doc.line(mark.line);
      ranges.push(Decoration.line({ class: `diff-${mark.kind}${active.includes(mark.line) ? ' diff-active' : ''}` }).range(line.from));
      if (mark.from !== undefined && mark.to !== undefined) { const from = line.from + Math.min(mark.from, line.length), to = line.from + Math.min(mark.to, line.length); if (to > from) ranges.push(Decoration.mark({ class: 'diff-inline' }).range(from, to)); }
    }
    for (const gap of gaps) { const pos = gap.before <= doc.lines ? doc.line(gap.before).from : doc.length; ranges.push(Decoration.widget({ widget: new GapWidget(gap.count), block: true, side: gap.before <= doc.lines ? -1 : 1 }).range(pos)); }
    return Decoration.set(ranges, true);
  },
  provide: f => EditorView.decorations.from(f)
});
export default function Editor({ value, readOnly = false, onChange, marks, gaps, active, scrollLine, onScroll, register }: {
  value: string; readOnly?: boolean; onChange: (text: string) => void; marks: LineMark[]; gaps: Gap[]; active: number[];
  scrollLine: { line: number; tick: number }; onScroll: (top: number, sideView: EditorView) => void; register: (view: EditorView | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null), suppress = useRef(false);
  const callbacks = useRef({ onChange, onScroll, register }); callbacks.current = { onChange, onScroll, register };
  useEffect(() => {
    const editor = new EditorView({ parent: host.current!, state: EditorState.create({ doc: value, extensions: [
      lineNumbers(), highlightActiveLine(), history(), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorState.lineSeparator.of(value.includes('\r\n') ? '\r\n' : '\n'), EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly), decorations, diffMarkers,
      EditorView.updateListener.of(u => { if (u.docChanged && !suppress.current) callbacks.current.onChange(u.state.sliceDoc()); }),
      EditorView.domEventHandlers({ scroll: (_event, editor) => { callbacks.current.onScroll(editor.scrollDOM.scrollTop, editor); } })
    ] }) }); view.current = editor; callbacks.current.register(editor);
    return () => { callbacks.current.register(null); view.current = null; editor.destroy(); };
  }, []);
  useEffect(() => {
    const editor = view.current; if (!editor) return;
    suppress.current = true;
    try { if (editor.state.sliceDoc() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } }); editor.dispatch({ effects: setMarks.of({ marks, gaps, active }) }); } finally { suppress.current = false; }
  }, [value, marks, gaps, active]);
  useEffect(() => { const editor = view.current; if (!editor || scrollLine.line < 1) return; const line = editor.state.doc.line(Math.min(scrollLine.line, editor.state.doc.lines)); editor.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) }); }, [scrollLine]);
  return <div className="editor" ref={host} />;
}
