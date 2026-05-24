use objc2::rc::Retained;
use objc2::msg_send;
use objc2_app_kit::NSScreen;
use objc2_foundation::{MainThreadMarker, NSRect};

/// Distance from screen top for the notch trigger threshold.
/// Set to 4px — user must push mouse all the way to the physical top edge.
pub const NOTCH_AREA_HEIGHT: f64 = 4.0;


#[derive(Debug, Clone, Copy)]
pub struct NotchLayout {
    pub compact_width: f64,
    pub compact_height: f64,
    pub expanded_width: f64,
    pub expanded_height: f64,
    pub notch_width: f64,
    pub notch_height: f64,
    /// Full screen frame: (x, y, width, height) in bottom-left screen coordinates
    pub screen_frame: (f64, f64, f64, f64),
    /// Visible frame: (x, y, width, height) in bottom-left screen coordinates
    pub visible_frame: (f64, f64, f64, f64),
}

pub fn target_screen() -> Option<Retained<NSScreen>> {
    let mtm = MainThreadMarker::new()?;
    let screens = NSScreen::screens(mtm);
    let count: usize = unsafe { msg_send![&screens, count] };
    (count > 0).then(|| unsafe { msg_send![&screens, objectAtIndex: 0] })
}

pub fn get_notch_layout(screen: Option<&NSScreen>) -> NotchLayout {
    let default_frame = (0.0, 0.0, 1440.0, 900.0);
    let visible_frame = screen.map_or(default_frame, |s| {
        let frame: NSRect = unsafe { msg_send![s, visibleFrame] };
        (
            frame.origin.x as f64,
            frame.origin.y as f64,
            frame.size.width as f64,
            frame.size.height as f64,
        )
    });
    let screen_frame = screen.map_or(default_frame, |s| {
        let frame: NSRect = s.frame();
        (
            frame.origin.x as f64,
            frame.origin.y as f64,
            frame.size.width as f64,
            frame.size.height as f64,
        )
    });

    let notch_width = 210.0_f64.min(screen_frame.2 - 36.0);
    let notch_height = 32.0;

    let compact_width = f64::max(notch_width - 6.0, 182.0).min(238.0);
    let compact_height = f64::max(notch_height + 2.0, 32.0).min(38.0);
    let expanded_width = f64::min(f64::max(f64::min(notch_width + 220.0, 540.0), 480.0), screen_frame.2 - 36.0);
    let expanded_height = f64::min(f64::max(notch_height + 374.0, 408.0), screen_frame.3 - 84.0);

    NotchLayout {
        compact_width,
        compact_height,
        expanded_width,
        expanded_height,
        notch_width,
        notch_height,
        screen_frame,
        visible_frame,
    }
}

/// Positions for hot/drawer are in **Tauri top-left** screen coordinates.
/// Tauri's `.position()` and `.set_position()` use top-left origin,
/// where y = 0 is the top edge of the screen and y increases downward.
/// 
/// x = center of screen horizontally.
/// y = menu_bar_height (just below the menu bar).

pub fn drawer_frame(layout: &NotchLayout) -> (f64, f64, f64, f64) {
    let x = (layout.screen_frame.2 - layout.expanded_width) / 2.0;
    let visible_top = layout.visible_frame.1 + layout.visible_frame.3;
    let y = layout.screen_frame.3 - visible_top;
    (x, y, layout.expanded_width, layout.expanded_height)
}


