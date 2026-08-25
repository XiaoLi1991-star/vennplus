import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceState } from '../types';

const HISTORY_LIMIT = 80;
const CONTINUOUS_EDIT_WINDOW_MS = 650;

function cloneWorkspace(state: WorkspaceState): WorkspaceState {
  return structuredClone(state);
}

function historyFingerprint(state: WorkspaceState): string {
  return JSON.stringify({ ...state, selectedMask: 0 });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useWorkspaceHistory({
  state,
  enabled,
  onRestore,
}: {
  state: WorkspaceState;
  enabled: boolean;
  onRestore: (state: WorkspaceState) => void;
}) {
  const pastRef = useRef<WorkspaceState[]>([]);
  const futureRef = useRef<WorkspaceState[]>([]);
  const restoringRef = useRef(false);
  const lastRecordedAtRef = useRef(0);
  const restoreRef = useRef(onRestore);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  restoreRef.current = onRestore;

  const syncAvailability = useCallback(() => {
    setAvailability({
      canUndo: pastRef.current.length > 1,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (pastRef.current.length === 0) {
      pastRef.current = [cloneWorkspace(state)];
      futureRef.current = [];
      lastRecordedAtRef.current = 0;
      syncAvailability();
      return;
    }
    if (restoringRef.current) {
      restoringRef.current = false;
      lastRecordedAtRef.current = 0;
      syncAvailability();
      return;
    }

    const currentFingerprint = historyFingerprint(state);
    const latest = pastRef.current.at(-1);
    if (latest && historyFingerprint(latest) === currentFingerprint) return;

    const now = Date.now();
    const next = cloneWorkspace(state);
    if (
      pastRef.current.length > 1 &&
      now - lastRecordedAtRef.current <= CONTINUOUS_EDIT_WINDOW_MS
    ) {
      pastRef.current[pastRef.current.length - 1] = next;
    } else {
      pastRef.current.push(next);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
    }
    futureRef.current = [];
    lastRecordedAtRef.current = now;
    syncAvailability();
  }, [enabled, state, syncAvailability]);

  const undo = useCallback(() => {
    if (pastRef.current.length <= 1) return;
    const current = pastRef.current.pop();
    const previous = pastRef.current.at(-1);
    if (!current || !previous) return;
    futureRef.current.push(current);
    restoringRef.current = true;
    restoreRef.current(cloneWorkspace(previous));
    syncAvailability();
  }, [syncAvailability]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneWorkspace(next));
    restoringRef.current = true;
    restoreRef.current(cloneWorkspace(next));
    syncAvailability();
  }, [syncAvailability]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled || isEditableTarget(event.target)) return;
      const commandKey = event.metaKey || event.ctrlKey;
      if (!commandKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, redo, undo]);

  return { ...availability, undo, redo };
}
