import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeSets } from '../lib/sets';
import type { SetAnalysis, SetDefinition } from '../types';

export const LARGE_ANALYSIS_CHARACTER_THRESHOLD = 60_000;
const WORKER_DEBOUNCE_MS = 280;

interface WorkerResponse {
  requestId: number;
  analysis: SetAnalysis;
}

function normalizeWorkerAnalysis(analysis: SetAnalysis): SetAnalysis {
  return {
    ...analysis,
    regionByMask:
      analysis.regionByMask instanceof Map
        ? analysis.regionByMask
        : new Map(analysis.regions.map((region) => [region.mask, region])),
  };
}

export function shouldAnalyzeInWorker(sets: SetDefinition[]): boolean {
  return (
    sets.reduce((total, set) => total + set.text.length, 0) >=
    LARGE_ANALYSIS_CHARACTER_THRESHOLD
  );
}

export function useSetAnalysis(sets: SetDefinition[]): {
  analysis: SetAnalysis;
  isAnalyzing: boolean;
} {
  const useWorker = shouldAnalyzeInWorker(sets);
  const synchronousAnalysis = useMemo(
    () => (useWorker ? null : analyzeSets(sets)),
    [sets, useWorker],
  );
  const [workerResult, setWorkerResult] = useState<{ sets: SetDefinition[]; analysis: SetAnalysis } | null>(null);
  const pendingAnalysis = useMemo(() => useWorker ? analyzeSets(sets.map((set) => ({ ...set, text: '' }))) : null, [sets, useWorker]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!useWorker) {
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let worker: Worker | null = null;
    let cancelled = false;

    const runSynchronousFallback = () => {
      window.setTimeout(() => {
        if (cancelled) return;
        const next = analyzeSets(sets);
        setWorkerResult({ sets, analysis: next });
      }, 0);
    };

    const timeout = window.setTimeout(() => {
      if (typeof Worker === 'undefined') {
        runSynchronousFallback();
        return;
      }

      try {
        worker = new Worker(new URL('../workers/setAnalysis.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (cancelled || event.data.requestId !== requestId) return;
          const next = normalizeWorkerAnalysis(event.data.analysis);
          setWorkerResult({ sets, analysis: next });
          worker?.terminate();
          worker = null;
        };
        worker.onerror = () => {
          worker?.terminate();
          worker = null;
          runSynchronousFallback();
        };
        worker.postMessage({ requestId, sets });
      } catch {
        runSynchronousFallback();
      }
    }, WORKER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      worker?.terminate();
    };
  }, [sets, useWorker]);

  return {
    analysis: synchronousAnalysis ?? (workerResult?.sets === sets ? workerResult.analysis : pendingAnalysis!),
    isAnalyzing: useWorker && workerResult?.sets !== sets,
  };
}
