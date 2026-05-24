import { useState, useRef, useEffect } from 'react';
import type { NoteTab } from '../types';

interface TabBarProps {
  tabs: NoteTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onRemoveTab: (id: string) => void;
  onRenameTab: (id: string, name: string) => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRemoveTab,
  onRenameTab,
}: TabBarProps) {
  return (
    <div className="tab-container">
      <div className="tab-list">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => onSelectTab(tab.id)}
            onRemove={() => onRemoveTab(tab.id)}
            onRename={(name) => onRenameTab(tab.id, name)}
            canRemove={tabs.length > 1}
          />
        ))}
      </div>
      <button onClick={onAddTab} className="tab-add-btn" title="新建便签">+</button>
    </div>
  );
}

function TabItem({
  tab,
  isActive,
  onSelect,
  onRemove,
  onRename,
  canRemove,
}: {
  tab: NoteTab;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  canRemove: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = tab.name || '未命名';

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = () => {
    setEditValue(tab.name || '');
    setEditing(true);
  };

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    onRename(trimmed || '未命名');
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div
      className={'tab-item' + (isActive ? ' active' : '')}
      onClick={onSelect}
      onDoubleClick={startEditing}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, 30))}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="tab-edit-input"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="tab-label">{displayName}</span>
      )}
      {isActive && !editing && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); startEditing(); }}
          className="tab-edit-btn"
          title="重命名"
        >
          ✎
        </button>
      )}
      {isActive && canRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="tab-close-btn"
          title="删除便签"
        >
          ×
        </button>
      )}
    </div>
  );
}
