# MacMerge

**Choose a language / 言語を選択 / 选择语言:** [English](README.en.md) · [日本語](README.md) · [简体中文](README.zh-CN.md)

macOS・Windows向けのローカルテキスト差分・マージアプリです。ファイルを比較し、必要な変更を採用して保存できます。表示言語はアプリ内の **EN / 日本語 / 简体 / 繁體** ボタンでいつでも切り替えられ、選択は次回起動時にも保持されます。

## 主な機能

- 最大20ファイル（1ファイル20MB、合計100MBまで）を開き、Aを基準に最大4ファイルを同時比較
- 差分の移動、変更の採用、列ごとの編集と保存
- 左右比較、Fluid View、統合表示。表示方法とスクロール同期を選択可能
- PDFから抽出したテキストをページ単位で比較（読み取り専用）
- ファイルは端末内で処理。クラウドへアップロードしません
- 英語、日本語、簡体字中国語、繁体字中国語のワンクリック切替（設定を保存）

初めて使う方は[操作マニュアル](docs/MANUAL.md)をご覧ください。

## 必要環境

- Node.js 20.19+ または 22.12+
- Rust stableとTauri 2のOS別ビルド要件
- macOS: Xcode Command Line Tools

## Windows版を試す

[MacMerge v0.2.0 Windows x64 インストーラー](https://github.com/zhuchuanhui/MacMerge/releases/download/v0.2.0/MacMerge_0.2.0_x64-setup.exe)をダウンロードしてください。インストーラーは未署名です。Windows実機での起動・機能確認はこれからです。

## 開発起動

```sh
npm install
npm run tauri:dev
```

## ビルド

```sh
npm run tauri:build       # 現在のOS向け本番バンドル
npm run build:mac:app     # Apple Silicon (arm64) のMacMerge.appのみ
npm run build:mac         # Apple Silicon (arm64) のmacOS本番バンドル一式
```

`.app`は`src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app`に生成されます。

## 対応形式と制限

UTF-8で読み込めるテキストファイルに加え、PDF、Word（DOCX/ODT）、PowerPoint（PPTX）、Excel（XLS/XLSX/ODS）に対応します。Office文書とPDFは抽出したテキストの読み取り専用比較です。Word本文、スライド内テキスト、表計算のセル値を比較します。

開始画面の「フォルダ比較」から2つのフォルダを選ぶと、相対パス付きで中の対応ファイルを比較できます。比較画面では相対パスごとに変更・追加・削除・同一を一覧表示し、状態で絞り込めます。ファイル行を選ぶと左右の本文表示がそのファイルへ移動します。「レポート作成」から件数と状態一覧、差分ファイルの本文を含むHTMLレポートを保存できます。画像や対応外のバイナリ、シンボリックリンクは除外します。`.git`、`node_modules`、`target`、`dist`、`build`、`.venv`、`venv`、`vendor`などの生成・依存フォルダは検索しません。1ファイル20MB以下、1フォルダあたり2,000ファイル・50MBまでです。フォルダとOffice/PDF文書は読み取り専用で、差分採用やファイルへの書き戻しはできません。

PDFのページ画像・レイアウト・書式比較、スキャンPDFのOCR、パスワード保護PDF、Wordのヘッダー・フッターや書式、Office内の画像・図形、表計算の書式・数式自体の比較には対応していません。未保存の編集内容はアプリ終了後には復元されません。

動作確認用サンプル：[`samples/folder-diff-demo`](samples/folder-diff-demo/README.md)、[`samples/many-files-folder-demo`](samples/many-files-folder-demo/README.md)（100件以上のファイル）、[`samples/office-diff-demo`](samples/office-diff-demo/README.md)、[`samples/pdf-diff-demo`](samples/pdf-diff-demo/README.md)。

## 開発者向けチェック

```sh
npm run build
npm run test:rust
npm run check:release
```

## GitHub Releaseとデプロイ

GitHub Releaseと本番デプロイは別の操作として管理します。現在のデプロイ設定は `undecided` です。本番用リソースの作成やデプロイは行いません。設定は [`deployment.config.json`](deployment.config.json)、開発・リリース手順は [`AGENTS.md`](AGENTS.md) を参照してください。

macOSビルドは未公証です。Windows版はv0.2.0インストーラーを公開済みですが、Windows実機での起動・機能確認は未完了です。
