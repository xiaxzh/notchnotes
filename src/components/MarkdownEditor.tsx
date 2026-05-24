import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown as MarkdownExtension } from 'tiptap-markdown';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';

let _activeEditor: Editor | null = null;

export function getActiveEditor(): Editor | null {
  return _activeEditor;
}

function setActiveEditor(editor: Editor | null) {
  _activeEditor = editor;
}

const selHighlightKey = new PluginKey('selectionHighlight');

const SelectionHighlight = Extension.create({
  name: 'selectionHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: selHighlightKey,
        state: {
          init() { return DecorationSet.empty; },
          apply(_tr, _set, _oldState, newState) {
            const { from, to } = newState.selection;
            if (from === to) return DecorationSet.empty;

            const decos: Decoration[] = [];
            newState.doc.nodesBetween(from, to, (node, pos) => {
              if (node.isText) {
                const start = Math.max(from, pos);
                const end = Math.min(to, pos + node.nodeSize);
                if (start < end) {
                  decos.push(Decoration.inline(start, end, { class: 'selection-highlight' }));
                }
              }
              return true;
            });
            return DecorationSet.create(newState.doc, decos);
          },
        },
        props: {
          decorations(state) {
            return selHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});

interface MarkdownEditorProps {
  tabId: string;
  initialText: string;
  onTextChange: (text: string) => void;
}

export default function MarkdownEditor({ tabId, initialText, onTextChange }: MarkdownEditorProps) {
  const handleChange = useCallback(
    debounce((text: string) => onTextChange(text), 300),
    [onTextChange]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      SelectionHighlight,
      Extension.create({
        name: 'escapeClearSelection',
        addKeyboardShortcuts() {
          return {
            'Escape': () => {
              const { editor } = this;
              if (!editor.state.selection.empty) {
                editor.commands.setTextSelection(editor.state.selection.head);
                return true;
              }
              return false;
            },
          };
        },
      }),
      Placeholder.configure({ placeholder: '开始写点什么...' }),
      MarkdownExtension.configure({
        html: false,
        linkify: true,
        breaks: true,
      }),
    ],
    content: initialText,
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md: string = (ed.storage as any).markdown.getMarkdown();
      handleChange(md);
    },
  });

  useEffect(() => {
    setActiveEditor(editor);
    return () => setActiveEditor(null);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current: string = (editor.storage as any).markdown.getMarkdown();
    if (current !== initialText) {
      editor.commands.setContent(initialText);
    }
  }, [tabId]);

  return (
    <EditorContent
      editor={editor}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 20px',
        fontSize: 14,
        lineHeight: 1.7,
        color: '#e8e8ed',
      }}
    />
  );
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}
