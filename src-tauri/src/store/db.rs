use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NoteTab {
    pub id: String,
    pub name: String,
    pub text: String,
    pub created_at: String,
    pub updated_at: String,
    pub selection_pos: i64,
}

pub struct AppDatabase(pub SqlitePool);

pub async fn init_database(app: &AppHandle) -> Result<AppDatabase, Box<dyn std::error::Error>> {
    let app_dir = app.path().app_config_dir()?;
    std::fs::create_dir_all(&app_dir)?;
    let db_path = app_dir.join("notchnotes.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());

    let pool = SqlitePool::connect(&db_url).await?;

    let sql = "CREATE TABLE IF NOT EXISTS tabs (
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
    );
    INSERT OR REPLACE INTO settings (key, value) VALUES ('show_tray_icon', 'true');
    INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_start', 'false');
    INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', 'system');
    INSERT OR REPLACE INTO settings (key, value) VALUES ('tab_counter', '1');";

    sqlx::query(sql).execute(&pool).await?;

    Ok(AppDatabase(pool))
}


