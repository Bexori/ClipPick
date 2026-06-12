# 影拾

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
npm run package  # 打包安装包
```

## 功能

- 粘贴链接 → 解析 → 选择格式 → 下载
- 支持 YouTube、Bilibili、TikTok、抖音、Twitter/X 等 1000+ 站点
- **播放列表 / 合集解析**：支持 YouTube 播放列表/频道、B 站合集，首页展示列表，逐个选择清晰度下载
- **收藏**：保存常用链接，支持复制链接一键跳转解析
- 下载历史记录（搜索 / 排序 / 分页）
- 音视频格式选择（田字格展示，合并格式优先）
- 字幕下载（手动字幕 / 自动字幕 / 嵌入视频）
- FFmpeg 后处理（格式转换 / 音频提取）
- B 站 OAuth 扫码登录（本地生成二维码，Cookie 过期检测）
- Cookie 管理（自动 / 浏览器读取 / cookies.txt）
- YouTube 反爬（Deno JS Runtime + mobile web player client）
- 代理支持
- 下载队列（并发控制 / 自动重试 / 暂停恢复）
- 下载完成桌面通知
- 设置持久化与导入导出

## License

ISC
