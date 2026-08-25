import { describe, expect, it } from 'vitest';
import {
  analyzeSets,
  getDuplicateCount,
  getSetDisplayName,
  formatRegionLabelLines,
  inclusiveIntersectionCount,
  parseIdentifiers,
} from '../src/lib/sets';
import type { SetDefinition } from '../src/types';

function sets(...values: string[][]): SetDefinition[] {
  return values.map((members, index) => ({
    id: String(index),
    name: String.fromCharCode(65 + index),
    color: '#000000',
    text: members.join('\n'),
  }));
}

describe('set parsing', () => {
  it('trims values, removes empty lines and keeps first occurrence order', () => {
    expect(parseIdentifiers(' TP53\n\nEGFR\nTP53\n BRCA1 ')).toEqual(['TP53', 'EGFR', 'BRCA1']);
  });

  it('is case-sensitive and reports within-set duplicates', () => {
    expect(parseIdentifiers('GeneA\ngenea')).toEqual(['GeneA', 'genea']);
    expect(getDuplicateCount('TP53\nTP53\nEGFR\nEGFR')).toBe(2);
  });

  it('keeps duplicate statistics with the analyzed set result', () => {
    const analysis = analyzeSets(sets(['TP53', 'TP53', 'EGFR'], ['EGFR']));
    expect(analysis.duplicateCounts).toEqual([1, 0]);
  });
});

describe('region label formatting', () => {
  it('supports count, union percentage, both and hidden modes without ambiguous toggles', () => {
    expect(formatRegionLabelLines(8, 0.089, 'count')).toEqual(['8']);
    expect(formatRegionLabelLines(8, 0.089, 'percentage')).toEqual(['9%']);
    expect(formatRegionLabelLines(8, 0.089, 'both')).toEqual(['8', '9%']);
    expect(formatRegionLabelLines(8, 0.089, 'none')).toEqual([]);
  });
});

describe('set display names', () => {
  it('uses the group name without an A/B/C prefix', () => {
    expect(getSetDisplayName({ id: 'a', name: '  Control  ', color: '#000', text: '' }, 0)).toBe(
      'Control',
    );
  });

  it('falls back to the set letter only when the group name is blank', () => {
    expect(getSetDisplayName({ id: 'b', name: '   ', color: '#000', text: '' }, 1)).toBe('B');
  });
});

describe('exact intersections', () => {
  const analysis = analyzeSets(
    sets(['A-only', 'AB', 'ABC'], ['B-only', 'AB', 'ABC'], ['C-only', 'ABC']),
  );

  it('assigns each identifier to one exact membership mask', () => {
    expect(analysis.regionByMask.get(1)?.members).toEqual(['A-only']);
    expect(analysis.regionByMask.get(3)?.members).toEqual(['AB']);
    expect(analysis.regionByMask.get(7)?.members).toEqual(['ABC']);
  });

  it('stores only membership combinations that actually occur', () => {
    const eightSets = sets(
      ['all-eight', 'first-only'],
      ['all-eight', 'pair-2-7'],
      ['all-eight'],
      ['all-eight'],
      ['all-eight'],
      ['all-eight'],
      ['all-eight', 'pair-2-7'],
      ['all-eight'],
    );
    const sparse = analyzeSets(eightSets);

    expect(sparse.regions.map((region) => region.mask)).toEqual([1, 66, 255]);
    expect(sparse.regions).toHaveLength(3);
    expect(sparse.regionByMask.has(3)).toBe(false);
  });

  it('computes union denominator and exact percentages', () => {
    expect(analysis.unionCount).toBe(5);
    expect(analysis.regionByMask.get(7)?.percentage).toBeCloseTo(0.2);
  });

  it('computes inclusive sizes for Euler layout independently of exact regions', () => {
    expect(inclusiveIntersectionCount(1, analysis)).toBe(3);
    expect(inclusiveIntersectionCount(3, analysis)).toBe(2);
    expect(inclusiveIntersectionCount(7, analysis)).toBe(1);
  });

  it('handles fully empty sets without invalid percentages', () => {
    const empty = analyzeSets(sets([], []));
    expect(empty.unionCount).toBe(0);
    expect(empty.regions).toEqual([]);
  });

  it('places members from identical sets entirely in their shared region', () => {
    const identical = analyzeSets(sets(['TP53', 'EGFR'], ['TP53', 'EGFR']));
    expect(identical.regionByMask.has(1)).toBe(false);
    expect(identical.regionByMask.has(2)).toBe(false);
    expect(identical.regionByMask.get(3)?.members).toEqual(['EGFR', 'TP53']);
  });

  it('keeps disjoint and contained sets in the correct exact regions', () => {
    const disjoint = analyzeSets(sets(['A-only'], ['B-only']));
    expect(disjoint.regionByMask.get(1)?.members).toEqual(['A-only']);
    expect(disjoint.regionByMask.get(2)?.members).toEqual(['B-only']);
    expect(disjoint.regionByMask.has(3)).toBe(false);

    const contained = analyzeSets(sets(['shared', 'outer-only'], ['shared']));
    expect(contained.regionByMask.get(1)?.members).toEqual(['outer-only']);
    expect(contained.regionByMask.get(3)?.members).toEqual(['shared']);
  });

  it('preserves Chinese and Unicode identifiers while removing exact duplicates', () => {
    const unicode = analyzeSets(sets(['基因甲', 'β-catenin', '基因甲'], ['β-catenin', '🧬-marker']));
    expect(unicode.unionMembers).toEqual(['🧬-marker', 'β-catenin', '基因甲']);
    expect(unicode.regionByMask.get(1)?.members).toEqual(['基因甲']);
    expect(unicode.regionByMask.get(2)?.members).toEqual(['🧬-marker']);
    expect(unicode.regionByMask.get(3)?.members).toEqual(['β-catenin']);
  });
});
