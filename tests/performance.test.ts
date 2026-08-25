import { describe, expect, it } from 'vitest';
import { LARGE_ANALYSIS_CHARACTER_THRESHOLD, shouldAnalyzeInWorker } from '../src/hooks/useSetAnalysis';
import type { SetDefinition } from '../src/types';

function set(text: string): SetDefinition {
  return { id: 'set-1', name: 'Large set', color: '#5275a4', text };
}

describe('large-input analysis routing', () => {
  it('keeps small inputs synchronous and sends large inputs to the worker', () => {
    expect(shouldAnalyzeInWorker([set('TP53\nEGFR')])).toBe(false);
    expect(shouldAnalyzeInWorker([set('A'.repeat(LARGE_ANALYSIS_CHARACTER_THRESHOLD))])).toBe(true);
  });
});
