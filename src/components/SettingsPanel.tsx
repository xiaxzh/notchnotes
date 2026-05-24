import { useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { useNoteStore } from '../hooks/useNoteStore';

interface SettingsPanelProps {
  onClose: () => void;
}

const THEMES = ['system', 'light', 'dark'] as const;

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useNoteStore();
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setUpdateStatus('检查中...');
    try {
      const update = await check();
      if (update) {
        setUpdateStatus('正在下载更新...');
        await update.downloadAndInstall();
        setUpdateStatus('更新完成');
      } else {
        setUpdateStatus('已是最新版本');
      }
    } catch (e) {
      setUpdateStatus('检查更新失败');
      console.error('Update error:', e);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3 className="settings-title">设置</h3>
          <button className="settings-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          <label className="settings-label">
            <span>显示菜单栏图标</span>
            <input
              type="checkbox"
              checked={settings.show_tray_icon}
              onChange={(e) => updateSettings({ ...settings, show_tray_icon: e.target.checked })}
              className="settings-checkbox"
            />
          </label>

          <label className="settings-label">
            <span>开机自启动</span>
            <input
              type="checkbox"
              checked={settings.auto_start}
              onChange={(e) => updateSettings({ ...settings, auto_start: e.target.checked })}
              className="settings-checkbox"
            />
          </label>

          <label className="settings-label">
            <span>主题</span>
          </label>
          <div className="settings-theme-group">
            {THEMES.map((t) => (
              <button
                key={t}
                className={'settings-theme-btn' + (settings.theme === t ? ' active' : '')}
                onClick={() => updateSettings({ ...settings, theme: t })}
              >
                {t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
              </button>
            ))}
          </div>

          <hr className="settings-divider" />

          <label className="settings-label">
            <span>版本 {import.meta.env.VITE_APP_VERSION || '0.1.0'}</span>
            <button className="settings-update-btn" onClick={checkForUpdates}>
              检查更新
            </button>
          </label>

          {updateStatus && (
            <span className="settings-update-status">{updateStatus}</span>
          )}
        </div>
      </div>
    </div>
  );
}
