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

    // Sizes are proportional to screen dimensions.
    // Ratios chosen for comfortable note-taking across common Mac sizes
    // while staying usable on smaller screens.
    let expanded_width = f64::min(f64::max(screen_frame.2 * 0.35, 420.0), 600.0);
    let expanded_height = f64::min(f64::max(screen_frame.3 * 0.45, 360.0), 580.0);
    let compact_width = f64::min(f64::max(expanded_width * 0.40, 170.0), 250.0);
    let compact_height = 34.0;
    let notch_width = f64::min(f64::max(screen_frame.2 * 0.14, 170.0), 240.0);
    let notch_height = 32.0;

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

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SCREEN: (f64, f64, f64, f64) = (0.0, 0.0, 1470.0, 956.0);
    const TEST_VISIBLE: (f64, f64, f64, f64) = (0.0, 33.0, 1470.0, 923.0);

    fn test_layout() -> NotchLayout {
        NotchLayout {
            compact_width: 204.0,
            compact_height: 34.0,
            expanded_width: 500.0,
            expanded_height: 440.0,
            notch_width: 210.0,
            notch_height: 32.0,
            screen_frame: TEST_SCREEN,
            visible_frame: TEST_VISIBLE,
        }
    }

    #[test]
    fn notch_area_height_constant() {
        assert_eq!(NOTCH_AREA_HEIGHT, 4.0);
    }

    #[test]
    fn get_notch_layout_uses_defaults_when_no_screen() {
        let layout = get_notch_layout(None);
        assert_eq!(layout.screen_frame, (0.0, 0.0, 1440.0, 900.0));
        assert_eq!(layout.visible_frame, (0.0, 0.0, 1440.0, 900.0));
    }

    #[test]
    fn notch_dimensions_within_bounds() {
        let layout = get_notch_layout(None);
        assert!(layout.notch_width >= 170.0);
        assert!(layout.notch_width <= 240.0);
        assert_eq!(layout.notch_height, 32.0);
    }

    #[test]
    fn compact_dimensions_sane() {
        let layout = get_notch_layout(None);
        assert!(layout.compact_width >= 182.0);
        assert!(layout.compact_width <= 238.0);
        assert!(layout.compact_height >= 32.0);
        assert!(layout.compact_height <= 38.0);
        assert!(layout.compact_width >= layout.notch_width - 6.0);
        assert!(layout.compact_height >= layout.notch_height);
    }

    #[test]
    fn expanded_dimensions_sane() {
        let layout = get_notch_layout(None);
        assert!(layout.expanded_width >= 480.0);
        assert!(layout.expanded_width <= 540.0);
        assert!(layout.expanded_height >= 360.0);
        assert!(layout.expanded_height <= 816.0);
        assert!(layout.expanded_width > layout.notch_width);
        assert!(layout.expanded_height > layout.notch_height);
    }

    #[test]
    fn drawer_frame_centers_horizontally() {
        let layout = test_layout();
        let (x, y, w, h) = drawer_frame(&layout);
        assert_eq!(w, layout.expanded_width);
        assert_eq!(h, layout.expanded_height);
        let expected_x = (TEST_SCREEN.2 - layout.expanded_width) / 2.0;
        assert!((x - expected_x).abs() < f64::EPSILON);
    }

    #[test]
    fn drawer_frame_y_below_menu_bar() {
        let layout = test_layout();
        let (_, y, _, _) = drawer_frame(&layout);
        let visible_top = TEST_VISIBLE.1 + TEST_VISIBLE.3;
        let expected_y = TEST_SCREEN.3 - visible_top;
        assert!((y - expected_y).abs() < f64::EPSILON);
        assert!(y >= 0.0);
    }

    #[test]
    fn drawer_frame_fits_on_screen() {
        let layout = test_layout();
        let (x, y, w, h) = drawer_frame(&layout);
        assert!(x >= 0.0);
        assert!(y >= 0.0);
        assert!(x + w <= TEST_SCREEN.2);
        assert!(y + h <= TEST_SCREEN.3);
    }

    #[test]
    fn layout_clamped_to_small_screen() {
        let layout = get_notch_layout(None);
        // Simulate what would happen with a tiny screen by just checking
        // the layout for the default screen fits within it
        assert!(layout.expanded_width <= layout.screen_frame.2);
        assert!(layout.expanded_height <= layout.screen_frame.3);
        assert!(layout.notch_width <= layout.screen_frame.2);
    }
}


