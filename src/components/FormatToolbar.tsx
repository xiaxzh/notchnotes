import type { Editor } from '@tiptap/core';
import { getActiveEditor } from './MarkdownEditor';

function focusAtCursor(ed: Editor) {
  return ed.chain().focus().setTextSelection(ed.state.selection.head);
}

export default function FormatToolbar() {
  const bold = () => getActiveEditor()?.chain().focus().toggleBold().run();
  const italic = () => getActiveEditor()?.chain().focus().toggleItalic().run();
  const strike = () => getActiveEditor()?.chain().focus().toggleStrike().run();
  const code = () => getActiveEditor()?.chain().focus().toggleCode().run();
  const h1 = () => getActiveEditor()?.chain().focus().toggleHeading({ level: 1 }).run();
  const h2 = () => getActiveEditor()?.chain().focus().toggleHeading({ level: 2 }).run();
  const h3 = () => getActiveEditor()?.chain().focus().toggleHeading({ level: 3 }).run();
  const quote = () => getActiveEditor()?.chain().focus().toggleBlockquote().run();
  const bulletList = () => { const ed = getActiveEditor(); if (ed) focusAtCursor(ed).toggleBulletList().run(); };
  const orderedList = () => { const ed = getActiveEditor(); if (ed) focusAtCursor(ed).toggleOrderedList().run(); };
  const taskList = () => {
    const ed = getActiveEditor();
    if (ed) (focusAtCursor(ed) as any).toggleTaskList().run();
  };

  return (
    <div className="format-toolbar">
      <button className="format-btn" onClick={bold} title="粗体"><strong>B</strong></button>
      <button className="format-btn" onClick={italic} title="斜体"><em>I</em></button>
      <button className="format-btn" onClick={strike} title="删除线"><span style={{ textDecoration: 'line-through' }}>S</span></button>
      <button className="format-btn" onClick={code} title="行内代码">{'</>'}</button>

      <div className="format-divider" />

      <button className="format-btn" onClick={h1} title="标题 1">H1</button>
      <button className="format-btn" onClick={h2} title="标题 2">H2</button>
      <button className="format-btn" onClick={h3} title="标题 3">H3</button>
      <button className="format-btn" onClick={quote} title="引用">❝</button>

      <div className="format-divider" />

      <button className="format-btn" onClick={bulletList} title="无序列表">≡</button>
      <button className="format-btn" onClick={orderedList} title="有序列表">1.</button>
      <button className="format-btn" onClick={taskList} title="任务列表">☐</button>
    </div>
  );
}
