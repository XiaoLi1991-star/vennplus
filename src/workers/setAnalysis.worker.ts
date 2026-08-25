import { analyzeSets } from '../lib/sets';
import type { SetDefinition } from '../types';

interface AnalyzeRequest {
  requestId: number;
  sets: SetDefinition[];
}

self.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const { requestId, sets } = event.data;
  const analysis = analyzeSets(sets);
  self.postMessage({ requestId, analysis });
};

export {};
