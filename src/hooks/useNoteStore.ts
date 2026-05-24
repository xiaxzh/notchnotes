import { create } from 'zustand';
import type { NoteTab, AppSettings } from '../types';
import * as api from '../lib/tauri';

interface NoteStore {
  tabs: NoteTab[];
  activeTabId: string | null;
  settings: AppSettings;
  isLoading: boolean;

  load: () => Promise<void>;
  addTab: () => Promise<void>;
  removeTab: (id: string) => Promise<void>;
  renameTab: (id: string, name: string) => Promise<void>;
  updateText: (id: string, text: string) => Promise<void>;
  updateSelection: (id: string, pos: number) => Promise<void>;
  selectTab: (id: string) => void;
  updateSettings: (settings: AppSettings) => Promise<void>;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  settings: { show_tray_icon: true, auto_start: false, theme: 'system' },
  isLoading: true,

  load: async () => {
    try {
      const [tabs, settings] = await Promise.all([
        api.getTabs(),
        api.getSettings(),
      ]);
      set({
        tabs,
        settings,
        activeTabId: tabs.length > 0 ? tabs[0].id : null,
        isLoading: false,
      });
    } catch (e) {
      console.error('Failed to load:', e);
      set({ isLoading: false });
    }
  },

  addTab: async () => {
    try {
      const tab = await api.addTab();
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }));
    } catch (e) {
      console.error('Failed to add tab:', e);
    }
  },

  removeTab: async (id: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    try {
      await api.removeTab(id);
      const newTabs = tabs.filter((t) => t.id !== id);
      const idx = tabs.findIndex((t) => t.id === id);
      const newActiveId = activeTabId === id
        ? newTabs[Math.min(idx, newTabs.length - 1)].id
        : activeTabId!;
      set({ tabs: newTabs, activeTabId: newActiveId });
    } catch (e) {
      console.error('Failed to remove tab:', e);
    }
  },

  renameTab: async (id: string, name: string) => {
    const sliced = name.slice(0, 30);
    await api.renameTab(id, sliced);
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name: sliced } : t)),
    }));
  },

  updateText: async (id: string, text: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, text } : t)),
    }));
    try {
      await api.updateText(id, text);
    } catch (e) {
      console.error('Failed to update text:', e);
    }
  },

  updateSelection: async (id: string, pos: number) => {
    try {
      await api.updateSelection(id, pos);
    } catch (e) {
      console.error('Failed to update selection:', e);
    }
  },

  selectTab: (id: string) => {
    set({ activeTabId: id });
  },

  updateSettings: async (settings: AppSettings) => {
    try {
      await api.updateSettings(settings);
      set({ settings });
    } catch (e) {
      console.error('Failed to update settings:', e);
    }
  },
}));
