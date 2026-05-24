import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNoteStore } from './useNoteStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');

const defaultSettings = { show_tray_icon: true, auto_start: false, theme: 'system' };

const mockTabs = [
  { id: '1', name: 'Note 1', text: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', selection_pos: 0 },
  { id: '2', name: 'Note 2', text: 'hello', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', selection_pos: 0 },
  { id: '3', name: 'Note 3', text: 'world', created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z', selection_pos: 0 },
];

function mockInvoke(handlers: Record<string, any>) {
  (invoke as any).mockImplementation((cmd: string, args?: any) => {
    if (cmd in handlers) return Promise.resolve(handlers[cmd](args));
    return Promise.reject(new Error(`unknown command: ${cmd}`));
  });
}

describe('useNoteStore', () => {
  beforeEach(() => {
    useNoteStore.setState({ tabs: [], activeTabId: null, settings: defaultSettings, isLoading: true });
    vi.clearAllMocks();
  });

  it('starts with initial state', () => {
    const s = useNoteStore.getState();
    expect(s.tabs).toEqual([]);
    expect(s.activeTabId).toBeNull();
    expect(s.isLoading).toBe(true);
    expect(s.settings).toEqual(defaultSettings);
  });

  it('load() populates tabs and settings', async () => {
    mockInvoke({
      get_tabs: () => mockTabs,
      get_settings: () => defaultSettings,
    });
    await useNoteStore.getState().load();
    const s = useNoteStore.getState();
    expect(s.tabs).toHaveLength(3);
    expect(s.activeTabId).toBe('1');
    expect(s.isLoading).toBe(false);
  });

  it('load() sets isLoading=false on error', async () => {
    mockInvoke({
      get_tabs: () => { throw new Error('fail'); },
    });
    await useNoteStore.getState().load();
    expect(useNoteStore.getState().isLoading).toBe(false);
  });

  it('addTab() adds a tab and selects it', async () => {
    useNoteStore.setState({ tabs: mockTabs, activeTabId: '1', isLoading: false });
    const newTab = { id: '4', name: 'Note 4', text: '', created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z', selection_pos: 0 };
    mockInvoke({ add_tab: () => newTab });

    await useNoteStore.getState().addTab();
    const s = useNoteStore.getState();
    expect(s.tabs).toHaveLength(4);
    expect(s.tabs[3].id).toBe('4');
    expect(s.activeTabId).toBe('4');
  });

  it('removeTab() removes tab and selects neighbor', async () => {
    useNoteStore.setState({ tabs: mockTabs, activeTabId: '2', isLoading: false });
    mockInvoke({ remove_tab: () => undefined });

    await useNoteStore.getState().removeTab('2');
    const s = useNoteStore.getState();
    expect(s.tabs).toHaveLength(2);
    expect(s.tabs.find(t => t.id === '2')).toBeUndefined();
    expect(s.activeTabId).toBe('3');
  });

  it('removeTab() selects left neighbor when removing last', async () => {
    useNoteStore.setState({ tabs: mockTabs, activeTabId: '3', isLoading: false });
    mockInvoke({ remove_tab: () => undefined });

    await useNoteStore.getState().removeTab('3');
    const s = useNoteStore.getState();
    expect(s.tabs).toHaveLength(2);
    expect(s.activeTabId).toBe('2');
  });

  it('removeTab() does nothing when only 1 tab', async () => {
    useNoteStore.setState({ tabs: [mockTabs[0]], activeTabId: '1', isLoading: false });

    await useNoteStore.getState().removeTab('1');
    const s = useNoteStore.getState();
    expect(s.tabs).toHaveLength(1);
  });

  it('renameTab() updates tab name', async () => {
    useNoteStore.setState({ tabs: mockTabs, isLoading: false });
    mockInvoke({ rename_tab: () => undefined });

    await useNoteStore.getState().renameTab('1', 'Renamed');
    const tab = useNoteStore.getState().tabs.find(t => t.id === '1')!;
    expect(tab.name).toBe('Renamed');
  });

  it('renameTab() truncates name to 30 chars', async () => {
    useNoteStore.setState({ tabs: mockTabs, isLoading: false });
    mockInvoke({ rename_tab: () => undefined });

    const long = 'a'.repeat(50);
    await useNoteStore.getState().renameTab('1', long);
    const tab = useNoteStore.getState().tabs.find(t => t.id === '1')!;
    expect(tab.name).toHaveLength(30);
    expect(tab.name).toBe('a'.repeat(30));
  });

  it('updateText() optimistically updates text', async () => {
    useNoteStore.setState({ tabs: mockTabs, isLoading: false });
    mockInvoke({ update_text: () => undefined });

    await useNoteStore.getState().updateText('1', 'new content');
    const tab = useNoteStore.getState().tabs.find(t => t.id === '1')!;
    expect(tab.text).toBe('new content');
  });

  it('selectTab() sets activeTabId', () => {
    useNoteStore.setState({ tabs: mockTabs, isLoading: false });
    useNoteStore.getState().selectTab('2');
    expect(useNoteStore.getState().activeTabId).toBe('2');
  });

  it('updateSettings() updates settings state', async () => {
    useNoteStore.setState({ tabs: mockTabs, settings: defaultSettings, isLoading: false });
    mockInvoke({ update_settings: () => undefined });

    const newSettings = { show_tray_icon: false, auto_start: true, theme: 'dark' };
    await useNoteStore.getState().updateSettings(newSettings);
    expect(useNoteStore.getState().settings).toEqual(newSettings);
  });
});
