# VideoBox 项目目录文档

桌面视频下载工具，基于 Electron + Vue 3 + TypeScript，使用 yt-dlp 下载视频、FFmpeg 处理音视频。

## 目录结构

```
VideoBox/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 应用入口：创建窗口、初始化服务
│   │   ├── ipc/
│   │   │   └── index.ts         # IPC 处理注册：桥接渲染进程与后端服务
│   │   ├── services/
│   │   │   ├── yt-dlp.service.ts      # yt-dlp 封装：解析视频信息
│   │   │   ├── download-manager.ts    # 下载管理：并发控制、进度解析
│   │   │   ├── ffmpeg.service.ts      # FFmpeg 封装：格式转换、提取音频
│   │   │   └── history.service.ts     # 历史记录：JSON 文件持久化
│   │   └── utils/
│   │       ├── paths.ts         # 二进制路径解析（yt-dlp / ffmpeg）
│   │       └── proxy.ts         # 代理环境变量读取
│   ├── preload/
│   │   └── index.ts             # 预加载脚本：暴露 window.api 给渲染进程
│   ├── renderer/                # Vue 3 前端
│   │   ├── index.html           # HTML 入口（含 CSP 配置）
│   │   └── src/
│   │       ├── main.ts          # Vue 应用初始化（Pinia / Router / ElementPlus）
│   │       ├── App.vue          # 根组件：顶部导航 + 路由视图
│   │       ├── env.d.ts         # TypeScript 环境声明
│   │       ├── router/
│   │       │   └── index.ts     # 路由配置（/ 首页, /history 历史）
│   │       ├── stores/
│   │       │   ├── download.store.ts   # 下载状态管理（Pinia）
│   │       │   ├── history.store.ts    # 历史记录状态管理
│   │       │   └── settings.store.ts   # 用户设置（localStorage 持久化）
│   │       ├── views/
│   │       │   ├── Home.vue     # 首页：URL 输入 → 解析 → 选择格式 → 下载
│   │       │   └── History.vue  # 历史页：下载记录表格 + 音视频处理入口
│   │       └── components/
│   │           ├── VideoInfo.vue         # 视频信息卡片（封面/标题/时长等）
│   │           ├── FormatSelector.vue    # 格式选择器（推荐/仅音频/全部）
│   │           ├── DownloadProgress.vue  # 单条下载进度条
│   │           ├── DownloadList.vue      # 下载队列面板（可折叠）
│   │           ├── HistoryTable.vue      # 历史记录表格
│   │           └── PostProcessDialog.vue # 音视频处理弹窗（格式转换/提取音频）
│   └── shared/
│       └── types.ts             # 共享类型定义 + IPC 通道常量
├── resources/
│   ├── yt-dlp.exe               # yt-dlp 二进制
│   ├── ffmpeg.exe               # FFmpeg 二进制
│   └── ffprobe.exe              # FFprobe 二进制
├── scripts/
│   └── dev.js                   # 开发启动脚本
├── electron-builder.yml         # electron-builder 打包配置
├── electron.vite.config.ts      # electron-vite 构建配置
├── package.json                 # 项目元信息与依赖
├── tsconfig.json                # TypeScript 根配置（引用 node/web 子配置）
├── tsconfig.node.json           # Node 端 TS 配置（main / preload / shared）
├── tsconfig.web.json            # Web 端 TS 配置（renderer）
└── .gitignore
```

## 架构概览

```
┌─────────────────────────────────────────────────┐
│ 渲染进程 (Renderer)                              │
│ Vue 3 + Pinia + Element Plus + Vue Router        │
│ ├─ App.vue (导航栏)                              │
│ ├─ views/Home.vue (视频解析 + 下载)              │
│ ├─ views/History.vue (历史记录 + 音视频处理)     │
│ └─ components/ (UI 组件)                         │
└─────────────┬───────────────────────────────────┘
              │ contextBridge (window.api)
┌─────────────▼───────────────────────────────────┐
│ 预加载脚本 (Preload)                             │
│ preload/index.ts → 暴露 API 接口                 │
└─────────────┬───────────────────────────────────┘
              │ ipcRenderer.invoke / .on
┌─────────────▼───────────────────────────────────┐
│ 主进程 (Main)                                    │
│ ├─ ipc/index.ts          → IPC 路由注册         │
│ ├─ services/yt-dlp.service.ts → 视频解析        │
│ ├─ services/download-manager.ts → 下载调度      │
│ ├─ services/ffmpeg.service.ts → 音视频转码      │
│ └─ services/history.service.ts → 历史持久化     │
└─────────────┬───────────────────────────────────┘
              │ spawn(child_process)
┌─────────────▼───────────────────────────────────┐
│ 外部二进制                                        │
│ resources/yt-dlp.exe  (视频解析 + 下载)          │
│ resources/ffmpeg.exe  (转码 + 音频提取)          │
└────────────────────────────────────────────────-┘
```

## 数据流

1. **视频解析**：用户输入 URL → `window.api.parseVideo()` → IPC → `YtDlpService.parseVideo()` → spawn yt-dlp `-J` 获取 JSON → 返回 `VideoParseResult`
2. **视频下载**：用户选择格式 + 目录 → `window.api.startDownload()` → `DownloadManager.startDownload()` → spawn yt-dlp 下载 → 进度通过 IPC 推送至渲染进程
3. **下载队列**：`DownloadManager` 维护并发上限（默认 3），超出排队的请求在活跃任务完成后自动启动
4. **音视频处理**：`window.api.convertVideo()` / `window.api.extractAudio()` → `FfmpegService` → spawn ffmpeg → 进度通过 IPC 回推
5. **历史记录**：下载完成后自动写入 `download-history.json`（位于 `userData` 目录，最多保留 500 条）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端框架 | Vue 3 + Composition API |
| 状态管理 | Pinia |
| UI 组件库 | Element Plus |
| 路由 | Vue Router (Hash 模式) |
| 构建工具 | electron-vite |
| 语言 | TypeScript 5 |
| 打包 | electron-builder (NSIS) |
| 外部工具 | yt-dlp, FFmpeg |

## 开发命令

```bash
npm run dev      # 启动开发环境
npm run build    # 仅构建
npm run package  # 构建 + 打包为 Windows 安装包
```
