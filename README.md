# VideoBox

桌面视频下载工具，基于 Electron + Vue 3 + TypeScript，使用 yt-dlp 解析下载、FFmpeg 处理音视频。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端 | Vue 3 (Composition API) + Pinia + Vue Router |
| UI 组件 | Element Plus |
| 构建 | electron-vite + TypeScript |
| 下载引擎 | yt-dlp |
| 音视频处理 | FFmpeg |

## 前置依赖

在构建和运行之前，需要准备好以下外部工具：

### 1. Node.js

需要 Node.js 18+ 环境。

下载地址：[https://nodejs.org/](https://nodejs.org/)

### 2. yt-dlp（必需）

视频解析与下载核心。下载后将 `yt-dlp.exe` 放入 `resources/` 目录。

下载地址：[https://github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases)

### 3. FFmpeg & FFprobe（可选）

用于音视频格式转换、合并、提取音频。下载后将 `ffmpeg.exe` 和 `ffprobe.exe` 放入 `resources/` 目录。

下载地址：[https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)（Windows 版本）

### 目录结构

```
resources/
├── yt-dlp.exe      (约 18MB，必需)
├── ffmpeg.exe      (约 195MB，可选)
└── ffprobe.exe     (约 195MB，可选)
```

> `resources/` 下的二进制文件已加入 `.gitignore`，不会被提交到仓库。

## 开发

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 构建
npm run build

# 构建并打包为 Windows 安装包
npm run package
```

## 功能

### 视频下载
- 粘贴视频链接 → 解析视频信息（标题、封面、时长、上传者）
- 自动推荐最佳画质，支持手动选择清晰度和格式
- 支持纯音频下载（MP3 等格式）
- 实时显示下载进度、速度、剩余时间
- 下载队列管理，支持并发控制

### 音视频处理
- 格式转换：MP4 / MKV / WebM / AVI
- 音频提取：MP3 / AAC / FLAC / WAV / Opus / M4A
- 处理进度实时反馈

### 历史记录
- 下载记录本地持久化
- 支持打开文件所在位置
- 支持删除单条或清空全部

## 支持的站点

通过 yt-dlp 支持 1000+ 视频站点，包括但不限于：

- YouTube
- Bilibili
- Facebook
- Twitter / X
- Instagram
- TikTok
- Vimeo

更多详见 [yt-dlp 支持列表](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

## 项目结构

```
VideoBox/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── index.ts           # 应用入口
│   │   ├── ipc/               # IPC 通信
│   │   ├── services/          # yt-dlp / ffmpeg / 下载管理 / 历史记录
│   │   └── utils/             # 路径解析 / 代理
│   ├── preload/               # 预加载脚本（contextBridge）
│   ├── renderer/              # Vue 3 前端
│   │   └── src/
│   │       ├── App.vue        # 根组件
│   │       ├── views/         # 页面（Home / History）
│   │       ├── components/    # UI 组件
│   │       ├── stores/        # Pinia 状态管理
│   │       └── router/        # 路由配置
│   └── shared/                # 共享类型定义
├── resources/                 # 外部二进制（不纳入版本控制）
├── electron.vite.config.ts    # 构建配置
├── electron-builder.yml       # 打包配置
└── package.json
```

## License

ISC
