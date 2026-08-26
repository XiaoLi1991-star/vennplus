import {
  DEFAULT_PUBLICATION_SETTINGS,
  getPublicationPixelDimensions,
} from '../data/publication';
import { VENNPLUS_VERSION } from '../data/version';
import type { PublicationSettings, Region, SetAnalysis, SetDefinition } from '../types';
import type { PublicationManifest } from './publicationManifest';
import { formatPercentage, getSetDisplayName } from './sets';
import { fitViewBoxToAspectRatio } from './viewBox';

const EXPORT_STYLE = `
  text { font-family: Arial, Helvetica, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .upset-axis-title { fill: #354249; font-size: 12px; font-weight: bold; }
  .upset-grid line { stroke: #e3e8eb; stroke-width: 0.75; shape-rendering: crispEdges; }
  .upset-grid text { fill: #758188; font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .upset-axis-line { stroke: #8b969c; stroke-width: 0.9; shape-rendering: crispEdges; vector-effect: non-scaling-stroke; }
  .upset-value-label { fill: #364148; font-size: 10.5px; font-weight: bold; font-variant-numeric: tabular-nums; }
  .upset-value-label-dense { dominant-baseline: middle; }
  .upset-set-count { fill: #56646b; font-size: 11px; font-weight: normal; font-variant-numeric: tabular-nums; }
  .upset-set-name { font-size: 11.5px; font-weight: bold; }
  .upset-note { fill: #7b878d; font-size: 10.5px; font-style: italic; }
`;

function slugify(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'vennplus';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, pngCrc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

/** Embed a standards-compliant PNG pHYs chunk so journal software reads the requested DPI. */
export function writePngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (
    png.length < PNG_SIGNATURE.length ||
    PNG_SIGNATURE.some((byte, index) => png[index] !== byte)
  ) {
    throw new Error('Invalid PNG data');
  }

  const pixelsPerMeter = Math.max(1, Math.round(dpi / 0.0254));
  const physicalData = new Uint8Array(9);
  const physicalView = new DataView(physicalData.buffer);
  physicalView.setUint32(0, pixelsPerMeter);
  physicalView.setUint32(4, pixelsPerMeter);
  physicalData[8] = 1;
  const physicalChunk = createPngChunk('pHYs', physicalData);
  const chunks: Uint8Array[] = [PNG_SIGNATURE];

  let offset = PNG_SIGNATURE.length;
  let inserted = false;
  while (offset + 12 <= png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset);
    const dataLength = view.getUint32(0);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > png.length) throw new Error('Invalid PNG chunk length');
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') chunks.push(png.subarray(offset, chunkEnd));
    if (type === 'IHDR' && !inserted) {
      chunks.push(physicalChunk);
      inserted = true;
    }
    offset = chunkEnd;
    if (type === 'IEND') break;
  }
  if (!inserted) throw new Error('PNG is missing an IHDR chunk');

  const outputLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(outputLength);
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

function scaleSvgNumber(value: string | null, mapY: (value: number) => number): string | null {
  if (value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(mapY(numeric)) : null;
}

function reflowUpSetClone(clone: SVGSVGElement, targetAspectRatio: number): void {
  if (clone.getAttribute('data-figure') !== 'upset') return;
  const sourceViewBox = clone.viewBox.baseVal;
  const targetHeight = sourceViewBox.width / targetAspectRatio;
  if (!Number.isFinite(targetHeight) || targetHeight <= sourceViewBox.height * 1.02) return;

  const sourceContentTop = Number(clone.getAttribute('data-export-content-top'));
  const sourceContentBottom = Number(clone.getAttribute('data-export-content-bottom'));
  if (
    !Number.isFinite(sourceContentTop) ||
    !Number.isFinite(sourceContentBottom) ||
    sourceContentBottom <= sourceContentTop
  ) return;

  const targetPadding = Math.max(18, targetHeight * 0.035);
  const verticalScale =
    (targetHeight - targetPadding * 2) / (sourceContentBottom - sourceContentTop);
  const mapY = (value: number) =>
    targetPadding + (value - sourceContentTop) * verticalScale;

  clone.querySelectorAll<SVGElement>('[y], [y1], [y2], [cy]').forEach((node) => {
    for (const attribute of ['y', 'y1', 'y2', 'cy']) {
      const scaled = scaleSvgNumber(node.getAttribute(attribute), mapY);
      if (scaled !== null) node.setAttribute(attribute, scaled);
    }
  });
  clone.querySelectorAll<SVGElement>('rect[height]').forEach((node) => {
    const height = Number(node.getAttribute('height'));
    if (Number.isFinite(height)) node.setAttribute('height', String(height * verticalScale));
  });
  clone.querySelectorAll<SVGElement>('[transform^="rotate("]').forEach((node) => {
    const transform = node.getAttribute('transform');
    const match = transform?.match(/^rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)$/);
    if (!match) return;
    node.setAttribute('transform', `rotate(${match[1]} ${match[2]} ${mapY(Number(match[3]))})`);
  });

  clone.setAttribute(
    'viewBox',
    [sourceViewBox.x, sourceViewBox.y, sourceViewBox.width, targetHeight].join(' '),
  );
  clone.setAttribute('data-export-upset-vertical-scale', verticalScale.toFixed(4));
}

function createExportClone(
  svg: SVGSVGElement,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-export-ignore]').forEach((node) => node.remove());
  clone.querySelectorAll('[role], [tabindex], [aria-label], [aria-pressed]').forEach((node) => {
    node.removeAttribute('role');
    node.removeAttribute('tabindex');
    node.removeAttribute('aria-label');
    node.removeAttribute('aria-pressed');
  });
  clone.querySelectorAll('.region-is-selected, .region-is-muted').forEach((node) => {
    node.classList.remove('region-is-selected', 'region-is-muted');
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  reflowUpSetClone(clone, publication.widthMm / publication.heightMm);
  const sourceViewBox = clone.viewBox.baseVal;
  const fittedViewBox = fitViewBoxToAspectRatio(
    [sourceViewBox.x, sourceViewBox.y, sourceViewBox.width, sourceViewBox.height],
    publication.widthMm / publication.heightMm,
    clone.getAttribute('data-figure') === 'upset' &&
      clone.getAttribute('data-upset-scrollable') === 'true'
      ? 'top-left'
      : 'center',
  );
  clone.setAttribute('viewBox', fittedViewBox.join(' '));
  clone.querySelectorAll('[data-figure-background]').forEach((node) => {
    node.setAttribute('fill', publication.background === 'transparent' ? 'none' : '#ffffff');
    node.setAttribute('x', String(fittedViewBox[0]));
    node.setAttribute('y', String(fittedViewBox[1]));
    node.setAttribute('width', String(fittedViewBox[2]));
    node.setAttribute('height', String(fittedViewBox[3]));
  });
  const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  const geometrySource = clone.getAttribute('data-geometry-source') ?? undefined;
  metadata.textContent = JSON.stringify({
    generator: 'VennPlus',
    version: VENNPLUS_VERSION,
    exportedAt: new Date().toISOString(),
    publication,
    geometrySource,
    semantics: {
      intersections: 'exact',
      percentageDenominator: 'union',
      caseSensitive: true,
      withinSetDuplicates: 'removed',
    },
  });
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EXPORT_STYLE;
  clone.insertBefore(metadata, clone.firstChild);
  clone.insertBefore(style, clone.firstChild);
  return clone;
}

export function serializeFigureSvg(
  svg: SVGSVGElement,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): { markup: string; width: number; height: number; widthMm: number; heightMm: number } {
  const clone = createExportClone(svg, publication);
  const widthMm = publication.widthMm;
  const heightMm = publication.heightMm;
  const { width, height } = getPublicationPixelDimensions(publication);
  clone.setAttribute('width', `${widthMm}mm`);
  clone.setAttribute('height', `${heightMm}mm`);
  return {
    markup: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
    width,
    height,
    widthMm,
    heightMm,
  };
}

export function exportSvg(
  svg: SVGSVGElement,
  projectTitle: string,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): void {
  const { markup } = serializeFigureSvg(svg, publication);
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${slugify(projectTitle)}.svg`);
}

async function renderSvgToCanvas(
  svg: SVGSVGElement,
  publication: PublicationSettings,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const { markup, width, height } = serializeFigureSvg(svg, publication);
  const source = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    if (publication.background === 'white') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);
    return { canvas, width, height };
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function exportPng(
  svg: SVGSVGElement,
  projectTitle: string,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): Promise<void> {
  const { canvas } = await renderSvgToCanvas(svg, publication);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG export failed'))), 'image/png');
  });
  const pngWithDpi = writePngDpi(
    new Uint8Array(await blob.arrayBuffer()),
    publication.rasterDpi,
  );
  const pngBuffer = pngWithDpi.buffer.slice(
    pngWithDpi.byteOffset,
    pngWithDpi.byteOffset + pngWithDpi.byteLength,
  ) as ArrayBuffer;
  downloadBlob(new Blob([pngBuffer], { type: 'image/png' }), `${slugify(projectTitle)}.png`);
}

export async function encodeTiffRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  dpi: number,
): Promise<ArrayBuffer> {
  const { default: UTIF } = await import('utif');
  const pixels = rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength) as ArrayBuffer;
  return UTIF.encodeImage(pixels, width, height, {
    t282: [dpi],
    t283: [dpi],
    t296: [2],
    t305: [`VennPlus ${VENNPLUS_VERSION}`],
  });
}

export async function exportTiff(
  svg: SVGSVGElement,
  projectTitle: string,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): Promise<void> {
  const { canvas, width, height } = await renderSvgToCanvas(svg, publication);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is not available');
  const rgba = context.getImageData(0, 0, width, height).data;
  const tiff = await encodeTiffRgba(rgba, width, height, publication.rasterDpi);
  downloadBlob(new Blob([tiff], { type: 'image/tiff' }), `${slugify(projectTitle)}.tiff`);
}

export async function exportPdf(
  svg: SVGSVGElement,
  projectTitle: string,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): Promise<void> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const clone = createExportClone(svg, publication);
  const contentWidth = (publication.widthMm / 25.4) * 72;
  const contentHeight = (publication.heightMm / 25.4) * 72;
  const pdf = new jsPDF({
    unit: 'pt',
    format: [contentWidth, contentHeight],
    orientation: contentWidth >= contentHeight ? 'landscape' : 'portrait',
  });
  pdf.setProperties({
    title: projectTitle,
    subject: clone.getAttribute('data-geometry-source')
      ? `Exact set intersections exported by VennPlus. Five-set geometry: ${clone.getAttribute('data-geometry-source')}`
      : 'Exact set intersections exported by VennPlus',
    creator: `VennPlus ${VENNPLUS_VERSION}`,
  });
  clone.style.position = 'fixed';
  clone.style.left = '-10000px';
  clone.style.top = '0';
  clone.setAttribute('width', String(contentWidth));
  clone.setAttribute('height', String(contentHeight));
  document.body.append(clone);
  try {
    await svg2pdf(clone, pdf, { x: 0, y: 0, width: contentWidth, height: contentHeight });
    pdf.save(`${slugify(projectTitle)}.pdf`);
  } finally {
    clone.remove();
  }
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportRegionTxt(region: Region, projectTitle: string): void {
  downloadBlob(
    new Blob([`${region.members.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }),
    createRegionFilename(region, projectTitle, 'txt'),
  );
}

export function exportRegionCsv(region: Region, projectTitle: string): void {
  const rows = [['Region', 'Member'], ...region.members.map((member) => [region.key, member])];
  const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}\r\n`;
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    createRegionFilename(region, projectTitle, 'csv'),
  );
}

export function createRegionFilename(
  region: Region,
  projectTitle: string,
  extension: 'txt' | 'csv',
): string {
  const projectSlug = slugify(projectTitle);
  const descriptive = `${projectSlug}-${slugify(region.key)}.${extension}`;
  if (new TextEncoder().encode(descriptive).length <= 180) return descriptive;
  let boundedProjectSlug = '';
  for (const character of projectSlug) {
    const candidate = `${boundedProjectSlug}${character}`;
    if (new TextEncoder().encode(candidate).length > 72) break;
    boundedProjectSlug = candidate;
  }
  boundedProjectSlug = boundedProjectSlug.replace(/[-._]+$/g, '') || 'vennplus';
  return `${boundedProjectSlug}-intersection-${region.mask}-${region.setIndices.length}sets.${extension}`;
}

export function exportIntersectionsCsv(
  analysis: SetAnalysis,
  projectTitle: string,
): void {
  const rows: Array<Array<string | number>> = [
    ['Region', 'Set degree', 'Count', 'Percentage of union'],
    ...analysis.regions
      .filter((region) => region.count > 0)
      .sort((a, b) => b.count - a.count || a.mask - b.mask)
      .map((region) => [region.key, region.setIndices.length, region.count, formatPercentage(region.percentage)]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}\r\n`;
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `${slugify(projectTitle)}-intersections.csv`,
  );
}

function tsvEscape(value: string): string {
  return /[\t"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function createSetsTsv(sets: SetDefinition[], analysis: SetAnalysis): string {
  const rowCount = Math.max(0, ...analysis.parsedSets.map((members) => members.length));
  const rows = [
    sets.map((set, index) => getSetDisplayName(set, index)),
    ...Array.from({ length: rowCount }, (_, rowIndex) =>
      analysis.parsedSets.map((members) => members[rowIndex] ?? ''),
    ),
  ];
  return `\uFEFF${rows.map((row) => row.map(tsvEscape).join('\t')).join('\r\n')}\r\n`;
}

export function exportSetsTxt(
  sets: SetDefinition[],
  analysis: SetAnalysis,
  projectTitle: string,
): void {
  downloadBlob(
    new Blob([createSetsTsv(sets, analysis)], { type: 'text/tab-separated-values;charset=utf-8' }),
    `${slugify(projectTitle)}-sets.txt`,
  );
}

export function createIntersectionsTsv(analysis: SetAnalysis): string {
  const regions = [...analysis.regions]
    .filter((region) => region.count > 0)
    .sort((a, b) => b.count - a.count || b.setIndices.length - a.setIndices.length || a.mask - b.mask);
  const rowCount = Math.max(0, ...regions.map((region) => region.members.length));
  const rows = [
    regions.map((region) => region.key),
    ...Array.from({ length: rowCount }, (_, rowIndex) =>
      regions.map((region) => region.members[rowIndex] ?? ''),
    ),
  ];
  return `\uFEFF${rows.map((row) => row.map(tsvEscape).join('\t')).join('\r\n')}\r\n`;
}

export function exportIntersectionsTxt(analysis: SetAnalysis, projectTitle: string): void {
  downloadBlob(
    new Blob([createIntersectionsTsv(analysis)], {
      type: 'text/tab-separated-values;charset=utf-8',
    }),
    `${slugify(projectTitle)}-intersection-members.txt`,
  );
}

export function exportPublicationManifest(
  manifest: PublicationManifest,
  projectTitle: string,
): void {
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  downloadBlob(
    new Blob([json], { type: 'application/json;charset=utf-8' }),
    `${slugify(projectTitle)}-reproducibility.json`,
  );
}

function headerCell(value: string) {
  return {
    value,
    fontWeight: 'bold' as const,
    color: '#ffffff',
    backgroundColor: '#526A7C',
    align: 'center' as const,
  };
}

function sheetName(value: string, fallback: string): string {
  const cleaned = value.replace(/[\\/?*:[\]]/g, '-').trim();
  return (cleaned || fallback).slice(0, 31);
}

export function createWorkbookSheets(
  sets: SetDefinition[],
  analysis: SetAnalysis,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
) {
  const summary = [
    [headerCell('Set'), headerCell('Name'), headerCell('Unique members')],
    ...sets.map((set, index) => [index + 1, set.name, analysis.parsedSets[index].length]),
    ['Union', 'All visible sets', analysis.unionCount],
  ];
  const intersections = [
    [
      headerCell('Region'),
      headerCell('Set degree'),
      headerCell('Count'),
      headerCell('Percentage of union'),
    ],
    ...analysis.regions
      .filter((region) => region.count > 0)
      .sort((a, b) => b.count - a.count || a.mask - b.mask)
      .map((region) => [
        region.key,
        region.setIndices.length,
        region.count,
        { value: region.percentage, format: '0.0%' },
      ]),
  ];
  const membersLong = [
    [headerCell('Region'), headerCell('Set degree'), headerCell('Member')],
    ...analysis.regions.flatMap((region) =>
      region.members.map((member) => [region.key, region.setIndices.length, member]),
    ),
  ];

  const metadata = [
    [headerCell('Field'), headerCell('Value')],
    ['Generator', 'VennPlus'],
    ['Version', VENNPLUS_VERSION],
    ['Intersection semantics', 'Exact membership regions'],
    ['Percentage denominator', 'Union of all visible sets'],
    ['Case sensitive', 'Yes'],
    ['Within-set duplicates', 'Removed'],
    ['Figure width (mm)', publication.widthMm],
    ['Figure height (mm)', publication.heightMm],
    ['Raster resolution (DPI)', publication.rasterDpi],
    ['Export background', publication.background],
  ];

  const usedSheetNames = new Set<string>(['Summary', 'Intersections', 'Members_Long', 'Metadata']);
  const setSheets = sets.map((set, index) => {
    let name = sheetName(`${String(index + 1).padStart(2, '0')}_${set.name}`, `Set_${index + 1}`);
    let suffix = 2;
    while (usedSheetNames.has(name)) {
      name = sheetName(`${name}_${suffix}`, `Set_${index + 1}_${suffix}`);
      suffix += 1;
    }
    usedSheetNames.add(name);
    return {
      sheet: name,
      data: [[headerCell('Member')], ...analysis.parsedSets[index].map((member) => [member])],
      stickyRowsCount: 1,
      columns: [{ width: 28 }],
    };
  });

  return [
    {
      sheet: 'Summary',
      data: summary,
      stickyRowsCount: 1,
      columns: [{ width: 12 }, { width: 28 }, { width: 18 }],
    },
    {
      sheet: 'Intersections',
      data: intersections,
      stickyRowsCount: 1,
      columns: [{ width: 42 }, { width: 14 }, { width: 12 }, { width: 14 }],
    },
    {
      sheet: 'Members_Long',
      data: membersLong,
      stickyRowsCount: 1,
      columns: [{ width: 42 }, { width: 14 }, { width: 28 }],
    },
    {
      sheet: 'Metadata',
      data: metadata,
      stickyRowsCount: 1,
      columns: [{ width: 28 }, { width: 42 }],
    },
    ...setSheets,
  ];
}

export async function exportWorkbook(
  sets: SetDefinition[],
  analysis: SetAnalysis,
  projectTitle: string,
  publication: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(createWorkbookSheets(sets, analysis, publication)).toFile(
    `${slugify(projectTitle)}-summary.xlsx`,
  );
}
