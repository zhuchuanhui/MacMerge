import { useMemo, useState } from 'react';
import { compareFolderTexts, type FolderFileDiff, type FolderStatus } from './folderCompare';

type Language = 'ja' | 'en' | 'zh';
const copy = {
  ja: { title: 'フォルダ内のファイル', path: '相対パス', status: '状態', all: 'すべて', same: '同一', changed: '変更', added: '追加', deleted: '削除', empty: '比較できるテキストファイルがありません', hint: '行を選ぶと下の差分表示がそのファイルへ移動します' },
  en: { title: 'Files in folders', path: 'Relative path', status: 'Status', all: 'All', same: 'Same', changed: 'Changed', added: 'Added', deleted: 'Deleted', empty: 'No comparable text files', hint: 'Select a row to jump to its content below' },
  zh: { title: '文件夹中的文件', path: '相对路径', status: '状态', all: '全部', same: '相同', changed: '已修改', added: '新增', deleted: '删除', empty: '没有可比较的文本文件', hint: '选择一行可跳转到下方对应内容' },
} satisfies Record<Language, Record<string, string>>;

const statusLabel: Record<Language, Record<FolderStatus, string>> = {
  ja: { same: '同一', changed: '変更', added: '追加', deleted: '削除' },
  en: { same: 'Same', changed: 'Changed', added: 'Added', deleted: 'Deleted' },
  zh: { same: '相同', changed: '已修改', added: '新增', deleted: '删除' },
};

export default function FolderCompareView({ leftText, rightText, leftName, rightName, language, selectedPath, onSelect }: {
  leftText: string; rightText: string; leftName: string; rightName: string; language: Language;
  selectedPath: string; onSelect: (path: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | FolderStatus>('all');
  const labels = copy[language];
  const entries = useMemo(() => compareFolderTexts(leftText, rightText), [leftText, rightText]);
  const counts = useMemo(() => entries.reduce((result, entry) => { result[entry.status]++; return result; }, { same: 0, changed: 0, added: 0, deleted: 0 }), [entries]);
  const filters: ('all' | FolderStatus)[] = ['all', 'changed', 'added', 'deleted', 'same'];
  const visible = filter === 'all' ? entries : entries.filter(entry => entry.status === filter);
  const labelFor = (entry: FolderFileDiff) => statusLabel[language][entry.status];

  return <section className="folder-compare" aria-label={labels.title}>
    <div className="folder-compare-head">
      <div><h2>{labels.title}</h2><p>{leftName} <span>↔</span> {rightName} · {entries.length} {language === 'ja' ? 'ファイル' : language === 'zh' ? '个文件' : 'files'}</p></div>
      <div className="folder-counts" aria-label={labels.status}>
        {(['changed', 'added', 'deleted', 'same'] as FolderStatus[]).map(status => <span key={status} className={`folder-count ${status}`}><b>{counts[status]}</b>{labels[status]}</span>)}
      </div>
    </div>
    <div className="folder-filter" role="group" aria-label={labels.status}>
      {filters.map(value => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{labels[value]} <span>{value === 'all' ? entries.length : counts[value]}</span></button>)}
      <small>{labels.hint}</small>
    </div>
    <div className="folder-table-wrap">
      <table className="folder-table"><thead><tr><th>{labels.path}</th><th>{labels.status}</th></tr></thead><tbody>
        {visible.map(entry => <tr key={entry.path} className={`${entry.status}${selectedPath === entry.path ? ' selected' : ''}`}>
          <td><button className="folder-path-button" onClick={() => onSelect(entry.path)} title={entry.path}><span className="folder-file-icon">{entry.status === 'added' ? '+' : entry.status === 'deleted' ? '−' : entry.status === 'changed' ? '~' : '·'}</span>{entry.path}</button></td>
          <td><span className={`folder-status ${entry.status}`}>{labelFor(entry)}</span></td>
        </tr>)}
        {!visible.length && <tr><td colSpan={2} className="folder-empty">{labels.empty}</td></tr>}
      </tbody></table>
    </div>
  </section>;
}
