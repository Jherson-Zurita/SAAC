import { useEffect } from 'react';
import { useUiStore } from '../stores/useUiStore';
import { useSelectionStore } from '../stores/useSelectionStore';
import { useDiagramStore } from '../stores/useDiagramStore';

interface KeyboardShortcutsOptions {
  onOpenProject?: () => void;
  onAnalyzeProject?: () => void;
  onExportReport?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { toggleLeftbar, toggleRightbar, toggleDownbar } = useUiStore();
  const { clearSelection } = useSelectionStore();
  const { setC4Level } = useDiagramStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMacPlatform = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMacPlatform ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Paleta de comandos y configuración: también desde inputs
      if (modKey && ((key === 'k' && !e.shiftKey) || (key === 'p' && e.shiftKey))) {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setCommandPaletteOpen(!ui.commandPaletteOpen);
        return;
      }
      if (modKey && e.key === ',') {
        e.preventDefault();
        useUiStore.getState().setSettingsOpen(true);
        return;
      }

      // Ignorar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+O: Abrir Proyecto
      if (cmdOrCtrl && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        options.onOpenProject?.();
        return;
      }

      // Ctrl+Shift+A: Analizar Proyecto
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        options.onAnalyzeProject?.();
        return;
      }

      // Ctrl+Shift+E: Exportar informe en Markdown
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        options.onExportReport?.();
        return;
      }

      // Ctrl+B: Toggle Leftbar
      if (cmdOrCtrl && e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault();
        toggleLeftbar();
        return;
      }

      // Ctrl+J o Ctrl+`: Toggle Downbar
      if (cmdOrCtrl && (e.key.toLowerCase() === 'j' || e.key === '`')) {
        e.preventDefault();
        toggleDownbar();
        return;
      }

      // Ctrl+Shift+R: Toggle Rightbar
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        toggleRightbar();
        return;
      }

      // Esc: Limpiar Selección (los modales manejan su propio Esc)
      const ui = useUiStore.getState();
      if (e.key === 'Escape' && !ui.commandPaletteOpen && !ui.settingsOpen) {
        clearSelection();
        return;
      }

      // Alt+1 .. Alt+4: Niveles C4
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setC4Level(1);
        } else if (e.key === '2') {
          e.preventDefault();
          setC4Level(2);
        } else if (e.key === '3') {
          e.preventDefault();
          setC4Level(3);
        } else if (e.key === '4') {
          e.preventDefault();
          setC4Level(4);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [options, toggleLeftbar, toggleRightbar, toggleDownbar, clearSelection, setC4Level]);
}
