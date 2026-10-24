import type { DiffResult, Row } from './diff';
import { compareFolderTexts } from './folderCompare';

export type ReportComparison = {
  leftName: string;
  rightName: string;
  diff: DiffResult;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function pairRows(rows: Row[]) {
  const left = rows.filter(row => row.left !== null);
  const right = rows.filter(row => row.right !== null);
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => ({ left: left[index], right: right[index] }));
}

function markedText(oldText: string, newText?: string) {
  if (newText === undefined) return escapeHtml(oldText);
  let prefix = 0;
  while (prefix < Math.min(oldText.length, newText.length) && oldText[prefix] === newText[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(oldText.length, newText.length) - prefix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;
  return `${escapeHtml(oldText.slice(0, prefix))}<mark>${escapeHtml(oldText.slice(prefix, oldText.length - suffix || undefined))}</mark>${suffix ? escapeHtml(oldText.slice(-suffix)) : ''}`;
}

export function createHtmlReport(comparisons: ReportComparison[], generatedAt = new Date()): string {
  const comparisonSections = comparisons.map(({ leftName, rightName, diff }) => {
    const additions = diff.rows.filter(row => row.kind === 'insert').length;
    const deletions = diff.rows.filter(row => row.kind === 'delete').length;
    const rows = diff.hunks.map((hunk, index) => {
      const pairs = pairRows(diff.rows.slice(hunk.start, hunk.end));
      const body = pairs.map(({ left, right }) => {
        const kind = left && right ? 'changed' : left ? 'deleted' : 'added';
        return `<tr class="${kind}"><td class="line-no">${left?.left ?? ''}</td><td class="old">${left ? markedText(left.text, right?.text) : '<span class="empty">—</span>'}</td><td class="line-no">${right?.right ?? ''}</td><td class="new">${right ? markedText(right.text, left?.text) : '<span class="empty">—</span>'}</td></tr>`;
      }).join('');
      return `<section class="change"><h3>変更 ${index + 1}</h3><table><thead><tr><th colspan="2">A · ${escapeHtml(leftName)}</th><th colspan="2">B · ${escapeHtml(rightName)}</th></tr></thead><tbody>${body}</tbody></table></section>`;
    }).join('');
    return `<article class="comparison"><h2>${escapeHtml(leftName)} <span>↔</span> ${escapeHtml(rightName)}</h2><p class="summary"><strong>${diff.hunks.length}</strong> 件の変更 <span>追加 ${additions} 行</span><span>削除 ${deletions} 行</span></p>${rows || '<p class="no-diff">差分はありません</p>'}</article>`;
  }).join('');
  const title = 'MacMerge 比較レポート';
  const date = generatedAt.toLocaleString('ja-JP');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3f8;color:#292431;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1200px;margin:36px auto;padding:0 22px}.report-head,.comparison{background:#fff;border:1px solid #e5e0eb;border-radius:14px;box-shadow:0 3px 12px #2415330a}.report-head{padding:24px 28px;margin-bottom:20px}.report-head h1{margin:0;font-size:24px}.report-head p{margin:5px 0 0;color:#81788b}.comparison{padding:22px 24px;margin:18px 0}.comparison h2{margin:0;font-size:19px;overflow-wrap:anywhere}.comparison h2 span{color:#a297b0;margin:0 8px}.summary{display:flex;gap:14px;align-items:center;color:#766c7e;margin:7px 0 18px}.summary strong{color:#6947ad;font-size:18px}.change{margin:16px 0;border:1px solid #e9e5ee;border-radius:9px;overflow:hidden}.change h3{margin:0;padding:8px 12px;background:#f4f0f8;color:#624e79;font-size:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:8px 10px;background:#fbfafd;text-align:left;font-size:12px;color:#655a70;overflow-wrap:anywhere}td{padding:6px 9px;border-top:1px solid #f0edf3;vertical-align:top;overflow-wrap:anywhere}td.line-no{width:44px;text-align:right;color:#988fa0;background:#faf9fb;font:11px ui-monospace,monospace}td.old,td.new{width:calc((100% - 88px)/2);font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.changed td.old,.deleted td.old{background:#fff0ed}.changed td.new,.added td.new{background:#e6f8ea}mark{background:#ffc75c;color:#352300;border-radius:2px;font-weight:700}.empty{color:#b7afbd}.no-diff{color:#6a956f;background:#eff8f0;padding:12px;border-radius:8px}@media print{body{background:#fff}.page{max-width:none;margin:0;padding:0}.report-head,.comparison{box-shadow:none;break-inside:avoid}.change{break-inside:avoid}}
</style></head><body><main class="page"><header class="report-head"><h1>${title}</h1><p>作成日時: ${escapeHtml(date)} · MacMerge</p></header>${comparisonSections || '<p class="no-diff">比較対象がありません。</p>'}</main></body></html>`;
}

export function createFolderHtmlReport(leftName: string, rightName: string, leftText: string, rightText: string, generatedAt = new Date()): string {
  const entries = compareFolderTexts(leftText, rightText);
  const counts = entries.reduce((result, entry) => { result[entry.status]++; return result; }, { same: 0, changed: 0, added: 0, deleted: 0 });
  const label: Record<string, string> = { same: '同一', changed: '変更', added: '追加', deleted: '削除' };
  const rows = entries.map(entry => {
    const status = label[entry.status];
    const details = entry.status === 'same' ? '' : `<details><summary>内容を表示</summary><div class="contents"><section><h4>変更前 · A · ${escapeHtml(leftName)}</h4><pre>${entry.left === undefined ? '<span class="empty">このフォルダにはありません</span>' : escapeHtml(entry.left)}</pre></section><section><h4>変更後 · B · ${escapeHtml(rightName)}</h4><pre>${entry.right === undefined ? '<span class="empty">このフォルダにはありません</span>' : escapeHtml(entry.right)}</pre></section></div></details>`;
    return `<tr class="${entry.status}"><td><span class="state">${status}</span></td><td><code>${escapeHtml(entry.path)}</code>${details}</td></tr>`;
  }).join('');
  const date = generatedAt.toLocaleString('ja-JP');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MacMerge フォルダ比較レポート</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f3f7;color:#292633;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1180px;margin:32px auto;padding:0 20px}.head,.file-list{background:#fff;border:1px solid #e6e2eb;border-radius:14px;box-shadow:0 3px 12px #2415330a}.head{padding:22px 26px;margin-bottom:16px}.head h1{margin:0;font-size:23px}.head p{color:#81788b;margin:5px 0}.pair{font-size:16px;font-weight:600}.pair span{color:#a399b0;padding:0 8px}.summary{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}.pill{padding:5px 10px;border-radius:16px;font-weight:600;font-size:12px}.pill.changed,.changed .state{background:#fff0ce;color:#8a5a00}.pill.added,.added .state{background:#dcf7e3;color:#22733f}.pill.deleted,.deleted .state{background:#ffe2e0;color:#a33f37}.pill.same,.same .state{background:#f0eef3;color:#686171}.file-list{overflow:hidden}.file-list h2{margin:0;padding:14px 18px;border-bottom:1px solid #ece9ef;font-size:15px}.file-list table{width:100%;border-collapse:collapse}.file-list th{text-align:left;color:#81788b;background:#faf9fb;font-size:11px;padding:9px 14px}.file-list td{padding:10px 14px;border-top:1px solid #f0edf3;vertical-align:top}.file-list tr.changed{background:#fffaf0}.file-list tr.added{background:#f5fcf6}.file-list tr.deleted{background:#fff7f6}.state{display:inline-block;min-width:48px;padding:2px 7px;border-radius:12px;text-align:center;font-size:10px;font-weight:700}.file-list code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.file-list details{margin-top:6px}.file-list summary{color:#7355ad;font-size:11px;cursor:pointer}.contents{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.contents section{min-width:0;border:1px solid #e9e5ee;border-radius:7px;overflow:hidden}.contents h4{margin:0;padding:6px 9px;background:#f8f6fa;font-size:11px}.contents section:first-child{border-color:#edb7b2;background:#fff8f7}.contents section:first-child h4{background:#ffe5e2;color:#9a3933}.contents section:last-child{border-color:#a9d7b3;background:#f5fcf6}.contents section:last-child h4{background:#daf2e0;color:#246c38}.contents pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:9px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;max-height:360px;overflow:auto}.empty{color:#a8a1ae}@media(max-width:650px){.contents{grid-template-columns:1fr}}@media print{body{background:white}.page{max-width:none;margin:0;padding:0}.head,.file-list{box-shadow:none}.file-list tr{break-inside:avoid}.contents{grid-template-columns:1fr 1fr}}
</style></head><body><main class="page"><header class="head"><h1>MacMerge フォルダ比較レポート</h1><p class="pair">${escapeHtml(leftName)} <span>↔</span> ${escapeHtml(rightName)}</p><p>作成日時: ${escapeHtml(date)} · ファイル数: ${entries.length}</p><div class="summary"><span class="pill changed">変更 ${counts.changed}</span><span class="pill added">追加 ${counts.added}</span><span class="pill deleted">削除 ${counts.deleted}</span><span class="pill same">同一 ${counts.same}</span></div></header><section class="file-list"><h2>相対パスごとの比較結果</h2><table><thead><tr><th>状態</th><th>ファイル</th></tr></thead><tbody>${rows || '<tr><td colspan="2">比較できるファイルはありません</td></tr>'}</tbody></table></section></main></body></html>`;
}
