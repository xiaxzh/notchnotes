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

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn setup_pool() -> Result<SqlitePool, Box<dyn std::error::Error>> {
        let pool = SqlitePool::connect("sqlite::memory:").await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS tabs (
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
            );"
        ).execute(&pool).await?;
        Ok(pool)
    }

    #[tokio::test]
    async fn insert_and_retrieve_tab() {
        let pool = setup_pool().await.unwrap();
        let now = "2026-01-01T00:00:00Z";
        sqlx::query(
            "INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        )
            .bind("tab-1")
            .bind("Test Note")
            .bind("hello world")
            .bind(now)
            .bind(now)
            .bind(0i64)
            .execute(&pool).await.unwrap();

        let rows: Vec<NoteTab> = sqlx::query_as("SELECT id, name, text, created_at, updated_at, selection_pos FROM tabs")
            .fetch_all(&pool).await.unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "tab-1");
        assert_eq!(rows[0].name, "Test Note");
        assert_eq!(rows[0].text, "hello world");
    }

    #[tokio::test]
    async fn empty_tabs_return_empty_vec() {
        let pool = setup_pool().await.unwrap();
        let rows: Vec<NoteTab> = sqlx::query_as("SELECT id, name, text, created_at, updated_at, selection_pos FROM tabs")
            .fetch_all(&pool).await.unwrap();
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn update_tab_text() {
        let pool = setup_pool().await.unwrap();
        let now = "2026-01-01T00:00:00Z";
        sqlx::query("INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES (?1, '', '', ?2, ?2, 0)")
            .bind("tab-1")
            .bind(now)
            .execute(&pool).await.unwrap();

        let now2 = "2026-06-01T00:00:00Z";
        sqlx::query("UPDATE tabs SET text = ?1, updated_at = ?2 WHERE id = ?3")
            .bind("new text")
            .bind(now2)
            .bind("tab-1")
            .execute(&pool).await.unwrap();

        let row: NoteTab = sqlx::query_as("SELECT id, name, text, created_at, updated_at, selection_pos FROM tabs WHERE id = ?1")
            .bind("tab-1")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(row.text, "new text");
    }

    #[tokio::test]
    async fn delete_tab() {
        let pool = setup_pool().await.unwrap();
        let now = "2026-01-01T00:00:00Z";
        sqlx::query("INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES (?1, '', '', ?2, ?2, 0)")
            .bind("tab-1")
            .bind(now)
            .execute(&pool).await.unwrap();

        sqlx::query("DELETE FROM tabs WHERE id = ?1")
            .bind("tab-1")
            .execute(&pool).await.unwrap();

        let rows: Vec<NoteTab> = sqlx::query_as("SELECT id, name, text, created_at, updated_at, selection_pos FROM tabs")
            .fetch_all(&pool).await.unwrap();
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn settings_insert_and_update() {
        let pool = setup_pool().await.unwrap();

        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('show_tray_icon', 'true')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_start', 'false')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', 'system')")
            .execute(&pool).await.unwrap();

        let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings ORDER BY key")
            .fetch_all(&pool).await.unwrap();
        assert_eq!(rows.len(), 3);

        // Update one setting
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', 'dark')")
            .execute(&pool).await.unwrap();

        let theme: (String,) = sqlx::query_as("SELECT value FROM settings WHERE key = 'theme'")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(theme.0, "dark");
    }

    #[tokio::test]
    async fn settings_defaults_on_empty_db() {
        let pool = setup_pool().await.unwrap();
        let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
            .fetch_all(&pool).await.unwrap();
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn multiple_tabs_ordered_by_created_at() {
        let pool = setup_pool().await.unwrap();

        let t1 = "2026-01-01T00:00:00Z";
        let t2 = "2026-02-01T00:00:00Z";
        let t3 = "2026-03-01T00:00:00Z";

        sqlx::query("INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES ('c', '', '', ?1, ?1, 0)").bind(t3).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES ('a', '', '', ?1, ?1, 0)").bind(t1).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO tabs (id, name, text, created_at, updated_at, selection_pos) VALUES ('b', '', '', ?1, ?1, 0)").bind(t2).execute(&pool).await.unwrap();

        let rows: Vec<NoteTab> = sqlx::query_as("SELECT id, name, text, created_at, updated_at, selection_pos FROM tabs ORDER BY created_at ASC")
            .fetch_all(&pool).await.unwrap();

        assert_eq!(rows[0].id, "a");
        assert_eq!(rows[1].id, "b");
        assert_eq!(rows[2].id, "c");
    }
}

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

    // Reclaim disk space from any previously deleted tabs
    sqlx::query("VACUUM;").execute(&pool).await?;

    Ok(AppDatabase(pool))
}


