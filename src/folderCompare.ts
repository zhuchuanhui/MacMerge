export type FolderFile = { path: string; text: string };
export type FolderStatus = 'same' | 'changed' | 'added' | 'deleted';
export type FolderFileDiff = {
  path: string;
  left?: string;
  right?: string;
  status: FolderStatus;
};

export function parseFolderText(text: string): FolderFile[] {
  const marker = /^--- ファイル: (.+) ---\r?$/gm;
  const matches = [...text.matchAll(marker)];
  return matches.map((match, index) => {
    const start = match.index! + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index! : text.length;
    const body = text.slice(start, end).replace(/^\r?\n/, '').replace(/\r?\n+$/, '');
    return {
      path: match[1],
      text: body.replace(/^(\\+)(--- ファイル: .* ---)\r?$/gm, (_line, slashes: string, markerLine: string) => `${slashes.slice(1)}${markerLine}`),
    };
  });
}

export function compareFolderTexts(leftText: string, rightText: string): FolderFileDiff[] {
  const left = new Map(parseFolderText(leftText).map(file => [file.path, file.text]));
  const right = new Map(parseFolderText(rightText).map(file => [file.path, file.text]));
  const entries: FolderFileDiff[] = [...new Set([...left.keys(), ...right.keys()])].map(path => {
    const a = left.get(path), b = right.get(path);
    return { path, left: a, right: b, status: a === undefined ? 'added' : b === undefined ? 'deleted' : a === b ? 'same' : 'changed' };
  });
  const priority: Record<FolderStatus, number> = { changed: 0, added: 1, deleted: 2, same: 3 };
  return entries.sort((a, b) => priority[a.status] - priority[b.status] || a.path.localeCompare(b.path, undefined, { numeric: true }));
}
