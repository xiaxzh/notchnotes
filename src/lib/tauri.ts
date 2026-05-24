import { invoke } from '@tauri-apps/api/core';
import type { NoteTab, AppSettings } from '../types';

export async function getTabs(): Promise<NoteTab[]> {
  return invoke('get_tabs');
}

export async function addTab(): Promise<NoteTab> {
  return invoke('add_tab');
}

export async function removeTab(id: string): Promise<void> {
  return invoke('remove_tab', { id });
}

export async function renameTab(id: string, name: string): Promise<void> {
  return invoke('rename_tab', { id, name });
}

export async function updateText(id: string, text: string): Promise<void> {
  return invoke('update_text', { id, text });
}

export async function updateSelection(id: string, pos: number): Promise<void> {
  return invoke('update_selection', { id, pos });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke('get_settings');
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  return invoke('update_settings', { settings });
}

export async function expandPanel(): Promise<void> {
  return invoke('expand_panel');
}

export async function collapsePanel(): Promise<void> {
  return invoke('collapse_panel');
}
