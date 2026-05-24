export interface NoteTab {
  id: string;
  name: string;
  text: string;
  created_at: string;
  updated_at: string;
  selection_pos: number;
}

export interface AppSettings {
  show_tray_icon: boolean;
  auto_start: boolean;
  theme: string;
}
