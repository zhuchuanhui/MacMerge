# MacMerge

**Choose a language / 言語を選択 / 选择语言:** [English](README.en.md) · [日本語](README.md) · [简体中文](README.zh-CN.md)

macOS・Windows向けのローカルテキスト差分・マージアプリです。ファイルを比較し、必要な変更を採用して保存できます。表示言語はアプリ内の **EN / 日本語 / 中文** ボタンでいつでも切り替えられ、選択は次回起動時にも保持されます。

## 主な機能

- 最大20ファイル（1ファイル20MB、合計100MBまで）を開き、Aを基準に最大4ファイルを同時比較
- 差分の移動、変更の採用、列ごとの編集と保存
- 左右比較、Fluid View、統合表示。表示方法とスクロール同期を選択可能
- PDFから抽出したテキストをページ単位で比較（読み取り専用）
- ファイルは端末内で処理。クラウドへアップロードしません
- 英語、日本語、簡体字中国語のワンクリック切替（設定を保存）

## 必要環境

- Node.js 20.19+ または 22.12+
- Rust stableとTauri 2のOS別ビルド要件
- macOS: Xcode Command Line Tools

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

UTF-8テキストとテキスト抽出可能なPDFに対応します。PDFの画像・レイアウト・書式比較、スキャンPDFのOCR、パスワード保護PDF、PDFへの保存、フォルダ比較には対応していません。未保存の編集内容はアプリ終了後には復元されません。

## 開発者向けチェック

```sh
npm run build
npm run test:rust
npm run check:release
```

## GitHub Releaseとデプロイ

GitHub Releaseと本番デプロイは別の操作として管理します。現在のデプロイ設定は `undecided` です。本番用リソースの作成やデプロイは行いません。設定は [`deployment.config.json`](deployment.config.json)、開発・リリース手順は [`AGENTS.md`](AGENTS.md) を参照してください。

署名・公証、Windowsの実機動作、外部配布は未確認です。
