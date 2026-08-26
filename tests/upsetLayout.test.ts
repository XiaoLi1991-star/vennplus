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
  it('adapts the plot width to the number of observed intersections', () => {
    const threeSetLayout = createUpSetLayout(['Control', 'Treatment A', 'Treatment B'], 7);
    const layout = createUpSetLayout(['Control', 'Treatment A'], 20);

    expect(threeSetLayout.plotWidth).toBe(252);
    expect(threeSetLayout.columnStep).toBe(36);
    expect(threeSetLayout.width).toBeLessThan(layout.width);
    expect(layout.plotWidth).toBe(600);
    expect(layout.isDense).toBe(false);
    expect(layout.minViewportWidth).toBeUndefined();
  });

  it('lets the user tighten or loosen intersection columns without changing the label lane', () => {
    const compact = createUpSetLayout(['Control', 'Treatment A', 'Treatment B'], 7, [], {
      labelScale: 1,
      valueScale: 1,
      columnScale: 0.75,
    });
    const spacious = createUpSetLayout(['Control', 'Treatment A', 'Treatment B'], 7, [], {
      labelScale: 1,
      valueScale: 1,
      columnScale: 1.5,
    });

    expect(compact.plotLeft).toBe(spacious.plotLeft);
    expect(compact.columnStep).toBe(27);
    expect(spacious.columnStep).toBe(54);
    expect(spacious.plotWidth).toBe(compact.plotWidth * 2);
  });

  it('adjusts row spacing by changing matrix and canvas height without moving the bar chart', () => {
    const compact = createUpSetLayout(['Control', 'Treatment A', 'Treatment B'], 7, [], {
      labelScale: 1,
      valueScale: 1,
      rowScale: 0.75,
    });
    const spacious = createUpSetLayout(['Control', 'Treatment A', 'Treatment B'], 7, [], {
      labelScale: 1,
      valueScale: 1,
      rowScale: 1.5,
    });

    expect(compact.matrixTop).toBe(spacious.matrixTop);
    expect(compact.rowStep).toBe(21);
    expect(spacious.rowStep).toBe(42);
    expect(compact.matrixBottom).toBe(282);
    expect(spacious.matrixBottom).toBe(324);
    expect(compact.height).toBe(352);
    expect(spacious.height).toBe(394);
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

    expect(layout.plotWidth).toBe(600);
    expect(layout.isDense).toBe(true);
    expect(layout.minViewportWidth).toBeGreaterThan(800);
  });

  it('gives dense Top 50 plots a minimum column spacing and horizontal viewport', () => {
    const layout = createUpSetLayout(['Control', 'Treatment A'], 50);

    expect(layout.columnStep).toBeGreaterThanOrEqual(22);
    expect(layout.plotWidth).toBe(1100);
    expect(layout.isDense).toBe(true);
    expect(layout.minViewportWidth).toBeGreaterThan(UPSET_BASE_WIDTH);
  });
});
