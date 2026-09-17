import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EulerChart } from '../src/components/EulerChart';
import { EXAMPLES } from '../src/data/examples';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { analyzeSets } from '../src/lib/sets';
import { serializeFigureSvg } from '../src/lib/download';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import type { SetDefinition } from '../src/types';

const sets: SetDefinition[] = [
  {
    id: 'a',
    name: 'Large',
    color: '#4E79A7',
    text: [
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
      'AB1',
      'AB2',
      'AC1',
      'ABC1',
    ].join('\n'),
  },
  {
    id: 'b',
    name: 'Medium',
    color: '#B08A2E',
    text: ['B1', 'B2', 'AB1', 'AB2', 'BC1', 'ABC1'].join('\n'),
  },
  {
    id: 'c',
    name: 'Small',
    color: '#4D8C6A',
    text: ['C1', 'AC1', 'BC1', 'ABC1'].join('\n'),
  },
];

interface CircleBounds {
  cx: number;
  cy: number;
  radius: number;
}

interface RectangleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function parseTranslation(transform: string | null): { x: number; y: number } {
  const values = transform?.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
  if (!values) throw new Error(`Expected a translate transform, received: ${transform}`);
  return { x: Number(values[1]), y: Number(values[2]) };
}

function distanceFromRectangleToCircle(
  rectangle: RectangleBounds,
  circle: CircleBounds,
): number {
  const nearestX = Math.max(rectangle.left, Math.min(circle.cx, rectangle.right));
  const nearestY = Math.max(rectangle.top, Math.min(circle.cy, rectangle.bottom));
  return Math.hypot(nearestX - circle.cx, nearestY - circle.cy) - circle.radius;
}

function expectDefaultSetLabelsOutsideEveryCircle(container: HTMLElement): void {
  const circles = [...container.querySelectorAll<SVGCircleElement>('.euler-figure circle')].map(
    (circle) => ({
      cx: Number(circle.getAttribute('cx')),
      cy: Number(circle.getAttribute('cy')),
      radius: Number(circle.getAttribute('r')),
    }),
  );
  const labelGroups = [
    ...container.querySelectorAll<SVGGElement>('.euler-set-labels .draggable-set-label'),
  ];

  expect(labelGroups).toHaveLength(circles.length);
  labelGroups.forEach((group) => {
    const translation = parseTranslation(group.getAttribute('transform'));
    const hitBox = group.querySelector<SVGRectElement>('rect');
    if (!hitBox) throw new Error('Expected every set label to include a hit box');
    const rectangle = {
      left: translation.x + Number(hitBox.getAttribute('x')),
      right:
        translation.x +
        Number(hitBox.getAttribute('x')) +
        Number(hitBox.getAttribute('width')),
      top: translation.y + Number(hitBox.getAttribute('y')),
      bottom:
        translation.y +
        Number(hitBox.getAttribute('y')) +
        Number(hitBox.getAttribute('height')),
    };

    circles.forEach((circle) => {
      expect(distanceFromRectangleToCircle(rectangle, circle)).toBeGreaterThanOrEqual(0);
    });
  });
}

function renderEuler(testSets: SetDefinition[], selectedMask: number | null = null) {
  return render(
    <EulerChart
      sets={testSets}
      analysis={analyzeSets(testSets)}
      selectedMask={selectedMask}
      display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
      figureStyle={DEFAULT_FIGURE_STYLE}
      labelPositions={{}}
      onSelectRegion={() => undefined}
      onSetLabelPositionChange={() => undefined}
    />,
  );
}

describe('Euler circle area encoding', () => {
  it('marks the selected exact region and mutes the other interactive labels', () => {
    const { container } = renderEuler(sets, 7);
    const selected = container.querySelector('.euler-region-labels [aria-pressed="true"]');
    const muted = container.querySelector('.euler-region-labels .region-is-muted');

    expect(container.querySelector('[data-selection-veil="true"]')).toBeInTheDocument();
    expect(selected).toHaveClass('region-is-selected');
    expect(muted).toBeInTheDocument();
  });

  it('keeps each rendered circle area proportional to its set size', () => {
    const { container } = renderEuler(sets);

    const radii = [...container.querySelectorAll('.euler-figure circle')].map((circle) =>
      Number(circle.getAttribute('r')),
    );
    expect(radii).toHaveLength(3);

    const relativeAreas = radii.map((radius) => (radius * radius) / (radii[0] * radii[0]));
    expect(relativeAreas[1]).toBeCloseTo(6 / 12, 4);
    expect(relativeAreas[2]).toBeCloseTo(4 / 12, 4);
  });

  it('exposes the full intersection name on every interactive value label', () => {
    const { container } = renderEuler(sets);
    const labels = [...container.querySelectorAll('.euler-region-labels [role="button"]')];

    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.getAttribute('aria-label')).toMatch(/，\d+ 个成员$/);
    });
  });

  it('removes Euler footnotes and side annotations without changing the complete intersection data', () => {
    const example = EXAMPLES.find((item) => item.id === 'four-biomarkers')!;
    const { container } = renderEuler(example.sets.map((set) => ({ ...set })));
    const chart = container.querySelector('.euler-figure');

    expect(chart).toHaveAttribute('data-region-label-count', '13');
    expect(chart).toHaveAttribute('data-spatial-region-label-count', '13');
    expect(chart).toHaveAttribute('data-separate-region-label-count', '0');
    expect(chart).toHaveAttribute('data-omitted-region-label-count', '2');
    expect(container.querySelector('.euler-separate-region-labels')).toBeNull();
    expect(container.querySelector('[data-euler-fit]')).toBeNull();
    expect(container.querySelectorAll('.euler-set-labels [data-set-label-text]')).toHaveLength(4);
    expect(analyzeSets(example.sets).regions).toHaveLength(15);
    expect(analyzeSets(example.sets).regionByMask.get(3)?.count).toBe(3);
    expect(analyzeSets(example.sets).regionByMask.get(12)?.count).toBe(3);
    const { markup } = serializeFigureSvg(chart as SVGSVGElement, DEFAULT_PUBLICATION_SETTINGS);
    expect(markup).not.toContain('Area fit:');
    expect(markup).not.toContain('EXACT INTERSECTIONS');
    expect(markup).not.toContain('euler-separate-region-labels');
  });

  it('offers a dedicated example with visibly unequal Euler circle areas', () => {
    const example = EXAMPLES.find((item) => item.id === 'three-proportional-euler')!;
    const { container } = renderEuler(example.sets.map((set) => ({ ...set })));
    const radii = [...container.querySelectorAll('.euler-figure circle')].map((circle) =>
      Number(circle.getAttribute('r')),
    );

    expect(example.defaultMode).toBe('euler');
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.5);
  });
});

describe('Euler default set label placement', () => {
  ['two-cohorts', 'three-treatments', 'four-biomarkers'].forEach((exampleId) => {
    const example = EXAMPLES.find((item) => item.id === exampleId)!;
    it(`keeps all ${example.sets.length}-set label boxes outside every circle`, () => {
      const { container } = renderEuler(example.sets.map((set) => ({ ...set })));
      expectDefaultSetLabelsOutsideEveryCircle(container);
    });
  });

  it('accounts for long scientific group names before placing labels', () => {
    const longNameSets = EXAMPLES.find((item) => item.id === 'four-biomarkers')!.sets.map((set, index) => ({
      ...set,
      name: [
        'Untreated discovery cohort',
        'Neoadjuvant combination treatment',
        'Post-treatment responder cohort',
        'External independent validation cohort',
      ][index],
    }));
    const { container } = renderEuler(longNameSets);
    expectDefaultSetLabelsOutsideEveryCircle(container);
  });
});
