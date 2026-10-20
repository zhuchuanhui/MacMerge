# Project Status

## Product

- **Name:** MacMerge
- **Problem / intended user:** macOS・Windowsでローカルのテキストを比較し、必要な変更だけ採用したい利用者。
- **MVP:** 開始画面、20ファイルの管理、最大5列のA基準比較、自動差分、3種類の差分表示、差分ナビゲーション、編集、変更採用、明示的保存、最近の比較。
- **Acceptance criteria:** 最大20ファイルを読み込み、最大5ファイルを表示して比較・採用・保存でき、関連チェックに通り、arm64 macOS .appを生成・起動できる。
- **Deferred:** PDFのページ画像・レイアウト比較、OCR、フォルダ比較、文字コード変換、3-way conflict merge、外部配布。

## Implementation

- **Platform / technology:** Rust + Tauri 2 + React + TypeScript + CodeMirror 6。既存のクロスプラットフォーム設計を継続。
- **Current state:** 最大20ファイルを開ける（1ファイル20MB以下、全体100MB以下）。Aを基準にB〜Eを最大4組同時比較する5列レイアウト、列割当、選択列の差分ナビゲーション・変更採用、列ごとの編集・保存を実装。差分行・文字のコントラストを強め、左右比較・Fluid View・統合表示を追加。Fluid Viewは2列時に対応差分を曲線でつなぎ、比較ペアを選択列へ追従させる。PDFは20MB以下のテキスト抽出可能な文書をページ単位で抽出・比較し、読み取り専用表示する。
- **Next step:** Finderからの実ドラッグによる受付・遷移を実機で確認。ファイル選択ダイアログ経由の20ファイル読み込み・上限動作と5列表示は確認済み。
- **Verification:** 下記の最終確認欄を参照。
- **Local artifact:** /Users/d/github/MacMerge/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app
- **Supported files:** 1ファイル20MB以下、全体100MB以下、最大20ファイルを開いて管理。A〜Eの最大5列を表示し、AとB〜Eの4組を比較。UTF-8テキストに加え、PDFの抽出テキスト比較に対応。スキャンPDF、パスワード保護PDF、ページ画像・レイアウト比較、PDF保存は未対応。

## GitHub and release

- **Repository:** https://github.com/zhuchuanhui/MacMerge （非公開）
- **Branch / PR:** main、初回コミットを作成。PRなし。
- **Commit convention:** Conventional Commits
- **CI:** 既存macOS/Windows設定あり。ローカルで同等のチェックを実行。リモートCI結果は未確認。
- **Release method:** v0.1.0を準備。既存ワークフローは手動実行でドラフトを生成。main・v0.1.0をpushし、CI成功後にReleaseを公開する。
- **Latest release:** [v0.1.0](https://github.com/zhuchuanhui/MacMerge/releases/tag/v0.1.0)（非公開リポジトリ内で公開）。
- **Release verification:** npm run check:releaseでバージョン・配置設定を検証。

## Deployment decision

```yaml
deployment:
  mode: undecided
  target: null
  environments: []
  trigger: none
  approval: required
  credentials: null
  rollback: null
  health_check: null
  estimated_monthly_cost: null
  decision_date: 2026-10-20
  rationale: deployment.config.jsonの既存設定を維持。今回の対象はローカル利用の.app作成まで。
```

## Risks and open decisions

- Windowsのビルドと実機操作は未検証。
- Finderからの実ドラッグは操作を試したが画面遷移を確認できず、未検証。ファイル選択ダイアログで3ファイルを選び、更新版.appでA/B/Cの3列表示とC側の差分を確認。
- 保存前の内容照合と原子的置換の間に発生する同時更新は排他制御していない。
- 未保存編集はメモリ上のみ。終了後の復元・終了時警告は未実装。
- Developer ID署名、公証、他のMacでの起動は対象外。ローカルのアドホック署名のみ。
- macOSファイルドロップを有効にするためTauriの`macOSPrivateApi`を使用。ローカルビルドで有効化した状態を確認。配布方針は未決定。
- フロントエンドのバンドルサイズ警告あり。

## 最終確認（2026-10-20）

- `npm run build`: 成功（TypeScript・Vite）。バンドルサイズ警告あり。
- `npm run check:release`: 成功、v0.1.0。
- `npm run test:rust`: 4件成功。`npm run test:capacity`: 10,000行のテキスト4組（5列分）の差分計算が約86.5ms（今回の開発機上のRustテスト計測）。
- 2026-10-20更新: 左右・Fluid・統合表示の切替を追加し、選択状態を保存。差分強調色を強め、2列Fluid Viewでは画面内の差分行を曲線で接続。フロントエンドビルド、release設定、Rustテストを再確認。
- 再ビルドしたarm64 `.app`を終了・再起動し、比較履歴から再表示。Fluid Viewが選択状態のまま復元され、差分行間の曲線が出ること、統合表示で変更前後が分けて読めることを画面で確認。
- arm64の`MacMerge.app`を再ビルドし、実行ファイルがMach-O arm64、表示名がMacMergeであることを確認。生成物の絶対パスは下記Local artifact。
- アプリを実際に起動し、21件の小さなUTF-8ファイルをファイル選択画面で選ぶ試験を実施。20件が読み込まれ、表示が`20/20`、21件目は「読み込み上限は20ファイル」として拒否。A〜Eの5ペインと5つ目の列への割当を画面で確認。
- 100MB全体上限と1ファイル20MB上限を越える実データは未試験。Finderからの実ドラッグ、Windowsビルド・実機操作は未検証。

- `npm run check:release`: 成功、v0.1.0の整合性確認。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 3件成功。CRLF保存、外部編集時の上書き拒否、削除済みファイルの再作成拒否、バイナリ拒否、空ファイル差分を検証。
- `npm run build:mac:app`: 成功。内包する`tsc && vite build`も成功。バンドルサイズ警告のみ。
- 実行ファイル: Mach-O arm64、CFBundleDisplayName: MacMerge、署名表示: ad hoc。公証なし。
- 新しい.appへ切り替えて起動し、開始画面と保存済み比較履歴をアクセシビリティ表示で確認。
- 2026-10-20更新版: `npm run build`成功。`npm run check:release`成功。Rustテスト3件成功。`npm run build:mac:app`成功し、arm64 .appを終了・再起動。開始画面で3ファイル比較の履歴を確認し、履歴を開いてA/B/Cの3列、Cの差分、C選択時のC→A/A→C採用ボタンを画面とアクセシビリティ表示で確認。Finderからの実ドラッグは再試行したが、比較画面へのドロップを確認できず未検証。ビルドサイズ警告あり。
- 差分の視認性改善: 変更を黄、追加を緑、削除を赤に分け、CodeMirrorの行番号脇に`~`/`+`/`−`を表示。変更文字を太字・下線付きの濃い黄で強調し、Fluid Viewの対応線を紫に変更。`npm run build`・`npm run check:release`・Rustテスト4件成功。arm64 `.app`を再ビルドして実際に再起動し、2ファイル比較で差分色・記号・文字強調・紫の線を目視確認。バンドルサイズ警告あり。
- macOSのドロップ要件をTauri公式資料で確認し、`tauri.conf.json`の`app.macOSPrivateApi`を有効化。設定反映後のarm64ビルド成功、アプリ終了・再起動、3ファイル履歴の再表示を確認。実際のFinderドロップは自動操作の座標制約により未検証。
- `git diff --check`: 成功。ただし全ファイルが未追跡のため、ソース全体の差分検証を意味しない。
- 外部操作: コミット、push、PR、Release、デプロイなし。
- 大容量サンプル: `samples/large-diff-demo/`に約12,000行・各約1.6MBのA/B/Cテキストを追加。比較アプリで3ファイルを実際に読み込み、A/Bでは6件、A/Cでは4件の変更をナビゲーションで確認。
- 大容量比較を試した際に、複数列の差分強調が選択中の比較ペアに引きずられる問題を発見し修正。各列がAとの個別の差分で着色され、選択列に応じて差分数と採用対象が変わることを、12,000行サンプルと再ビルドしたarm64 `.app`で確認。`npm run build`と`npm run build:mac:app`成功。バンドルサイズ警告あり。
- PDF比較: `pdf-extract`でページ単位にテキストを抽出し、ページ区切りとともに既存の差分画面へ表示。PDFは読み取り専用、PDFへの保存とPDFを採用先にする操作は無効化。パスワード保護・破損・未対応文字形式のエラー、画像のみPDFの非対応案内を追加。日本語2ページ請求書2種とスキャン画像PDFのサンプルを`samples/pdf-diff-demo/`に追加。
- 2026-10-20 PDF確認: `npm run build`、`cargo test --locked --manifest-path src-tauri/Cargo.toml`（5件）、`npm run check:release`成功。`npm run build:mac:app`でarm64 `MacMerge.app`生成成功（13.01 MiB）。最終.appを終了・再起動し、請求書PDF2つを選択して2ページ表示、ページ区切り、日本語を含む8件の差分、保存ボタンとPDF間の採用ボタン無効化を実画面で確認。画像のみPDFはRustテストで非対応案内を確認し、PDFサンプルのレンダリングも目視確認。
- PDFの画面画像・レイアウト・フォント差・表組み比較、OCR、PDFへの変更書き戻し、パスワード保護PDF、Windows上のPDF比較は未検証または未対応。ViteのJavaScriptバンドルサイズ警告は継続。

- 2026-10-20 標準メニュー日本語化: macOS標準操作をTauriの定義済みメニューで保持し、日本語の見出し・操作名を設定。Info.plistに開発言語jaと対応言語jaを追加。arm64 .appビルド、Rustテスト5件、release設定チェック成功。生成.appを再起動し、アクセシビリティ経由でファイル・編集・表示・ウインドウ・ヘルプ、およびOS追加の音声入力・絵文字・ウインドウ操作も日本語であることを確認。各操作の実行とWindowsは未検証。既存のViteサイズ警告あり。コミット・公開・デプロイなし。

## リリース準備（2026-10-20）

- ユーザーよりコミット・push・Release公開の指示あり。非公開のzhuchuanhui/MacMergeを作成。
- `npm run build`、`npm run check:release`、Rustテスト5件成功。Viteのサイズ警告あり。
- 一時レンダリング画像の`tmp/`をGit管理から除外。
- 本番デプロイなし。Developer ID署名・公証、Windows実機、今回の変更のUI再検証は未実施。

## リリース修正（2026-10-20）

- 初回コミットcdbbd71を非公開のorigin/mainへpush済み。Release・タグは未公開。
- 初回CIはWindowsのCRLF改行でバージョン検証が誤判定して失敗。macOSジョブはキャンセル。バージョン検証・更新スクリプトをCRLF対応に修正し、CRLFファイルの検証成功。
- macOSのsigningIdentityをアドホック署名に明示設定。arm64 app・DMG再生成成功。DMGチェックサム、内包アプリの厳格な署名検証、バージョン0.1.0を確認。Developer ID署名・公証なし。
- ユーザーが修正のcommit・push・CI再実行・Release公開を承認。CI成功後にv0.1.0を公開する。

## v0.1.0公開結果（2026-10-20）

- リリース対象コミット: 4991a8dd19a1aae361eadcd8702e7e3211dc270c。タグv0.1.0をoriginへpush。
- GitHub CI 39376713871: macOS・Windowsともバージョン検証、フロントエンドビルド、Rustテスト成功。
- Release: https://github.com/zhuchuanhui/MacMerge/releases/tag/v0.1.0 。ドラフトではない正式リリース。リポジトリは非公開を維持。
- 添付: MacMerge_0.1.0_aarch64.dmg（4,201,300 bytes）、SHA256SUMS.txt。ローカル生成・検証したDMGを直接添付（手動ドラフト生成ワークフローは未実行）。
- 公開後にGitHubからダウンロードしSHA-256一致を確認。DMGはarm64、内包バージョン0.1.0、アドホック署名検証成功。
- SHA-256: 99b9fada94b70e006aea5713d9b4c551910dcfb1387442108df02ace9960cb89。
- Developer ID署名・公証、他のMacでの起動、Windows実機動作は未検証。今回のUI再検証なし。本番デプロイなし。
