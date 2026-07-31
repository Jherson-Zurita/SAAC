import { useCallback, useEffect, useRef } from 'react';
import { useDesignStore } from '../stores/useDesignStore';

const DEFAULT_AUTOSAVE_DELAY_MS = 800;

export interface UseDesignAutosaveOptions {
  projectPath: string | null;
  enabled?: boolean;
  delayMs?: number;
}

export function useDesignAutosave({
  projectPath,
  enabled = true,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
}: UseDesignAutosaveOptions) {
  const designId = useDesignStore((state) => state.currentDesign?.id ?? null);
  const isDirty = useDesignStore((state) => state.isDirty);
  const saveStatus = useDesignStore((state) => state.saveStatus);
  const save = useDesignStore((state) => state.save);
  const timerRef = useRef<number | null>(null);

  const cancelPendingSave = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const saveNow = useCallback(async () => {
    cancelPendingSave();
    if (!projectPath || !designId) return null;
    return await save(projectPath);
  }, [cancelPendingSave, designId, projectPath, save]);

  useEffect(() => {
    cancelPendingSave();

    if (
      !enabled ||
      !projectPath ||
      !designId ||
      !isDirty ||
      saveStatus === 'saving' ||
      saveStatus === 'error'
    ) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void save(projectPath).catch(() => undefined);
    }, Math.max(0, delayMs));

    return cancelPendingSave;
  }, [
    cancelPendingSave,
    delayMs,
    designId,
    enabled,
    isDirty,
    projectPath,
    save,
    saveStatus,
  ]);

  return {
    saveNow,
    cancelPendingSave,
  };
}
