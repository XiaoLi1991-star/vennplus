import type { LabelPoint, ShapeGeometry, VennTemplate } from '../types';
import {
  VENN5_REFERENCE_REGION_LABELS,
  VENN5_REFERENCE_SET_LABELS,
  VENN5_REFERENCE_SHAPES,
  VENN5_REFERENCE_VIEW_BOX,
} from '../data/venn5Reference';

const PI = Math.PI;
const CONTOUR_PATH_CACHE = new WeakMap<ShapeGeometry, string>();

function letterMask(value: string): number {
  let mask = 0;
  for (const letter of value) mask |= 1 << (letter.charCodeAt(0) - 65);
  return mask;
}

function point(x: number, y: number): LabelPoint {
  return { x, y };
}

function labels(entries: Array<[string, number, number]>): Map<number, LabelPoint> {
  return new Map(entries.map(([name, x, y]) => [letterMask(name), point(x, y)]));
}

function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry = rx,
  rotation = 0,
): ShapeGeometry {
  return { kind: 'ellipse', cx, cy, rx, ry, rotation };
}

function radialPoints(count: number, radius: number, startAngle = PI / 2): LabelPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: radius * Math.cos(startAngle + (2 * PI * index) / count),
    y: radius * Math.sin(startAngle + (2 * PI * index) / count),
  }));
}

function ringEllipses(
  count: number,
  centerRadius: number,
  ellipseA: number,
  ellipseB: number,
  startAngle: number,
  rotationOffset: number,
): ShapeGeometry[] {
  return Array.from({ length: count }, (_, index) => {
    const theta = startAngle + (2 * PI * index) / count;
    return ellipse(
      centerRadius * Math.cos(theta),
      centerRadius * Math.sin(theta),
      ellipseA,
      ellipseB,
      theta + rotationOffset,
    );
  });
}

const TWO_SET: VennTemplate = {
  viewBox: [-1.9, -1.55, 3.8, 3.1],
  shapes: [ellipse(-2 / 3, 0, 1), ellipse(2 / 3, 0, 1)],
  regionLabels: labels([
    ['A', -0.8, 0],
    ['B', 0.8, 0],
    ['AB', 0, 0],
  ]),
  setLabels: [point(-0.8, -1.15), point(0.8, -1.15)],
};

const triangleY = (Math.sqrt(3) + 2) / 6;
const THREE_SET: VennTemplate = {
  viewBox: [-1.8, -1.85, 3.6, 3.7],
  shapes: [
    ellipse(-2 / 3, triangleY, 1),
    ellipse(2 / 3, triangleY, 1),
    ellipse(0, -triangleY, 1),
  ],
  regionLabels: labels([
    ['A', -0.8, 0.62],
    ['B', 0.8, 0.62],
    ['C', 0, -0.62],
    ['AB', 0, 0.8],
    ['AC', -0.5, 0],
    ['BC', 0.5, 0],
    ['ABC', 0, 0.2],
  ]),
  setLabels: [point(-0.8, 1.78), point(0.8, 1.78), point(0, -1.78)],
};

const FOUR_SET: VennTemplate = {
  // ggplot uses an upward-positive y axis while SVG uses a downward-positive
  // y axis. Reflect the ggvenn template across the x axis so the four petals
  // open upward on screen instead of appearing upside down.
  viewBox: [-2.1, -1.9, 4.2, 4.1],
  shapes: [
    ellipse(-0.7, 0.5, 0.75, 1.5, -PI / 4),
    ellipse(-0.72 + 2 / 3, 1 / 6, 0.75, 1.5, -PI / 4),
    ellipse(0.72 - 2 / 3, 1 / 6, 0.75, 1.5, PI / 4),
    ellipse(0.7, 0.5, 0.75, 1.5, PI / 4),
  ],
  regionLabels: labels([
    ['A', -1.5, 0],
    ['B', -0.6, -0.7],
    ['C', 0.6, -0.7],
    ['D', 1.5, 0],
    ['AB', -0.9, -0.3],
    ['BC', 0, -0.4],
    ['CD', 0.9, -0.3],
    ['AC', -0.8, 0.9],
    ['BD', 0.8, 0.9],
    ['AD', 0, 1.4],
    ['ABC', -0.5, 0.2],
    ['BCD', 0.5, 0.2],
    ['ACD', -0.3, 1.1],
    ['ABD', 0.3, 1.1],
    ['ABCD', 0, 0.7],
  ]),
  setLabels: [point(-1.54, 1.68), point(-0.8, -1.12), point(0.8, -1.12), point(1.54, 1.68)],
};

const FIVE_SET: VennTemplate = {
  // Authoritative five-set layout from Adrian Dusa's R package `venn` 1.13,
  // transformed from its 0..1000 upward-positive plot coordinates into a
  // square, downward-positive SVG coordinate system. See THIRD_PARTY_NOTICES.
  viewBox: VENN5_REFERENCE_VIEW_BOX,
  shapes: VENN5_REFERENCE_SHAPES,
  regionLabels: VENN5_REFERENCE_REGION_LABELS,
  setLabels: VENN5_REFERENCE_SET_LABELS,
};

const SIX_SET: VennTemplate = {
  viewBox: [-3, -3, 6, 6],
  shapes: ringEllipses(6, 1, 1.5, 1, PI / 2 + PI / 12, -PI / 6),
  regionLabels: new Map(),
  setLabels: radialPoints(6, 2.62, PI / 2),
};

const TEMPLATES = new Map<number, VennTemplate>([
  [2, TWO_SET],
  [3, THREE_SET],
  [4, FOUR_SET],
  [5, FIVE_SET],
  [6, SIX_SET],
]);

export function getVennTemplate(setCount: number): VennTemplate {
  return TEMPLATES.get(setCount) ?? THREE_SET;
}

export function isPointInShape(x: number, y: number, shape: ShapeGeometry): boolean {
  if (shape.kind === 'contour') {
    let inside = false;
    for (let current = 0, previous = shape.points.length - 1; current < shape.points.length; previous = current, current += 1) {
      const a = shape.points[current];
      const b = shape.points[previous];
      const crossesRay = a.y > y !== b.y > y;
      if (crossesRay && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  const dx = x - shape.cx;
  const dy = y - shape.cy;
  const cos = Math.cos(-shape.rotation);
  const sin = Math.sin(-shape.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (localX * localX) / (shape.rx * shape.rx) + (localY * localY) / (shape.ry * shape.ry) <= 1;
}

export function pointToMask(x: number, y: number, shapes: ShapeGeometry[]): number {
  return shapes.reduce(
    (mask, shape, index) => (isPointInShape(x, y, shape) ? mask | (1 << index) : mask),
    0,
  );
}

export function ellipseTransform(shape: ShapeGeometry): string | undefined {
  if (shape.kind !== 'ellipse') return undefined;
  if (shape.rotation === 0) return undefined;
  return `rotate(${(shape.rotation * 180) / PI} ${shape.cx} ${shape.cy})`;
}

export function contourPath(shape: ShapeGeometry): string | undefined {
  if (shape.kind !== 'contour' || shape.points.length === 0) return undefined;
  const cached = CONTOUR_PATH_CACHE.get(shape);
  if (cached) return cached;
  const [first, ...rest] = shape.points;
  const coordinate = (value: number) => Number(value.toFixed(4));
  const path = `M ${coordinate(first.x)} ${coordinate(first.y)} ${rest
    .map((item) => `L ${coordinate(item.x)} ${coordinate(item.y)}`)
    .join(' ')} Z`;
  CONTOUR_PATH_CACHE.set(shape, path);
  return path;
}

function distanceToSegment(
  x: number,
  y: number,
  start: LabelPoint,
  end: LabelPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(x - start.x, y - start.y);
  const projection = Math.max(
    0,
    Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(x - (start.x + projection * dx), y - (start.y + projection * dy));
}

function boundaryClearance(x: number, y: number, shape: ShapeGeometry): number {
  if (shape.kind === 'contour') {
    let clearance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < shape.points.length; index += 1) {
      clearance = Math.min(
        clearance,
        distanceToSegment(
          x,
          y,
          shape.points[index],
          shape.points[(index + 1) % shape.points.length],
        ),
      );
    }
    return clearance;
  }

  const dx = x - shape.cx;
  const dy = y - shape.cy;
  const cos = Math.cos(-shape.rotation);
  const sin = Math.sin(-shape.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const normalized = Math.sqrt(
    (localX * localX) / (shape.rx * shape.rx) +
      (localY * localY) / (shape.ry * shape.ry),
  );
  return Math.abs(1 - normalized) * Math.min(shape.rx, shape.ry);
}

export function findLabelPointsBySampling(template: VennTemplate): Map<number, LabelPoint> {
  if (template.regionLabels.size > 0) return template.regionLabels;

  const [minX, minY, width, height] = template.viewBox;
  const candidates = new Map<number, { point: LabelPoint; clearance: number }>();
  const columns = 180;
  const rows = 180;

  for (let row = 0; row < rows; row += 1) {
    const y = minY + ((row + 0.5) / rows) * height;
    for (let column = 0; column < columns; column += 1) {
      const x = minX + ((column + 0.5) / columns) * width;
      const mask = pointToMask(x, y, template.shapes);
      if (mask === 0) continue;

      const clearance = Math.min(
        ...template.shapes.map((shape) => boundaryClearance(x, y, shape)),
      );

      if (clearance > (candidates.get(mask)?.clearance ?? -1)) {
        candidates.set(mask, { point: { x, y }, clearance });
      }
    }
  }

  return new Map(Array.from(candidates, ([mask, candidate]) => [mask, candidate.point]));
}
