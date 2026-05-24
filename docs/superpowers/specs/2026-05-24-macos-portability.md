# macOS 移植性 & 版本升级风险

## 概述

分析 NotchNotes 在不同 Mac 硬件和 macOS 版本下的行为一致性和降级策略。

## 风险矩阵

### macOS Private API (`macOSPrivateApi: true`)

| API | 用途 | 类型 | 稳定性 | OS 升级风险 |
|-----|------|------|--------|------------|
| `WKWebView setValue:forKey:@"drawsBackground"` | WKWebView 透明背景 | 私有 KVC | 自 macOS 10.14 (2018) 稳定 | 低 — 持续使用 8 年，Tauri v3 计划移除对该 API 的依赖 |
| `WKWebView setValue:forKey:@"fullScreenEnabled"` | WebView 全屏视频 | 私有 KVC | 同上 | 低 — NotchNotes 不使用全屏视频功能 |

`macOSPrivateApi: true` **不**影响 `NSWindow` 层级设置（`setLevel:`），后者是公共 API。

### 公共 API（无风险）

| API | 位置 | 稳定性 |
|-----|------|--------|
| `NSEvent::mouseLocation()` | mouse.rs | 文档化的公共 API，自 macOS 10.0 |
| `NSScreen::screens()` / `visibleFrame` / `frame` | geometry.rs | 文档化的公共 API |
| `NSWindow setLevel:` | panel.rs | 文档化的公共 API |
| `SMAppService` (macOS 13+) | autostart.rs | 文档化的公共 API |

### 硬件差异

| 场景 | 当前行为 | 影响 |
|------|----------|------|
| 有刘海的 Mac (Air/Pro) | 触发区对齐物理刘海 | 正常 |
| 无刘海 Mac (Mini/Studio/iMac) | 触发区居中显示 | 可正常工作，触发区没有物理刘海对应 |
| 外接显示器（副屏） | 触发区仅在主屏生效 | 需要在笔记本屏幕上触发 |
| 外接显示器（主屏） | 触发区居中屏幕顶部 | 可正常工作 |
| 不同刘海宽度 | `notch_width` 硬编码 210pt | 触发区可能偏移数像素，功能不受影响 |

## 保护机制

### 窗口创建 (panel.rs)

`create_drawer_window()` 包含三层保护：

1. **`catch_unwind` 包裹 `WebviewWindowBuilder::build()** — 如果私有 KVC 调用抛出 Objective-C 异常，转换为 Rust panic 并被捕获，不会导致整个进程崩溃。
2. **`set_window_floating()` 的 `catch_unwind`** — `setLevel:` 的 `msg_send!` 同样被保护。
3. **调用处丢弃 `Result`** — `lib.rs` 中 `let _ = expand()` 主动忽略不可恢复的错误，应用继续运行（只是无法显示抽屉）。

### 降级后的表现

如果未来 macOS 移除了 `drawsBackground` KVC：

- webview 背景变为不透明（白色）
- 窗口圆角区域显示白底而非透明穿透
- 应用依然可以运行和使用
- 所有编辑器功能、数据持久化不受影响

## 减轻措施

- **Tauri v3** 已计划移除私有 API 依赖（源码注释 `TODO: Remove in v3`）
- **macOS Sequoia beta 测试** 建议在 developer beta 发布时验证一次
- **重新构建** 旧版二进制在新 macOS 上如需修复，只需 `npm run tauri build`（无其他依赖）

## 不在此文范围内的

- 前端 CSS 样式的浏览器兼容性（由 WKWebView 版本决定）
- TipTap 编辑器的库版本兼容性
- GitHub Actions CI 运行环境
