use crate::notch::geometry;
use objc2::msg_send;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn create_drawer_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let screen = geometry::target_screen();
    let layout = geometry::get_notch_layout(screen.as_deref());
    let frame = geometry::drawer_frame(&layout);

    // Wrap webview creation in catch_unwind to handle macOS private API panics
    // (e.g., drawsBackground KVC removed in a future macOS version).
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        WebviewWindowBuilder::new(app, "notch-drawer", WebviewUrl::App("index.html".into()))
            .title("NotchNotes")
            .inner_size(layout.expanded_width, layout.expanded_height)
            .position(frame.0, frame.1)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false)
            .build()
    }));

    match result {
        Ok(Ok(window)) => {
            set_window_floating(&window);
            Ok(())
        }
        Ok(Err(build_err)) => {
            log::warn!("[notch] failed to create drawer window: {build_err}");
            Err(Box::new(build_err))
        }
        Err(panic) => {
            let msg = panic
                .downcast_ref::<String>()
                .map(|s| s.as_str())
                .or_else(|| panic.downcast_ref::<&str>().copied())
                .unwrap_or("unknown panic");
            log::error!("[notch] macOS API panic while creating window: {msg}");
            Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("window creation panicked: {msg}"),
            )))
        }
    }
}

fn set_window_floating(window: &tauri::WebviewWindow) {
    if let Ok(ptr) = window.ns_window() {
        if !ptr.is_null() {
            let ns_window = ptr as *mut objc2::runtime::NSObject;
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                unsafe { let _: () = msg_send![ns_window, setLevel: 3i64]; }
            }));
        }
    }
}

pub fn expand(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(drawer) = app.get_webview_window("notch-drawer") {
        let _ = drawer.show();
        let _ = drawer.set_focus();
        let _ = app.emit("panel-shown", ());
    } else {
        create_drawer_window(app)?;
    }
    Ok(())
}

pub fn collapse(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let _ = app.emit("panel-hide", ());
    Ok(())
}

pub fn hide_panel(app: &AppHandle) {
    if let Some(drawer) = app.get_webview_window("notch-drawer") {
        let _ = drawer.hide();
    }
}
