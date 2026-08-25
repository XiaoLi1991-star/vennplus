import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, PALETTES } from '../src/data/palettes';

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastAgainstWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

describe('publication palettes', () => {
  it('uses the restrained ggvenn categorical order as the default', () => {
    expect(DEFAULT_PALETTE.id).toBe('ggvenn-soft');
    expect(DEFAULT_PALETTE.colors).toEqual([
      '#4E79A7',
      '#B08A34',
      '#4D8B68',
      '#C76460',
      '#8B6AA7',
      '#B97443',
      '#3F8393',
      '#9E657A',
    ]);
  });

  it('provides eight unique colors in every preset', () => {
    for (const palette of PALETTES) {
      expect(palette.colors).toHaveLength(8);
      expect(new Set(palette.colors).size).toBe(8);
    }
  });

  it('keeps every default outline distinguishable against a white publication background', () => {
    for (const color of DEFAULT_PALETTE.colors) {
      expect(contrastAgainstWhite(color)).toBeGreaterThanOrEqual(3);
    }
  });
});
