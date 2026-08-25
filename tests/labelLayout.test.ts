import { describe, expect, it } from 'vitest';
import { getVennTemplate } from '../src/lib/geometry';
import {
  clampSetLabelPosition,
  createAdaptiveSetLabelLayout,
  estimateSvgTextWidth,
  selectNonOverlappingLabelKeys,
} from '../src/lib/labelLayout';

describe('adaptive set label layout', () => {
  it('estimates CJK and long names more widely than short ASCII names', () => {
    expect(estimateSvgTextWidth('非常长的实验处理组名称', 12)).toBeGreaterThan(
      estimateSvgTextWidth('Control', 12),
    );
  });

  it('moves long paired labels outward and expands the canvas instead of overlapping inward', () => {
    const template = getVennTemplate(4);
    const short = createAdaptiveSetLabelLayout(
      template.setLabels,
      ['Control', 'Treat A', 'Treat B', 'Validation'],
      0.15,
      template.viewBox,
    );
    const long = createAdaptiveSetLabelLayout(
      template.setLabels,
      [
        'Discovery cohort with long name',
        'Neoadjuvant treatment cohort',
        'Post-treatment validation cohort',
        'External independent validation',
      ],
      0.15,
      template.viewBox,
    );

    expect(long.labels[0].x).toBeLessThan(short.labels[0].x);
    expect(long.labels[1].x).toBeLessThan(short.labels[1].x);
    expect(long.labels[2].x).toBeGreaterThan(short.labels[2].x);
    expect(long.labels[3].x).toBeGreaterThan(short.labels[3].x);
    expect(long.viewBox[0]).toBeLessThan(short.viewBox[0]);
    expect(long.viewBox[2]).toBeGreaterThan(short.viewBox[2]);
  });

  it('separates neighbouring group names after a large font increase', () => {
    const template = getVennTemplate(4);
    const fontSize = 0.15 * 1.8;
    const result = createAdaptiveSetLabelLayout(
      template.setLabels,
      ['Control', 'Treatment A', 'Treatment B', 'Validation'],
      fontSize,
      template.viewBox,
    );
    const left = result.labels[1];
    const right = result.labels[2];
    const visibleGap =
      right.x - right.estimatedWidth / 2 - (left.x + left.estimatedWidth / 2);

    expect(visibleGap).toBeGreaterThanOrEqual(fontSize * 0.7);
  });

  it('keeps manually moved labels inside the export viewBox', () => {
    const viewBox: [number, number, number, number] = [-2, -2, 4, 4];
    const clamped = clampSetLabelPosition({ x: 99, y: -99 }, 1.2, 0.15, viewBox);
    expect(clamped.x).toBeLessThan(2);
    expect(clamped.y).toBeGreaterThan(-2);
  });
});

describe('collision-aware scientific labels', () => {
  it('keeps the higher-priority label when boxes overlap', () => {
    const selected = selectNonOverlappingLabelKeys([
      { key: 1, x: 0, y: 0, width: 10, height: 10, priority: 1 },
      { key: 2, x: 2, y: 1, width: 10, height: 10, priority: 10 },
      { key: 3, x: 30, y: 30, width: 8, height: 8, priority: 2 },
    ]);
    expect([...selected].sort((a, b) => a - b)).toEqual([2, 3]);
  });
});
