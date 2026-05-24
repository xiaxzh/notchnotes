import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useNoteStore } from './hooks/useNoteStore';
import { useTauriEvents } from './hooks/useTauriEvents';
import TabBar from './components/TabBar';
import MarkdownEditor from './components/MarkdownEditor';
import FormatToolbar from './components/FormatToolbar';
import SettingsPanel from './components/SettingsPanel';
import './App.css';

function useTheme() {
  const { settings } = useNoteStore();

  useEffect(() => {
    const apply = (theme: string) => {
      if (theme === 'system') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    };

    apply(settings.theme);

    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.theme]);
}

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const { tabs, activeTabId, isLoading, load, addTab, removeTab, renameTab, updateText, selectTab } = useNoteStore();
  const appRef = useRef<HTMLDivElement>(null);

  useTheme();
  useTauriEvents();

  // Play slide-in animation when panel is shown
  useEffect(() => {
    const unlisten = listen('panel-shown', () => {
      const el = appRef.current;
      if (el) {
        el.animate([
          { opacity: 0, transform: 'translateY(-20px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], {
          duration: 250,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'both',
        });
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="app" ref={appRef}>
      <div className="app-header">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={selectTab}
          onAddTab={addTab}
          onRemoveTab={removeTab}
          onRenameTab={renameTab}
        />
        <button className="settings-button" onClick={() => setShowSettings(!showSettings)} title="设置">
          ⚙
        </button>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <FormatToolbar />
      <div className="editor-container">
        {activeTab ? (
          <MarkdownEditor
            key={activeTab.id}
            tabId={activeTab.id}
            initialText={activeTab.text}
            onTextChange={(text) => updateText(activeTab.id, text)}
          />
        ) : (
          <div className="empty-state">
            <p>未选择便签</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
