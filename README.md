# 影拾

桌面视频下载工具，粘贴链接即下。

## 前置准备

下载以下文件放入 `resources/` 目录：

| 文件 | 用途 | 必需 |
|------|------|:---:|
| yt-dlp.exe | 视频解析下载 | 是 |
| deno.exe | YouTube 反爬 | 推荐 |
| ffmpeg.exe | 格式转换 | 可选 |
| ffprobe.exe | 格式转换 | 可选 |

## 开发

```bash
npm install
npm run dev      # 启动
npm run build    # 构建
npm run package  # 打包
```

## 功能

- 粘贴链接 → 解析 → 选格式 → 下载，支持 1000+ 站点
- 播放列表 / 合集解析（YouTube、B 站）
- 下载历史记录、链接收藏
- 字幕下载、格式转换、音频提取
- B 站扫码登录、Cookie 管理、代理支持

## License

ISC
