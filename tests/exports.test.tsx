import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/node';
import UTIF from 'utif';
import { VennChart } from '../src/components/VennChart';
import { UpSetChart } from '../src/components/UpSetChart';
import { cloneExample, DEFAULT_EXAMPLE, EXAMPLES } from '../src/data/examples';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { analyzeSets, describeRegion } from '../src/lib/sets';
import {
  createRegionFilename,
  createSetsTsv,
  createIntersectionsTsv,
  createWorkbookSheets,
  encodeTiffRgba,
  serializeFigureSvg,
  writePngDpi,
} from '../src/lib/download';

describe('vector figure export', () => {
  it('serializes the scientific layer without hit targets or browser state', () => {
    const sets = cloneExample(EXAMPLES.find((example) => example.id === 'four-biomarkers')!);
    const analysis = analyzeSets(sets);
    const ref = createRef<SVGSVGElement>();
    render(
      <VennChart
        ref={ref}
        sets={sets}
        analysis={analysis}
        selectedMask={15}
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );

    expect(ref.current?.querySelector('[data-selection-veil="true"]')).toBeInTheDocument();
    expect(ref.current?.querySelector('[aria-pressed="true"]')).toBeInTheDocument();

    const exported = serializeFigureSvg(ref.current!);
    expect(exported.markup.match(/<ellipse/g)).toHaveLength(4);
    expect(exported.markup).not.toContain('data-export-ignore');
    expect(exported.markup).not.toContain('tabindex');
    expect(exported.markup).not.toContain('role="button"');
    expect(exported.markup).not.toContain('aria-pressed');
    expect(exported.markup).not.toContain('data-selection-veil');
    expect(exported.markup).not.toContain('region-is-selected');
    expect(exported.markup).not.toContain('region-is-muted');
    expect(exported.markup).toContain('vector-effect="non-scaling-stroke"');
    expect(exported.markup).toContain('width="180mm"');
    expect(exported.markup).toContain('"intersections":"exact"');
    sets.forEach((set) => expect(exported.markup).toContain(`>${set.name}</text>`));
    expect(exported.markup).not.toMatch(/>[A-D]\s*[·•]\s*/);
  });

  it('keeps the five-set reference geometry and embeds its required attribution', () => {
    const fiveSetExample = EXAMPLES.find((example) => example.id === 'five-pathways')!;
    const sets = cloneExample(fiveSetExample);
    const analysis = analyzeSets(sets);
    const ref = createRef<SVGSVGElement>();
    render(
      <VennChart
        ref={ref}
        sets={sets}
        analysis={analysis}
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );

    expect(ref.current?.getAttribute('viewBox')).toBe('-4 -4 8 8');
    const exported = serializeFigureSvg(ref.current!);
    expect(exported.markup.match(/<path/g)).toHaveLength(5);
    expect(exported.markup.match(/class="venn-region-label"/g)).toHaveLength(31);
    expect(exported.markup.match(/>0<\/tspan>/g)).toHaveLength(10);
    expect(exported.markup).not.toContain('paint-order');
    expect(exported.markup).not.toContain('rgba(255, 255, 255');
    expect(exported.markup).toContain('Adrian Dusa (2026), venn 1.13');
    expect(exported.widthMm).toBe(180);
    expect(exported.heightMm).toBe(120);
  });

  it('supports transparent single-column export at a physical size', () => {
    const sets = cloneExample(DEFAULT_EXAMPLE);
    const analysis = analyzeSets(sets);
    const ref = createRef<SVGSVGElement>();
    render(
      <VennChart
        ref={ref}
        sets={sets}
        analysis={analysis}
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        labelPositions={{}}
        onSelectRegion={() => undefined}
        onSetLabelPositionChange={() => undefined}
      />,
    );
    const exported = serializeFigureSvg(ref.current!, {
      widthMm: 85,
      heightMm: 85,
      rasterDpi: 300,
      background: 'transparent',
    });
    expect(exported.markup).toContain('width="85mm"');
    expect(exported.markup).toContain('height="85mm"');
    expect(exported.markup).toContain('data-figure-background="true"');
    expect(exported.markup).toMatch(/data-figure-background="true"[^>]+fill="none"/);
    expect(exported.width).toBe(1004);
  });

  it('preserves independent UpSet label and value typography in vector export', () => {
    const sets = EXAMPLES.find((example) => example.id === 'six-cohorts')!.sets.map((set) => ({
      ...set,
    }));
    const analysis = analyzeSets(sets);
    const ref = createRef<SVGSVGElement>();
    render(
      <UpSetChart
        ref={ref}
        sets={sets}
        analysis={analysis}
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={{
          ...DEFAULT_FIGURE_STYLE,
          upsetLabelFontScale: 1.3,
          upsetLabelsBold: true,
          upsetValueFontScale: 1.2,
          upsetValuesBold: true,
        }}
        topN={20}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );

    const exported = serializeFigureSvg(ref.current!);
    const exportedViewBox = exported.markup.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
    expect(exportedViewBox).toHaveLength(4);
    expect(exportedViewBox![2] / exportedViewBox![3]).toBeCloseTo(1.5, 6);
    expect(exported.markup).toMatch(
      /class="upset-set-name"[^>]+style="[^"]*font-size: 14\.95px;[^"]*font-weight: 700/,
    );
    expect(exported.markup).toMatch(
      /class="upset-value-label"[^>]+style="[^"]*font-size: 13\.2px;[^"]*font-weight: 700/,
    );
    expect(exported.markup).not.toContain('data-export-upset-vertical-scale');
    const matrixBottom = Math.max(
      ...[...exported.markup.matchAll(/<circle[^>]+cy="([^"]+)"/g)].map((match) =>
        Number(match[1]),
      ),
    );
    expect(matrixBottom).toBe(Number(ref.current!.getAttribute('data-matrix-bottom')));
  });

  it('preserves compact three-set column spacing and centers it on the export canvas', () => {
    const sets = EXAMPLES.find((example) => example.id === 'three-treatments')!.sets.map((set) => ({
      ...set,
    }));
    const analysis = analyzeSets(sets);
    const ref = createRef<SVGSVGElement>();
    render(
      <UpSetChart
        ref={ref}
        sets={sets}
        analysis={analysis}
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={{
          ...DEFAULT_FIGURE_STYLE,
          upsetColumnScale: 0.75,
          upsetRowScale: 1.5,
        }}
        topN={20}
        sort="size"
        onSelectRegion={() => undefined}
      />,
    );

    expect(ref.current).toHaveAttribute('data-column-step', '27');
    const sourceViewBox = ref.current!.getAttribute('viewBox')!.split(/\s+/).map(Number);
    const exported = serializeFigureSvg(ref.current!);
    const exportedViewBox = exported.markup.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);

    expect(exported.markup).toContain('data-column-scale="0.75"');
    expect(exported.markup).toContain('data-column-step="27"');
    expect(exported.markup).toContain('data-row-scale="1.5"');
    expect(exported.markup).toContain('data-row-step="42"');
    expect(exportedViewBox).toHaveLength(4);
    expect(exportedViewBox![0]).toBeLessThan(sourceViewBox[0]);
    expect(exportedViewBox![2] / exportedViewBox![3]).toBeCloseTo(1.5, 6);
  });
});

describe('PNG publication metadata', () => {
  it('writes the requested DPI into a pHYs chunk', () => {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    const ihdr = [
      0, 0, 0, 13,
      73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0,
      0, 0, 0, 0,
    ];
    const iend = [0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0];
    const encoded = writePngDpi(new Uint8Array([...signature, ...ihdr, ...iend]), 300);

    let offset = 8;
    let physicalData: Uint8Array | null = null;
    while (offset + 12 <= encoded.length) {
      const view = new DataView(encoded.buffer, encoded.byteOffset + offset);
      const length = view.getUint32(0);
      const type = new TextDecoder().decode(encoded.subarray(offset + 4, offset + 8));
      if (type === 'pHYs') physicalData = encoded.subarray(offset + 8, offset + 8 + length);
      offset += 12 + length;
    }

    expect(physicalData).not.toBeNull();
    const physicalView = new DataView(
      physicalData!.buffer,
      physicalData!.byteOffset,
      physicalData!.byteLength,
    );
    expect(physicalView.getUint32(0)).toBe(11_811);
    expect(physicalView.getUint32(4)).toBe(11_811);
    expect(physicalData![8]).toBe(1);
  });
});

describe('selected-region filenames', () => {
  it('keeps short names descriptive and bounds long multi-set filenames', () => {
    const analysis = analyzeSets(cloneExample(DEFAULT_EXAMPLE));
    const region = analysis.regions[0];
    expect(createRegionFilename(region, 'vennplus-figure', 'txt')).toContain(region.key);

    const longRegion = {
      ...region,
      key: Array.from({ length: 8 }, (_, index) =>
        `Long publication cohort name ${index + 1}`,
      ).join(' ∩ '),
      setIndices: Array.from({ length: 8 }, (_, index) => index),
      mask: 255,
    };
    const filename = createRegionFilename(longRegion, 'vennplus-figure', 'csv');
    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(180);
    expect(filename).toBe('vennplus-figure-intersection-255-8sets-exact.csv');

    const unicodeFilename = createRegionFilename(longRegion, '超长科研项目名称'.repeat(20), 'txt');
    expect(new TextEncoder().encode(unicodeFilename).length).toBeLessThanOrEqual(120);
    expect(unicodeFilename).toContain('-intersection-255-8sets-exact.txt');
  });
});

describe('tab-separated set export', () => {
  it('writes one set per column with names in the first row', () => {
    const sets = cloneExample(DEFAULT_EXAMPLE);
    const analysis = analyzeSets(sets);
    const rows = createSetsTsv(sets, analysis).replace(/^\uFEFF/, '').trimEnd().split('\r\n');

    expect(rows[0].split('\t')).toEqual(sets.map((set) => set.name));
    expect(rows).toHaveLength(Math.max(...analysis.parsedSets.map((members) => members.length)) + 1);
    expect(rows[1].split('\t')).toHaveLength(sets.length);
  });

  it('writes every observed intersection as a named member column', () => {
    const sets = cloneExample(DEFAULT_EXAMPLE);
    const analysis = analyzeSets(sets);
    const rows = createIntersectionsTsv(analysis).replace(/^\uFEFF/, '').trimEnd().split('\r\n');
    const regions = [...analysis.regions]
      .filter((region) => region.count > 0)
      .sort((a, b) => b.count - a.count || b.setIndices.length - a.setIndices.length || a.mask - b.mask);

    expect(rows[0].split('\t')).toEqual(regions.map(describeRegion));
    expect(rows).toHaveLength(Math.max(...regions.map((region) => region.count)) + 1);
    expect(rows[1].split('\t')).toHaveLength(regions.length);
  });
});

describe('workbook export', () => {
  it('creates the requested summary, intersection, long-member and per-set sheets', async () => {
    const sets = cloneExample(DEFAULT_EXAMPLE);
    const analysis = analyzeSets(sets);
    const sheets = createWorkbookSheets(sets, analysis);
    const names = sheets.map((sheet) => sheet.sheet);

    expect(names.slice(0, 3)).toEqual(['Summary', 'Intersections', 'Members_Long']);
    expect(names).toContain('Metadata');
    expect(names).toHaveLength(4 + sets.length);
    expect(new Set(names).size).toBe(names.length);

    const buffer = await writeExcelFile(sheets).toBuffer();
    expect(buffer.byteLength).toBeGreaterThan(3_000);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});

describe('TIFF export', () => {
  it('encodes lossless RGBA pixels with physical DPI metadata', async () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255,
      55, 110, 163, 255,
    ]);
    const encoded = await encodeTiffRgba(rgba, 2, 1, 600);
    const bytes = new Uint8Array(encoded);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('MM');
    const [ifd] = UTIF.decode(encoded);
    expect(ifd.t256).toEqual([2]);
    expect(ifd.t257).toEqual([1]);
    expect(ifd.t282).toEqual([600]);
    expect(ifd.t283).toEqual([600]);
    expect(ifd.t296).toEqual([2]);
  });
});
