import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormatToolbar from './FormatToolbar';

describe('FormatToolbar', () => {
  it('renders all format buttons without crashing', () => {
    render(<FormatToolbar />);
    const buttons = [
      '粗体', '斜体', '删除线', '行内代码',
      '标题 1', '标题 2', '标题 3', '引用',
      '无序列表', '有序列表', '任务列表',
    ];
    for (const title of buttons) {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    }
  });

  it('renders dividers between groups', () => {
    const { container } = render(<FormatToolbar />);
    const dividers = container.querySelectorAll('.format-divider');
    expect(dividers).toHaveLength(2);
  });

  it('renders button symbols correctly', () => {
    render(<FormatToolbar />);
    expect(screen.getByText('≡')).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('☐')).toBeInTheDocument();
  });
});
