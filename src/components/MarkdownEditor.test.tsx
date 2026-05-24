import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownEditor, { getActiveEditor } from './MarkdownEditor';

describe('MarkdownEditor selection behavior', () => {
  it('clears text selection on Escape key', () => {
    const onTextChange = vi.fn();
    render(
      <MarkdownEditor
        tabId="test-1"
        initialText="Hello World, this is a test"
        onTextChange={onTextChange}
      />
    );
    const editor = getActiveEditor()!;
    expect(editor).toBeTruthy();
    expect(editor.state.selection.empty).toBe(true);

    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(editor.state.selection.empty).toBe(false);
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);

    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      })
    );

    expect(editor.state.selection.empty).toBe(true);
  });

  it('does not affect empty selection on Escape', () => {
    const onTextChange = vi.fn();
    render(
      <MarkdownEditor
        tabId="test-2"
        initialText="Hello World"
        onTextChange={onTextChange}
      />
    );
    const editor = getActiveEditor()!;

    expect(editor.state.selection.empty).toBe(true);

    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(editor.state.selection.empty).toBe(true);
  });

  it('clears selection when cursor moves to a new position (click behavior)', () => {
    const onTextChange = vi.fn();
    render(
      <MarkdownEditor
        tabId="test-3"
        initialText="Hello World"
        onTextChange={onTextChange}
      />
    );
    const editor = getActiveEditor()!;

    editor.commands.setTextSelection({ from: 7, to: 12 });
    expect(editor.state.selection.empty).toBe(false);

    editor.commands.setTextSelection(1);

    expect(editor.state.selection.empty).toBe(true);
  });

  it('getActiveEditor returns editor after mount and null after unmount', () => {
    expect(getActiveEditor()).toBeNull();

    const { unmount } = render(
      <MarkdownEditor
        tabId="test-4"
        initialText="Hello"
        onTextChange={vi.fn()}
      />
    );
    expect(getActiveEditor()).not.toBeNull();

    unmount();
    expect(getActiveEditor()).toBeNull();
  });

  describe('task list: toggle + type preserves structure', () => {
    it('toggleTaskList on empty doc, then typing preserves task item', () => {
      render(<MarkdownEditor tabId="tl1" initialText="" onTextChange={vi.fn()} />);
      const editor = getActiveEditor()!;
      editor.commands.toggleTaskList();
      editor.commands.insertContent('My task');
      expect(editor.getHTML()).toContain('data-type="taskItem"');
      expect(editor.getHTML()).toContain('My task');
    });

    it('toggleTaskList on new paragraph after Enter preserves task item when typing', () => {
      render(<MarkdownEditor tabId="tl2" initialText="Hello" onTextChange={vi.fn()} />);
      const editor = getActiveEditor()!;
      editor.commands.setTextSelection(6);
      editor.commands.splitBlock();
      editor.commands.toggleTaskList();
      editor.commands.insertContent('Todo item');

      const html = editor.getHTML();
      expect(html).toContain('data-type="taskItem"');
      expect(html).toContain('Todo item');
    });

    it('toggleTaskList + typing preserves state (not toggled off)', () => {
      render(<MarkdownEditor tabId="tl3" initialText="" onTextChange={vi.fn()} />);
      const editor = getActiveEditor()!;
      editor.commands.toggleTaskList();
      editor.commands.insertContent('Some text');
      // toggleTaskList again should REMOVE it
      editor.commands.toggleTaskList();

      const md = (editor.storage as any).markdown.getMarkdown() as string;
      // After toggling off, there should be no - [ ] in the output
      expect(md).not.toContain('- [ ]');
      // Text should still be there (as plain paragraph)
      expect(md).toContain('Some text');
    });

    it('getMarkdown preserves task list in mixed content (paragraph + task)', () => {
      render(<MarkdownEditor tabId="tl4" initialText="Hello" onTextChange={vi.fn()} />);
      const editor = getActiveEditor()!;
      editor.commands.setTextSelection(6);
      editor.commands.splitBlock();
      editor.commands.toggleTaskList();
      editor.commands.insertContent('Todo');

      const md = (editor.storage as any).markdown.getMarkdown() as string;
      expect(md).toContain('- [ ]');
      expect(md).toContain('Todo');
    });

    it('round-trip: task list markdown parses and re-serializes correctly', () => {
      render(<MarkdownEditor tabId="tl5" initialText="- [ ] Saved task" onTextChange={vi.fn()} />);
      const editor = getActiveEditor()!;
      const md = (editor.storage as any).markdown.getMarkdown() as string;
      expect(md).toContain('- [ ]');
      expect(md).toContain('Saved task');
    });
  });
});
