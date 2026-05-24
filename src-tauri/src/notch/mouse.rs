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
