import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from './SettingsPanel';
import { useNoteStore } from '../hooks/useNoteStore';
// check is already mocked via src/test/setup.ts

const defaultSettings = { show_tray_icon: true, auto_start: false, theme: 'system' };

describe('SettingsPanel', () => {
  beforeEach(() => {
    useNoteStore.setState({
      tabs: [],
      activeTabId: null,
      settings: { ...defaultSettings },
      isLoading: false,
    });
  });

  it('renders all setting controls', () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    expect(screen.getByText('显示菜单栏图标')).toBeInTheDocument();
    expect(screen.getByText('开机自启动')).toBeInTheDocument();
    expect(screen.getByText('主题')).toBeInTheDocument();
    expect(screen.getByText('跟随系统')).toBeInTheDocument();
    expect(screen.getByText('浅色')).toBeInTheDocument();
    expect(screen.getByText('深色')).toBeInTheDocument();
    expect(screen.getByText('检查更新')).toBeInTheDocument();
  });

  it('shows correct theme as active', () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    expect(screen.getByText('跟随系统')).toHaveClass('active');
    expect(screen.getByText('浅色')).not.toHaveClass('active');
    expect(screen.getByText('深色')).not.toHaveClass('active');
  });

  it('toggles show_tray_icon checkbox', async () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const checkbox = screen.getByLabelText('显示菜单栏图标') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(useNoteStore.getState().settings.show_tray_icon).toBe(false);
    });
  });

  it('toggles auto_start checkbox', async () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const checkbox = screen.getByLabelText('开机自启动') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(useNoteStore.getState().settings.auto_start).toBe(true);
    });
  });

  it('changes theme on button click', async () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByText('深色'));

    await waitFor(() => {
      expect(useNoteStore.getState().settings.theme).toBe('dark');
    });
    expect(screen.getByText('深色')).toHaveClass('active');
    expect(screen.getByText('跟随系统')).not.toHaveClass('active');
  });

  it('closes when clicking overlay', async () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    await userEvent.click(screen.getByText('设置').closest('.settings-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside panel', async () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    await userEvent.click(screen.getByText('主题'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows update status after check', async () => {
    const { check } = await import('@tauri-apps/plugin-updater');
    (check as any).mockResolvedValue(null);

    render(<SettingsPanel onClose={vi.fn()} />);
    await userEvent.click(screen.getByText('检查更新'));
    await waitFor(() => {
      expect(screen.getByText('已是最新版本')).toBeInTheDocument();
    });
  });
});
