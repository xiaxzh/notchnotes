use std::process::Command;

pub fn enable_autostart(_app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
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

    let _ = Command::new("launchctl")
        .args(["load", "-w"])
        .arg(launch_agents_dir.join("com.notchnotes.launcher.plist"))
        .output();

    Ok(())
}

pub fn disable_autostart(_app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
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
