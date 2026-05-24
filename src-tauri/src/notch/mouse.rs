use objc2_app_kit::NSEvent;
use objc2_foundation::NSPoint;

#[derive(Debug, Clone, Copy)]
pub struct MouseLocation {
    pub x: f64,
    pub y: f64,
}

pub fn get_mouse_location() -> MouseLocation {
    let point: NSPoint = NSEvent::mouseLocation();
    MouseLocation {
        x: point.x as f64,
        y: point.y as f64,
    }
}

pub fn is_in_rect(mouse: MouseLocation, rect: (f64, f64, f64, f64)) -> bool {
    mouse.x >= rect.0
        && mouse.x <= rect.0 + rect.2
        && mouse.y >= rect.1
        && mouse.y <= rect.1 + rect.3
}

#[cfg(test)]
mod tests {
    use super::*;

    fn loc(x: f64, y: f64) -> MouseLocation { MouseLocation { x, y } }

    #[test]
    fn inside_center() {
        assert!(is_in_rect(loc(10.0, 10.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn inside_left_edge() {
        assert!(is_in_rect(loc(0.0, 10.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn inside_right_edge() {
        assert!(is_in_rect(loc(20.0, 10.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn inside_top_edge() {
        assert!(is_in_rect(loc(10.0, 0.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn inside_bottom_edge() {
        assert!(is_in_rect(loc(10.0, 20.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn outside_left() {
        assert!(!is_in_rect(loc(-1.0, 10.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn outside_right() {
        assert!(!is_in_rect(loc(21.0, 10.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn outside_above() {
        assert!(!is_in_rect(loc(10.0, -1.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn outside_below() {
        assert!(!is_in_rect(loc(10.0, 21.0), (0.0, 0.0, 20.0, 20.0)));
    }

    #[test]
    fn notch_trigger_rect_coordinates() {
        // Simulate the trigger zone from lib.rs: screen 1470x956, notch 210px
        let screen_w = 1470.0;
        let notch_w = 210.0;
        let notch_x_center = (screen_w - notch_w) / 2.0;
        let notch_x_end = notch_x_center + notch_w;

        // Mouse at notch center, at screen top
        assert!(is_in_rect(loc(notch_x_center + 50.0, 956.0), (notch_x_center, 952.0, notch_w, 4.0)));
        // Mouse outside left of notch
        assert!(!is_in_rect(loc(notch_x_center - 10.0, 956.0), (notch_x_center, 952.0, notch_w, 4.0)));
        // Mouse below threshold
        assert!(!is_in_rect(loc(notch_x_center + 50.0, 950.0), (notch_x_center, 952.0, notch_w, 4.0)));
    }

    #[test]
    fn zero_size_rect() {
        assert!(is_in_rect(loc(5.0, 5.0), (5.0, 5.0, 0.0, 0.0)));
        assert!(!is_in_rect(loc(5.0, 6.0), (5.0, 5.0, 0.0, 0.0)));
        assert!(!is_in_rect(loc(6.0, 5.0), (5.0, 5.0, 0.0, 0.0)));
    }

    #[test]
    fn negative_coordinates() {
        assert!(is_in_rect(loc(-5.0, -5.0), (-10.0, -10.0, 10.0, 10.0)));
        assert!(!is_in_rect(loc(-15.0, -5.0), (-10.0, -10.0, 10.0, 10.0)));
    }
}
