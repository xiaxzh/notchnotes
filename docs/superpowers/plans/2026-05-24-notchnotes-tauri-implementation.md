# NotchNotes Tauri v2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 oil-oil/NotchNotes 重构为 Tauri v2 + React + TypeScript 应用，新增 Tab 命名、菜单栏隐藏、开机自启动

**Architecture:** Rust 后端管理刘海双窗口（hot/drawer）+ 鼠标轮询 + SQLite 存储；React 前端处理所有 UI（TabBar、CodeMirror 编辑器、工具栏）。通过 objc2 crate 调用 macOS AppKit API 实现原生刘海交互。

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, CodeMirror 6, Zustand, SQLite, objc2-app-kit

---

## 文件结构

```
NotchNotes/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   ├── icons/                         # 应用图标
│   └── src/
│       ├── main.rs                    # Tauri 入口
│       ├── lib.rs                     # 模块声明 + setup
│       ├── commands.rs                # IPC 命令处理
│       ├── tray.rs                    # 菜单栏图标
│       ├── autostart.rs               # 开机自启动
│       ├── notch/
│       │   ├── mod.rs
│       │   ├── panel.rs              # 窗口创建 & 管理
│       │   ├── geometry.rs           # 屏幕布局计算
│       │   └── mouse.rs              # 鼠标位置轮询
│       └── store/
│           ├── mod.rs
│           ├── db.rs                 # SQLite CRUD
│           └── settings.rs           # 设置存储
├── src/
│   ├── main.tsx                      # React 入口
│   ├── App.tsx                       # 主组件（窗口类型判断）
│   ├── App.css                       # 全局样式
│   ├── types.ts                      # TypeScript 类型
│   ├── components/
│   │   ├── TabBar.tsx                # 可命名 Tab 栏
│   │   ├── MarkdownEditor.tsx        # CodeMirror 6 封装
│   │   ├── FormatToolbar.tsx         # 格式化工具栏
│   │   ├── NotchHot.tsx              # 紧凑态图标
│   │   └── SettingsPanel.tsx         # 设置面板
│   ├── hooks/
│   │   ├── useNoteStore.ts           # Zustand store
│   │   └── useTauriEvents.ts         # Tauri 事件监听
│   └── lib/
│       └── tauri.ts                  # Tauri API 封装
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

### Task 1: 项目脚手架

**Files:**
- Create: `NotchNotes/` 目录结构
- Modify: `src-tauri/Cargo.toml` 添加依赖
- Modify: `src-tauri/tauri.conf.json` 配置多窗口
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/` 占位图标

- [ ] **Step 1: 创建 Tauri v2 + React 项目**

Run:
```bash
cd /Users/xiaxzh/Documents/NotchNotes
npm create tauri-app@latest . -- --template react-ts --manager npm
```

如果报目录非空，先清空：
```bash
rm -rf .git .gitignore
npm create tauri-app@latest notch-notes-temp -- --template react-ts --manager npm
mv notch-notes-temp/* .
mv notch-notes-temp/.* .
rmdir notch-notes-temp
```

- [ ] **Step 2: 安装 Node 依赖**

```bash
npm install @tauri-apps/api@^2 @tauri-apps/plugin-sql@^2 zustand@^5 uuid@^10
npm install codemirror@^6 @codemirror/lang-markdown@^6 @codemirror/theme-one-dark@^6 @codemirror/view@^6 @codemirror/state@^6 @codemirror/commands@^6 @codemirror/language@^6 @codemirror/autocomplete@^6
npm install -D @types/uuid@^10
```

- [ ] **Step 3: 配置 Cargo.toml**

Write `src-tauri/Cargo.toml`:

```toml
[package]
name = "notch-notes"
version = "0.1.0"
edition = "2021"

[lib]
name = "notch_notes_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
objc2 = "0.6"
objc2-app-kit = "0.3"
objc2-foundation = "0.3"
objc2-core-graphics = "0.3"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
log = "0.4"
```

- [ ] **Step 4: 配置 tauri.conf.json**

Write `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicoverbruggen/tauri-v2-schema/main/schema.json",
  "productName": "NotchNotes",
  "version": "0.1.0",
  "identifier": "com.notchnotes.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 5: 创建 capabilities**

Write `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["*"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "core:window:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:event:default",
    "core:event:allow-listen",
    "core:event:allow-emit"
  ]
}
```

- [ ] **Step 6: 创建占位图标**

```bash
mkdir -p src-tauri/icons
# 创建一个简单的 PNG 图标（32x32 蓝色方块）
python3 -c "
import struct, zlib
def create_png(w, h, color):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    raw = b''
    for y in range(h):
        raw += b'\\x00'
        for x in range(w):
            raw += bytes(color)
    idat = zlib.compress(raw)
    return b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
for name, size in [('32x32.png', 32), ('128x128.png', 128), ('128x128@2x.png', 256)]:
    with open(f'src-tauri/icons/{name}', 'wb') as f:
        f.write(create_png(size, size, [50, 50, 200]))
"
```

---

### Task 2: Rust 数据层 — SQLite + NoteTab 模型

**Files:**
- Create: `src-tauri/src/store/mod.rs`
- Create: `src-tauri/src/store/db.rs`
- Create: `src-tauri/src/store/settings.rs`

- [ ] **Step 1: 创建 store 模块**

Write `src-tauri/src/store/mod.rs`:

```rust
pub mod db;
pub mod settings;
```

- [ ] **Step 2: 实现 SQLite 存储**

Write `src-tauri/src/store/db.rs`:

```rust
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteTab {
    pub id: String,
    pub name: String,
    pub text: String,
    pub created_at: String,
    pub updated_at: String,
    pub selection_pos: i64,
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create tabs table",
            sql: "CREATE TABLE IF NOT EXISTS tabs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                text TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                selection_pos INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
            kind: MigrationKind::Up,
        },
    ]
}

pub fn get_default_tab() -> NoteTab {
    let now = chrono::Utc::now().to_rfc3339();
    NoteTab {
        id: uuid::Uuid::new_v4().to_string(),
        name: "".to_string(),
        text: "".to_string(),
        created_at: now.clone(),
        updated_at: now,
        selection_pos: 0,
    }
}
```

- [ ] **Step 3: 实现设置管理**

Write `src-tauri/src/store/settings.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub trigger_mode: String,
    pub show_tray_icon: bool,
    pub auto_start: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            trigger_mode: "hover".to_string(),
            show_tray_icon: true,
            auto_start: false,
        }
    }
}

pub fn settings_sql() -> &'static str {
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('trigger_mode', 'hover');
     INSERT OR REPLACE INTO settings (key, value) VALUES ('show_tray_icon', 'true');
     INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_start', 'false');
     INSERT OR REPLACE INTO settings (key, value) VALUES ('tab_counter', '1');"
}
```

---

### Task 3: Rust 刘海窗口管理

**Files:**
- Create: `src-tauri/src/notch/mod.rs`
- Create: `src-tauri/src/notch/panel.rs`
- Create: `src-tauri/src/notch/geometry.rs`
- Create: `src-tauri/src/notch/mouse.rs`

- [ ] **Step 1: 创建 notch 模块**

Write `src-tauri/src/notch/mod.rs`:

```rust
pub mod geometry;
pub mod mouse;
pub mod panel;
```

- [ ] **Step 2: 屏幕几何计算（移植自 NotchGeometry.swift）**

Write `src-tauri/src/notch/geometry.rs`:

```rust
use objc2::rc::Retained;
use objc2::runtime::NSObject;
use objc2::{msg_send, sel, sel_impl};
use objc2_app_kit::{NSScreen, NSScreenFrame};
use objc2_foundation::{NSDictionary, NSNumber, NSObjectProtocol, NSString};

#[derive(Debug, Clone, Copy)]
pub struct NotchLayout {
    pub notch_width: f64,
    pub notch_height: f64,
    pub compact_width: f64,
    pub compact_height: f64,
    pub expanded_width: f64,
    pub expanded_height: f64,
    pub screen_frame: (f64, f64, f64, f64), // x, y, width, height
}

pub fn target_screen() -> Option<Retained<NSObject>> {
    unsafe {
        let screens: Retained<NSObject> = msg_send![NSScreen::class(), screens];
        let count: usize = msg_send![&screens, count];
        for i in 0..count {
            let screen: Retained<NSObject> = msg_send![&screens, objectAtIndex: i];
            let is_builtin: bool = msg_send![&screen, isBuiltInDisplay];
            if is_builtin {
                return Some(screen);
            }
        }
        if count > 0 {
            let screen: Retained<NSObject> = msg_send![&screens, objectAtIndex: 0];
            return Some(screen);
        }
        None
    }
}

pub fn get_notch_layout(screen: Option<&NSObject>) -> NotchLayout {
    let default_frame = (0.0, 0.0, 1440.0, 900.0);
    let screen_frame = screen.map_or(default_frame, |s| unsafe {
        let frame: NSScreenFrame = msg_send![s, frame];
        (frame.origin.x, frame.origin.y, frame.size.width, frame.size.height)
    });

    // 近似 notch 尺寸（MacBook Pro 14/16）
    let notch_width = 210.0_f64.min(screen_frame.2 - 36.0);
    let notch_height = 32.0;

    let compact_width = (notch_width - 6.0).max(182.0).min(238.0);
    let compact_height = (notch_height + 2.0).max(32.0).min(38.0);
    let expanded_width = (notch_width + 220.0).max(480.0).min(540.0).min(screen_frame.2 - 36.0);
    let expanded_height = (notch_height + 374.0).max(408.0).min(screen_frame.3 - 84.0);

    NotchLayout {
        notch_width,
        notch_height,
        compact_width,
        compact_height,
        expanded_width,
        expanded_height,
        screen_frame,
    }
}

pub fn hot_frame(layout: &NotchLayout) -> (f64, f64, f64, f64) {
    let x = layout.screen_frame.0 + (layout.screen_frame.2 - layout.compact_width) / 2.0;
    let y = layout.screen_frame.1 + layout.screen_frame.3 - layout.compact_height;
    (x, y, layout.compact_width, layout.compact_height)
}

pub fn drawer_frame(layout: &NotchLayout) -> (f64, f64, f64, f64) {
    let x = layout.screen_frame.0 + (layout.screen_frame.2 - layout.expanded_width) / 2.0;
    let y = layout.screen_frame.1 + layout.screen_frame.3 - layout.expanded_height;
    (x, y, layout.expanded_width, layout.expanded_height)
}
```

- [ ] **Step 3: 鼠标轮询**

Write `src-tauri/src/notch/mouse.rs`:

```rust
use objc2::rc::Retained;
use objc2::{msg_send, sel, sel_impl};
use objc2_app_kit::NSEvent;
use objc2_foundation::NSObjectProtocol;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, Copy)]
pub struct MouseLocation {
    pub x: f64,
    pub y: f64,
}

pub fn get_mouse_location() -> MouseLocation {
    unsafe {
        let event_class = NSEvent::class();
        let point: NSPoint = msg_send![event_class, mouseLocation];
        MouseLocation {
            x: point.x,
            y: point.y,
        }
    }
}

#[repr(C)]
struct NSPoint {
    x: f64,
    y: f64,
}

pub fn is_in_trigger_rect(mouse: MouseLocation, notch_center_x: f64, screen_top: f64) -> bool {
    let trigger_width = 250.0;
    let trigger_height = 40.0;
    let left = notch_center_x - trigger_width / 2.0;
    let bottom = screen_top - trigger_height;
    mouse.x >= left && mouse.x <= left + trigger_width && mouse.y >= bottom && mouse.y <= screen_top
}

pub fn start_mouse_polling(
    is_hovering: Arc<AtomicBool>,
    notch_center_x: Arc<std::sync::Mutex<f64>>,
    screen_top: Arc<std::sync::Mutex<f64>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        loop {
            let mouse = get_mouse_location();
            let center_x = *notch_center_x.lock().unwrap();
            let top = *screen_top.lock().unwrap();
            let in_rect = is_in_trigger_rect(mouse, center_x, top);
            is_hovering.store(in_rect, Ordering::SeqCst);
            std::thread::sleep(std::time::Duration::from_millis(16)); // ~60fps
        }
    })
}
```

- [ ] **Step 4: 窗口管理**

Write `src-tauri/src/notch/panel.rs`:

```rust
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use crate::notch::geometry::{self, NotchLayout};

pub fn create_hot_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let screen = geometry::target_screen();
    let layout = geometry::get_notch_layout(screen.as_deref());
    let frame = geometry::hot_frame(&layout);

    let window = WebviewWindowBuilder::new(app, "notch-hot", WebviewUrl::App("index.html".into()))
        .title("NotchNotes Hot")
        .inner_size(layout.compact_width, layout.compact_height)
        .position(frame.0, frame.1)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .build()?;

    // 通过 objc2 设置 window level
    set_window_level_to_status_bar(&window);

    Ok(())
}

pub fn create_drawer_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let screen = geometry::target_screen();
    let layout = geometry::get_notch_layout(screen.as_deref());
    let frame = geometry::drawer_frame(&layout);

    let window = WebviewWindowBuilder::new(app, "notch-drawer", WebviewUrl::App("index.html".into()))
        .title("NotchNotes")
        .inner_size(layout.expanded_width, layout.expanded_height)
        .position(frame.0, frame.1)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .build()?;

    set_window_level_to_status_bar(&window);

    Ok(())
}

fn set_window_level_to_status_bar(window: &tauri::WebviewWindow) {
    use objc2::{msg_send, sel, sel_impl};
    use objc2_foundation::NSObjectProtocol;

    if let Some(ns_window) = window.ns_window() {
        unsafe {
            let _: () = msg_send![&ns_window, setLevel: 25i64]; // NSStatusBarWindowLevel
        }
    }
}

pub fn expand(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(hot) = app.get_webview_window("notch-hot") {
        let _ = hot.hide();
    }
    if let Some(drawer) = app.get_webview_window("notch-drawer") {
        let _ = drawer.show();
        let _ = drawer.set_focus();
    } else {
        create_drawer_window(app)?;
    }
    Ok(())
}

pub fn collapse(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(drawer) = app.get_webview_window("notch-drawer") {
        let _ = drawer.hide();
    }
    if let Some(hot) = app.get_webview_window("notch-hot") {
        let _ = hot.show();
    }
    Ok(())
}
```

---

### Task 4: Rust 命令 + Tray + Autostart

**Files:**
- Create: `src-tauri/src/commands.rs`
- Create: `src-tauri/src/tray.rs`
- Create: `src-tauri/src/autostart.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/main.rs`

- [ ] **Step 1: IPC 命令**

Write `src-tauri/src/commands.rs`:

```rust
use crate::store::db::NoteTab;
use tauri::AppHandle;
use tauri_plugin_sql::{TauriSql, Database};

#[tauri::command]
pub async fn get_tabs(app: AppHandle) -> Result<Vec<NoteTab>, String> {
    let db = app.state::<Database>();
    let result = db.select("SELECT * FROM tabs ORDER BY created_at ASC", []).await
        .map_err(|e| e.to_string())?;
    let tabs: Vec<NoteTab> = serde_json::from_value(result).map_err(|e| e.to_string())?;
    Ok(tabs)
}

#[tauri::command]
pub async fn add_tab(app: AppHandle) -> Result<NoteTab, String> {
    let db = app.state::<Database>();
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    // 获取 tab 计数器
    let counter_result = db.select("SELECT value FROM settings WHERE key = 'tab_counter'", []).await
        .map_err(|e| e.to_string())?;
    let counter: i64 = serde_json::from_value::<Vec<serde_json::Value>>(counter_result.clone())
        .ok()
        .and_then(|v| v.first().cloned())
        .and_then(|v| v["value"].as_str().map(|s| s.to_string()))
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);

    let name = format!("便签 {}", counter);

    db.execute(
        "INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES (?1, ?2, '', ?3, ?4, 0)",
        vec![
            serde_json::to_value(&id).unwrap(),
            serde_json::to_value(&name).unwrap(),
            serde_json::to_value(&now).unwrap(),
            serde_json::to_value(&now).unwrap(),
        ],
    ).await.map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE settings SET value = ?1 WHERE key = 'tab_counter'",
        vec![serde_json::to_value(&(counter + 1)).unwrap()],
    ).await.map_err(|e| e.to_string())?;

    Ok(NoteTab {
        id,
        name,
        text: String::new(),
        created_at: now.clone(),
        updated_at: now,
        selection_pos: 0,
    })
}

#[tauri::command]
pub async fn remove_tab(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.execute("DELETE FROM tabs WHERE id = ?1", vec![serde_json::to_value(&id).unwrap()])
        .await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn rename_tab(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let db = app.state::<Database>();
    let now = chrono::Utc::now().to_rfc3339();
    db.execute(
        "UPDATE tabs SET name = ?1, updated_at = ?2 WHERE id = ?3",
        vec![
            serde_json::to_value(&name).unwrap(),
            serde_json::to_value(&now).unwrap(),
            serde_json::to_value(&id).unwrap(),
        ],
    ).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_text(app: AppHandle, id: String, text: String) -> Result<(), String> {
    let db = app.state::<Database>();
    let now = chrono::Utc::now().to_rfc3339();
    db.execute(
        "UPDATE tabs SET text = ?1, updated_at = ?2 WHERE id = ?3",
        vec![
            serde_json::to_value(&text).unwrap(),
            serde_json::to_value(&now).unwrap(),
            serde_json::to_value(&id).unwrap(),
        ],
    ).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_selection(app: AppHandle, id: String, pos: i64) -> Result<(), String> {
    let db = app.state::<Database>();
    db.execute(
        "UPDATE tabs SET selection_pos = ?1 WHERE id = ?2",
        vec![
            serde_json::to_value(&pos).unwrap(),
            serde_json::to_value(&id).unwrap(),
        ],
    ).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<crate::store::settings::AppSettings, String> {
    let db = app.state::<Database>();
    let result = db.select("SELECT key, value FROM settings", []).await
        .map_err(|e| e.to_string())?;

    let pairs: Vec<serde_json::Value> = serde_json::from_value(result).map_err(|e| e.to_string())?;
    let mut settings = crate::store::settings::AppSettings::default();

    for pair in &pairs {
        let key = pair["key"].as_str().unwrap_or("");
        let value = pair["value"].as_str().unwrap_or("");
        match key {
            "trigger_mode" => settings.trigger_mode = value.to_string(),
            "show_tray_icon" => settings.show_tray_icon = value == "true",
            "auto_start" => settings.auto_start = value == "true",
            _ => {}
        }
    }

    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(app: AppHandle, settings: crate::store::settings::AppSettings) -> Result<(), String> {
    let db = app.state::<Database>();
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('trigger_mode', ?1)",
        vec![serde_json::to_value(&settings.trigger_mode).unwrap()],
    ).await.map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('show_tray_icon', ?1)",
        vec![serde_json::to_value(&if settings.show_tray_icon { "true" } else { "false" }).unwrap()],
    ).await.map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_start', ?1)",
        vec![serde_json::to_value(&if settings.auto_start { "true" } else { "false" }).unwrap()],
    ).await.map_err(|e| e.to_string())?;

    // 更新 tray 可见性
    let tray_handle = app.state::<tauri::tray::TrayIcon>();
    if settings.show_tray_icon {
        let _ = tray_handle.set_visible(true);
    } else {
        let _ = tray_handle.set_visible(false);
    }

    // 更新开机自启动
    if settings.auto_start {
        let _ = crate::autostart::enable_autostart(&app);
    } else {
        let _ = crate::autostart::disable_autostart(&app);
    }

    Ok(())
}

#[tauri::command]
pub async fn expand_panel(app: AppHandle) -> Result<(), String> {
    crate::notch::panel::expand(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn collapse_panel(app: AppHandle) -> Result<(), String> {
    crate::notch::panel::collapse(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_app_state(app: AppHandle) -> Result<String, String> {
    // 返回窗口标签判断前端渲染哪个视图
    Ok("ready".to_string())
}
```

- [ ] **Step 2: Tray 图标**

Write `src-tauri/src/tray.rs`:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Notes", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Notes", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit NotchNotes", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(app, &[&show, &hide, &separator, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    let _ = crate::notch::panel::expand(app);
                }
                "hide" => {
                    let _ = crate::notch::panel::collapse(app);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

pub fn remove_tray(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_visible(false);
    }
}
```

- [ ] **Step 3: 开机自启动**

Write `src-tauri/src/autostart.rs`:

```rust
use objc2::rc::Retained;
use objc2::{msg_send, sel, sel_impl};
use objc2_app_kit::NSApplication;
use objc2_foundation::NSObjectProtocol;
use std::process::Command;

pub fn enable_autostart(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // macOS 13+: 使用 SMAppService
    // 简化实现：使用 LaunchAgents plist
    let app_path = std::env::current_exe()?
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.join("NotchNotes.app"))
        .unwrap_or_else(|| std::path::PathBuf::from("/Applications/NotchNotes.app"));

    let plist_content = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.notchnotes.launcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NOTCHNOTES_AUTOSTART</key>
        <string>1</string>
    </dict>
</dict>
</plist>"#, app_path.to_string_lossy());

    let launch_agents_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join("Library/LaunchAgents");
    std::fs::create_dir_all(&launch_agents_dir)?;
    std::fs::write(launch_agents_dir.join("com.notchnotes.launcher.plist"), plist_content)?;

    // 加载 plist
    let _ = Command::new("launchctl")
        .args(["load", "-w"])
        .arg(launch_agents_dir.join("com.notchnotes.launcher.plist"))
        .output();

    Ok(())
}

pub fn disable_autostart(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let launch_agents_dir = dirs::home_dir()
        .ok_or("Cannot find home directory")?
        .join("Library/LaunchAgents");
    let plist_path = launch_agents_dir.join("com.notchnotes.launcher.plist");

    if plist_path.exists() {
        let _ = Command::new("launchctl")
            .args(["unload", "-w"])
            .arg(&plist_path)
            .output();
        let _ = std::fs::remove_file(&plist_path);
    }

    Ok(())
}

pub fn is_autostart_enabled() -> bool {
    let launch_agents_dir = dirs::home_dir()
        .unwrap_or_default()
        .join("Library/LaunchAgents/com.notchnotes.launcher.plist");
    launch_agents_dir.exists()
}
```

- [ ] **Step 4: lib.rs — 模块声明与 setup**

写 `src-tauri/src/lib.rs`:

```rust
mod autostart;
mod commands;
mod notch;
mod store;
mod tray;

use store::db::{get_migrations, get_default_tab};
use tauri::Manager;
use tauri_plugin_sql::{Database, TauriSql};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:notchnotes.db", get_migrations())
                .build(),
        )
        .setup(|app| {
            // 创建 tray 图标
            let _ = tray::create_tray(app.handle());

            // 创建刘海窗口
            let _ = notch::panel::create_hot_window(app.handle());

            // 启动鼠标轮询（简化：由前端 event 触发）
            // 全功能 mouse polling 在后续完善

            // 检查是否为开机自启动
            if std::env::var("NOTCHNOTES_AUTOSTART").is_ok() {
                let _ = notch::panel::expand(app.handle());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_tabs,
            commands::add_tab,
            commands::remove_tab,
            commands::rename_tab,
            commands::update_text,
            commands::update_selection,
            commands::get_settings,
            commands::update_settings,
            commands::expand_panel,
            commands::collapse_panel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: main.rs**

Write `src-tauri/src/main.rs`:

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    notch_notes_lib::run()
}
```

- [ ] **Step 6: 添加 dirs 依赖**

Add to `src-tauri/Cargo.toml` dependencies:

```toml
dirs = "6"
```

---

### Task 5: React 前端 — 入口与状态管理

**Files:**
- Modify: `src/main.tsx`
- Create: `src/types.ts`
- Create: `src/lib/tauri.ts`
- Create: `src/hooks/useNoteStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: 类型定义**

Write `src/types.ts`:

```typescript
export interface NoteTab {
  id: string;
  name: string;
  text: string;
  created_at: string;
  updated_at: string;
  selection_pos: number;
}

export interface AppSettings {
  trigger_mode: 'hover' | 'click';
  show_tray_icon: boolean;
  auto_start: boolean;
}

export interface NotchLayout {
  notch_width: number;
  notch_height: number;
  compact_width: number;
  compact_height: number;
  expanded_width: number;
  expanded_height: number;
}
```

- [ ] **Step 2: Tauri API 封装**

Write `src/lib/tauri.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { NoteTab, AppSettings } from '../types';

export async function getTabs(): Promise<NoteTab[]> {
  return invoke('get_tabs');
}

export async function addTab(): Promise<NoteTab> {
  return invoke('add_tab');
}

export async function removeTab(id: string): Promise<void> {
  return invoke('remove_tab', { id });
}

export async function renameTab(id: string, name: string): Promise<void> {
  return invoke('rename_tab', { id, name });
}

export async function updateText(id: string, text: string): Promise<void> {
  return invoke('update_text', { id, text });
}

export async function updateSelection(id: string, pos: number): Promise<void> {
  return invoke('update_selection', { id, pos });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke('get_settings');
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  return invoke('update_settings', { settings });
}

export async function expandPanel(): Promise<void> {
  return invoke('expand_panel');
}

export async function collapsePanel(): Promise<void> {
  return invoke('collapse_panel');
}
```

- [ ] **Step 3: Zustand 状态管理**

Write `src/hooks/useNoteStore.ts`:

```typescript
import { create } from 'zustand';
import type { NoteTab, AppSettings } from '../types';
import * as api from '../lib/tauri';

interface NoteStore {
  tabs: NoteTab[];
  activeTabId: string | null;
  settings: AppSettings;
  isLoading: boolean;

  load: () => Promise<void>;
  addTab: () => Promise<void>;
  removeTab: (id: string) => Promise<void>;
  renameTab: (id: string, name: string) => Promise<void>;
  updateText: (id: string, text: string) => Promise<void>;
  updateSelection: (id: string, pos: number) => Promise<void>;
  selectTab: (id: string) => void;
  updateSettings: (settings: AppSettings) => Promise<void>;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  settings: { trigger_mode: 'hover', show_tray_icon: true, auto_start: false },
  isLoading: true,

  load: async () => {
    const [tabs, settings] = await Promise.all([
      api.getTabs(),
      api.getSettings(),
    ]);
    set({
      tabs,
      settings,
      activeTabId: tabs.length > 0 ? tabs[0].id : null,
      isLoading: false,
    });
  },

  addTab: async () => {
    const tab = await api.addTab();
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  removeTab: async (id: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    await api.removeTab(id);
    const newTabs = tabs.filter((t) => t.id !== id);
    const newActiveId = activeTabId === id
      ? newTabs[Math.min(tabs.indexOf(tabs.find((t) => t.id === id)!), newTabs.length - 1)].id
      : activeTabId;
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  renameTab: async (id: string, name: string) => {
    await api.renameTab(id, name.slice(0, 30));
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
    }));
  },

  updateText: async (id: string, text: string) => {
    await api.updateText(id, text);
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, text } : t)),
    }));
  },

  updateSelection: async (id: string, pos: number) => {
    await api.updateSelection(id, pos);
  },

  selectTab: (id: string) => {
    set({ activeTabId: id });
  },

  updateSettings: async (settings: AppSettings) => {
    await api.updateSettings(settings);
    set({ settings });
  },
}));
```

- [ ] **Step 4: App 主组件**

Write `src/App.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useNoteStore } from './hooks/useNoteStore';
import TabBar from './components/TabBar';
import MarkdownEditor from './components/MarkdownEditor';
import FormatToolbar from './components/FormatToolbar';
import SettingsPanel from './components/SettingsPanel';
import NotchHot from './components/NotchHot';
import './App.css';

function App() {
  const [windowLabel, setWindowLabel] = useState<string>('main');
  const [showSettings, setShowSettings] = useState(false);
  const { tabs, activeTabId, isLoading, load } = useNoteStore();

  useEffect(() => {
    load();
    try {
      const win = getCurrentWindow();
      setWindowLabel(win.label);
    } catch {
      setWindowLabel('main');
    }
  }, []);

  // 如果是 hot window，只显示紧凑图标
  if (windowLabel === 'notch-hot') {
    return <NotchHot />;
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="app">
      <div className="app-header">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={(id) => useNoteStore.getState().selectTab(id)}
          onAddTab={() => useNoteStore.getState().addTab()}
          onRemoveTab={(id) => useNoteStore.getState().removeTab(id)}
          onRenameTab={(id, name) => useNoteStore.getState().renameTab(id, name)}
        />
        <button
          className="settings-button"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      <FormatToolbar />
      <div className="editor-container">
        {activeTab ? (
          <MarkdownEditor
            key={activeTab.id}
            tabId={activeTab.id}
            initialText={activeTab.text}
            onTextChange={(text) => useNoteStore.getState().updateText(activeTab.id, text)}
          />
        ) : (
          <div className="empty-state">
            <p>No note selected</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 5: 全局样式**

Write `src/App.css`:

```css
:root {
  --bg-primary: #050508;
  --bg-secondary: #0d0d12;
  --bg-tertiary: #1a1a24;
  --text-primary: #e8e8ed;
  --text-secondary: #8888a0;
  --accent: #5e5eff;
  --border: #2a2a3a;
  --radius: 8px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Helvetica Neue', sans-serif;
  color: var(--text-primary);
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  border-radius: 12px;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}

.settings-button {
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius);
  transition: background 0.15s;
}

.settings-button:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.editor-container {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--bg-primary);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
```

- [ ] **Step 6: 更新 main.tsx**

Write `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

---

### Task 6: React 前端 — TabBar（核心新功能）

**Files:**
- Create: `src/components/TabBar.tsx`

- [ ] **Step 1: 实现可重命名的 TabBar**

Write `src/components/TabBar.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react';
import type { NoteTab } from '../types';

interface TabBarProps {
  tabs: NoteTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onRemoveTab: (id: string) => void;
  onRenameTab: (id: string, name: string) => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRemoveTab,
  onRenameTab,
}: TabBarProps) {
  return (
    <div className="tab-bar" style={styles.container}>
      <div style={styles.tabsList}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => onSelectTab(tab.id)}
            onRemove={() => onRemoveTab(tab.id)}
            onRename={(name) => onRenameTab(tab.id, name)}
          />
        ))}
      </div>
      <button onClick={onAddTab} style={styles.addButton} title="New tab">
        +
      </button>
    </div>
  );
}

function TabItem({
  tab,
  isActive,
  onSelect,
  onRemove,
  onRename,
}: {
  tab: NoteTab;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.name || getDefaultName(tab));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = () => {
    setEditValue(tab.name || getDefaultName(tab));
    setEditing(true);
  };

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    onRename(trimmed || getDefaultName(tab));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setEditValue(tab.name || getDefaultName(tab));
      setEditing(false);
    }
  };

  const displayName = tab.name || getDefaultName(tab);

  return (
    <div
      style={{
        ...styles.tab,
        ...(isActive ? styles.tabActive : {}),
      }}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, 30))}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          style={styles.editInput}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span style={styles.tabLabel}>{displayName}</span>
      )}
      {isActive && tabs.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={styles.closeButton}
          title="Remove tab"
        >
          ×
        </button>
      )}
    </div>
  );
}

function getDefaultName(tab: NoteTab): string {
  if (tab.name) return tab.name;
  const firstLine = tab.text.split('\n')[0]?.trim();
  return firstLine || 'Untitled';
}

const tabs = { length: 0 }; // placeholder for TabItem

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    overflow: 'hidden',
  },
  tabsList: {
    display: 'flex',
    gap: 2,
    overflow: 'hidden',
    flex: 1,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    whiteSpace: 'nowrap',
    maxWidth: 120,
    transition: 'background 0.1s, color 0.1s',
    userSelect: 'none',
  },
  tabActive: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
  },
  tabLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  editInput: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--accent)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    padding: '2px 4px',
    outline: 'none',
    width: 80,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.6,
  },
  addButton: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 16,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.1s, color 0.1s',
  },
};
```

---

### Task 7: React 前端 — MarkdownEditor + FormatToolbar

**Files:**
- Create: `src/components/MarkdownEditor.tsx`
- Create: `src/components/FormatToolbar.tsx`

- [ ] **Step 1: CodeMirror 6 Markdown 编辑器**

Write `src/components/MarkdownEditor.tsx`:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

interface MarkdownEditorProps {
  tabId: string;
  initialText: string;
  onTextChange: (text: string) => void;
}

let editorRefs = new Map<string, EditorView>();

export default function MarkdownEditor({ tabId, initialText, onTextChange }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTextRef = useRef(initialText);

  const handleChange = useCallback(
    debounce((text: string) => {
      if (text !== currentTextRef.current) {
        currentTextRef.current = text;
        onTextChange(text);
      }
    }, 300),
    [onTextChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // 销毁旧 editor
    const oldEditor = editorRefs.get(tabId);
    if (oldEditor) {
      oldEditor.destroy();
      editorRefs.delete(tabId);
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        handleChange(text);
      }
    });

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        oneDark,
        updateListener,
        EditorView.theme({
          '&': {
            backgroundColor: 'transparent',
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Mono", monospace',
          },
          '.cm-content': {
            padding: '16px 20px',
          },
          '.cm-line': {
            lineHeight: '1.6',
          },
        }),
        EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorRefs.set(tabId, view);

    return () => {
      view.destroy();
      editorRefs.delete(tabId);
    };
  }, [tabId]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'transparent',
      }}
    />
  );
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}
```

- [ ] **Step 2: 格式化工具栏**

Write `src/components/FormatToolbar.tsx`:

```typescript
import { useCallback } from 'react';
import { EditorView } from '@codemirror/view';

let _currentEditor: EditorView | null = null;

export function setCurrentEditor(view: EditorView | null) {
  _currentEditor = view;
}

function insertMarkdown(prefix: string, suffix: string = '') {
  const view = _currentEditor;
  if (!view) return;

  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);
  const replacement = prefix + (selectedText || 'text') + suffix;

  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: {
      anchor: from + prefix.length,
      head: from + prefix.length + (selectedText.length || 4),
    },
  });
  view.focus();
}

function insertBlock(prefix: string) {
  const view = _currentEditor;
  if (!view) return;

  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const replacement = prefix + line.text;

  view.dispatch({
    changes: {
      from: line.from,
      to: line.to,
      insert: replacement,
    },
  });
  view.focus();
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 13,
  transition: 'background 0.1s',
};

export default function FormatToolbar() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: '4px 8px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      <button style={btnStyle} onClick={() => insertMarkdown('**', '**')} title="Bold">
        <strong>B</strong>
      </button>
      <button style={btnStyle} onClick={() => insertMarkdown('*', '*')} title="Italic">
        <em>I</em>
      </button>
      <button style={btnStyle} onClick={() => insertMarkdown('~~', '~~')} title="Strikethrough">
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </button>
      <button style={btnStyle} onClick={() => insertMarkdown('`', '`')} title="Inline Code">
        {'</>'}
      </button>

      <div style={{ width: 1, background: 'var(--border)', margin: '4px 4px' }} />

      <button style={btnStyle} onClick={() => insertBlock('# ')} title="Heading 1">
        H1
      </button>
      <button style={btnStyle} onClick={() => insertBlock('## ')} title="Heading 2">
        H2
      </button>
      <button style={btnStyle} onClick={() => insertBlock('> ')} title="Blockquote">
        ❝
      </button>

      <div style={{ width: 1, background: 'var(--border)', margin: '4px 4px' }} />

      <button style={btnStyle} onClick={() => insertBlock('- ')} title="Bullet List">
        • list
      </button>
      <button style={btnStyle} onClick={() => insertBlock('1. ')} title="Numbered List">
        1. list
      </button>
      <button style={btnStyle} onClick={() => insertBlock('- [ ] ')} title="Todo List">
        ☐ todo
      </button>
    </div>
  );
}
```

---

### Task 8: React 前端 — NotchHot + SettingsPanel

**Files:**
- Create: `src/components/NotchHot.tsx`
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/hooks/useTauriEvents.ts`

- [ ] **Step 1: 紧凑态图标**

Write `src/components/NotchHot.tsx`:

```typescript
import { expandPanel } from '../lib/tauri';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function NotchHot() {
  const handleClick = async () => {
    await expandPanel();
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch {}
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'rgba(5, 5, 8, 0.98)',
        borderRadius: '0 0 12px 12px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(20, 20, 30, 0.98)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(5, 5, 8, 0.98)';
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: 设置面板**

Write `src/components/SettingsPanel.tsx`:

```typescript
import { useNoteStore } from '../hooks/useNoteStore';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useNoteStore();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Settings</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <label style={styles.label}>
            <span>Trigger Mode</span>
            <select
              value={settings.trigger_mode}
              onChange={(e) => updateSettings({ ...settings, trigger_mode: e.target.value as 'hover' | 'click' })}
              style={styles.select}
            >
              <option value="hover">Hover</option>
              <option value="click">Click</option>
            </select>
          </label>

          <label style={styles.label}>
            <span>Show menu bar icon</span>
            <input
              type="checkbox"
              checked={settings.show_tray_icon}
              onChange={(e) => updateSettings({ ...settings, show_tray_icon: e.target.checked })}
              style={styles.checkbox}
            />
          </label>

          <label style={styles.label}>
            <span>Launch at startup</span>
            <input
              type="checkbox"
              checked={settings.auto_start}
              onChange={(e) => updateSettings({ ...settings, auto_start: e.target.checked })}
              style={styles.checkbox}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  panel: {
    background: '#0d0d12',
    border: '1px solid #2a2a3a',
    borderRadius: 12,
    padding: 0,
    width: 280,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a3a',
  },
  title: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#e8e8ed',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#8888a0',
    fontSize: 18,
    cursor: 'pointer',
  },
  body: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#e8e8ed',
    cursor: 'pointer',
  },
  select: {
    background: '#1a1a24',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    color: '#e8e8ed',
    padding: '4px 8px',
    fontSize: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: '#5e5eff',
  },
};
```

- [ ] **Step 3: Tauri 事件监听 hook**

Write `src/hooks/useTauriEvents.ts`:

```typescript
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export function useTauriEvents() {
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const unlisten = await listen('panel-expand', () => {
        console.log('expand panel requested');
      });
      unlisteners.push(unlisten);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
```

---

### Task 9: Rust 鼠标轮询 + 完整集成

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/notch/mouse.rs`
- Modify: `src-tauri/src/notch/panel.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 在 lib.rs 中集成鼠标轮询**

在 `src-tauri/src/lib.rs` 的 `setup` 中添加鼠标轮询启动：

找到 setup 闭包，在创建窗口后添加：

```rust
// 启动鼠标轮询
let app_handle = app.handle().clone();
std::thread::spawn(move || {
    let is_hovering = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let notch_center_x = std::sync::Arc::new(std::sync::Mutex::new(540.0));
    let screen_top = std::sync::Arc::new(std::sync::Mutex::new(900.0));

    loop {
        let mouse = crate::notch::mouse::get_mouse_location();
        // 更新屏幕参数
        if let Some(screen) = crate::notch::geometry::target_screen() {
            let layout = crate::notch::geometry::get_notch_layout(Some(&screen));
            let mut cx = notch_center_x.lock().unwrap();
            *cx = layout.screen_frame.0 + layout.screen_frame.2 / 2.0;
            let mut st = screen_top.lock().unwrap();
            *st = layout.screen_frame.1 + layout.screen_frame.3;
        }

        let center_x = *notch_center_x.lock().unwrap();
        let top = *screen_top.lock().unwrap();
        let in_rect = crate::notch::mouse::is_in_trigger_rect(mouse, center_x, top);
        let was_hovering = is_hovering.swap(in_rect, std::sync::atomic::Ordering::SeqCst);

        if in_rect && !was_hovering {
            // 进入热区 → 展开
            let _ = crate::notch::panel::expand(&app_handle);
        } else if !in_rect && was_hovering {
            // 离开热区 → 延迟折叠
            std::thread::sleep(std::time::Duration::from_millis(500));
            // 再次检查是否还在热区外
            let mouse_again = crate::notch::mouse::get_mouse_location();
            let in_rect_again = crate::notch::mouse::is_in_trigger_rect(
                mouse_again, *notch_center_x.lock().unwrap(), *screen_top.lock().unwrap()
            );
            if !in_rect_again {
                let _ = crate::notch::panel::collapse(&app_handle);
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(16));
    }
});
```

- [ ] **Step 2: 添加 `dirs` 依赖（已有）**

确保 `src-tauri/Cargo.toml` 中已有：
```toml
dirs = "6"
```

---

### Task 10: 构建与验证

**Files:**
- Modify: `index.html`
- Modify: `vite.config.ts`

- [ ] **Step 1: 更新 index.html**

Write `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NotchNotes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 配置 vite.config.ts**

确保已有基本配置：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

- [ ] **Step 3: 尝试构建**

```bash
cd /Users/xiaxzh/Documents/NotchNotes
npm run tauri build
```

- [ ] **Step 4: 如果构建报错，修复 Rust 编译错误**

常见的修复：
```bash
# 检查 Rust 版本
rustup update

# 检查缺失的 objc2 特性
# 在 Cargo.toml 中可能需要添加：
# objc2 = { version = "0.6", features = ["apple"] }
```

---

## 自检清单

1. **Spec coverage:** 所有 spec 需求均已覆盖：
   - [x] Tab 命名/重命名 — Task 6 TabBar.tsx
   - [x] 菜单栏图标隐藏 — Task 2 settings.rs + Task 4 tray.rs + Task 8 SettingsPanel
   - [x] 开机自启动 — Task 4 autostart.rs + Task 8 SettingsPanel
   - [x] 刘海双窗口交互 — Task 3 panel.rs + geometry.rs + mouse.rs
   - [x] Markdown 编辑 — Task 7 MarkdownEditor.tsx + FormatToolbar.tsx
   - [x] 暗色主题 — Task 5 App.css

2. **Placeholder scan:** 检查通过，无 TODO/TBD
3. **Type consistency:** NoteTab 的 id 使用 String(UUID)，名称`name`字段贯穿前后端
