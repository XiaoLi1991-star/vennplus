import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpSetChart } from '../src/components/UpSetChart';
import { EXAMPLES } from '../src/data/examples';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { analyzeSets } from '../src/lib/sets';

const sets = EXAMPLES.find((example) => example.id === 'six-cohorts')!.sets.map((set) => ({ ...set }));
const analysis = analyzeSets(sets);
const display = {
  regionLabelMode: 'count' as const,
  showSetNames: true,
  showEmpty: false,
};

describe('UpSet chart responsive density', () => {
  it('applies independent label and numeric typography without breaking lane spacing', () => {
    const figureStyle = {
      ...DEFAULT_FIGURE_STYLE,
      upsetLabelFontScale: 1.3,
      upsetLabelsBold: true,
      upsetValueFontScale: 1.2,
      upsetValuesBold: true,
    };
    const { container } = render(
      <UpSetChart
        sets={sets}
        analysis={analysis}
        display={display}
        figureStyle={figureStyle}
        topN={20}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );

    const chart = container.querySelector('svg.upset-figure')!;
    const setName = chart.querySelector<SVGTextElement>('.upset-set-name')!;
    const axisTitle = chart.querySelector<SVGTextElement>('.upset-axis-title')!;
    const setCount = chart.querySelector<SVGTextElement>('.upset-set-count')!;
    const valueLabel = chart.querySelector<SVGTextElement>('.upset-value-label')!;
    const tick = chart.querySelector<SVGTextElement>('.upset-grid text')!;

    expect(setName.style.fontSize).toBe('14.95px');
    expect(axisTitle.style.fontSize).toBe('15.6px');
    expect(setName.style.fontWeight).toBe('700');
    expect(setCount.style.fontSize).toBe('13.2px');
    expect(valueLabel.style.fontSize).toBe('13.2px');
    expect(tick.style.fontSize).toBe('13.2px');
    expect(valueLabel.style.fontWeight).toBe('700');
    expect(Number(chart.getAttribute('data-set-name-gap'))).toBeGreaterThanOrEqual(18);
  });

  it('keeps Top 20 compact and leaves group names clear of the matrix', () => {
    const { container } = render(
      <UpSetChart
        sets={sets}
        analysis={analysis}
        display={display}
        figureStyle={DEFAULT_FIGURE_STYLE}
        topN={20}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );

    const svg = container.querySelector('svg.upset-figure');
    expect(svg).toHaveAttribute('data-upset-scrollable', 'false');
    expect(Number(svg?.getAttribute('data-set-name-gap'))).toBeGreaterThanOrEqual(18);
    expect(svg?.getAttribute('style')).toBeNull();
    expect(container.querySelector('.upset-frozen-lane')).toBeInTheDocument();
    expect(container.querySelector('.upset-frozen-lane')).toHaveAttribute(
      'preserveAspectRatio',
      'none',
    );
    expect(container.querySelector('.upset-scroll-hint')).not.toBeInTheDocument();
    expect(
      [...container.querySelectorAll('.upset-axis-title')].filter(
        (label) => label.textContent === 'Intersection size',
      ),
    ).toHaveLength(1);
    const axes = container.querySelectorAll('svg.upset-figure .upset-axis-line');
    expect(axes).toHaveLength(2);
    expect(container.querySelector('svg.upset-figure [data-axis="x"]')).toHaveAttribute('y1', '190');
    expect(container.querySelector('svg.upset-figure [data-axis="y"]')).toHaveAttribute('x1');
    expect(container.querySelector('.upset-frozen-lane [data-axis="y"]')).toBeInTheDocument();
    container.querySelectorAll<SVGTextElement>('.upset-set-count').forEach((label) => {
      expect(Number(label.getAttribute('x')) - Number(label.dataset.barEnd)).toBeGreaterThanOrEqual(12);
      expect(label).toHaveAttribute('text-anchor', 'start');
    });
    container.querySelectorAll<SVGTextElement>('.upset-value-label').forEach((label) => {
      expect(Number(label.getAttribute('y'))).toBeLessThan(Number(label.dataset.barY));
    });
  });

  it('uses a readable horizontal viewport and keeps short Top 50 counts horizontal', () => {
    const { container } = render(
      <UpSetChart
        sets={sets}
        analysis={analysis}
        display={display}
        figureStyle={DEFAULT_FIGURE_STYLE}
        topN={50}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );

    const svg = container.querySelector('svg.upset-figure');
    const valueLabels = [...container.querySelectorAll('.upset-value-label')];
    expect(svg).toHaveAttribute('data-upset-scrollable', 'true');
    expect(container.querySelector('.upset-chart-shell')).toHaveClass('is-dense');
    expect(container.querySelector('.upset-chart-shell')).toHaveAttribute('data-upset-dense', 'true');
    expect(container.querySelector('.upset-frozen-lane')).toHaveTextContent('Intersection size');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMinYMid meet');
    const viewBox = svg?.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [];
    expect(viewBox[3]).toBe(430);
    expect(viewBox[2] / viewBox[3]).toBeGreaterThan(2);
    expect(Number(svg?.getAttribute('data-column-step'))).toBeGreaterThanOrEqual(22);
    expect(svg?.getAttribute('style')).toMatch(/min-width:\s*\d+px/);
    expect(svg).toHaveAttribute('data-value-label-layout', 'horizontal');
    expect(container.querySelector('.upset-scroll-hint')).toHaveTextContent(
      'Scroll horizontally to explore',
    );
    expect(Number(svg?.getAttribute('data-value-label-gap'))).toBeGreaterThanOrEqual(20);
    expect(valueLabels).toHaveLength(50);
    valueLabels.forEach((label) => {
      expect(label).not.toHaveClass('upset-value-label-dense');
      expect(label.getAttribute('transform')).toBeNull();
      expect(
        Number((label as SVGTextElement).dataset.barY) - Number(label.getAttribute('y')),
      ).toBeGreaterThanOrEqual(20);
    });
  });

  it('angles long dense labels and expands their annotation band', () => {
    const { container } = render(
      <UpSetChart
        sets={sets}
        analysis={analysis}
        display={{ ...display, regionLabelMode: 'both' }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        topN={50}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );

    const svg = container.querySelector('svg.upset-figure');
    const valueLabels = [...container.querySelectorAll('.upset-value-label')];
    expect(svg).toHaveAttribute('data-value-label-layout', 'angled');
    expect(Number(svg?.getAttribute('data-value-label-gap'))).toBeGreaterThanOrEqual(22);
    expect(Number(svg?.getAttribute('data-bar-top'))).toBeGreaterThan(82);
    valueLabels.forEach((label) => {
      expect(label).toHaveClass('upset-value-label-dense');
      expect(label.getAttribute('transform')).toMatch(/^rotate\(-75 /);
    });
  });

  it('renders both values together and can hide values completely', () => {
    const both = render(
      <UpSetChart
        sets={sets}
        analysis={analysis}
        display={{ ...display, regionLabelMode: 'both' }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        topN={20}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );
    const firstLabel = both.container.querySelector('.upset-value-label');
    expect(firstLabel).toHaveTextContent('8');
    expect(firstLabel).toHaveTextContent('9%');
    both.unmount();

    const hidden = render(
      <UpSetChart
        sets={sets}
        analysis={analysis}
        display={{ ...display, regionLabelMode: 'none' }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        topN={20}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );
    expect(hidden.container.querySelectorAll('.upset-value-label')).toHaveLength(0);
  });

  it('renders only membership combinations that actually occur', () => {
    const identicalSets = sets.slice(0, 3).map((set, index) => ({
      ...set,
      id: `identical-${index}`,
      text: 'TP53\nEGFR',
    }));
    const identicalAnalysis = analyzeSets(identicalSets);
    const { container } = render(
      <UpSetChart
        sets={identicalSets}
        analysis={identicalAnalysis}
        display={{ ...display, showEmpty: true }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        topN={10}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );
    expect(container.querySelectorAll('.upset-bars > g')).toHaveLength(1);
    expect(container.querySelector('.upset-note')).toHaveTextContent(
      'Showing 1 of 1 observed intersections',
    );
    expect(container.querySelector('.upset-note')).not.toHaveTextContent('空交集');
  });
});
