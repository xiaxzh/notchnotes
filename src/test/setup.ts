import '@testing-library/jest-dom';

class MockPointerEvent extends Event {
  button: number;
  clientX: number;
  clientY: number;
  constructor(type: string, props?: Partial<PointerEvent>) {
    super(type, props);
    this.button = props?.button ?? 0;
    this.clientX = props?.clientX ?? 0;
    this.clientY = props?.clientY ?? 0;
  }
}
(PointerEvent as any) ??= MockPointerEvent;

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));
