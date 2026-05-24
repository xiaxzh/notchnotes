import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from './TabBar';

const baseTab = { id: '1', name: 'Note 1', text: '', created_at: '', updated_at: '', selection_pos: 0 };
const tab2 = { ...baseTab, id: '2', name: 'Note 2' };

describe('TabBar', () => {
  const defaultProps = { onSelectTab: vi.fn(), onAddTab: vi.fn(), onRemoveTab: vi.fn(), onRenameTab: vi.fn() };

  it('renders all tab labels', () => {
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} />);
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Note 2')).toBeInTheDocument();
  });

  it('shows 未命名 for nameless tabs', () => {
    render(<TabBar tabs={[{ ...baseTab, name: '' }]} activeTabId="1" {...defaultProps} />);
    expect(screen.getByText('未命名')).toBeInTheDocument();
  });

  it('marks active tab with .active class', () => {
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="2" {...defaultProps} />);
    const items = document.querySelectorAll('.tab-item');
    expect(items[0]).not.toHaveClass('active');
    expect(items[1]).toHaveClass('active');
  });

  it('responds to clicks via fireEvent', () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} onSelectTab={onSelect} />);
    fireEvent.click(screen.getByText('Note 2'));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('adds tab on + button click', () => {
    const onAdd = vi.fn();
    render(<TabBar tabs={[baseTab]} activeTabId="1" {...defaultProps} onAddTab={onAdd} />);
    fireEvent.click(screen.getByTitle('新建便签'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('shows close button for active tab when multiple tabs exist', () => {
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} />);
    expect(screen.getByTitle('删除便签')).toBeInTheDocument();
  });

  it('hides close button when only one tab', () => {
    render(<TabBar tabs={[baseTab]} activeTabId="1" {...defaultProps} />);
    expect(screen.queryByTitle('删除便签')).not.toBeInTheDocument();
  });

  it('removes tab on close button click', () => {
    const onRemove = vi.fn();
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} onRemoveTab={onRemove} />);
    fireEvent.click(screen.getByTitle('删除便签'));
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('renames via double-click', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} onRenameTab={onRename} />);

    await user.dblClick(screen.getByText('Note 1'));
    const input = screen.getByDisplayValue('Note 1');
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    expect(onRename).toHaveBeenCalledWith('1', 'Renamed');
  });

  it('submits empty rename as 未命名', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} onRenameTab={onRename} />);

    await user.dblClick(screen.getByText('Note 1'));
    const input = screen.getByDisplayValue('Note 1');
    await user.clear(input);
    await user.keyboard('{Tab}');

    expect(onRename).toHaveBeenCalledWith('1', '未命名');
  });

  it('cancels rename on Escape', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} onRenameTab={onRename} />);

    await user.dblClick(screen.getByText('Note 1'));
    const input = screen.getByDisplayValue('Note 1');
    await user.keyboard('{Escape}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Note 1')).not.toBeInTheDocument();
  });

  it('shows edit button on hover for active tab', () => {
    render(<TabBar tabs={[baseTab, tab2]} activeTabId="1" {...defaultProps} />);
    const tabItem = screen.getByText('Note 1').closest('.tab-item')!;
    expect(screen.queryByTitle('重命名')).not.toBeInTheDocument();

    fireEvent.mouseEnter(tabItem);
    expect(screen.getByTitle('重命名')).toBeInTheDocument();
  });
});
