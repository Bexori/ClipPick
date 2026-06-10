# 影盒

桌面视频下载工具，粘贴链接即下。

## 前置准备

下载以下文件放入 `resources/` 目录：

| 文件 | 用途 | 必需 | 下载 |
|------|------|------|------|
| yt-dlp.exe | 视频解析下载 | 是 | [GitHub](https://github.com/yt-dlp/yt-dlp/releases) |
| deno.exe | YouTube 反爬 | 推荐 | [GitHub](https://github.com/denoland/deno/releases)（解压 zip 得到 exe） |
| ffmpeg.exe | 格式转换 | 可选 | [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) |
| ffprobe.exe | 格式转换 | 可选 | 同上 |

```
resources/
├── yt-dlp.exe
├── deno.exe
├── ffmpeg.exe
└── ffprobe.exe
```

## 开发

```bash
npm install
npm run dev      # 启动
npm run build    # 构建
```

## 功能

- 粘贴链接 → 解析 → 选择格式 → 下载
- 支持 YouTube、Bilibili、TikTok、抖音、Twitter/X 等 1000+ 站点
- 音视频格式转换、提取音频
- 下载历史记录

## License

ISC
