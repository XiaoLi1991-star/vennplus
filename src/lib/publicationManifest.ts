import { getPublicationPixelDimensions } from '../data/publication';
import { VENNPLUS_VERSION } from '../data/version';
import type { SetAnalysis, WorkspaceState } from '../types';

export interface PublicationManifest {
  kind: 'vennplus-reproducibility-manifest';
  version: 1;
  generatedAt: string;
  generator: { name: 'VennPlus'; version: string };
  hashes: { dataSha256: string; settingsSha256: string };
  data: {
    setCount: number;
    unionCount: number;
    nonEmptyIntersectionCount: number;
    sets: Array<{ index: number; name: string; uniqueMembers: number; duplicatesRemoved: number }>;
  };
  visualization: {
    mode: WorkspaceState['mode'];
    paletteId: string;
    display: WorkspaceState['display'];
    figureStyle: WorkspaceState['figureStyle'];
    setLabelPositions: WorkspaceState['setLabelPositions'];
    upset: { topN: number; sort: WorkspaceState['sort'] } | null;
  };
  output: {
    sizing: 'custom';
    widthMm: number;
    heightMm: number;
    rasterDpi: number;
    pixelWidth: number;
    pixelHeight: number;
    background: WorkspaceState['publication']['background'];
  };
  semantics: {
    intersections: 'exact-membership';
    percentageDenominator: 'union';
    caseSensitive: true;
    withinSetDuplicates: 'removed';
    processing: 'browser-local';
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPublicationManifest({
  state,
  analysis,
}: {
  state: WorkspaceState;
  analysis: SetAnalysis;
}): Promise<PublicationManifest> {
  const normalizedData = state.sets.map((set, index) => ({
    name: set.name,
    members: [...analysis.parsedSets[index]].sort((a, b) => a.localeCompare(b)),
  }));
  const visualization = {
    mode: state.mode,
    paletteId: state.paletteId,
    display: state.display,
    figureStyle: state.figureStyle,
    setLabelPositions: state.setLabelPositions,
    upset: state.mode === 'upset' ? { topN: state.topN, sort: state.sort } : null,
  } satisfies PublicationManifest['visualization'];
  const [dataSha256, settingsSha256] = await Promise.all([
    sha256(JSON.stringify(normalizedData)),
    sha256(JSON.stringify({ visualization, publication: state.publication })),
  ]);

  const pixels = getPublicationPixelDimensions(state.publication);

  return {
    kind: 'vennplus-reproducibility-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    generator: { name: 'VennPlus', version: VENNPLUS_VERSION },
    hashes: { dataSha256, settingsSha256 },
    data: {
      setCount: state.sets.length,
      unionCount: analysis.unionCount,
      nonEmptyIntersectionCount: analysis.regions.filter((region) => region.count > 0).length,
      sets: state.sets.map((set, index) => ({
        index: index + 1,
        name: set.name,
        uniqueMembers: analysis.parsedSets[index].length,
        duplicatesRemoved: analysis.duplicateCounts[index],
      })),
    },
    visualization,
    output: {
      sizing: 'custom',
      widthMm: state.publication.widthMm,
      heightMm: state.publication.heightMm,
      rasterDpi: state.publication.rasterDpi,
      pixelWidth: pixels.width,
      pixelHeight: pixels.height,
      background: state.publication.background,
    },
    semantics: {
      intersections: 'exact-membership',
      percentageDenominator: 'union',
      caseSensitive: true,
      withinSetDuplicates: 'removed',
      processing: 'browser-local',
    },
  };
}
