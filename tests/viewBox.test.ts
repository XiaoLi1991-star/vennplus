import { describe, expect, it } from 'vitest';
import { fitViewBoxToAspectRatio } from '../src/lib/viewBox';

describe('publication canvas fitting', () => {
  it('adds centered canvas space without changing the source geometry', () => {
    const fitted = fitViewBoxToAspectRatio([-4, -4, 8, 8], 1.5);

    expect(fitted[2] / fitted[3]).toBeCloseTo(1.5);
    expect(fitted[3]).toBe(8);
    expect(fitted[0]).toBe(-6);
    expect(fitted[1]).toBe(-4);
  });

  it('can keep an UpSet canvas anchored to the top left', () => {
    const fitted = fitViewBoxToAspectRatio([0, 0, 900, 560], 1, 'top-left');

    expect(fitted).toEqual([0, 0, 900, 900]);
  });
});
