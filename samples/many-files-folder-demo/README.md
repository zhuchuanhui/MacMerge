# 多ファイル・フォルダ比較サンプル

開始画面の「フォルダ比較」から `Folder-A` と `Folder-B` を選んでください。両側それぞれ100件を超えるファイルを含み、サブフォルダ内の変更をまとめて確認できます。

## 含まれる差分

- 10カテゴリ×10ファイルを用意。共通ファイルはそのまま残るものと内容変更したものが混在します。
- `config/application.json` は環境名と金額が異なります。
- `data/users.csv` は既存行の状態変更と、新しい行の追加があります。
- `operations` の一部ファイルは Folder-B で削除されています。
- `reports` の一部ファイルと `docs/release-notes/2026/release.txt` は Folder-B に追加されています。
- テキストはUTF-8です。各ファイルは小さいため、フォルダ比較上限内で試せます。

差分ナビゲーションで複数箇所を順番に確認してください。フォルダ比較は読み取り専用です。

同じ比較のサンプルレポートは [`Folder-comparison-report.html`](Folder-comparison-report.html) です。MacMergeの「レポート作成」から、別の比較結果もHTMLとして保存できます。
