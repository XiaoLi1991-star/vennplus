import type { LabelPoint } from '../types';

export interface AdaptiveSetLabel extends LabelPoint {
  estimatedWidth: number;
}

export interface AdaptiveSetLabelLayout {
  labels: AdaptiveSetLabel[];
  viewBox: [number, number, number, number];
}

export interface LabelBoxCandidate {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
}

export interface LabelCircle {
  x: number;
  y: number;
  radius: number;
}

export interface CircleRegionAnchor extends LabelPoint {
  clearance: number;
}

export interface AdaptiveSetLabelOptions {
  shiftLongLabelsOutward?: boolean;
}

function characterWidth(character: string): number {
  if (/\s/u.test(character)) return 0.34;
  if (/[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(character)) return 1;
  if (/[MW@#%&]/u.test(character)) return 0.82;
  if (/[ilI1|.,:;!'`]/u.test(character)) return 0.32;
  if (/[-–—·/()[\]]/u.test(character)) return 0.45;
  return 0.61;
}

export function estimateSvgTextWidth(text: string, fontSize: number, minimumEm = 2): number {
  const units = Array.from(text).reduce((total, character) => total + characterWidth(character), 0);
  return Math.max(fontSize * minimumEm, units * fontSize);
}

/**
 * Finds the visually safest point inside every exact membership region formed
 * by a set of circles. A four-circle Euler layout cannot always realize every
 * non-empty data combination; missing masks are intentionally absent from the
 * returned map so the caller can report them without placing a value in the
 * wrong geometric region.
 */
export function findExactCircleRegionAnchors(
  circles: LabelCircle[],
  bounds: [number, number, number, number],
  sampleStep = 3,
): Map<number, CircleRegionAnchor> {
  const [minX, minY, width, height] = bounds;
  const maxX = minX + width;
  const maxY = minY + height;
  const step = Math.max(1, sampleStep);
  const anchors = new Map<number, CircleRegionAnchor>();

  const considerPoint = (x: number, y: number) => {
    let mask = 0;
    let clearance = Number.POSITIVE_INFINITY;
    circles.forEach((circle, index) => {
      const distance = Math.hypot(x - circle.x, y - circle.y);
      if (distance <= circle.radius) mask |= 1 << index;
      clearance = Math.min(clearance, Math.abs(circle.radius - distance));
    });
    if (mask === 0) return;
    const current = anchors.get(mask);
    if (!current || clearance > current.clearance) {
      anchors.set(mask, {
        x: roundCoordinate(x),
        y: roundCoordinate(y),
        clearance: roundCoordinate(clearance),
      });
    }
  };

  circles.forEach((circle) => considerPoint(circle.x, circle.y));
  for (let y = minY + step / 2; y <= maxY; y += step) {
    for (let x = minX + step / 2; x <= maxX; x += step) considerPoint(x, y);
  }

  return anchors;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function createOutsideCircleLabelPoints(
  circles: LabelCircle[],
  texts: string[],
  fontSize: number,
  diagramCenter: LabelPoint,
  gap = fontSize * 0.42,
): LabelPoint[] {
  return circles.map((circle, index) => {
    let dx = circle.x - diagramCenter.x;
    let dy = circle.y - diagramCenter.y;
    let length = Math.hypot(dx, dy);

    if (length < 0.0001) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, circles.length);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      length = 1;
    }

    const unitX = dx / length;
    const unitY = dy / length;
    const estimatedWidth = estimateSvgTextWidth(texts[index] ?? '', fontSize);
    // Match the draggable label hit target so the complete interactive label,
    // not merely its anchor point, stays beyond the circle boundary.
    const halfWidth = estimatedWidth / 2 + fontSize * 0.55;
    const halfHeight = fontSize * 0.9;
    const projectedHalfExtent = Math.abs(unitX) * halfWidth + Math.abs(unitY) * halfHeight;
    const distance = circle.radius + projectedHalfExtent + gap;

    return {
      x: roundCoordinate(circle.x + unitX * distance),
      y: roundCoordinate(circle.y + unitY * distance),
    };
  });
}

export function createAdaptiveSetLabelLayout(
  basePoints: LabelPoint[],
  texts: string[],
  fontSize: number,
  baseViewBox: [number, number, number, number],
  options: AdaptiveSetLabelOptions = {},
): AdaptiveSetLabelLayout {
  const [minX, minY, width, height] = baseViewBox;
  const maxX = minX + width;
  const maxY = minY + height;
  const centerX = minX + width / 2;
  const horizontalThreshold = width * 0.06;
  const nominalWidth = fontSize * 8.5;
  const margin = fontSize * 0.72;

  const labels = basePoints.map((basePoint, index) => {
    const estimatedWidth = estimateSvgTextWidth(texts[index] ?? '', fontSize);
    const extraWidth = options.shiftLongLabelsOutward === false
      ? 0
      : Math.max(0, estimatedWidth - nominalWidth);
    const dx = basePoint.x - centerX;
    const horizontalDirection = Math.abs(dx) <= horizontalThreshold ? 0 : Math.sign(dx);
    return {
      x: roundCoordinate(basePoint.x + horizontalDirection * extraWidth * 0.52),
      y: basePoint.y,
      estimatedWidth,
    };
  });

  // Font scaling and long group names can make neighbouring labels touch even
  // when their original anchors are valid. Separate labels that occupy the
  // same horizontal band, moving the left item left and the right item right.
  // The expanded viewBox below then keeps the complete labels exportable.
  const collisionGap = fontSize * 0.72;
  for (let pass = 0; pass < labels.length; pass += 1) {
    let changed = false;
    for (let firstIndex = 0; firstIndex < labels.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < labels.length; secondIndex += 1) {
        const first = labels[firstIndex];
        const second = labels[secondIndex];
        if (Math.abs(first.y - second.y) > fontSize * 1.6) continue;
        const left = first.x <= second.x ? first : second;
        const right = left === first ? second : first;
        const requiredDistance = left.estimatedWidth / 2 + right.estimatedWidth / 2 + collisionGap;
        const overlap = requiredDistance - (right.x - left.x);
        if (overlap <= 0) continue;
        const shift = overlap / 2;
        left.x -= shift;
        right.x += shift;
        changed = true;
      }
    }
    if (!changed) break;
  }
  labels.forEach((label) => {
    label.x = roundCoordinate(label.x);
  });

  const contentMinX = Math.min(
    minX,
    ...labels.map((label) => label.x - label.estimatedWidth / 2 - margin),
  );
  const contentMaxX = Math.max(
    maxX,
    ...labels.map((label) => label.x + label.estimatedWidth / 2 + margin),
  );
  const contentMinY = Math.min(minY, ...labels.map((label) => label.y - fontSize - margin));
  const contentMaxY = Math.max(maxY, ...labels.map((label) => label.y + fontSize + margin));

  return {
    labels,
    viewBox: [
      roundCoordinate(contentMinX),
      roundCoordinate(contentMinY),
      roundCoordinate(contentMaxX - contentMinX),
      roundCoordinate(contentMaxY - contentMinY),
    ],
  };
}

export function clampSetLabelPosition(
  point: LabelPoint,
  labelWidth: number,
  fontSize: number,
  viewBox: [number, number, number, number],
): LabelPoint {
  const [minX, minY, width, height] = viewBox;
  const margin = fontSize * 0.45;
  const halfWidth = Math.min(labelWidth / 2, Math.max(0, width / 2 - margin));
  const minLabelX = minX + halfWidth + margin;
  const maxLabelX = minX + width - halfWidth - margin;
  const minLabelY = minY + fontSize + margin;
  const maxLabelY = minY + height - fontSize - margin;
  return {
    x: Math.min(maxLabelX, Math.max(minLabelX, point.x)),
    y: Math.min(maxLabelY, Math.max(minLabelY, point.y)),
  };
}

export function selectNonOverlappingLabelKeys(
  candidates: LabelBoxCandidate[],
  padding = 0,
): Set<number> {
  const accepted: LabelBoxCandidate[] = [];
  const ordered = [...candidates].sort(
    (a, b) => b.priority - a.priority || a.key - b.key,
  );

  ordered.forEach((candidate) => {
    const left = candidate.x - candidate.width / 2 - padding;
    const right = candidate.x + candidate.width / 2 + padding;
    const top = candidate.y - candidate.height / 2 - padding;
    const bottom = candidate.y + candidate.height / 2 + padding;
    const overlaps = accepted.some((item) => {
      const itemLeft = item.x - item.width / 2 - padding;
      const itemRight = item.x + item.width / 2 + padding;
      const itemTop = item.y - item.height / 2 - padding;
      const itemBottom = item.y + item.height / 2 + padding;
      return left < itemRight && right > itemLeft && top < itemBottom && bottom > itemTop;
    });
    if (!overlaps) accepted.push(candidate);
  });

  return new Set(accepted.map((candidate) => candidate.key));
}
