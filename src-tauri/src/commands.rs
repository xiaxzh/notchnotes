use crate::store::db::{AppDatabase, NoteTab};
use crate::store::settings::AppSettings;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_tabs(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>) -> Result<Vec<NoteTab>, String> {
    let rows = sqlx::query_as::<_, NoteTab>("SELECT id, name, text, created_at, updated_at, selection_pos FROM tabs ORDER BY created_at ASC")
        .fetch_all(&db.0)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub async fn add_tab(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>) -> Result<NoteTab, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    let counter_row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = 'tab_counter'")
        .fetch_optional(&db.0)
        .await
        .map_err(|e| e.to_string())?;

    let counter: i64 = counter_row
        .and_then(|(v,)| v.parse().ok())
        .unwrap_or(1);

    let name = format!("便签 {}", counter);

    sqlx::query(
        "INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES (?1, ?2, '', ?3, ?4, 0)"
    )
        .bind(&id)
        .bind(&name)
        .bind(&now)
        .bind(&now)
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE settings SET value = ?1 WHERE key = 'tab_counter'")
        .bind(&(counter + 1).to_string())
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;

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
pub async fn remove_tab(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM tabs WHERE id = ?1")
        .bind(&id)
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn rename_tab(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>, id: String, name: String) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE tabs SET name = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&name)
        .bind(&now)
        .bind(&id)
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_text(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>, id: String, text: String) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE tabs SET text = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&text)
        .bind(&now)
        .bind(&id)
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_selection(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>, id: String, pos: i64) -> Result<(), String> {
    sqlx::query("UPDATE tabs SET selection_pos = ?1 WHERE id = ?2")
        .bind(pos)
        .bind(&id)
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_settings(_app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>) -> Result<AppSettings, String> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&db.0)
        .await
        .map_err(|e| e.to_string())?;

    let mut settings = AppSettings::default();

    for (key, value) in &rows {
        match key.as_str() {
            "show_tray_icon" => settings.show_tray_icon = value == "true",
            "auto_start" => settings.auto_start = value == "true",
            "theme" => settings.theme = value.clone(),
            _ => {}
        }
    }

    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(app: AppHandle<tauri::Wry>, db: State<'_, AppDatabase>, settings: AppSettings) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('show_tray_icon', ?1)")
        .bind(if settings.show_tray_icon { "true" } else { "false" })
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_start', ?1)")
        .bind(if settings.auto_start { "true" } else { "false" })
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?1)")
        .bind(&settings.theme)
        .execute(&db.0)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_visible(settings.show_tray_icon);
    }

    if settings.auto_start {
        let _ = crate::autostart::enable_autostart(&app);
    } else {
        let _ = crate::autostart::disable_autostart(&app);
    }

    Ok(())
}

#[tauri::command]
pub async fn expand_panel(app: AppHandle<tauri::Wry>) -> Result<(), String> {
    crate::notch::panel::expand(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn collapse_panel(app: AppHandle<tauri::Wry>) -> Result<(), String> {
    crate::notch::panel::collapse(&app).map_err(|e| e.to_string())
}


