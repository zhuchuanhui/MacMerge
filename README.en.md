# MacMerge

**Choose a language / 言語を選択 / 选择语言:** [English](README.en.md) · [日本語](README.md) · [简体中文](README.zh-CN.md)

A local text diff and merge app for macOS and Windows. Compare files, accept the changes you need, and save them. Switch the app language at any time with the **EN / 日本語 / 中文** buttons. Your choice is saved between launches.

## Features

- Open up to 20 files (20 MB per file, 100 MB total) and compare up to four files against baseline A
- Navigate differences, accept changes, edit and save each column
- Side-by-side, Fluid View, and unified views, with optional synchronized scrolling
- Compare page-by-page extracted PDF text (read-only)
- Files are processed locally and are not uploaded to a cloud service
- One-click English, Japanese, and Simplified Chinese UI language selection, persisted across launches

## Requirements

- Node.js 20.19+ or 22.12+
- Rust stable and the platform requirements for Tauri 2
- macOS: Xcode Command Line Tools

## Run in development

```sh
npm install
npm run tauri:dev
```

## Build

```sh
npm run tauri:build       # Production bundle for the current OS
npm run build:mac:app     # Apple Silicon (arm64) MacMerge.app only
npm run build:mac         # Full Apple Silicon macOS production bundle
```

The `.app` is created at `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app`.

## Supported formats and limitations

MacMerge supports UTF-8 text and PDFs with extractable text. It does not compare PDF images, layout, or formatting; OCR scanned PDFs; open password-protected PDFs; save to PDF; or compare folders. Unsaved edits are not restored after quitting.

## Developer checks

```sh
npm run build
npm run test:rust
npm run check:release
```

## GitHub Releases and deployment

GitHub Releases and production deployment are managed separately. The current deployment mode is `undecided`; no production resources or deployment are configured. See [`deployment.config.json`](deployment.config.json) and [`AGENTS.md`](AGENTS.md) for project workflow details.

Code signing and notarization, Windows runtime behavior, and external distribution have not been verified.
