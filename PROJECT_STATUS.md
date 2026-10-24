# Project Status

## Product

- **Name:** MacMerge
- **Problem / intended user:** macOS・Windowsでローカルのテキストを比較し、必要な変更だけ採用したい利用者。
- **MVP:** 開始画面、20ファイルの管理、最大5列のA基準比較、自動差分、3種類の差分表示、差分ナビゲーション、編集、変更採用、明示的保存、最近の比較。
- **Acceptance criteria:** 最大20ファイルを読み込み、最大5ファイルを表示して比較・採用・保存でき、関連チェックに通り、arm64 macOS .appを生成・起動できる。
- **Deferred:** PDFのページ画像・レイアウト比較、OCR、文字コード変換、3-way conflict merge、外部配布。

## Implementation

- **Platform / technology:** Rust + Tauri 2 + React + TypeScript + CodeMirror 6。既存のクロスプラットフォーム設計を継続。
- **Current state:** 最大20項目を開ける（1ファイル20MB以下、読込後合計100MB以下）。Aを基準にB〜Eを最大4組同時比較する5列レイアウト、差分ナビゲーション・変更採用・テキスト保存を実装。PDF、DOCX/ODT、PPTX、XLS/XLSX/ODSは読み取り専用で抽出テキストを比較。フォルダは対応ファイルを再帰的に集め、相対パス付きの比較レポートにして比較する。
- **Next step:** Windows x64インストーラーをv0.2.0としてGitHub Releaseへ公開し、ユーザーのWindows PCで導入・起動確認。
- **Verification:** 下記の最終確認欄を参照。
- **Local artifact:** /Users/d/github/MacMerge/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app
- **Supported files:** UTF-8テキスト、PDF、DOCX、ODT、PPTX、XLS、XLSX、ODS。フォルダは2,000対象ファイル・50MBまで。1ファイル20MB以下、全体100MB以下、最大20項目を開いて最大5列表示。Office文書・PDF・フォルダは読み取り専用。スキャンPDF、画像・レイアウト・書式比較、OCR、構造化文書への書き戻しは未対応。

## GitHub and release

- **Repository:** https://github.com/zhuchuanhui/MacMerge （非公開）
- **Branch / PR:** main、初回コミットを作成。PRなし。
- **Commit convention:** Conventional Commits
- **CI:** macOS/Windows matrix CIあり。現行mainのcommit `642ae6f`（v0.2.0ソース）は2026-10-24に両OSのCI成功。
- **Release method:** 手動workflow dispatchで既存version tagからmacOS DMGとWindows x64 NSIS setup EXEをビルドし、SHA256一覧付きのdraft GitHub Releaseを作成。CI/両プラットフォームのbuild成功後に公開。
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

- Windows実機での操作は未検証。Parallels Desktopはあるが`prlctl list -a`では登録VMがなく、このMacではWindows版を直接実行できない。現行mainのWindows CIは成功済みだが、Windows installer buildは未実施。Parallels Desktopには登録VMがなく、`rustup`もないためローカルWindows buildはできない。
- Finderからの実ドラッグは2026-10-25に実アプリで確認済み。`Peer.txt`のドロップ後に6/20件となり、Peer.txtが比較画面の基準Aとして表示された。Windows実機操作は未検証。
- 保存前の内容照合と原子的置換の間に発生する同時更新は排他制御していない。
- 未保存編集はメモリ上のみで、強制終了・クラッシュ後の復元は未対応。通常の⌘Qとウインドウを閉じる操作には終了確認を実装し、キャンセル時に編集が保持されることを実アプリで確認済み。
- Developer ID署名、公証、他のMacでの起動は対象外。ローカルのアドホック署名のみ。
- macOSファイルドロップを有効にするためTauriの`macOSPrivateApi`を使用。ローカルビルドで有効化した状態を確認。配布方針は未決定。
- フロントエンドのバンドルサイズ警告あり。

## Finderドロップ確認（2026-10-25）

- Finderを画面左側に並べ、`/tmp/macmerge-odt-word/Peer.txt`を既存のMacMergeアプリへドロップ。比較画面に遷移し、6/20ファイル、基準AがPeer.txt、比較相手file-11.txt、1件の差分が表示された。ネイティブドロップから読み込み・比較画面への遷移まで確認済み。
- Windows検証環境を確認。Parallels Desktopはインストール済みだが`prlctl list -a`で登録VMなし。`rustup`はなく、Rust導入ターゲットは`aarch64-apple-darwin`のみ。現作業ツリーのWindows実機・ネイティブビルドは未検証。

## macOS版機能の最終確認（2026-10-25）

- ユーザー指定の確認範囲はmacOS版。Windows版は今回の対象外。
- 既存のarm64 `.app`（`/Users/d/github/MacMerge/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app`）のみを使用し、別コピーは起動していない。Finderドロップ後の6/20件・Peer.txt基準の比較画面を確認し、左右/Fluid/統合表示、同期オン/オフ、A↔B/A↔C、選択ペアのみ/全ファイルを実操作で確認。最後に左右表示・同期オン・A↔B・全ファイル表示へ復帰。
- 既存の検証記録には開始/履歴、複数ファイル・最大5列、差分位置/ナビゲーション、変更採用、編集・保存、基準ファイル切替、フォルダ比較/フィルター/HTMLレポート、日本語/英語/中国語、PDF/Office抽出、読み込み上限、終了確認の実アプリ確認とRust境界テストを記録済み。
- 現行ソースで`npm run test:rust`（13件）、`npm run build`、`npm run check:release`、`git diff --check`成功。フロントエンドは約575KBのバンドル警告あり。前回のソース変更時に既存アプリを終了・同じ`.app`を再ビルド・再起動しており、今回の変更は状態記録のみ。
- 公開・デプロイ・コミットなし。スキャンPDFのOCR、画像/レイアウト/書式比較、構造化文書への書き戻しは未対応。

## Windows版v0.2.0リリース準備（2026-10-25）

- ユーザー依頼により、非公開リポジトリ`zhuchuanhui/MacMerge`でWindows版の検証用releaseを用意する。対象branchは`main`、現行versionは0.2.0、既存latest releaseはv0.1.0。
- `.github/workflows/release.yml`を更新し、Windows x64 runnerでNSIS setup EXEを作成。macOS DMGとWindows setup EXE、SHA256一覧を含むdraftを作る。Release作成jobだけに`contents: write`を与え、追加Secretsやコード署名は使わない。本番デプロイなし。
- 現行main `642ae6f` のCI run `40108739128` はmacOS・Windowsとも成功。ローカル`npm run test:rust`（13件）、`npm run build`、`node scripts/check-release.mjs v0.2.0`、Release workflowのYAML parse、`git diff --check`も成功。Windows installerの実ビルド・実行はGitHub ActionsとユーザーPCで確認する。
- リポジトリはprivate。GitHub branch-protection APIはFree private repositoryのプラン制限で読み取り拒否（403）。

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

## フォルダ・Office形式対応（2026-10-20）

- フォルダ同士の比較を追加。相対パスでテキストを集約して差分表示し、フォルダ内容は読み取り専用。上限は1フォルダ2,000ファイル・合計50MB・深さ32。`.git`、`node_modules`、`target`等の生成物ディレクトリ、シンボリックリンク、バイナリは除外し、除外件数を表示。
- DOCX・ODT・PPTX・XLS・XLSX・ODSのテキスト抽出比較を追加。PDFを含め、これらの形式は読み取り専用で、レイアウト・画像・書式やPDFの見た目は比較しない。
- `samples/folder-diff-demo/`に追加・削除・変更・バイナリ除外を含むフォルダ比較サンプル、`samples/office-diff-demo/`にWord・Excel・PowerPointサンプルを追加。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 7件成功。フォルダ相対パス・バイナリ除外、およびDOCX・XLSX・PPTX抽出を含む。
- `npm run build`、`npm run check:release`、`git diff --check`成功。`npm run build:mac:app`成功。Viteの大きなJavaScriptバンドル警告あり。
- 生成アプリの実行ファイルはMach-O arm64、CFBundleNameはMacMerge。最終.appを実際に起動し、Folder-A/Folder-Bを選択、相対パス内の追加・削除・変更、バイナリ1件の除外、読み取り専用表示を確認。さらにWord-A.docx/Word-B.docxをアプリ画面で比較し、本文差分を確認。
- XLS/XLSX/ODSはRust抽出テストの範囲が限定的で、各形式の実ファイルでのUI確認は未実施。ODT・PPTX・XLS・ODS、2,000ファイル/50MB上限、深い階層、Windows実機、フォルダのFinderドラッグ投入は未検証。PDF画像OCR、Office書式・画像・数式の比較や書き戻しは未対応。公開・デプロイなし。

## フォルダ比較一覧とレポート（2026-10-20）

- フォルダ同士の比較時に相対パス別の一覧を表示。変更・追加・削除・同一件数を示し、状態フィルターを追加。変更ファイルを先に並べ、行を選ぶと左右の本文表示を該当ファイルへ移動。
- フォルダ比較レポートをHTMLで出力。全体件数と相対パス別状態を一覧化し、差分ファイルの本文を展開して確認できる。
- `npm run build`成功（Viteのバンドルサイズ警告あり）。`npm run build:mac:app`成功しarm64アプリを再生成。画面上の一覧・状態フィルター・行選択・レポート保存を確認。生成レポートを`samples/many-files-folder-demo/Folder-comparison-report.html`に保存し、件数・追加/削除状態・変更ファイル本文を確認。

## レポートの変更前・変更後表示（2026-10-20）

- フォルダHTMLレポートの内容欄を、変更前は赤系、変更後は緑系のカードと見出しに分け、見出しにも「変更前」「変更後」を明記。既存のサンプルレポートにも同じ見分け方を反映。
- `npm run build`、`npm run check:release`、`git diff --check`成功。arm64 `.app`を再生成。Viteのバンドルサイズ警告あり。レポートをブラウザで開いた見た目の再確認は未実施。

## 多ファイル比較サンプル（2026-10-20）

- `samples/many-files-folder-demo/`を追加。Folder-Aは100ファイル、Folder-Bは101ファイル。共有ファイル、内容変更、削除、追加、深い階層のファイルを含む。READMEから操作と差分内容を確認できる。トップレベルREADMEのサンプル一覧にも掲載。
- 生成済みMacMerge.appでFolder-A/Folder-Bを実際に比較し、読み込み件数100/101、38件の差分が表示されることを確認。サンプル全体は約39KB。`git diff --check`成功。コード変更なしのためアプリ再ビルドは未実施。

## Fluid View差分マップ表示修正（2026-10-20）

- 差分位置マップのCSSが欠けて、Fluid Viewで説明文・ラベル・ボタンが標準レイアウトのまま縦に崩れていたため、2列の圧縮トラック、ファイルラベル、変更・追加・削除を示す色付きマーカーを復旧。
- `npm run build`、`npm run build:mac:app`、`git diff --check`成功。arm64アプリを起動しプロセスを確認。添付と同じ3ファイルの比較画面での見た目は未再現・未確認。Viteのバンドルサイズ警告あり。

## Fluid Viewスクロール負荷の軽減（2026-10-20）

- Fluid接続線の描画対象を左右両方で表示中の行に限定し、差分行ペアは差分更新時に一度だけ計算。スクロールイベントを1フレームに集約し、同一パスならReact更新を省略。
- Fluid Viewの差分カードに`content-visibility`を設定し、画面外カードのレイアウト・描画を遅延。
- `npm run build`、`npm run build:mac:app`、`git diff --check`成功。arm64アプリを再生成。体感・フレームレートの前後測定と実データでのスクロール比較は未実施。Viteのバンドルサイズ警告あり。

## Fluid Viewの追加スクロール最適化（2026-10-20）

- Fluid接続線用の対応行を差分変更時に1度だけ生成し、表示範囲の開始行を二分探索してから可視範囲内だけ座標計算するよう変更。画面外の差分に対する座標問い合わせをなくした。
- 画面外の差分カードは`content-visibility`で描画を遅延し、スクロールイベントはフレーム単位でまとめ、形状が同じならReact state更新を省略する。
- `npm run build`、`npm run check:release`、`git diff --check`、`npm run build:mac:app`成功。arm64アプリを再生成。実機での前後フレームレート・スクロール体感の測定は未実施。Viteのバンドルサイズ警告あり。


## Fluid View追加最適化の取り消し（2026-10-20）

- 同期スクロール中にSVGをスクロール量で移動する変更は、体感差が小さいとのユーザー意見を受けて取り消し。差分行の事前計算・可視範囲限定と、画面外カードの遅延描画は維持。
- 取り消し後に`npm run build`、`npm run check:release`、`git diff --check`、`npm run build:mac:app`成功。最新版を一つだけ再起動。Viteのバンドルサイズ警告あり。

## 動作確認と起動設定の堅牢化（2026-10-21）

- 保存済み表示モードを読み込めない場合に初期化で例外にならないよう、既定の左右表示へ安全にフォールバックする処理を追加。
- arm64 macOSアプリで開始画面、3テキスト比較のFluid View（11件の変更と差分位置マップ）、PDF比較（15件の変更と抽出テキスト）、統合表示の変更前・変更後の色分け、次の差分への移動を操作確認。PDFは読み取り専用として表示。
- `npm run test:rust`（7件）、`npm run build`、`npm run check:release`、`git diff --check`、`npm run build:mac:app`成功。ビルド後の`.app`を起動し、開始画面と実比較画面を確認。Viteの約570KBバンドル警告と未公証の注意は継続。
- OS起動直後の初回画面取得では白紙に見えたが、WebView再読み込み後に開始画面が表示され、再ビルド後の新規起動では正常表示を確認。再起動をまたぐ初回WebView不調は原因を特定できておらず、別環境・長時間使用・実ファイルのFinderドラッグ投入は未検証。公開・デプロイなし。

## ABC比較ペア選択の明確化（2026-10-21）

- 3ファイル以上の比較画面に「比較対象（Aを基準）」を追加。A↔B、A↔Cなど各ペアをボタンで切り替え、相手ファイル名・変更件数・選択中状態を表示。選択するとタイトル、差分マップ、差分カード、採用先がそのペアへ切り替わる。
- arm64 `.app`を再ビルドして起動。3ファイル比較でA↔B（11件）からA↔C（7件）へ切り替わり、タイトルと差分内容が更新されることを画面で確認。`npm run build`、`npm run check:release`、`git diff --check`成功。Viteの大きなJavaScriptバンドル警告あり。

## C列の比較切替と一時非表示（2026-10-21）

- ファイル棚で現在割り当て中のCを再選択すると、比較状態だけ初期化され差分計算が再実行されない不具合を修正。同じ割り当ての再選択では既存差分を保ち、選択したB/C列を比較対象としてフォーカスする。
- 3ファイル以上では比較ペア欄から「選択ペアのみ／全ファイルを表示」を切り替え可能にし、Aと選択中の相手だけを一時表示できるようにした。差分計算は選択中ペアを先に処理し、他ペアを順次計算する。
- `npm run build`、`npm run check:release`、`git diff --check`、`npm run build:mac:app`成功。生成したarm64 `.app`を起動し、3ファイル履歴を開いてC再選択後にA↔C・11件の差分へ切り替わることを確認。「選択ペアのみ」でA/Cの2ペイン、「全ファイルを表示」でA/B/Cの3ペインに戻ることも実画面で確認。署名検証成功。Viteの約571KBバンドル警告、未公証。

## スクロール同期状態の視認性（2026-10-21）

- 同期ボタンに「同期: オン／同期: オフ」の状態ラベルを表示。オンは緑色、オフはグレーにし、小さい画面でもON/OFF表示が残るようにした。アクセシビリティ名とツールチップも現在状態に連動。
- `npm run build`、`npm run check:release`、`git diff --check`、`npm run build:mac:app`成功。ビルドしたarm64アプリの実画面でオン→オフ→オンを操作し、アクセシビリティ状態の表示が切り替わることを確認。Viteの約571KBバンドル警告、未公証。

## 比較基準ファイルの切替（2026-10-21）

- 比較画面に「基準ファイル」メニューを追加。開いているファイルを選ぶとA列へ入れ替え、旧Aは選んだファイルの元の列へ移動する。各ペアの差分と採用方向を新しいA基準で再計算する。
- `npm run build`、`npm run check:release`、`git diff --check`、`npm run build:mac:app`成功。arm64アプリでCのファイルを基準に選び、A列がA-baseline.txt、旧AのB-edited.txtがC列へ移動し、比較ペア・差分件数・採用方向が更新されることを実画面で確認。Viteの約572KBバンドル警告、未公証。

## 比較列の表示モードを明確化（2026-10-21）
- 「選択ペアのみ／全ファイル」の一つのトグルを、現在の状態を示す「表示中:」ラベルと選択状態が常時見える2択コントロールに変更。どちらの表示かを色・枠・アクセシビリティの選択状態で示す。
- `npm run build`、`npm run check:release`、`git diff --check`成功。Viteの約572KBバンドルサイズ警告あり。arm64 `.app`再ビルド成功、未公証。再ビルド後のアプリを終了・再起動し、起動画面をアクセシビリティ表示で確認。比較画面の新しい2択コントロールはビルド確認済みだが、実画面での切替操作は未検証。


## 全機能の再検証と修正（2026-10-24）

- 指定どおり、既存の `/Users/d/github/MacMerge/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app` を終了・再ビルド・再起動して操作確認。別コピーは使用していない。
- フォルダ比較で本文に `--- ファイル: fake.txt ---` があると一覧へ架空ファイルが出る問題を再現。本文中の区切り行をエスケープし、一覧とレポートの解析時に復元するよう修正。`\` 付きの同様の行とCRLFも保持する回帰テストを追加。
- 同じテキスト比較を履歴から開き直すと「比較しています…」のまま止まる問題を修正。履歴読み込み時に比較結果を無条件で消さないようにし、ペアが同じでも結果が残ることをアプリ上で確認。
- `npm run build`、`npm run check:release`、`git diff --check`成功。`npm run test:rust`は13件成功。`npm run build:mac:app`成功、arm64の既存アプリを再起動して修正後の画面を確認。約572KBのJavaScriptバンドル警告と未公証の注意は継続。
- 実アプリ操作で開始画面・最近の比較、2/3列比較、差分位置、差分移動、変更採用、テキスト保存、履歴の再表示、基準ファイル・比較ペア・表示列切替、左右/Fluid/統合表示、同期オン/オフ、フォルダの変更/追加/削除/同一フィルター、HTMLレポート保存、日本語/英語/中国語の切替を確認。フォルダレポートは103件のサンプルと、区切り文字を含む本文の双方で出力確認。通常レポートは差分なしの表示を含めて保存確認。
- DOCX、PDFの履歴比較、ODS、XLS、ODTの抽出テキスト・読み取り専用表示を実アプリで確認。XLSX、PPTX、PDF、フォルダの読み込みと差分計算はRustテストで確認。20MiBを1バイト超えるファイルは実アプリで上限エラーを確認。Rust境界テストでフォルダ2,000件ちょうど／2,001件、50MiBちょうど／50MiB+1バイト、階層32段／33段を確認。展開後テキストが20MiBを超える圧縮PPTXも拒否。
- PDFおよびPPTXの抽出結果に20MiB上限を適用し、フォルダ内の抽出結果も50MiBを超える前に中断するよう修正。圧縮した2スライドPPTXで、合計展開テキストが20MiBを超えた場合の拒否を確認。
- 再起動後の最新アプリで103ファイルのサンプルフォルダを再読込し、変更・追加・削除・同一の件数と変更フィルターを画面で確認。
- ガイドの対応形式一覧にODTが抜けていたため、日本語・英語・簡体字中国語の各表示へ追加。再起動後、3言語それぞれでODTの表記を確認。
- 追加した検証用ファイルは `/tmp/macmerge-folder-marker-check/`、`/tmp/macmerge-format-probe/`、`/tmp/macmerge-text-probe/` にある。履歴から再確認できるよう入力サンプルは残し、生成レポートは削除済み。
- 開いている文書合計100MiBの上限を実アプリで確認。20MiBのUTF-8ファイルを5件（合計100MiB）読み込み、5/20件・5列で表示。さらに1バイトの6件目を選ぶと上限メッセージが表示され追加を停止。検証した5ファイルと1バイトファイルは`/tmp/macmerge-100mib-check/`に残し、履歴から再度開ける状態にした。
- Microsoft Wordで日本語・英語のテキストを含むODTを新規作成し、同じWord生成ODTと抽出内容を合わせたUTF-8テキストを再起動後の既存arm64アプリで比較。3行すべて一致し、差分なし・ODT読み取り専用を確認。Wordの保存時にODT互換性の注意が表示されたが保存は成功。Word起動時にAdobe PDF連携のVBAエラーも出たが、終了後に文書作成・保存を続行できた。
- 未確認: Windows実機とFinderからの実ドラッグ。Finderの検証ファイルをMacMerge画面へドラッグし、Finderウインドウを縮小した状態と、既存アプリを終了・再起動した後の両方で試したが、MacMergeへの追加を確認できなかった。現在のソースにはTauriの`onDragDropEvent`受付とdrop処理があるが、画面操作からnative dropイベントの到達有無は特定できていない。今回の実アプリ検証はこのMacのarm64版に限定。公開・デプロイなし。Word生成ODTの使い捨て入力は `/tmp/macmerge-odt-word/` にある。

## 未保存編集の終了保護（2026-10-24）

- 未保存テキストがある状態で`⌘Q`を試すと、macOS標準のQuitメニュー経路がウインドウの`CloseRequested`を通らず終了することを実アプリで確認。
- Quitメニューをアプリ独自項目（`⌘Q`アクセラレータ付き）に置き換え、終了イベントをフロントエンドの確認ダイアログへ通知。Rust側でも終了イベントを保留し、確認後の終了コマンドだけを許可するようにした。ウインドウを閉じる操作には既存のCloseRequested確認を維持。
- 既存arm64アプリを終了して同じ`.app`を再ビルド・再起動。未保存編集を作って`⌘Q`を押すと確認が表示され、「キャンセル」で未保存の編集が保持されることを確認。「保存せずに終了」を選ぶとプロセスが終了した。ウインドウを閉じる操作でも確認が表示され、キャンセル後に編集が保持された。
- `npm run build`成功（JavaScriptバンドルサイズ警告あり）、`npm run check:release`成功、`npm run test:rust` 13件成功、`npm run build:mac:app`成功、`git diff --check`成功。生成物は`src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app`。アドホック署名、未公証。公開・デプロイなし。

## 追加の境界確認（2026-10-24）

- 使い捨てUTF-8ファイル21件をファイル選択画面から一括選択して読み込み、実アプリが20/20件で停止し「残りは追加していません」と表示することを確認。試験ファイルは`/tmp/macmerge-open-count-check/`にある。
- 表示言語を英語に変更し、既存アプリを終了して再起動。起動直後の画面と最近の比較メニューが英語であることを確認し、言語設定の永続化を確認。
- 最近の比較から開いた5ファイル比較でA側の「ファイルを置き換え」を選び、`file-10.txt`を`file-22.txt`に差し替え。Aの見出し・基準ファイル・比較内容が更新され、既存の読み込み済みファイル数へ新規ファイルが加わることを確認。
- 英語確認後、日本語に戻してアプリを終了・再起動し、日本語選択が保持されたことを再確認。検証後はアプリを日本語の開始画面で開いた状態に戻した。
- Finderの実ファイル（`/tmp/macmerge-odt-word/Peer.txt`）を選択し、Finderウインドウを画面左にタイルした状態からMacMergeへドラッグしたが、ファイル追加を確認できなかった。Finderドラッグは依然未検証であり、UI自動操作でnative dragイベントが届かない可能性とアプリ側の不具合を切り分けられていない。Windows実機も未使用。

## 表示モードのアクセシビリティ名（2026-10-24）

- 比較画面の表示モード切替グループで、誤って「言語」のアクセシビリティ名を使っていたため、用途に合う「比較表示モード」に修正。英語は`Comparison view modes`、中国語は`比较显示模式`を追加。
- 指定の手順どおり既存arm64アプリを終了し、同じ`.app`を再ビルドして起動。比較画面で日本語・英語・中国語の各グループ名がアクセシビリティツリーへ反映されることを確認し、日本語の開始画面へ戻した。
- `npm run build:mac:app`成功、`npm run check:release`成功、`git diff --check`成功。Viteの約575KBバンドルサイズ警告あり。アドホック署名、未公証。公開・デプロイなし。

## v0.2.0リリース準備（2026-10-25）

- ユーザーのcommit・push・Release指示に基づき、フォルダ比較、Office文書抽出、HTMLレポート、比較表示改善、終了保護をv0.2.0として公開準備。
- package.json・package-lock.json・Tauri設定・Cargo.toml・Cargo.lockを0.2.0へ統一。
- ローカルRustテスト13件、フロントエンドビルド、release設定チェック成功。バンドルサイズ警告あり。
- 配布対象はApple Silicon向けmacOS DMG。アドホック署名を使用し、Developer ID署名・公証なし。非公開リポジトリを維持。本番デプロイなし。
