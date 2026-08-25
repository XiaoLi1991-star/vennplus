import { describe, expect, it } from 'vitest';
import { estimateSvgTextWidth } from '../src/lib/labelLayout';
import {
  createUpSetLayout,
  UPSET_BASE_WIDTH,
  UPSET_SET_BAR_WIDTH,
  UPSET_SET_BAR_X,
  UPSET_SET_COUNT_FONT_SIZE,
  UPSET_SET_COUNT_X,
  UPSET_SET_NAME_FONT_SIZE,
} from '../src/lib/upsetLayout';

describe('UpSet adaptive layout', () => {
  it('keeps the standard chart compact for up to 20 intersections', () => {
    const layout = createUpSetLayout(['Control', 'Treatment A'], 20);

    expect(layout.width).toBeGreaterThanOrEqual(UPSET_BASE_WIDTH);
    expect(layout.plotWidth).toBe(618);
    expect(layout.isDense).toBe(false);
    expect(layout.minViewportWidth).toBeUndefined();
  });

  it('reserves a readable gap after the longest set name', () => {
    const longestName = 'Treatment A';
    const layout = createUpSetLayout(['Control', longestName], 20);
    const estimatedRightEdge =
      layout.setNameX + estimateSvgTextWidth(longestName, UPSET_SET_NAME_FONT_SIZE);

    expect(layout.plotLeft - estimatedRightEdge).toBeGreaterThanOrEqual(18);
    expect(layout.setNameGap).toBeGreaterThanOrEqual(18);
  });

  it('keeps set counts clear of both their bars and group names', () => {
    const maxCount = 12_345;
    const layout = createUpSetLayout(['Control', 'Treatment A'], 20, [39, maxCount]);
    const countWidth = estimateSvgTextWidth(String(maxCount), UPSET_SET_COUNT_FONT_SIZE, 0);

    expect(UPSET_SET_COUNT_X - (UPSET_SET_BAR_X + UPSET_SET_BAR_WIDTH)).toBeGreaterThanOrEqual(12);
    expect(layout.setNameX - (UPSET_SET_COUNT_X + countWidth)).toBeGreaterThanOrEqual(12);
  });

  it('expands the label lane for long Chinese group names', () => {
    const shortLayout = createUpSetLayout(['对照组', '处理组'], 20);
    const longLayout = createUpSetLayout(['长期随访验证队列一组', '处理组'], 20);

    expect(longLayout.plotLeft).toBeGreaterThan(shortLayout.plotLeft);
    expect(longLayout.width).toBeGreaterThan(shortLayout.width);
  });

  it('uses a horizontal viewport for long publication-style names at Top 20', () => {
    const layout = createUpSetLayout(
      ['DNA Repair', 'HDR through Homologous Recombination (HRR)'],
      20,
      [346, 69],
      { labelScale: 1.3, valueScale: 1.4 },
    );

    expect(layout.plotWidth).toBe(618);
    expect(layout.isDense).toBe(true);
    expect(layout.minViewportWidth).toBeGreaterThan(UPSET_BASE_WIDTH);
  });

  it('gives dense Top 50 plots a minimum column spacing and horizontal viewport', () => {
    const layout = createUpSetLayout(['Control', 'Treatment A'], 50);

    expect(layout.columnStep).toBeGreaterThanOrEqual(22);
    expect(layout.plotWidth).toBe(1100);
    expect(layout.isDense).toBe(true);
    expect(layout.minViewportWidth).toBeGreaterThan(UPSET_BASE_WIDTH);
  });
});
