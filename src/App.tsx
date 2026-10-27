import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm, open, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { EditorView } from '@codemirror/view';
import Editor from './Editor';
import ChangeView from './ChangeView';
import DiffConnectors from './DiffConnectors';
import DiffOverview from './DiffOverview';
import FolderCompareView from './FolderCompareView';
import { adoptHunk, presentation, type DiffResult } from './diff';
import { createFolderHtmlReport, createHtmlReport } from './report';

type DocumentFormat = 'text' | 'pdf' | 'docx' | 'odt' | 'pptx' | 'spreadsheet' | 'folder';
type Document = { path: string; text: string; saved: string; format: DocumentFormat; pageCount: number | null; itemCount: number | null; skippedCount: number | null };
type LoadedDocument = { text: string; format: DocumentFormat; pageCount: number | null; itemCount: number | null; skippedCount: number | null };
type Recent = { paths: string[]; date: number; changes: number };
type Side = 0 | 1 | 2 | 3 | 4;
const MAX_OPEN_FILES = 20;
const MAX_VISIBLE_PANES = 5;
const MAX_OPEN_TEXT_BYTES = 100 * 1024 * 1024;
const SIDE_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
type ViewMode = 'side-by-side' | 'fluid' | 'unified';
type Language = 'ja' | 'en' | 'zh-Hans' | 'zh-Hant';
const languageKey = 'macmerge.language.v1';
const messages: Record<Language, Record<string, string>> = {
  ja: {recent:'最近の比較',files:'開いているファイル',guide:'使い方',start:'MacMergeをはじめる',open:'ファイルを開く',folderCompare:'フォルダ比較',drag:'ドラッグして比較',drop:'テキスト・PDF・Officeファイルやフォルダをここにドロップ',click:'またはクリックしてファイルを選択',history:'比較履歴',first:'最初の比較をはじめましょう',addHistory:'ファイルを追加すると、比較履歴がここに表示されます。',none:'開いているファイルはありません',multiple:'複数ファイルをまとめて追加できます。',local:'ファイルはこのデバイス内で処理',close:'閉じる',language:'表示言語',viewModes:'比較表示モード',add:'ファイルを追加',back:'開始画面へ',side:'左右に並べる',unified:'統合表示',sync:'同期',syncOn:'同期: オン',syncOff:'同期: オフ',shelf:'ファイル',choose:'ファイルを選択',replace:'ファイルを置き換え',save:'保存',report:'レポート作成',readonly:'読み取り専用',loading:'処理中…',next:'次の変更',previous:'前の変更',noDiff:'差分なし',dropOverlay:'ファイルをドロップして比較',dropMore:'複数ファイルをまとめて追加できます',compareAgainst:'比較ペア',baseline:'基準ファイル',baselineHint:'選んだファイルをAに設定',changes:'件の変更',pairOnly:'選択ペアのみ',allFiles:'全ファイル',showing:'表示中',unsavedClose:'未保存の変更があります。保存せずに終了しますか？'},
  en: {recent:'Recent comparisons',files:'Open files',guide:'How to use',start:'Welcome to MacMerge',open:'Open files',folderCompare:'Compare folders',drag:'Drop files to compare',drop:'Drop text, PDF, Office files, or folders here',click:'or click to choose files',history:'Comparison history',first:'Start your first comparison',addHistory:'Your comparisons will appear here after you add files.',none:'No open files',multiple:'Add multiple files at once.',local:'Files stay on this device',close:'Close',language:'Language',viewModes:'Comparison view modes',add:'Add files',back:'Home',side:'Side by side',unified:'Unified view',sync:'Sync',syncOn:'Sync: On',syncOff:'Sync: Off',shelf:'Files',choose:'Choose file',replace:'Replace file',save:'Save',report:'Create report',readonly:'Read only',loading:'Working…',next:'Next change',previous:'Previous change',noDiff:'No differences',dropOverlay:'Drop files to compare',dropMore:'You can add multiple files at once',compareAgainst:'Comparison pairs',baseline:'Baseline file',baselineHint:'Set selected file as A',changes:'changes',pairOnly:'Selected pair only',allFiles:'All files',showing:'Showing',unsavedClose:'You have unsaved changes. Quit without saving?'},
  'zh-Hans': {recent:'最近比较',files:'已打开的文件',guide:'使用方法',start:'开始使用 MacMerge',open:'打开文件',folderCompare:'比较文件夹',drag:'拖放文件以进行比较',drop:'将文本、PDF、Office 文件或文件夹拖放到此处',click:'或点击选择文件',history:'比较历史',first:'开始首次比较',addHistory:'添加文件后，比较记录将显示在这里。',none:'没有已打开的文件',multiple:'可以一次添加多个文件。',local:'文件仅在此设备上处理',close:'关闭',language:'显示语言',viewModes:'比较显示模式',add:'添加文件',back:'返回首页',side:'并排显示',unified:'合并视图',sync:'同步',syncOn:'同步：开',syncOff:'同步：关',shelf:'文件',choose:'选择文件',replace:'替换文件',save:'保存',report:'生成报告',readonly:'只读',loading:'处理中…',next:'下一个更改',previous:'上一个更改',noDiff:'没有差异',dropOverlay:'拖放文件以进行比较',dropMore:'可以一次添加多个文件',compareAgainst:'比较文件对',baseline:'基准文件',baselineHint:'将所选文件设为 A',changes:'处更改',pairOnly:'仅显示所选文件对',allFiles:'所有文件',showing:'当前显示',unsavedClose:'有未保存的更改。要放弃更改并退出吗？'},
  'zh-Hant': {recent:'最近的比較',files:'已開啟的檔案',guide:'使用說明',start:'開始使用 MacMerge',open:'開啟檔案',folderCompare:'比較資料夾',drag:'拖放檔案以進行比較',drop:'將文字、PDF、Office 檔案或資料夾拖放到這裡',click:'或點擊選擇檔案',history:'比較記錄',first:'開始第一次比較',addHistory:'新增檔案後，比較記錄會顯示在這裡。',none:'沒有已開啟的檔案',multiple:'可以一次新增多個檔案。',local:'檔案只在這部裝置上處理',close:'關閉',language:'顯示語言',viewModes:'比較顯示模式',add:'新增檔案',back:'回到首頁',side:'並排顯示',unified:'整合檢視',sync:'同步',syncOn:'同步：開',syncOff:'同步：關',shelf:'檔案',choose:'選擇檔案',replace:'取代檔案',save:'儲存',report:'建立報告',readonly:'唯讀',loading:'處理中…',next:'下一個變更',previous:'上一個變更',noDiff:'沒有差異',dropOverlay:'拖放檔案以進行比較',dropMore:'可以一次新增多個檔案',compareAgainst:'比較組合',baseline:'基準檔案',baselineHint:'將所選檔案設為 A',changes:'項變更',pairOnly:'只顯示所選組合',allFiles:'所有檔案',showing:'目前顯示',unsavedClose:'有尚未儲存的變更。要放棄變更並結束嗎？'},
};
const viewModeKey = 'macmerge.view-mode.v1';
function readViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(viewModeKey);
    return saved === 'fluid' || saved === 'unified' ? saved : 'side-by-side';
  } catch {
    return 'side-by-side';
  }
}
const nameOf = (path: string) => path.split(/[\\/]/).pop() || path;
const folderOf = (path: string) => path.split(/[\\/]/).slice(0, -1).pop() || '';
function documentSummary(doc: Document, language: Language) {
  const traditional = language === 'zh-Hant';
  if (doc.format === 'text') return `${doc.text.split('\n').length}${language === 'en' ? ' lines' : language.startsWith('zh') ? ' 行' : ' 行'}`;
  if (doc.format === 'pdf') return `PDF · ${doc.pageCount ?? '?'}${language === 'en' ? ' pages' : language.startsWith('zh') ? ' 頁' : 'ページ'} · ${language === 'en' ? 'extracted text' : traditional ? '擷取文字' : language.startsWith('zh') ? '提取文本' : '抽出テキスト'}`;
  if (doc.format === 'spreadsheet') return `${language === 'en' ? 'Spreadsheet' : traditional ? '試算表' : language.startsWith('zh') ? '表格' : '表計算'} · ${doc.itemCount ?? '?'}${language === 'en' ? ' sheets' : traditional ? ' 個工作表' : language.startsWith('zh') ? ' 个工作表' : 'シート'} · ${language === 'en' ? 'read only' : traditional ? '唯讀' : language.startsWith('zh') ? '只读' : '読み取り専用'}`;
  if (doc.format === 'pptx') return `PowerPoint · ${doc.itemCount ?? '?'}${language === 'en' ? ' slides' : traditional ? ' 張投影片' : language.startsWith('zh') ? ' 张幻灯片' : 'スライド'} · ${language === 'en' ? 'read only' : traditional ? '唯讀' : language.startsWith('zh') ? '只读' : '読み取り専用'}`;
  if (doc.format === 'docx' || doc.format === 'odt') return `${doc.format === 'odt' ? 'OpenDocument' : 'Word'} · ${language === 'en' ? 'extracted text · read only' : traditional ? '擷取文字 · 唯讀' : language.startsWith('zh') ? '提取文本 · 只读' : '抽出テキスト · 読み取り専用'}`;
  const skipped = doc.skippedCount ?? 0;
  return `${language === 'en' ? 'Folder' : traditional ? '資料夾' : language.startsWith('zh') ? '文件夹' : 'フォルダ'} · ${doc.itemCount ?? 0}${language === 'en' ? ' files' : traditional ? ' 個檔案' : language.startsWith('zh') ? ' 个文件' : 'ファイル'}${skipped ? (language === 'en' ? ` · ${skipped} skipped` : traditional ? ` · 略過 ${skipped} 項` : language.startsWith('zh') ? ` · 跳过 ${skipped} 项` : ` · ${skipped}件を除外`) : ''} · ${language === 'en' ? 'read only' : traditional ? '唯讀' : language.startsWith('zh') ? '只读' : '読み取り専用'}`;
}
const recentKey = 'macmerge.recents.v1';
function readRecents(): Recent[] { try { const data = JSON.parse(localStorage.getItem(recentKey) || '[]'); return Array.isArray(data) ? data.filter(r => Array.isArray(r.paths) && r.paths.length >= 2 && r.paths.length <= MAX_VISIBLE_PANES && r.paths.every((p: unknown) => typeof p === 'string') && typeof r.date === 'number').slice(0, 12) : []; } catch { return []; } }
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    files: <><rect x="8" y="3" width="12" height="15" rx="2"/><path d="M15 18v3H4V7h4M12 7h4M12 11h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6H7"/></>,
    folder: <path d="M3 7V5h7l2 3h9v12H3V7Z"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="m14 5 7 7-7 7M21 12H3"/>,
    back: <path d="m14 5-7 7 7 7"/>,
    up: <path d="m6 15 6-6 6 6"/>, down: <path d="m6 9 6 6 6-6"/>,
    split: <><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></>,
    flow: <><path d="M4 7h5a3 3 0 0 1 0 6H7a3 3 0 0 0 0 6h13"/><path d="m16 15 4 4-4 4"/></>,
    list: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 12h8M8 15h8"/></>,
    save: <><path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/></>,
    guide: <><path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4ZM12 6v15"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    swap: <><path d="M3 8h17l-4-4M21 16H4l4 4"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.files}</svg>;
}
export default function App() {
  const [language, setLanguage] = useState<Language>(() => { try { const saved = localStorage.getItem(languageKey); return saved === 'en' || saved === 'zh-Hans' || saved === 'zh-Hant' ? saved : saved === 'zh' ? 'zh-Hans' : 'ja'; } catch { return 'ja'; } });
  const t = (key: string) => messages[language][key] ?? messages.ja[key] ?? key;
  useEffect(() => { try { localStorage.setItem(languageKey, language); } catch { /* language remains available during this session */ } void invoke('set_app_language', { language }).catch(() => {}); }, [language]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pair, setPair] = useState<string[]>(Array(MAX_VISIBLE_PANES).fill(''));
  const [screen, setScreen] = useState<'home' | 'compare'>('home');
  const [section, setSection] = useState<'recent' | 'files' | 'guide'>('recent');
  const [recents, setRecents] = useState<Recent[]>(readRecents);
  const [diff, setDiff] = useState<(DiffResult | null)[]>(Array(MAX_VISIBLE_PANES - 1).fill(null));
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [dropSide, setDropSide] = useState<Side | undefined>();
  const [focusedSide, setFocusedSide] = useState<Side>(1);
  const [selectedFolderFile, setSelectedFolderFile] = useState('');
  const [scroll, setScroll] = useState<{ line: number; tick: number }[]>(Array.from({ length: MAX_VISIBLE_PANES }, () => ({ line: 0, tick: 0 })));
  const [syncScroll, setSyncScroll] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [showAllFiles, setShowAllFiles] = useState(true);
  const stateRef = useRef({ documents, pair, screen }); stateRef.current = { documents, pair, screen };
  const hasUnsavedChanges = useRef(false);
  hasUnsavedChanges.current = documents.some(doc => doc.format === 'text' && doc.text !== doc.saved);
  const allowClose = useRef(false);
  const closePromptOpen = useRef(false);
  const busyRef = useRef(false);
  const editors = useRef<(EditorView | null)[]>(Array(MAX_VISIBLE_PANES).fill(null));
  const panelsRef = useRef<HTMLDivElement>(null);
  const dropHandler = useRef<(paths: string[], side?: Side) => void>(() => {});
  const selected = pair.map(path => documents.find(d => d.path === path));
  const left = selected[0], right = selected[1];
  const activePeer = focusedSide > 0 && selected[focusedSide] ? focusedSide : Math.max(1, selected.findIndex((doc, index) => index > 0 && !!doc));
  const visibleDiff = diff[activePeer - 1] ?? null;
  const visual = useMemo(() => diff.map(result => presentation(result)), [diff]);
  const paneCount = Math.max(2, ...selected.map((doc, index) => doc ? index + 1 : 0));
  const visibleSides: Side[] = showAllFiles || paneCount <= 2 ? Array.from({ length: paneCount }, (_, index) => index as Side) : [0, activePeer as Side];
  const visiblePaneCount = visibleSides.length;
  const flowEnabled = viewMode === 'fluid' && visiblePaneCount === 2;
  const comparePaths = selected.map(doc => doc?.path).filter((path): path is string => !!path);
  const hunk = visibleDiff?.hunks[active];
  const activeRows = hunk ? visibleDiff!.rows.slice(hunk.start, hunk.end) : [];
  const additions = visibleDiff?.rows.filter(r => r.kind === 'insert').length ?? 0;
  const deletions = visibleDiff?.rows.filter(r => r.kind === 'delete').length ?? 0;
  const folderPeer = selected[activePeer];
  const folderComparison = left?.format === 'folder' && folderPeer?.format === 'folder';

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    const appWindow = getCurrentWindow();
    appWindow.onCloseRequested(async event => {
      if (!hasUnsavedChanges.current || allowClose.current) return;
      event.preventDefault();
      if (closePromptOpen.current) return;
      closePromptOpen.current = true;
      try {
        if (await confirm(t('unsavedClose'), { title: 'MacMerge', kind: 'warning' })) {
          allowClose.current = true;
          await appWindow.close();
        }
      } catch (cause) {
        setError(`終了確認を表示できませんでした: ${String(cause)}`);
      } finally {
        closePromptOpen.current = false;
      }
    }).then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(cause => {
      if (!disposed) setError(`終了確認を開始できませんでした: ${String(cause)}`);
    });
    listen('macmerge-exit-requested', async () => {
      if (closePromptOpen.current) return;
      closePromptOpen.current = true;
      try {
        if (!hasUnsavedChanges.current || await confirm(t('unsavedClose'), { title: 'MacMerge', kind: 'warning' })) {
          await invoke('request_app_exit');
        }
      } catch (cause) {
        setError(`終了確認を表示できませんでした: ${String(cause)}`);
      } finally {
        closePromptOpen.current = false;
      }
    }).then(fn => { if (disposed) fn(); else unlistenExit = fn; }).catch(cause => {
      if (!disposed) setError(`終了確認を開始できませんでした: ${String(cause)}`);
    });
    return () => { disposed = true; unlisten?.(); unlistenExit?.(); };
  }, [language]);

  async function loadPaths(paths: string[], side?: Side) {
    if (busyRef.current || !paths.length) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('ファイルを読み込んでいます…');
    const current = stateRef.current; const loaded: Document[] = []; const failures: string[] = [];
    let currentBytes = current.documents.reduce((sum, doc) => sum + new TextEncoder().encode(doc.text).length, 0);
    let hitFileLimit = false, hitMemoryLimit = false;
    try {
      for (const path of [...new Set(paths)]) {
        const existing = current.documents.find(d => d.path === path);
        if (existing) { loaded.push(existing); continue; }
        if (current.documents.length + loaded.filter(d => !current.documents.some(existingDoc => existingDoc.path === d.path)).length >= MAX_OPEN_FILES) { hitFileLimit = true; break; }
        try {
          const content = await invoke<LoadedDocument>('read_text_document', { path });
          const text = content.text;
          const bytes = new TextEncoder().encode(text).length;
          if (currentBytes + bytes > MAX_OPEN_TEXT_BYTES) { hitMemoryLimit = true; break; }
          currentBytes += bytes; loaded.push({ path, text, saved: text, format: content.format, pageCount: content.pageCount, itemCount: content.itemCount, skippedCount: content.skippedCount });
        }
        catch (e) { failures.push(`${nameOf(path)}: ${String(e)}`); }
      }
      if (loaded.length) {
        setDocuments(prev => [...prev, ...loaded.filter(d => !prev.some(p => p.path === d.path))]);
        let next = [...current.pair];
        if (side !== undefined) { loaded.slice(0, MAX_VISIBLE_PANES - side).forEach((doc, index) => { next[side + index] = doc.path; }); }
        else if (loaded.length >= 2) { next = Array(MAX_VISIBLE_PANES).fill(''); loaded.slice(0, MAX_VISIBLE_PANES).forEach((doc, index) => { next[index] = doc.path; }); }
        else if (current.screen === 'compare' && current.pair[0]) { const slot = next.findIndex((path, index) => index > 0 && !path); next[slot > 0 ? slot : 1] = loaded[0].path; }
        else { next[0] = loaded[0].path; }
        setPair(next); setActive(0); setScreen('compare');
        setNotice(hitFileLimit ? `読み込み上限は${MAX_OPEN_FILES}ファイルです。残りは追加していません` : hitMemoryLimit ? '合計100MBの読み込み上限に達しました。残りは追加していません' : loaded.length > 2 ? `${loaded.length}ファイルを追加しました。A〜Eから最大5ファイルを表示できます` : '');
      } else setNotice(hitFileLimit ? `読み込み上限は${MAX_OPEN_FILES}ファイルです` : hitMemoryLimit ? '合計100MBの読み込み上限に達しました' : '');
      if (failures.length) setError(failures.join('\n'));
    } finally { setBusy(false); busyRef.current = false; }
  }
  dropHandler.current = (paths, side) => { void loadPaths(paths, side); };
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === 'leave') { setDragging(false); setDropSide(undefined); return; }
      const el = document.elementFromPoint(payload.position.x / window.devicePixelRatio, payload.position.y / window.devicePixelRatio);
      const value = el?.closest('[data-side]')?.getAttribute('data-side'); const numericSide = value === null || value === undefined ? NaN : Number(value); const side: Side | undefined = Number.isInteger(numericSide) && numericSide >= 0 && numericSide < MAX_VISIBLE_PANES ? numericSide as Side : undefined;
      if (payload.type === 'drop') { setDragging(false); setDropSide(undefined); dropHandler.current(payload.paths, side); }
      else { setDragging(true); setDropSide(side); }
    }).then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(e => { if (!disposed) setError(`ドラッグ受付を開始できませんでした: ${String(e)}`); });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  useEffect(() => {
    let cancelled = false; setDiff(Array(MAX_VISIBLE_PANES - 1).fill(null));
    if (!selected[0]) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const results: (DiffResult | null)[] = Array(MAX_VISIBLE_PANES - 1).fill(null);
        const order = [activePeer - 1, ...Array.from({ length: MAX_VISIBLE_PANES - 1 }, (_, index) => index).filter(index => index !== activePeer - 1)];
        try {
          for (const index of order) {
            const peer = selected[index + 1];
            if (!peer) continue;
            results[index] = await invoke<DiffResult>('compare_text', { left: selected[0]!.text, right: peer.text });
            if (cancelled) return;
            setDiff([...results]);
          }
          if (!cancelled) setActive(0);
        } catch (e) { if (!cancelled) setError(`比較に失敗しました: ${String(e)}`); }
      })();
    }, 80);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pair.join('\0'), ...selected.map(d => d?.text)]);
  useEffect(() => { if (visibleDiff) setActive(index => Math.min(index, Math.max(0, visibleDiff.hunks.length - 1))); }, [visibleDiff, focusedSide]);
  useEffect(() => {
    if (!comparePaths.length || !diff.some(Boolean)) return;
    setRecents(prev => [{ paths: comparePaths, date: Date.now(), changes: diff.reduce((sum, result) => sum + (result?.hunks.length ?? 0), 0) }, ...prev.filter(r => r.paths.join('\0') !== comparePaths.join('\0'))].slice(0, 12));
  }, [diff]);
  useEffect(() => { try { localStorage.setItem(recentKey, JSON.stringify(recents)); } catch { /* history remains available during this session */ } }, [recents]);
  useEffect(() => { try { localStorage.setItem(viewModeKey, viewMode); } catch { /* mode remains available during this session */ } }, [viewMode]);
  async function choose(side?: Side) { try { const selected = await open({ multiple: true, directory: false, title: '比較するテキスト・PDF・Officeファイルを選択' }); if (selected) await loadPaths(typeof selected === 'string' ? [selected] : selected, side); } catch (e) { setError(String(e)); } }
  async function chooseFolders() { try { const selected = await open({ multiple: true, directory: true, title: '比較するフォルダを2つ選択' }); if (selected) await loadPaths(typeof selected === 'string' ? [selected] : selected); } catch (e) { setError(String(e)); } }
  function edit(path: string, text: string) { setDiff(Array(MAX_VISIBLE_PANES - 1).fill(null)); setDocuments(prev => prev.map(d => d.path === path ? { ...d, text } : d)); }
  async function save(side: Side) {
    const doc = selected[side]; if (!doc || doc.format !== 'text' || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { const snapshot = doc.text; await invoke('save_text_atomic', { path: doc.path, content: snapshot, expectedContent: doc.saved }); setDocuments(prev => prev.map(d => d.path === doc.path ? { ...d, saved: snapshot } : d)); setNotice(`${nameOf(doc.path)} を保存しました`); }
    catch (e) { setError(`保存に失敗しました: ${String(e)}`); }
    finally { setBusy(false); busyRef.current = false; }
  }
  function navigate(direction: number) {
    const currentDiff = visibleDiff; if (!currentDiff?.hunks.length) return; const index = (active + direction + currentDiff.hunks.length) % currentDiff.hunks.length; navigateTo(index);
  }
  function navigateTo(index: number) {
    const currentDiff = visibleDiff; if (!currentDiff?.hunks.length || !currentDiff.hunks[index]) return; setActive(index); const block = currentDiff.rows.slice(currentDiff.hunks[index].start, currentDiff.hunks[index].end);
    setScroll(prev => Array.from({ length: MAX_VISIBLE_PANES }, (_, side) => { const key = side === 0 ? 'left' : 'right'; const line = side === 0 || side === activePeer ? block.find(r => r[key] !== null)?.[key] : block.find(r => r.right !== null)?.right; return { line: line ?? Math.max(1, currentDiff.rows.slice(0, currentDiff.hunks[index].start).filter(r => r[key] !== null).length), tick: prev[side].tick + 1 }; }));
  }
  async function createReport() {
    if (left?.format === 'folder' && selected[activePeer]?.format === 'folder') {
      try {
        const path = await saveDialog({ title: 'フォルダ比較レポートを保存', defaultPath: 'MacMerge-フォルダ比較レポート.html', filters: [{ name: 'HTMLレポート', extensions: ['html'] }] });
        if (!path) return;
        await writeTextFile(path, createFolderHtmlReport(nameOf(left.path), nameOf(selected[activePeer]!.path), left.text, selected[activePeer]!.text));
        setNotice(`${nameOf(path)} を保存しました`); setError('');
      } catch (e) { setError(`レポートを作成できませんでした: ${String(e)}`); }
      return;
    }
    const comparisons = selected.slice(1, paneCount).flatMap((doc, index) => doc && diff[index] ? [{ leftName: nameOf(left!.path), rightName: nameOf(doc.path), diff: diff[index]! }] : []);
    if (!comparisons.length) return;
    try {
      const path = await saveDialog({ title: '比較レポートを保存', defaultPath: 'MacMerge-比較レポート.html', filters: [{ name: 'HTMLレポート', extensions: ['html'] }] });
      if (!path) return;
      await writeTextFile(path, createHtmlReport(comparisons));
      setNotice(`${nameOf(path)} を保存しました`);
      setError('');
    } catch (e) { setError(`レポートを作成できませんでした: ${String(e)}`); }
  }
  function selectFolderFile(path: string) {
    setSelectedFolderFile(path);
    const positions = selected.map(doc => {
      if (!doc) return 0;
      const line = doc.text.split(/\r?\n/).findIndex(value => value === `--- ファイル: ${path} ---`);
      return line >= 0 ? line + 1 : 0;
    });
    setScroll(prev => prev.map((entry, side) => positions[side] ? { line: positions[side], tick: entry.tick + 1 } : entry));
    if (positions[activePeer]) setFocusedSide(activePeer as Side);
  }
  function adopt(source: Side) { const peer = activePeer as Side; const targetIndex = source === 0 ? peer : 0; const target = selected[targetIndex]; const incoming = selected[source]; const pairDiff = diff[peer - 1]; if (!pairDiff || !target || !incoming || targetIndex === source) return; if (target.format !== 'text') { setError('PDF・Office文書・フォルダは読み取り専用です。採用先にはテキストファイルを選択してください'); return; } const next = adoptHunk([left!.text, selected[peer]!.text], pairDiff, active, source === 0 ? 0 : 1); edit(target.path, next[targetIndex === 0 ? 0 : 1]); setNotice(`${SIDE_LABELS[source]} → ${SIDE_LABELS[targetIndex]} に変更を採用しました`); }
  function assign(path: string, side: Side) {
    if (pair[side] === path) { if (side > 0) { setFocusedSide(side); setActive(0); } return; }
    setDiff(Array(MAX_VISIBLE_PANES - 1).fill(null));
    setPair(prev => { const next = [...prev]; const previousSlot = next.findIndex((value, index) => index !== side && value === path); const displaced = next[side]; next[side] = path; if (previousSlot >= 0) next[previousSlot] = displaced; return next; });
    setFocusedSide(side === 0 ? 1 : side); setActive(0);
  }
  function promoteBaseline(path: string) {
    const slot = pair.findIndex((value, index) => index > 0 && value === path);
    if (slot < 1 || !pair[0]) return;
    const next = [...pair];
    [next[0], next[slot]] = [next[slot], next[0]];
    setDiff(Array(MAX_VISIBLE_PANES - 1).fill(null));
    setPair(next);
    setFocusedSide(slot as Side);
    setShowAllFiles(true);
    setActive(0);
  }
  const subtitle = !left || !right ? '2つ以上のファイルを追加して比較' : !diff[0] ? '比較しています…' : `${additions} 行の追加、${deletions} 行の削除 · ${visibleDiff?.hunks.length ?? 0} 件の変更`;
  const dropText = dropSide === undefined ? 'ファイルをドロップして比較' : `${SIDE_LABELS[dropSide]}列にファイルを追加`;
  return <main className={screen === 'home' ? 'home-shell' : 'compare-shell'}>
    {screen === 'home' ? <>
      <aside className="sidebar"><div className="side-brand"><span className="brand-icon"><Icon name="swap" size={24}/></span>MacMerge</div><nav className="side-nav">{([['recent', 'clock', 'recent'], ['files', 'folder', 'files'], ['guide', 'guide', 'guide']] as const).map(([id, icon, key]) => <button key={id} className={section === id ? 'selected' : ''} onClick={() => setSection(id)}><Icon name={icon}/>{t(key)}{id === 'files' && documents.length > 0 && <small>{documents.length}</small>}</button>)}</nav><div className="sidebar-bottom"><span className="privacy-dot"/>{t('local')}<small>MacMerge · 0.2.0</small><div className="language-switch" role="group" aria-label={t('language')}><span>{t('language')}</span>{([['en','EN'],['ja','日本語'],['zh-Hans','简体'],['zh-Hant','繁體']] as const).map(([value,label])=><button key={value} className={language===value?'selected':''} aria-pressed={language===value} onClick={()=>setLanguage(value)}>{label}</button>)}</div></div></aside>
      <div className="home-content"><section className="hero"><div className="hero-top"><h1>{section === 'recent' ? t('recent') : section === 'files' ? t('files') : t('start')}</h1><div className="hero-actions"><button className="glass-button" onClick={() => void choose()} disabled={busy}><Icon name="plus"/>{t('open')}</button><button className="glass-button" onClick={() => void chooseFolders()} disabled={busy}><Icon name="folder"/>{t('folderCompare')}</button></div></div><button className="drop-zone" onClick={() => void choose()} disabled={busy}><span className="drop-art"><Icon name="files" size={64}/></span><strong>{t('drag')}</strong><span>{t('drop')}</span><small>{t('click')}</small></button></section>
      <section className="home-body">{error && <div className="error-message" role="alert">{error}<button onClick={() => setError('')}>閉じる</button></div>}{notice && <p className="notice" role="status">{notice}</p>}
        {section === 'recent' && <><div className="list-heading"><h2>{t('history')}</h2><span>{recents.length}</span></div>{recents.length ? <div className="recent-list">{recents.map(r => <button className="recent-row" key={r.paths.join('\0')} onClick={() => void loadPaths(r.paths)} disabled={busy}><span className="recent-icon"><Icon name="split" size={28}/></span><span className="recent-info"><strong>{r.paths.map(nameOf).join(' / ')}</strong><span>{r.changes} · {new Date(r.date).toLocaleString(language==='ja'?'ja-JP':language==='zh-Hant'?'zh-TW':language==='zh-Hans'?'zh-CN':'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span><Icon name="arrow" size={18}/></button>)}</div> : <div className="empty-state"><Icon name="clock" size={32}/><h3>{t('first')}</h3><p>{t('addHistory')}</p></div>}</>}
        {section === 'files' && (documents.length ? <div className="recent-list">{documents.map(d => <div className="recent-row" key={d.path}><Icon name="files" size={28}/><span className="recent-info"><strong>{nameOf(d.path)}{d.text !== d.saved && <em>{language==='ja'?'未保存':language.startsWith('zh')?'未保存':'Unsaved'}</em>}</strong><span>{d.path}</span></span><button onClick={() => { assign(d.path, 0); setScreen('compare'); }}>A</button><button onClick={() => { assign(d.path, 1); setScreen('compare'); }}>B</button></div>)}</div> : <div className="empty-state"><Icon name="folder" size={32}/><h3>{t('none')}</h3><p>{t('multiple')}</p></div>)}
        {section === 'guide' && <div className="guide-cards">{(language === 'ja' ? [['01','ファイル・フォルダを追加',`テキスト、PDF、DOCX、ODT、XLSX、XLS、ODS、PPTXを比較できます。フォルダは中の対応ファイルを相対パス付きで比較します。`],['02','比較する列を選ぶ',`ファイル一覧のA〜${SIDE_LABELS[MAX_VISIBLE_PANES - 1]}ボタンで比較する列を選びます。`],['03','差分を確認','PDF・Office文書・フォルダは抽出テキストの読み取り専用比較です。テキストファイルでは変更を採用して保存できます。']] : language === 'en' ? [['01','Add files or folders','Compare UTF-8 text, PDF, DOCX, ODT, XLSX, XLS, ODS, and PPTX. Folders compare supported contents with relative paths.'],['02','Choose comparison columns',`Use the A–${SIDE_LABELS[MAX_VISIBLE_PANES - 1]} buttons in the file list to choose columns.`],['03','Review differences','PDF, Office documents, and folders are read-only text comparisons. Text files can accept changes and be saved.']] : language === 'zh-Hant' ? [['01','新增檔案或資料夾','比較 UTF-8 文字、PDF、DOCX、ODT、XLSX、XLS、ODS 和 PPTX。資料夾會依相對路徑比較其中支援的檔案。'],['02','選擇比較欄',`使用檔案清單中的 A–${SIDE_LABELS[MAX_VISIBLE_PANES - 1]} 按鈕選擇欄位。`],['03','檢視差異','PDF、Office 文件和資料夾以唯讀文字方式比較。文字檔可採用變更並儲存。']] : [['01','添加文件或文件夹','支持比较 UTF-8 文本、PDF、DOCX、ODT、XLSX、XLS、ODS 和 PPTX。文件夹会按相对路径比较其中受支持的文件。'],['02','选择比较列',`使用文件列表中的 A–${SIDE_LABELS[MAX_VISIBLE_PANES - 1]} 按钮选择列。`],['03','查看差异','PDF、Office 文档和文件夹以只读文本方式比较。文本文件可以采纳更改并保存。']]).map(([num, title, text]) => <article key={num}><small>{num}</small><h3>{title}</h3><p>{text}</p></article>)}</div>}
      </section></div>
    </> : <>
      <header className="compare-toolbar"><button className="icon-button" title={t('back')} aria-label={t('back')} onClick={() => setScreen('home')}><Icon name="back"/></button><div className="comparison-title"><h1>{left ? nameOf(left.path) : 'A'} <span>/</span> {selected[activePeer] ? nameOf(selected[activePeer]!.path) : 'B'}</h1><p>{subtitle}</p></div><div className="toolbar-actions"><div className="language-switch compact" role="group" aria-label={t('language')}>{([['en','EN'],['ja','日本語'],['zh-Hans','简体'],['zh-Hant','繁體']] as const).map(([value,label])=><button key={value} className={language===value?'selected':''} aria-pressed={language===value} onClick={() => setLanguage(value)}>{label}</button>)}</div><div className="view-modes" role="group" aria-label={t('viewModes')}><button className={viewMode === 'side-by-side' ? 'selected' : ''} aria-label={t('side')} aria-pressed={viewMode === 'side-by-side'} title={t('side')} onClick={() => setViewMode('side-by-side')}><Icon name="split"/></button><button className={viewMode === 'fluid' ? 'selected' : ''} aria-label="Fluid View" aria-pressed={viewMode === 'fluid'} title="Fluid View" onClick={() => setViewMode('fluid')}><Icon name="flow"/></button><button className={viewMode === 'unified' ? 'selected' : ''} aria-label={t('unified')} aria-pressed={viewMode === 'unified'} title={t('unified')} onClick={() => setViewMode('unified')}><Icon name="list"/></button></div><button className="report-button" onClick={() => void createReport()} disabled={!diff.some(Boolean)} title={t("report")}><Icon name="list"/>{t("report")}</button><button className={`sync-toggle ${syncScroll ? 'enabled' : 'disabled'}`} aria-pressed={syncScroll} aria-label={t(syncScroll ? 'syncOn' : 'syncOff')} onClick={() => setSyncScroll(v => !v)} title={t(syncScroll ? 'syncOn' : 'syncOff')}><Icon name="split"/>{t(syncScroll ? 'syncOn' : 'syncOff')}</button><button onClick={() => void choose()} disabled={busy}><Icon name="plus"/>{t('add')}</button></div></header>
      <div className="file-shelf"><span className="shelf-label">{t('shelf')} <b>{documents.length}/{MAX_OPEN_FILES}</b></span><div className="file-tabs">{documents.map(d => <div className={`file-tab ${pair.includes(d.path) ? 'in-pair' : ''}`} key={d.path}><Icon name="files" size={16}/><span title={d.path}>{nameOf(d.path)}{d.text !== d.saved && <i className="dirty-dot"/>}</span>{SIDE_LABELS.map((label, index) => <button title={`${label} · ${t('choose')}`} className={pair[index] === d.path ? 'assigned' : ''} onClick={() => assign(d.path, index as Side)} key={label}>{label}</button>)}</div>)}</div></div>
      {left && selected.filter(Boolean).length > 1 && <div className="baseline-picker"><label htmlFor="baseline-file">{t('baseline')}</label><select id="baseline-file" value={left.path} onChange={event => promoteBaseline(event.target.value)}>{selected.map((doc, index) => doc ? <option value={doc.path} key={doc.path}>{SIDE_LABELS[index]} · {nameOf(doc.path)}</option> : null)}</select><small>{t('baselineHint')}</small></div>}
      {paneCount > 2 && <div className="comparison-picker" role="group" aria-label={t('compareAgainst')}><span>{t('compareAgainst')}</span>{Array.from({ length: paneCount - 1 }, (_, index) => (index + 1) as Side).filter(side => !!selected[side]).map(side => <button key={side} className={activePeer === side ? 'selected' : ''} aria-pressed={activePeer === side} onClick={() => { setFocusedSide(side); setActive(0); }}><strong>A ↔ {SIDE_LABELS[side]}</strong><span title={selected[side]!.path}>{nameOf(selected[side]!.path)}</span><small>{diff[side - 1] ? `${diff[side - 1]!.hunks.length} ${t('changes')}` : t('loading')}</small></button>)}<div className="pane-visibility-control" role="group" aria-label={t('showing')}><span>{t('showing')}:</span><button className={!showAllFiles ? 'selected' : ''} aria-pressed={!showAllFiles} onClick={() => setShowAllFiles(false)}>{t('pairOnly')}</button><button className={showAllFiles ? 'selected' : ''} aria-pressed={showAllFiles} onClick={() => setShowAllFiles(true)}>{t('allFiles')}</button></div></div>}
      {folderComparison && left && folderPeer ? <FolderCompareView leftText={left.text} rightText={folderPeer.text} leftName={nameOf(left.path)} rightName={nameOf(folderPeer.path)} language={language} selectedPath={selectedFolderFile} onSelect={selectFolderFile}/> : null}
      {!folderComparison && <DiffOverview diff={visibleDiff} leftLabel={left ? nameOf(left.path) : "A"} rightLabel={selected[activePeer] ? nameOf(selected[activePeer]!.path) : "B"} onSelect={navigateTo}/>}
      {error && <div className="error-message" role="alert">{error}<button onClick={() => setError('')}>{t('close')}</button></div>}
      {viewMode === 'side-by-side' || flowEnabled ? <section ref={panelsRef} className={`panels panes-${visiblePaneCount} ${flowEnabled ? 'fluid-connectors' : ''}`}>{visibleSides.map(side => { const doc = selected[side]; const paneDiff = side === 0 ? visibleDiff : diff[side - 1]; const paneVisual = side === 0 ? visual[activePeer - 1]?.[0] : visual[side - 1]?.[1]; const paneActiveIndex = Math.min(active, Math.max(0, (paneDiff?.hunks.length ?? 1) - 1)); const paneHunk = paneDiff?.hunks[paneActiveIndex]; const paneActiveRows = paneHunk ? paneDiff!.rows.slice(paneHunk.start, paneHunk.end) : []; return <article data-side={side} className={`pane ${focusedSide === side ? 'pane-focused' : ''}`} key={side} onPointerDown={() => setFocusedSide(side)}><div className="pane-head"><span className="side-badge">{SIDE_LABELS[side]}</span><span className="breadcrumb" title={doc?.path}><Icon name="folder" size={16}/>{doc ? folderOf(doc.path) : 'ファイルを選択'}<span>›</span><strong>{doc ? nameOf(doc.path) : '未選択'}</strong>{doc && doc.text !== doc.saved && <i className="dirty-dot"/>}</span><button className="icon-button" title="ファイルを置き換え" aria-label={`${SIDE_LABELS[side]}のファイルを選択`} onClick={() => void choose(side)} disabled={busy}><Icon name="plus" size={18}/></button><button className="save-button" disabled={!doc || doc.format !== 'text' || busy || doc.text === doc.saved} onClick={() => void save(side)}><Icon name="save" size={15}/>保存</button></div>{doc ? <Editor key={doc.path} value={doc.text} readOnly={doc.format !== 'text'} onChange={text => edit(doc.path, text)} marks={paneVisual?.marks ?? []} gaps={paneVisual?.gaps ?? []} active={paneActiveRows.map(r => side === 0 ? r.left : r.right).filter((n): n is number => n !== null)} scrollLine={scroll[side]} register={view => { editors.current[side] = view; }} onScroll={(top, view) => { if (!syncScroll) return; editors.current.forEach((other, index) => { if (index !== side && other && Math.abs(other.scrollDOM.scrollTop - top) > 1 && Math.abs(view.scrollDOM.scrollTop - top) < 1) other.scrollDOM.scrollTop = top; }); }}/>: <button className="pane-empty" onClick={() => void choose(side)} disabled={busy}><Icon name="files" size={42}/><strong>{SIDE_LABELS[side]}のファイルをドロップ</strong><span>またはクリックして選択</span></button>}<div className="pane-foot"><span>{doc ? documentSummary(doc, language) : 'ファイル未選択'}</span><span>{doc?.format === 'text' ? `UTF-8 · ${doc.text.includes('\r\n') ? 'CRLF' : 'LF'}${doc.text !== doc.saved ? ' · 未保存' : ''}` : doc ? t('readonly') : ''}</span></div></article>; })}{flowEnabled && <DiffConnectors containerRef={panelsRef} editorsRef={editors} diff={visibleDiff} peer={activePeer}/>}</section> : <ChangeView mode={viewMode} diff={visibleDiff} leftName={left ? nameOf(left.path) : 'A'} rightName={selected[activePeer] ? nameOf(selected[activePeer]!.path) : SIDE_LABELS[activePeer]} active={active} onSelect={setActive}/>}
      <footer className="comparison-footer"><span className="status-text" role="status">{busy ? t('loading') : notice || (paneCount > 2 ? (language==='ja'?`Aを基準に${SIDE_LABELS.slice(1, paneCount).join('・')}を比較 · 最大${MAX_VISIBLE_PANES}列`:language==='en'?`Comparing ${SIDE_LABELS.slice(1,paneCount).join(', ')} against A · up to ${MAX_VISIBLE_PANES} columns`:`以 A 为基准比较 ${SIDE_LABELS.slice(1,paneCount).join('、')} · 最多 ${MAX_VISIBLE_PANES} 列`) : (language==='ja'?`黄：変更　緑：追加　赤：削除${viewMode === 'fluid' ? '　紫の線：対応する変更' : ''}`:language==='en'?`Yellow: changed · Green: added · Red: deleted${viewMode==='fluid'?' · Purple lines: matching changes':''}`:`黄色：修改 · 绿色：新增 · 红色：删除${viewMode==='fluid'?' · 紫色连线：对应更改':''}`))}</span><div className="merge-controls"><button disabled={!visibleDiff?.hunks.length || !selected[activePeer] || !left || left.format !== 'text'} onClick={() => adopt(activePeer as Side)}>{SIDE_LABELS[activePeer]} → A {language==='ja'?'を採用':language==='en'?'Accept':'采纳'}</button><button disabled={!visibleDiff?.hunks.length || !selected[activePeer] || !left || selected[activePeer]?.format !== 'text'} onClick={() => adopt(0)}>A → {SIDE_LABELS[activePeer]} {language==='ja'?'を採用':language==='en'?'Accept':'采纳'}</button></div><div className="diff-navigation"><span>{visibleDiff?.hunks.length ? `${active + 1} / ${visibleDiff.hunks.length}` : visibleDiff ? t('noDiff') : ''}</span><button className="icon-button" title={t('previous')} aria-label={t('previous')} disabled={!visibleDiff?.hunks.length} onClick={() => navigate(-1)}><Icon name="up"/></button><button className="icon-button" title={t('next')} aria-label={t('next')} disabled={!visibleDiff?.hunks.length} onClick={() => navigate(1)}><Icon name="down"/></button></div></footer>
    </>}
    {dragging && <div className={`drag-overlay ${dropSide !== undefined && screen === 'compare' ? `drop-side-${dropSide}` : ''}`}><div><Icon name="files" size={58}/><strong>{screen==='home'?t('dropOverlay'):language==='ja'?`${SIDE_LABELS[dropSide ?? 0]}列にファイルを追加`:language==='en'?`Drop files into column ${SIDE_LABELS[dropSide ?? 0]}`:`将文件放入 ${SIDE_LABELS[dropSide ?? 0]} 列`}</strong><span>{t('dropMore')}</span></div></div>}
  </main>;
}
