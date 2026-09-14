import { describe, expect, it } from 'vitest';
import { cloneExample, EXAMPLES } from '../src/data/examples';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { DEFAULT_PALETTE } from '../src/data/palettes';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { createPublicationManifest } from '../src/lib/publicationManifest';
import { analyzeSets } from '../src/lib/sets';
import type { WorkspaceState } from '../src/types';

describe('publication manifest', () => {
  it('records reproducible data and settings hashes without a preflight payload', async () => {
    const sets = cloneExample(EXAMPLES.find((example) => example.id === 'four-biomarkers')!);
    const state: WorkspaceState = {
      projectTitle: 'Manifest test',
      sets,
      mode: 'venn',
      display: { regionLabelMode: 'count', showSetNames: true, showEmpty: false },
      figureStyle: DEFAULT_FIGURE_STYLE,
      setLabelPositions: { venn: {}, euler: {} },
      paletteId: DEFAULT_PALETTE.id,
      selectedMask: 15,
      topN: 20,
      sort: 'size',
      publication: DEFAULT_PUBLICATION_SETTINGS,
    };
    const analysis = analyzeSets(sets);
    const manifest = await createPublicationManifest({
      state,
      analysis,
    });

    expect(manifest.kind).toBe('vennplus-reproducibility-manifest');
    expect(manifest.hashes.dataSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.settingsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.data.setCount).toBe(4);
    expect(manifest.data.unionCount).toBe(51);
    expect(manifest.output.widthMm).toBe(180);
    expect(manifest.output.pixelWidth).toBe(4252);
    expect(manifest).not.toHaveProperty('preflight');
    expect(manifest).not.toHaveProperty('assessment');
  });
});
