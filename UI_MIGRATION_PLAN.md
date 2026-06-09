# VideoBox UI 改造方案

## 一、为什么要改

当前 UI（Element Plus 浅色主题）功能可用，但存在明显体验缺陷：

| 问题 | 现状 | 对用户的影响 |
|------|------|------------|
| 缺乏专业工具感 | 通用浅色后台风格 | 不像桌面工具，更像内部管理系统 |
| 状态反馈不足 | 解析只有 `parsing` 布尔值 | 用户不知道当前在干什么、还要等多久 |
| 导航扩展性差 | 顶部两 tab | 后续加设置、任务管理会挤或藏深 |
| 系统状态不可见 | 没有引擎/路径信息 | 出了问题用户不知道怎么排查 |
| 下载进度体验弱 | 底部固定面板 | 和主流程割裂，用户视线需要跳转 |

目标设计（深色桌面壳 + 四态切换 + 骨架屏 + 侧栏 + 状态栏）解决了以上所有问题。

---

## 二、核心决策

### 决策 1：保留 Element Plus，不删

**结论：保留 EP，用 CSS 变量做深色主题化，不重写交互逻辑。**

理由：

| 如果删掉 EP | 如果保留并主题化 |
|------------|----------------|
| 需手写 Message/MessageBox/Notification | 改 ~20 个 CSS 变量即可 |
| 需手写 Table 排序/筛选/空状态 | 只改行背景、边框色 |
| 需手写 Input clearable/focus/disabled | 只改边框和聚焦色 |
| 需手写 Dialog 动画/遮罩/层级 | 只改背景和圆角 |
| 估计多 3-5 天工作量 | 估计多 0.5 天工作量 |

EP 在项目中的实际使用点：
- `ElMessage.success/error` — 下载开始/完成/失败通知
- `ElMessageBox.confirm` — 删除历史确认弹窗
- `ElTable` + 排序 + `v-loading` — 历史记录表格
- `ElTag` — 状态标签
- `ElImage` + error slot — 封面图加载失败兜底
- `ElAlert` — 解析错误提示
- `ElInput` + clearable + 回车事件 — URL 输入

这些都是交互逻辑，不是视觉问题。CSS 能解决视觉，不能替代交互逻辑。

### 决策 2：保持 SFC 组件拆分，不合并到 App.vue

你提供的 mock 用 `defineComponent` + 字符串 template 把下载页整个塞在 App.vue 里（~700 行），这在原型阶段可以，正式实现不行。

正确做法：Home.vue 拆成独立 SFC 子组件。

### 决策 3：导航结构澄清

mock 里有 4 个导航项，但它们的关系需要明确：

| 导航项 | 实际定位 | 对应路由 |
|--------|---------|---------|
| 视频下载 | **核心工作区**：输入 URL → 解析 → 选格式 → 下载。内嵌"当前任务"面板 | `/` |
| 下载任务 | **全局任务视图**：所有进行中/排队/失败任务的集中管理，批量操作 | `/tasks` |
| 下载记录 | **历史视图**：已完成下载的列表，打开文件/重新下载/删除 | `/history` |
| 设置中心 | **配置页**：默认保存路径、清晰度偏好、并发数、主题 | `/settings` |

"视频下载"内嵌的"当前任务"面板只显示**最近一条**任务，是快速预览入口。点"下载任务"导航进入的是全局任务列表。

---

## 三、技术方案

### 3.1 深色主题化 EP 的核心变量

```css
:root {
  /* 背景层级 */
  --el-bg-color: #080f1f;
  --el-bg-color-overlay: #0d1b33;
  --el-bg-color-page: #060d1a;
  /* 文字 */
  --el-text-color-primary: #f8fafc;
  --el-text-color-regular: #cbd5e1;
  --el-text-color-secondary: #94a3b8;
  --el-text-color-placeholder: #697893;
  /* 边框 */
  --el-border-color: rgba(96, 125, 172, 0.26);
  --el-border-color-light: rgba(100, 116, 139, 0.22);
  --el-border-color-lighter: rgba(100, 116, 139, 0.14);
  /* 品牌色 */
  --el-color-primary: #ff5fa7;
  --el-color-primary-light-3: #ff85bb;
  --el-color-primary-light-5: #ffa8d0;
  --el-color-primary-light-7: #ffcbe3;
  --el-color-primary-light-9: #ffe8f2;
  --el-color-primary-dark-2: #e04d8f;
  /* 填充 */
  --el-fill-color: rgba(17, 31, 59, 0.92);
  --el-fill-color-light: rgba(8, 17, 35, 0.46);
  --el-fill-color-blank: #080f1f;
}
```

约 30 行 CSS 变量覆盖掉 EP 默认浅色主题。具体组件样式偏差用 scoped style 微调。

### 3.2 组件拆分

Home.vue（当前 450 行）拆为：

```
views/Home.vue                    # 页面编排，持有状态机
components/UrlInputPanel.vue      # 1. 输入视频链接
components/ParseResultPanel.vue   # 2. 解析结果（空/loading/成功 三态）
components/DownloadConfig.vue     # 3. 下载配置（格式选择 + 路径 + 开始按钮）
components/CurrentTask.vue        # 4. 当前任务进度
```

每个子组件职责单一，不超过 150 行。

### 3.3 状态机设计

Home.vue 页面状态从当前的一个 `parsing: boolean` 升级为标准状态机：

```
empty → parsing → success → downloading
  ↑        ↓         ↓           ↓
  └────────┴─────────┴───────────┘ (清空/重置)
```

```ts
type PageStatus = 'empty' | 'parsing' | 'success' | 'downloading'
```

各状态下 UI 表现：

| 状态 | 输入区 | 解析结果区 | 配置区 | 任务区 |
|------|--------|-----------|--------|--------|
| empty | 可输入 | 空状态提示 | 灰显占位 | 空状态提示 |
| parsing | 按钮 loading | 骨架屏 | 骨架屏 | — |
| success | 可编辑 | 视频信息 | 可选格式+路径 | — |
| downloading | 可编辑 | 视频信息 | 可选格式+路径 | 进度卡片 |

### 3.4 路由扩展

```ts
// 当前
routes: [
  { path: '/', name: 'Home', component: Home },
  { path: '/history', name: 'History', component: History },
]

// 改造后
routes: [
  { path: '/', name: 'Home', component: Home },
  { path: '/tasks', name: 'Tasks', component: Tasks },
  { path: '/history', name: 'History', component: History },
  { path: '/settings', name: 'Settings', component: Settings },
]
```

---

## 四、改造范围

### 改什么

| 文件 | 操作 | 工作量 | 说明 |
|------|------|--------|------|
| `src/renderer/src/App.vue` | 重写 | M | 深色应用壳（标题栏+侧栏+内容+状态栏） |
| `src/renderer/src/views/Home.vue` | 重写 | L | 状态机驱动，拆分子组件 |
| `src/renderer/src/views/Tasks.vue` | 新增 | S | 全局任务列表 |
| `src/renderer/src/views/Settings.vue` | 新增 | S | 设置占位页 |
| `src/renderer/src/views/History.vue` | 改样式 | S | 深色主题化，逻辑不动 |
| `src/renderer/src/components/UrlInputPanel.vue` | 新增 | S | Home 子组件 |
| `src/renderer/src/components/ParseResultPanel.vue` | 新增 | M | 三态切换 |
| `src/renderer/src/components/DownloadConfig.vue` | 新增 | M | 格式选择+路径 |
| `src/renderer/src/components/CurrentTask.vue` | 新增 | S | 任务进度卡片 |
| `src/renderer/src/components/VideoInfo.vue` | 改样式 | S | 深色化 |
| `src/renderer/src/components/FormatSelector.vue` | 改样式 | S | 深色化 |
| `src/renderer/src/components/DownloadList.vue` | 改样式 | S | 深色化 |
| `src/renderer/src/components/DownloadProgress.vue` | 改样式 | S | 深色化 |
| `src/renderer/src/components/HistoryTable.vue` | 改样式 | S | 深色化 |
| `src/renderer/src/style.css` | 新增 | S | EP 深色变量 + 全局重置 |
| `src/renderer/src/main.ts` | 改 | S | 引入 style.css |
| `src/renderer/src/router/index.ts` | 改 | S | 加 2 条路由 |

> L = 大（>200 行变更），M = 中（100-200 行），S = 小（<100 行）

### 不改什么

| 范围 | 原因 |
|------|------|
| `src/main/**` | Electron 主进程逻辑零改动 |
| `src/preload/**` | IPC 桥接零改动 |
| `src/shared/types.ts` | 类型定义零改动 |
| `src/renderer/src/stores/**` | Pinia stores 零改动（UI 换皮，数据层不变） |
| `package.json` dependencies | 不增不减（保留 EP，不引入新依赖） |
| `electron.vite.config.ts` | 构建配置零改动 |

---

## 五、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| EP 深色 CSS 变量覆盖不全，部分组件残留浅色 | 中 | 低 | 逐个组件检查，scoped style 兜底 |
| 状态机重构引入解析/下载流程 bug | 低 | 高 | 只改 UI 层状态展示，不动 IPC 调用逻辑 |
| CSP 限制导致自定义样式/图标加载失败 | 低 | 中 | 当前 CSP 已允许 `unsafe-inline` style，够用 |
| 窗口 minWidth/minHeight 需调整 | 低 | 低 | 侧栏布局需更宽，从 750px 提到 900px |

---

## 六、实施计划

### 阶段 1：基础设施（预计 1-2 小时）

- [ ] 创建 `style.css`：EP 深色变量 + 全局重置样式
- [ ] 修改 `main.ts`：引入 style.css（保留 EP 和所有插件）
- [ ] 修改 `main/index.ts`：窗口尺寸调整为 `1100×750`，minWidth `900`
- [ ] 修改 `router/index.ts`：添加 `/tasks`、`/settings` 路由

**验收标准**：`npm run dev` 启动，EP 组件全部显示为深色，路由 4 条全部可达（页面内容暂为占位）。

### 阶段 2：应用壳（预计 2-3 小时）

- [ ] 重写 `App.vue`：标题栏 + 左侧导航 + 路由视图 + 底部状态栏
- [ ] 导航项绑定路由，active 状态响应路由变化
- [ ] 状态栏对接 `settingsStore.defaultSavePath`（路径显示）
- [ ] 状态栏"任务数"对接 `downloadStore.activeTasks.length`
- [ ] 状态栏"引擎可用"暂时写死为 true（后续接真实检测）

**验收标准**：4 个导航项点击切换路由，状态栏显示真实路径和任务数，窗口拖拽区 `-webkit-app-region: drag` 正常。

### 阶段 3：下载页（预计 3-4 小时）

- [ ] 拆分并创建 4 个子组件（UrlInputPanel / ParseResultPanel / DownloadConfig / CurrentTask）
- [ ] 在 Home.vue 实现 `PageStatus` 状态机
- [ ] 实现 parsley/成功态的骨架屏动画
- [ ] 格式选择对接真实 `downloadStore.videoInfo.formats`
- [ ] "解析视频"按钮对接 `window.api.parseVideo()` + store
- [ ] "开始下载"按钮对接 `window.api.startDownload()` + store
- [ ] 当前任务面板对接 `downloadStore.activeTasks[0]`

**验收标准**：粘贴真实 YouTube/Bilibili 链接 → 解析 → 选格式 → 下载 → 进度条动，全流程可用。

### 阶段 4：其余页面 + 收尾（预计 2-3 小时）

- [ ] Tasks.vue：任务列表，复用 DownloadProgress 组件
- [ ] Settings.vue：设置表单（默认路径选择、并发数）
- [ ] History.vue：深色样式适配（逻辑不动）
- [ ] HistoryTable.vue / DownloadProgress.vue / DownloadList.vue：深色样式适配
- [ ] 整体走查：检查 EP 组件是否有浅色残留，scoped style 兜底

**验收标准**：4 个页面功能完整，所有 EP 组件无浅色残留，现有下载/历史功能无回退。

---

## 七、验收清单

- [ ] `npm run dev` 正常启动，无控制台报错
- [ ] 解析 YouTube 链接 → 显示视频信息 → 选择格式 → 下载 → 进度更新 → 完成通知，全流程正常
- [ ] 历史记录页面：列表加载、删除确认弹窗、打开文件夹功能正常
- [ ] 4 个导航项切换正常，active 状态正确
- [ ] 底部状态栏显示真实引擎状态、任务数、保存路径
- [ ] 窗口最小尺寸下无布局错乱
- [ ] `npm run build` 构建成功

---

## 八、不做的事

- **不改 Electron 主进程代码**（除非窗口尺寸调整）
- **不改 IPC 协议**（通道名、载荷格式不变）
- **不改 Pinia store 接口**（state/actions 签名不变）
- **不引入新依赖**（不动 package.json）
- **不实现 mock 代码中的 `defineComponent` + 字符串 template 模式**（用标准 SFC）
- **不实现 mock 代码中的樱花装饰背景**（纯视觉元素，低优先级，后续可加）

---

*文档版本：v2.0，最后更新 2026-06-09*
