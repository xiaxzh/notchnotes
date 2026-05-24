import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export function useTauriEvents() {
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const unlisten = await listen('panel-expand', () => {
        console.log('panel expand event received');
      });
      unlisteners.push(unlisten);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
