import type { ICircle } from '@upsetjs/venn.js';
import type { SetAnalysis } from '../types';
import { maskToIndices } from './sets';

/** Integrate shared vertical intervals; stable for coincident and tangent circles. */
export function circleIntersectionArea(circles: readonly ICircle[]): number {
  if (!circles.length) return 0;
  const smallest = circles.reduce((a, b) => a.radius < b.radius ? a : b);
  if (smallest.radius <= 0) return 0;
  if (circles.every((c) => Math.hypot(c.x - smallest.x, c.y - smallest.y) + smallest.radius <= c.radius + 1e-7)) {
    return Math.PI * smallest.radius ** 2;
  }
  const left = Math.max(...circles.map((c) => c.x - c.radius));
  const right = Math.min(...circles.map((c) => c.x + c.radius));
  if (left >= right) return 0;
  const steps = 2048, dx = (right - left) / steps;
  let area = 0;
  for (let i = 0; i < steps; i++) {
    const x = left + (i + 0.5) * dx;
    let low = -Infinity, high = Infinity;
    for (const c of circles) {
      const half = Math.sqrt(Math.max(0, c.radius ** 2 - (x - c.x) ** 2));
      low = Math.max(low, c.y - half); high = Math.min(high, c.y + half);
    }
    area += Math.max(0, high - low) * dx;
  }
  return area;
}

export function assessEulerFit(circles: readonly ICircle[], analysis: SetAnalysis) {
  const setCount = circles.length;
  const totalCounts = analysis.parsedSets.reduce((sum, members) => sum + members.length, 0);
  const scale = circles.reduce((sum, c) => sum + Math.PI * c.radius ** 2, 0) / totalCounts;
  if (!totalCounts || !Number.isFinite(scale) || scale <= 0) return { maxRegionError: 0, fittedCounts: [] as number[] };
  const fittedCounts = Array<number>(1 << setCount).fill(0);
  for (let mask = (1 << setCount) - 1; mask > 0; mask--) {
    let area = circleIntersectionArea(maskToIndices(mask, setCount).map((i) => circles[i])) / scale;
    for (let other = mask + 1; other < 1 << setCount; other++) {
      if ((other & mask) === mask) area -= fittedCounts[other];
    }
    fittedCounts[mask] = area;
  }
  const maxRegionError = Math.max(...fittedCounts.slice(1).map((value, i) =>
    Math.abs(value - (analysis.regionByMask.get(i + 1)?.count ?? 0)) / analysis.unionCount));
  return { maxRegionError, fittedCounts };
}
