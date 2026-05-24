# NotchNotes - Tauri v2 重构设计文档

## 概述

将 [oil-oil/NotchNotes](https://github.com/oil-oil/NotchNotes)（macOS SwiftUI 原生应用）重构为 Tauri v2 + React + TypeScript 跨平台应用，保留原有刘海交互体验，并新增 Tab 命名、菜单栏隐藏、开机自启功能。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Rust + Tauri v2 | 窗口管理、刘海交互、数据存储 |
| 前端 | React + TypeScript + Vite | UI 渲染 |
| 编辑器 | CodeMirror 6 | Markdown 编辑 |
| 存储 | SQLite (tauri-plugin-sql) | 笔记持久化 |
| macOS 原生 | objc2-app-kit | 刘海窗口级别、鼠标轮询、SMAppService |

## 窗口架构

两个独立窗口模拟原版两段式动画：

### 1. Notch Hot Window（紧凑态）

- 无边框、透明背景
- 尺寸：与刘海宽度一致
- Window Level：`statusBar`（通过 objc2 设置）
- 显示内容：极简图标 `note.text`
- 触发逻辑：鼠标进入刘海触发区时显示

### 2. Notch Drawer Window（展开态）

- 无边框、透明背景
- 尺寸：约 500×420，水平居中
- Window Level：`statusBar`（同 hot window）
- 显示内容：完整 React 应用（TabBar + Editor + Toolbar）
- 触发逻辑：点击 hot window 时展开，鼠标离开时折叠

### 窗口切换流程

```
鼠标进入刘海区
    → hot window 淡入显示 (0.3s)
    → 用户点击 hot window (hover 模式) 或 点击 (click 模式)
        → hot window 隐藏
        → drawer window 展开动画（0.28s spring）
        → 编辑器获得焦点
    → 鼠标离开 drawer 区域 (0.22s 延迟)
        → drawer window 折叠动画（0.16s ease-out）
        → hot window 重新显示
    → 鼠标离开刘海区
        → hot window 隐藏
```

## 数据模型

```typescript
interface NoteTab {
  id: string;           // UUID
  name: string;         // 用户自定义名称（← 新增）
  text: string;         // Markdown 内容
  createdAt: string;    // ISO datetime
  updatedAt: string;    // ISO datetime
  selectionPos: number; // 光标位置
}

interface AppSettings {
  triggerMode: 'hover' | 'click';
  showTrayIcon: boolean;   // ← 新增：菜单栏图标可见性
  autoStart: boolean;      // ← 新增：开机自启动
}
```

### Tab 命名规则

- 新 tab 默认名称：`"便签 1"`、`"便签 2"`（序号递增，存储在计数器）
- 双击 tab 标签进入编辑模式 → Enter/失焦保存 → Escape 取消
- 空名称时回退为 `"未命名"`
- 长度限制 30 字符

## Rust 后端组件

### `src-tauri/src/main.rs`
- Tauri 应用入口
- 初始化插件（sql, tray）
- 注册 IPC 命令

### `src-tauri/src/commands.rs`
```rust
get_tabs() -> Vec<NoteTab>
add_tab() -> NoteTab
remove_tab(id: String)
rename_tab(id: String, name: String)  // 新功能
update_text(id: String, text: String)
update_selection(id: String, pos: i64)
expand_panel()
collapse_panel()
get_settings() -> AppSettings
update_settings(settings: AppSettings)
```

### `src-tauri/src/notch/mod.rs`
子模块：

- `panel.rs` - 双窗口创建/管理
  - `create_hot_window()` / `create_drawer_window()`
  - `expand()` / `collapse()` 动画
  - 通过 objc2 设置 NSWindow.level = .statusBar

- `geometry.rs` - 屏幕布局计算
  - `target_screen()` 获取内置显示器
  - `measured_notch_size()` 测量刘海尺寸
  - `layout()` 计算 hot/drawer frame

- `mouse.rs` - 60fps 鼠标轮询
  - 使用 `NSEvent.mouseLocation`（通过 objc2-core-graphics）
  - `TriggerRect` 热区判定（notch 区域）
  - hover/click 双模式

### `src-tauri/src/store/db.rs`
- SQLite 初始化（CREATE TABLE IF NOT EXISTS）
- CRUD 操作

### `src-tauri/src/store/settings.rs`
- 设置项的读写
- 初始化默认值

### `src-tauri/src/tray.rs`
- 创建系统托盘图标（NSStatusItem）
- 菜单项：Show/Hide/Quit
- 动态显示/隐藏（toggle）

### `src-tauri/src/autostart.rs`
- 开机自启动管理
- macOS 13+: SMAppService（通过 objc2）
- Fallback: LaunchAgents plist

## 前端 React 组件

### `App.tsx`
- NotchDrawer 状态管理
- 初始化时加载 tabs
- 监听 Tauri 事件（panel show/hide）

### `components/TabBar.tsx`
- 核心新功能组件
- 展示所有 tab 的名称标签
- 双击内联编辑名称
- 点击切换 tab
- +/- 按钮添加/删除 tab
- 删除 tab 时自动切换到邻近 tab

### `components/MarkdownEditor.tsx`
- CodeMirror 6 封装
- Markdown 语法高亮
- 同步内容到 Rust 后端（debounced）
- 图片粘贴处理

### `components/FormatToolbar.tsx`
- B（粗体）/ I（斜体）/ S（删除线）/ Code（行内代码）
- H1 / H2 / Quote
- 有序列表 / 无序列表 / 任务列表
- 通过 CodeMirror API 插入 markdown 语法

### `components/NotchHot.tsx`
- Hot window 渲染的内容
- 简单图标 + hover 态背景变化
- 点击触发展开事件

### `components/NotchDrawer.tsx`
- Drawer window 渲染的内容
- 组合 TabBar + FormatToolbar + MarkdownEditor
- 主题：暗色背景（同原项目 #050508）

### `components/SettingsPanel.tsx`
- 触发模式选择（hover/click）
- 显示菜单栏图标开关
- 开机自启动开关
- 面板在 drawer 内弹出

## 项目文件结构

```
NotchNotes/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   ├── build.rs
│   ├── icons/
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── icon.icns
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands.rs
│       ├── tray.rs
│       ├── autostart.rs
│       ├── notch/
│       │   ├── mod.rs
│       │   ├── panel.rs
│       │   ├── geometry.rs
│       │   └── mouse.rs
│       └── store/
│           ├── mod.rs
│           ├── db.rs
│           └── settings.rs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── types.ts
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── MarkdownEditor.tsx
│   │   ├── FormatToolbar.tsx
│   │   ├── NotchHot.tsx
│   │   ├── NotchDrawer.tsx
│   │   └── SettingsPanel.tsx
│   ├── hooks/
│   │   ├── useNotch.ts
│   │   └── useNoteStore.ts
│   └── store/
│       └── index.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 依赖

### Rust (Cargo.toml)
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
objc2 = "0.6"
objc2-app-kit = "0.3"
objc2-foundation = "0.3"
objc2-core-graphics = "0.3"
```

### Node.js (package.json)
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "codemirror": "^6",
    "@codemirror/lang-markdown": "^6",
    "@codemirror/theme-one-dark": "^6",
    "react": "^19",
    "react-dom": "^19",
    "zustand": "^5",
    "uuid": "^10"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/uuid": "^10",
    "typescript": "^5",
    "vite": "^6",
    "@vitejs/plugin-react": "^4"
  }
}
```
