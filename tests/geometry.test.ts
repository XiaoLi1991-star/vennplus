import { describe, expect, it } from 'vitest';
import {
  contourPath,
  findLabelPointsBySampling,
  getVennTemplate,
  pointToMask,
} from '../src/lib/geometry';

describe.each([2, 3, 4])('%i-set deterministic Venn geometry', (setCount) => {
  const template = getVennTemplate(setCount);

  it('keeps every exact region label inside its intended fixed-shape region', () => {
    const mismatches = Array.from(template.regionLabels.entries()).filter(
      ([mask, point]) => pointToMask(point.x, point.y, template.shapes) !== mask,
    );
    expect(mismatches).toEqual([]);
  });

  it('contains all non-empty masks exactly once in its label contract', () => {
    expect([...template.regionLabels.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: (1 << setCount) - 1 }, (_, index) => index + 1),
    );
  });

  it('keeps every default set label center outside the diagram shapes', () => {
    expect(
      template.setLabels.map((label) => pointToMask(label.x, label.y, template.shapes)),
    ).toEqual(Array.from({ length: setCount }, () => 0));
  });
});

describe('four-set construction', () => {
  it('uses four equal ellipses rather than four deformed intersection shapes', () => {
    const shapes = getVennTemplate(4).shapes;
    expect(shapes).toHaveLength(4);
    expect(shapes.every((shape) => shape.kind === 'ellipse')).toBe(true);
    expect(
      new Set(
        shapes.map((shape) =>
          shape.kind === 'ellipse' ? `${shape.rx}:${shape.ry}` : 'contour',
        ),
      ),
    ).toEqual(new Set(['0.75:1.5']));
    expect(
      shapes.every((shape) => shape.kind === 'ellipse' && Math.abs(shape.rotation) === Math.PI / 4),
    ).toBe(true);
  });

  it('opens the petal construction upward in SVG coordinates', () => {
    const template = getVennTemplate(4);
    const widthAt = (y: number) => {
      const points = Array.from({ length: 2_001 }, (_, index) => -2 + (4 * index) / 2_000);
      const occupied = points.filter((x) => pointToMask(x, y, template.shapes) !== 0);
      return occupied.at(-1)! - occupied[0];
    };

    // Negative y is visually above positive y in SVG. The upper shoulder must
    // be wider than the lower tip, matching the upright ggvenn flower shape.
    expect(widthAt(-0.4)).toBeGreaterThan(widthAt(1.2));
    expect(
      template.shapes.map((shape) =>
        shape.kind === 'ellipse' ? Math.sign(shape.rotation) : 0,
      ),
    ).toEqual([-1, -1, 1, 1]);
  });

  it('keeps the two upper set labels close to the petal shoulders', () => {
    const upperLabels = getVennTemplate(4).setLabels.slice(1, 3);
    expect(upperLabels.map((label) => label.y)).toEqual([-1.12, -1.12]);
  });
});

describe('five-set venn reference construction', () => {
  it('contains all 31 exact membership regions and samples one valid label point for each', () => {
    const template = getVennTemplate(5);
    const labelPoints = findLabelPointsBySampling(template);
    expect(labelPoints.size).toBe(31);
    expect(
      [...labelPoints].filter(
        ([mask, label]) => pointToMask(label.x, label.y, template.shapes) !== mask,
      ),
    ).toEqual([]);
  });

  it('uses the five authoritative non-elliptical reference contours', () => {
    const template = getVennTemplate(5);
    expect(template.shapes).toHaveLength(5);
    expect(template.shapes.every((shape) => shape.kind === 'contour')).toBe(true);
    expect(
      template.shapes.map((shape) => (shape.kind === 'contour' ? shape.points.length : 0)),
    ).toEqual([215, 216, 218, 219, 210]);
    expect(template.viewBox).toEqual([-4, -4, 8, 8]);
    expect(template.setLabels[0].y).toBeLessThan(0);
    const path = contourPath(template.shapes[0]);
    expect(path).toMatch(/^M [-\d.]+ [-\d.]+ L /);
    expect(path).toMatch(/ Z$/);
    expect(path).not.toMatch(/\.\d{5}/);
  });

  it('preserves the reference set-name and intersection-label coordinates', () => {
    const template = getVennTemplate(5);
    expect(template.setLabels).toEqual([
      { x: -3.36, y: -2.4 },
      { x: 0.28, y: -3.68 },
      { x: 3.2, y: -1.6 },
      { x: 1.6, y: 3.6 },
      { x: -3.04, y: 3.04 },
    ]);
    expect(template.regionLabels.get(1)).toEqual({ x: -2.456, y: -1.424 });
    expect(template.regionLabels.get(31)).toEqual({ x: -0.136, y: 0.056 });
    expect(template.setLabels.map((label) => pointToMask(label.x, label.y, template.shapes))).toEqual(
      [0, 0, 0, 0, 0],
    );
  });

  it('matches the first source contour anchor after exact coordinate conversion', () => {
    const shape = getVennTemplate(5).shapes[0];
    expect(shape.kind).toBe('contour');
    if (shape.kind === 'contour') expect(shape.points[0]).toEqual({ x: -1.2088, y: -2.6448 });
  });
});

describe('compact default set-label placement', () => {
  it('uses close outside positions for two, three and four sets', () => {
    expect(getVennTemplate(2).setLabels).toEqual([
      { x: -0.8, y: -1.15 },
      { x: 0.8, y: -1.15 },
    ]);
    expect(getVennTemplate(3).setLabels).toEqual([
      { x: -0.8, y: 1.78 },
      { x: 0.8, y: 1.78 },
      { x: 0, y: -1.78 },
    ]);
    expect(getVennTemplate(4).setLabels).toEqual([
      { x: -1.54, y: 1.68 },
      { x: -0.8, y: -1.12 },
      { x: 0.8, y: -1.12 },
      { x: 1.54, y: 1.68 },
    ]);
  });
});
