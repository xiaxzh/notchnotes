# NotchNotes — 交互设计与实现决策

## 概述

macOS 刘海便签应用。鼠标划过屏幕顶部刘海区域触发展开，离开后自动收起。单窗口架构，纯 CSS/WebAnimations 过渡动画，无窗口几何变化。

## 交互流程

```
鼠标进入刘海触发区 (triggerRect)
  → 展开: 窗口 show (已预置在 expanded 尺寸 + 正确位置)
  → Rust emit "panel-shown" 事件
  → 前端 Web Animations API:
      opacity 0 → 1
      translateY(-12px) scale(0.96) → 0 scale(1)
      7-stop spring bounce keyframe, 420ms
  → 编辑器自动获得焦点

鼠标离开抽屉保持区 (keepOpenRect)
  → 500ms 防抖延迟
  → 再次确认鼠标仍不在保持区
  → Rust emit "panel-hide" 事件 (不立即 hide)
  → 前端 Web Animations API:
      opacity 1 → 0, translateY(0) → (-8px), scale(1) → 0.97
      150ms ease-in
  → anim.finished 后 invoke("hide_panel")
  → Rust hide drawer → 窗口不可见
  → 轮询线程 sleep 300ms 防误触
```

## 交互热区

### 触发区 (triggerRect)
- 位置: 屏幕最顶端、菜单栏中央的刘海位置，水平居中
- 尺寸: notch_width × NOTCH_AREA_HEIGHT（~210 × 52 pt）
  - 水平精确匹配刘海宽度，避免菜单栏两侧误触
  - 竖直覆盖刘海区域（顶部 52px），足够 16ms 轮询不丢帧
- 坐标系: bottom-left，`y = screen_frame.3 − NOTCH_AREA_HEIGHT`
- 鼠标必须进入屏幕顶端的刘海区域 → 触发展开。沿着菜单栏下半部分或可见内容区移动不触发

### 保持区 (keepOpenRect)
- 位置: 与 drawer 窗口位置一致 (水平居中，菜单栏下方)
- 尺寸: expanded_width×expanded_height + 4px margin each side
- 鼠标离开此区域 500ms 后 → 收起

## 窗口架构 (单窗口)

### 创建 (create_drawer_window)
- 类型: WebviewWindow, 无边框, 透明背景, alwaysOnTop, skipTaskbar, 不可缩放
- 尺寸: expanded_width×expanded_height (约 480-540 × 408+)
- 位置: 屏幕水平居中, visibleFrame 顶部紧贴菜单栏下方
- NSWindow.level: 3 (statusBar 级别, 通过 objc2 msg_send 设置)
- 创建后立即 hide, 等待首次 expand

### 展开 (expand)
- `drawer.show()` — 窗口在 expanded 位置/尺寸显现
- `drawer.set_focus()` — 聚焦窗口, 激活键盘输入
- `app.emit("panel-shown")` — 通知前端播放入场动画
- 注: 不修改窗口 position/size, 不创建额外窗口

### 收起 (collapse → hide_panel)
- 前序: 轮询线程 emit "panel-hide" 事件, 不立即 hide
- 前端: 播放退出动画 → 动画结束 → invoke("hide_panel")
- hide_panel: `drawer.hide()`
- 轮询线程: collapse 后 sleep 300ms, 避免退出动画期间误触重开

## 动画系统

### 设计原则
- 不动窗口几何 (position/size), 纯 CSS transform/opacity
- Web Animations API, 运行在浏览器 compositor 线程
- will-change: transform, opacity 提前告知 GPU

### 入场 (420ms)
- 7-stop 弹簧回弹 keyframe
```typescript
[
  { opacity: 0, transform: 'translateY(-12px) scale(0.96)', offset: 0 },
  { opacity: 0.35, transform: 'translateY(-8px) scale(0.972)', offset: 0.12 },
  { opacity: 0.75, transform: 'translateY(-3px) scale(0.988)', offset: 0.25 },
  { opacity: 1, transform: 'translateY(2.5px) scale(1.005)', offset: 0.48 },
  { opacity: 1, transform: 'translateY(-0.8px) scale(0.998)', offset: 0.68 },
  { opacity: 1, transform: 'translateY(0.3px) scale(1.001)', offset: 0.84 },
  { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 },
]
```
- easing: `cubic-bezier(0.16, 1, 0.3, 1)` — 快速启动 + 弹簧缓出
- 首帧预置 inline style + force reflow, 消除 flash

### 出场 (150ms)
- 2-stop, ease-in 加速淡出
```typescript
[
  { opacity: 1, transform: 'translateY(0) scale(1)' },
  { opacity: 0, transform: 'translateY(-8px) scale(0.97)' },
]
```
- await anim.finished → invoke("hide_panel")

## 鼠标轮询

### 技术方案
- NSEvent::mouseLocation (通过 objc2), 全局鼠标坐标, 无需追踪区域
- 独立线程, 16ms 循环 (~60fps)
- 坐标系: bottom-left screen origin, y 从屏幕底部向上增长

### 状态机
```
is_expanded = false:
  → 每次循环: 检查鼠标是否在 triggerRect 内
  → 是: 在 main_thread 上调用 expand(), is_expanded = true

is_expanded = true:
  → 每次循环: 检查鼠标是否在 keepOpenRect 内
  → 不在: sleep 500ms → 重新检查 → 仍不在: collapse() + is_expanded = false + sleep 300ms
```

### 防抖
- 收起前 500ms 延迟, 防止鼠标短暂离开时误关闭
- 收起后 300ms 禁止重开, 防止退出动画期间误触

## 主题系统

### 实现
- HTML data-theme 属性: "dark" / "light" / "system"
- CSS 变量: :root (dark default) + [data-theme="light"] 覆盖
- useTheme hook: 注入 document.documentElement, 监听 matchMedia 变化

### 三种模式
- system: 跟随 matchMedia('prefers-color-scheme: dark'), 动态监听 change 事件
- dark: 固定 data-theme="dark"
- light: 固定 data-theme="light"

### 存储
- SQLite settings 表, key="theme", value="system"|"dark"|"light"
- 通过 update_settings IPC 持久化

## 编辑器 (TipTap)

### 选型
- @tiptap/react + @tiptap/starter-kit + @tiptap/extension-underline
- 独立导入 TaskList + TaskItem (@tiptap/starter-kit 不包含)
- tiptap-markdown 解析/序列化 Markdown

### 选中态
- SelectionHighlight 扩展: 使用 ProseMirror Plugin + Decoration.inline
- 自定义 CSS: `.selection-highlight { background: rgba(94,94,255,0.25) }`

### Image 粘贴
- ImagePaste 扩展: 处理 paste 事件, 将 base64 data URL 插入编辑器

## 托盘图标

- 单色模板图标: icon_as_template(true), 使用 tray-icon-template.png
- macOS 自动适配亮色/暗色菜单栏 (白色前景, 透明背景)
- 菜单: 显示/隐藏, 设置 (展开面板), 退出

## 自动更新

- tauri-plugin-updater, GitHub Releases 分发
- update.json 配置各平台 .tar.gz URL + 签名
- Settings 面板 "检查更新" 按钮 → check() → downloadAndInstall()
- 签名密钥: ~/.tauri/notchnotes.key (密码: notchnotes)

## 关键决策记录

| 决策 | 选项 | 选择理由 |
|---|---|---|
| 窗口架构 | 双窗口 / 单窗口 | 单窗口。移除 hot window 省 ~19MB 内存, 交互更简洁 |
| 动画方案 | CSS transform / 窗口 setSize | CSS transform。不动窗口几何, 避免 WebView 重排, compositor 线程执行 |
| 热区检测 | NSEvent.mouseLocation / 窗口事件 | NSEvent。全局鼠标坐标, 不依赖窗口焦点, 刘海外也能触发 |
| 编辑器 | CodeMirror 6 / TipTap | TipTap。WYSIWYG 实时渲染, Typora 风格 |
| 存储 | tauri-plugin-sql / sqlx | sqlx。类型安全, 异步查询, 与 Tauri 集成更好 |
| 主题切换 | CSS @media / data-theme | data-theme。支持用户手动覆盖, 不依赖系统偏好 |
| 托盘图标 | 两套 PNG / 单色模板 | 单色模板。icon_as_template(true), macOS 自动适配, 无需维护两套图标 |

## 项目结构

```
NotchNotes/
├── src/
│   ├── main.tsx
│   ├── App.tsx              # 主题 + 动画事件监听 + 布局
│   ├── App.css               # CSS 变量 + 组件样式 + 亮色覆盖
│   ├── types.ts              # NoteTab / AppSettings 类型
│   ├── components/
│   │   ├── TabBar.tsx        # 便签栏 (新建/重命名/删除/切换)
│   │   ├── MarkdownEditor.tsx # TipTap 封装 (SelectionHighlight, TaskList, ImagePaste)
│   │   ├── FormatToolbar.tsx  # 格式工具栏 (B/I/S/Code/H1-3/Quote/List/Task)
│   │   └── SettingsPanel.tsx  # 设置面板 (主题/托盘/自启/更新)
│   └── hooks/
│       ├── useNoteStore.ts   # Zustand store (tabs + settings CRUD)
│       └── useTauriEvents.ts # Tauri 事件监听
├── src-tauri/
│   ├── Cargo.toml / tauri.conf.json
│   ├── src/
│   │   ├── main.rs → lib.rs  # 应用入口 + setup + 鼠标轮询线程
│   │   ├── commands.rs       # 10 个 IPC 命令
│   │   ├── tray.rs           # 系统托盘 (模板图标)
│   │   ├── autostart.rs      # 开机自启 (SMAppService + LaunchAgent)
│   │   ├── notch/
│   │   │   ├── panel.rs      # 单窗口创建/展开/收起/隐藏
│   │   │   ├── geometry.rs   # 屏幕布局 / 触发区 / 保持区
│   │   │   └── mouse.rs      # NSEvent::mouseLocation 轮询
│   │   └── store/
│   │       ├── db.rs         # SQLite 初始化 + CRUD
│   │       └── settings.rs   # AppSettings 结构体
│   └── icons/                # 应用图标 + 托盘模板图标
├── update.json               # GitHub Releases 更新清单
└── docs/superpowers/
    ├── specs/                # 设计文档
    └── plans/                # 实施计划
```
