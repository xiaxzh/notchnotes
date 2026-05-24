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
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep active tab visible
  const activeIndex = tabs.findIndex((t) => t.id === activeTabId);
  useEffect(() => {
    if (listRef.current && activeIndex >= 0) {
      const child = listRef.current.children[activeIndex] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="tab-container">
      <div className="tab-list" ref={listRef}>
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
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const displayName = tab.name || '未命名';

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
    setEditValue(tab.name || '');
    setEditing(true);
    setError(false);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const trimmed = editValue.trim();
    try {
      await onRename(trimmed || '未命名');
      setEditing(false);
      setError(false);
    } catch {
      setError(true);
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = window.setTimeout(() => {
        setEditing(false);
        setError(false);
        submittingRef.current = false;
      }, 1500);
      return;
    }
    submittingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setEditing(false); setError(false); }
  };

  return (
      <div
      className={'tab-item' + (isActive ? ' active' : '')}
      onClick={onSelect}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, 30))}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className={'tab-edit-input' + (error ? ' error' : '')}
          onClick={(e) => e.stopPropagation()}
          title={error ? '同名便签已存在' : undefined}
        />
      ) : (
        <>
          <span className="tab-label">{displayName}</span>
          {isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); startEditing(); }}
              className="tab-edit-btn"
              title="重命名"
            >✎</button>
          )}
        </>
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
