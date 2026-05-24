import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
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

  // Entry/exit animation (macOS-style spring)
  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    const setup = async () => {
      const u1 = await listen('panel-shown', () => {
        const el = appRef.current;
        if (!el) return;
        // Immediately set initial state to prevent flash
        el.style.opacity = '0';
        el.style.transform = 'translateY(-12px) scale(0.96)';
        void el.offsetHeight;
        // Spring-bounce entry: drop down with overshoot, settle
        const anim = el.animate([
          { opacity: 0, transform: 'translateY(-12px) scale(0.96)', offset: 0 },
          { opacity: 0.35, transform: 'translateY(-8px) scale(0.972)', offset: 0.12 },
          { opacity: 0.75, transform: 'translateY(-3px) scale(0.988)', offset: 0.25 },
          { opacity: 1, transform: 'translateY(2.5px) scale(1.005)', offset: 0.48 },
          { opacity: 1, transform: 'translateY(-0.8px) scale(0.998)', offset: 0.68 },
          { opacity: 1, transform: 'translateY(0.3px) scale(1.001)', offset: 0.84 },
          { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 },
        ], {
          duration: 420,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'both',
        });
        anim.onfinish = () => {
          el.style.opacity = '';
          el.style.transform = '';
        };
      });
      unlisteners.push(u1);

      const u2 = await listen('panel-hide', async () => {
        const el = appRef.current;
        if (!el) {
          await invoke('hide_panel');
          return;
        }
        const anim = el.animate([
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-8px) scale(0.97)' },
        ], {
          duration: 150,
          easing: 'ease-in',
          fill: 'both',
        });
        await anim.finished;
        el.style.opacity = '';
        el.style.transform = '';
        await invoke('hide_panel');
      });
      unlisteners.push(u2);
    };
    setup();
    return () => { unlisteners.forEach((fn) => fn()); };
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
