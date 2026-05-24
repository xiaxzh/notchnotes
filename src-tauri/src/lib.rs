mod autostart;
mod commands;
mod notch;
mod store;
mod tray;

use store::db::init_database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Initialize database
            match tauri::async_runtime::block_on(init_database(app.handle())) {
                Ok(db) => { app.manage(db); }
                Err(e) => { eprintln!("[setup] failed to initialize database: {e}"); }
            }

            // Create tray icon
            if let Err(e) = tray::create_tray(app.handle()) {
                eprintln!("[setup] failed to create tray: {e}");
            }

            // Compute initial notch layout for mouse polling
            let screen = notch::geometry::target_screen();
            let layout = notch::geometry::get_notch_layout(screen.as_deref());
            let trigger_rect = notch::geometry::trigger_rect(&layout);
            let screen_w = layout.screen_frame.2;
            let visible_h = layout.visible_frame.3;
            let vis_origin_y = layout.visible_frame.1;
            let expanded_w = layout.expanded_width;
            let expanded_h = layout.expanded_height;

            // Start mouse polling thread
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut is_expanded = false;

                loop {
                    let mouse = notch::mouse::get_mouse_location();
                    // When expanded, the keep-open area covers the drawer bounds plus a small margin
                    let drawer_x = (screen_w - expanded_w) / 2.0;
                    let drawer_y = vis_origin_y + visible_h - expanded_h;
                    let margin = 4.0;
                    let keep_open_rect = (
                        drawer_x - margin,
                        drawer_y - margin,
                        expanded_w + margin * 2.0,
                        expanded_h + margin * 2.0,
                    );
                    let active_rect = if is_expanded { keep_open_rect } else { trigger_rect };
                    let in_rect = notch::mouse::is_in_rect(mouse, active_rect);

                    if in_rect && !is_expanded {
                        let handle = app_handle.clone();
                        let _ = app_handle.run_on_main_thread(move || {
                            let _ = notch::panel::expand(&handle);
                        });
                        is_expanded = true;
                    } else if !in_rect && is_expanded {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let mouse2 = notch::mouse::get_mouse_location();
                        if !notch::mouse::is_in_rect(mouse2, keep_open_rect) {
                            let handle = app_handle.clone();
                            let _ = app_handle.run_on_main_thread(move || {
                                let _ = notch::panel::collapse(&handle);
                            });
                            is_expanded = false;
                            std::thread::sleep(std::time::Duration::from_millis(300));
                        }
                    }

                    std::thread::sleep(std::time::Duration::from_millis(16));
                }
            });

            // Check if launched via autostart
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
            commands::hide_panel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
