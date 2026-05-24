use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub show_tray_icon: bool,
    pub auto_start: bool,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            show_tray_icon: true,
            auto_start: false,
            theme: "system".to_string(),
        }
    }
}
