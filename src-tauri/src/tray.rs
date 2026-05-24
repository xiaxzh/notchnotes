use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};

fn load_png(data: &[u8]) -> Result<Image<'static>, Box<dyn std::error::Error>> {
    let decoder = png::Decoder::new(std::io::Cursor::new(data));
    let mut reader = decoder.read_info()?;
    let buf_size = reader.output_buffer_size().unwrap_or(0);
    let mut buf = vec![0u8; buf_size];
    let info = reader.next_frame(&mut buf)?;
    let w = info.width;
    let h = info.height;
    let rgba = if info.color_type == png::ColorType::Rgba {
        buf[..info.buffer_size()].to_vec()
    } else if info.color_type == png::ColorType::Rgb {
        buf[..info.buffer_size()].chunks(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect()
    } else {
        return Err("unsupported color type".into());
    };
    Ok(Image::new_owned(rgba, w, h))
}

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Notes", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Notes", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit NotchNotes", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(app, &[&show, &hide, &separator, &quit])?;

    let png_data = include_bytes!("../icons/tray-icon-template.png");
    let tray_icon = load_png(png_data)?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(tray_icon)
        .icon_as_template(true)
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
