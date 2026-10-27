# MacMerge

**选择语言 / Choose a language / 言語を選択:** [简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.md)

面向 macOS 和 Windows 的本地文本差异比较与合并应用。比较文件、采纳需要的更改并保存。点击应用中的 **EN / 日本語 / 简体 / 繁體** 按钮即可切换界面语言，选择会在下次启动后保留。

## 功能

- 最多打开 20 个文件（单个不超过 20 MB，总计不超过 100 MB），以 A 为基准同时比较最多 4 个文件
- 浏览差异、采纳更改，并分别编辑和保存各列
- 支持并排、Fluid View 和合并视图，可选择同步滚动
- 按页面比较 PDF 中提取的文本（只读）
- 文件仅在本机处理，不会上传到云服务
- 一键切换英语、日语、简体中文和繁体中文界面，并记住选择

## 环境要求

- Node.js 20.19+ 或 22.12+
- Rust stable 和 Tauri 2 对应操作系统的构建依赖
- macOS：Xcode Command Line Tools

## 开发运行

```sh
npm install
npm run tauri:dev
```

## 构建

```sh
npm run tauri:build       # 为当前操作系统创建生产构建
npm run build:mac:app     # 仅构建 Apple Silicon (arm64) MacMerge.app
npm run build:mac         # 构建完整的 Apple Silicon macOS 生产包
```

`.app` 输出位置：`src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MacMerge.app`。

## 支持格式与限制

支持 UTF-8 文本和可提取文本的 PDF。不支持比较 PDF 图像、布局或格式；不支持扫描 PDF 的 OCR、受密码保护的 PDF、保存为 PDF 或文件夹比较。退出应用后不会恢复未保存的编辑。

## 开发检查

```sh
npm run build
npm run test:rust
npm run check:release
```

## GitHub Release 与部署

GitHub Release 与生产部署分别管理。当前部署模式为 `undecided`，尚未配置生产资源或部署。项目流程请参阅 [`deployment.config.json`](deployment.config.json) 和 [`AGENTS.md`](AGENTS.md)。

代码签名与公证、Windows 实际运行和外部分发尚未验证。
