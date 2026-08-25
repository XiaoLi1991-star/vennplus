import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VennChart } from '../src/components/VennChart';
import { cloneExample, DEFAULT_EXAMPLE, EXAMPLES } from '../src/data/examples';
import {
  DEFAULT_FIGURE_STYLE,
  hasFigureFill,
  resolveFigureStrokeColor,
} from '../src/data/figureStyle';
import { analyzeSets } from '../src/lib/sets';

const sets = cloneExample(DEFAULT_EXAMPLE);
const analysis = analyzeSets(sets);
const display = {
  regionLabelMode: 'count' as const,
  showSetNames: true,
  showEmpty: false,
};

describe('figure paint rules', () => {
  it('uses a custom edge only while a visible fill is active', () => {
    const custom = {
      ...DEFAULT_FIGURE_STYLE,
      fillOpacity: 0.6,
      strokeColorMode: 'custom' as const,
      customStrokeColor: '#334455',
    };
    expect(hasFigureFill(custom)).toBe(true);
    expect(resolveFigureStrokeColor('#abcdef', custom)).toBe('#334455');

    const outline = { ...custom, fillMode: 'outline' as const };
    expect(hasFigureFill(outline)).toBe(false);
    expect(resolveFigureStrokeColor('#abcdef', outline)).toBe('#abcdef');

    const transparent = { ...custom, fillOpacity: 0 };
    expect(hasFigureFill(transparent)).toBe(false);
    expect(resolveFigureStrokeColor('#abcdef', transparent)).toBe('#abcdef');
  });

  it('renders the outline-only mode with palette strokes and configurable typography', () => {
    const { container } = render(
      <VennChart
        sets={sets}
        analysis={analysis}
        display={display}
        figureStyle={{
          ...DEFAULT_FIGURE_STYLE,
          fillMode: 'outline',
          strokeWidth: 2.75,
          setLabelFontScale: 1.2,
          setLabelsBold: false,
          regionLabelFontScale: 1.4,
          regionLabelsBold: true,
          strokeColorMode: 'custom',
          customStrokeColor: '#111111',
        }}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );

    const ellipses = [...container.querySelectorAll('.venn-set-layer ellipse')];
    expect(ellipses).toHaveLength(sets.length);
    ellipses.forEach((ellipse, index) => {
      expect(ellipse).toHaveAttribute('fill', 'none');
      expect(ellipse).toHaveAttribute('stroke', sets[index].color);
      expect(ellipse).toHaveAttribute('stroke-width', '2.75');
    });

    const regionLabel = container.querySelector('.venn-region-label text');
    expect(regionLabel).toHaveAttribute('font-weight', '700');
    expect(Number(regionLabel?.getAttribute('font-size'))).toBeCloseTo(0.182);
    const setLabel = container.querySelector('[data-set-label-text]');
    expect(setLabel).toHaveAttribute('font-weight', '400');
    expect(Number(setLabel?.getAttribute('font-size'))).toBeCloseTo(0.18);
  });

  it('renders filled sets with the selected opacity and custom edge color', () => {
    const { container } = render(
      <VennChart
        sets={sets}
        analysis={analysis}
        display={display}
        figureStyle={{
          ...DEFAULT_FIGURE_STYLE,
          fillOpacity: 0.65,
          strokeColorMode: 'custom',
          customStrokeColor: '#4b5563',
        }}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );

    const ellipses = [...container.querySelectorAll('.venn-set-layer ellipse')];
    ellipses.forEach((ellipse, index) => {
      expect(ellipse).toHaveAttribute('fill', sets[index].color);
      expect(ellipse).toHaveAttribute('fill-opacity', '0.65');
      expect(ellipse).toHaveAttribute('stroke', '#4b5563');
    });
  });

  it('shows group names without redundant A/B/C/D prefixes', () => {
    const { container } = render(
      <VennChart
        sets={sets}
        analysis={analysis}
        display={display}
        figureStyle={DEFAULT_FIGURE_STYLE}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );

    const labels = [...container.querySelectorAll('[data-set-label-text]')].map(
      (label) => label.textContent,
    );
    expect(labels).toEqual(sets.map((set) => set.name));
    expect(labels.join(' ')).not.toMatch(/\b[A-D]\s*[·•]\s*/);
  });

  it('shows every five-set region including zero counts with solid text', () => {
    const fiveSetExample = EXAMPLES.find((example) => example.id === 'five-pathways')!;
    const fiveSets = cloneExample(fiveSetExample);
    const fiveSetAnalysis = analyzeSets(fiveSets);
    const { container } = render(
      <VennChart
        sets={fiveSets}
        analysis={fiveSetAnalysis}
        display={{ ...display, showEmpty: false }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );

    const labels = [...container.querySelectorAll('.venn-region-label text')];
    expect(labels).toHaveLength(31);
    expect(labels.filter((label) => label.textContent === '0')).toHaveLength(10);
    labels.forEach((label) => {
      expect(label).not.toHaveAttribute('stroke');
      expect(label).not.toHaveAttribute('stroke-width');
      expect(label.getAttribute('style') ?? '').not.toContain('paint-order');
    });
  });
});
