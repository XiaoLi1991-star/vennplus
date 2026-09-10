import { createRef } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EulerChart } from '../src/components/EulerChart';
import { UpSetChart } from '../src/components/UpSetChart';
import { IntersectionResults } from '../src/components/IntersectionResults';
import { SelectedRegionPanel } from '../src/components/SelectedRegionPanel';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { DEFAULT_PALETTE } from '../src/data/palettes';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { analyzeSets, queryIntersection } from '../src/lib/sets';
import { createSetsTsv, serializeFigureSvg } from '../src/lib/download';
import { nextSetColor, parseSetTable, uniqueSetName } from '../src/lib/setImport';
import { circleIntersectionArea } from '../src/lib/eulerFit';
import { useSetAnalysis } from '../src/hooks/useSetAnalysis';
import type { SetDefinition } from '../src/types';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const display = { regionLabelMode: 'count' as const, showSetNames: true, showEmpty: false };
const makeSets = (members: string[][]): SetDefinition[] => members.map((items, i) => ({ id: String(i), name: String.fromCharCode(65 + i), color: DEFAULT_PALETTE.colors[i], text: items.join('\n') }));

describe('Euler boundary geometry', () => {
  it('does not render invalid coordinates for empty sets', () => {
    const sets = makeSets([[], [], [], []]);
    const { container } = render(<EulerChart sets={sets} analysis={analyzeSets(sets)} display={display} figureStyle={DEFAULT_FIGURE_STYLE} labelPositions={{}} onSelectRegion={() => {}} onSetLabelPositionChange={() => {}} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
  it.each(['identical', 'disjoint', 'nested'] as const)('fits four %s sets without contradictory higher-order terms', (kind) => {
    const sets = makeSets(Array.from({ length: 4 }, (_, i) => Array.from({ length: kind === 'nested' ? 10 - 2 * i : 10 }, (_, j) => `${kind === 'disjoint' ? i : ''}gene${j}`)));
    const analysis = analyzeSets(sets);
    const { container } = render(<EulerChart sets={sets} analysis={analysis} display={display} figureStyle={DEFAULT_FIGURE_STYLE} labelPositions={{}} onSelectRegion={() => {}} onSetLabelPositionChange={() => {}} />);
    const circles = [...container.querySelectorAll('.euler-figure g[aria-hidden="true"] > circle')].map((c, i) => ({ setid: String(i), x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')), radius: Number(c.getAttribute('r')) }));
    expect(circles).toHaveLength(4);
    const scale = Math.PI * circles[0].radius ** 2 / 10;
    expect(circleIntersectionArea(circles) / scale).toBeCloseTo(kind === 'identical' ? 10 : kind === 'nested' ? 4 : 0, 3);
    expect(Number(container.querySelector('svg')!.getAttribute('data-max-region-error'))).toBeLessThan(0.001);
    if (kind === 'identical') expect(new Set(circles.map((c) => `${c.x},${c.y},${c.radius}`)).size).toBe(1);
  });
});

describe('table import and stable group identity', () => {
  it('round-trips exported sets including quotes, tabs, BOM and different column lengths', () => {
    const sets = makeSets([['TP53', 'a\tb', 'a"b'], ['EGFR']]);
    sets[0].name = 'Discovery "A"';
    const imported = parseSetTable(createSetsTsv(sets, analyzeSets(sets)));
    expect(imported).toEqual(sets.map(({ name, text }) => ({ name, text })));
  });
  it('reads comma-separated files without breaking quoted commas', () => {
    expect(parseSetTable('"A, study",B\r\n"gene,1",gene2\r\n')).toEqual([{ name: 'A, study', text: 'gene,1' }, { name: 'B', text: 'gene2' }]);
  });
  it.each(['A\nTP53', 'A\tA\nx\ty', 'A\tB\nx\ty\tz', 'A\tB\n"unfinished\tx', 'A\tB\n"x\ny"\tz'])('rejects ambiguous input: %s', (text) => expect(() => parseSetTable(text)).toThrow());
  it('reuses an unused palette slot after deletion without changing existing colors', () => {
    const sets = makeSets([[], [], [], []]);
    const remaining = [sets[0], sets[2], sets[3]];
    expect(nextSetColor(remaining, DEFAULT_PALETTE.colors)).toBe(sets[1].color);
    expect(uniqueSetName('A', sets)).toBe('A 2');
  });
});

describe('exact versus inclusive membership and output scope', () => {
  const sets = makeSets([['AB', 'ABC'], ['AB', 'ABC'], ['ABC']]);
  const analysis = analyzeSets(sets);
  const region = analysis.regionByMask.get(3)!;
  it('keeps the exact region exclusive and includes higher orders only on request', () => {
    expect(region.members).toEqual(['AB']);
    expect(region.excludedSets).toEqual(['C']);
    expect(queryIntersection(region, analysis, true).members).toEqual(['AB', 'ABC']);
  });
  it('uses the same search/output range and switches to whole-region downloads explicitly', () => {
    const download = vi.fn();
    render(<SelectedRegionPanel region={region} analysis={analysis} onClearSelection={() => {}} onDownloadTxt={download} onDownloadCsv={download} />);
    fireEvent.change(screen.getByLabelText('交集口径'), { target: { value: 'inclusive' } });
    fireEvent.change(screen.getByLabelText('搜索选中区域成员'), { target: { value: 'ABC' } });
    fireEvent.click(screen.getByRole('button', { name: 'TXT' }));
    expect(download.mock.lastCall![0].members).toEqual(['ABC']);
    expect(download.mock.lastCall![0].membershipMode).toBe('inclusive');
    fireEvent.change(screen.getByLabelText('复制与下载范围'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(download.mock.lastCall![0].members).toEqual(['AB', 'ABC']);
  });
});

describe('complete intersection results and figure/export consistency', () => {
  it('does not expose stale results between different asynchronous inputs', async () => {
    vi.useFakeTimers();
    const first = makeSets([Array.from({ length: 8000 }, (_, i) => `first-${i}`), ['shared']]);
    const next = makeSets([Array.from({ length: 8000 }, (_, i) => `second-${i}`), ['other'], ['third']]);
    const { result, rerender } = renderHook(({ sets }) => useSetAnalysis(sets), { initialProps: { sets: first } });
    expect(result.current.isAnalyzing).toBe(true);
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.analysis.unionCount).toBe(8001);
    rerender({ sets: next });
    expect(result.current.isAnalyzing).toBe(true);
    expect(result.current.analysis.unionMembers).not.toContain('first-0');
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysis.unionCount).toBe(8002);
    expect(result.current.analysis.unionMembers).toContain('second-0');
  });
  it('exposes all 255 observed intersections, including regions beyond Top 50', () => {
    const sets = makeSets(Array.from({ length: 8 }, (_, i) => Array.from({ length: 255 }, (_, j) => j + 1).filter((mask) => mask & (1 << i)).map((mask) => `member-${mask}`)));
    const analysis = analyzeSets(sets), onSelect = vi.fn();
    render(<IntersectionResults sets={sets} analysis={analysis} region={null} onSelect={onSelect} onClear={() => {}} onDownloadTxt={() => {}} onDownloadCsv={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '全部交集（255）' }));
    fireEvent.change(screen.getByLabelText('搜索全部交集'), { target: { value: 'member-255' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '查看成员' }));
    expect(onSelect).toHaveBeenCalledWith(255);
  });
  it.each([1, 1.5, 2])('preserves physical aspect %s, row positions and bar heights in SVG export', (ratio) => {
    const sets = makeSets([['AB', 'A'], ['AB', 'BC'], ['BC', 'C']]);
    const ref = createRef<SVGSVGElement>();
    const props = { sets, analysis: analyzeSets(sets), display, figureStyle: DEFAULT_FIGURE_STYLE, topN: 50, sort: 'size' as const, onSelectRegion: () => {}, targetAspectRatio: ratio };
    const { rerender, container } = render(<UpSetChart ref={ref} {...props} selectedMask={3} />);
    expect(container.querySelector('[data-selection-column]')).toBeInTheDocument();
    expect(container.querySelector('[aria-pressed="true"]')).toBeInTheDocument();
    const before = ref.current!;
    const markup = serializeFigureSvg(before, { ...DEFAULT_PUBLICATION_SETTINGS, widthMm: 180, heightMm: 180 / ratio }).markup;
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toBe(before.getAttribute('viewBox'));
    for (const [selector, attr] of [['.upset-matrix circle', 'cy'], ['.upset-intersection-bar', 'height']]) {
      expect([...doc.querySelectorAll(selector)].map((n) => n.getAttribute(attr))).toEqual([...before.querySelectorAll(selector)].map((n) => n.getAttribute(attr)));
    }
    expect(markup).not.toContain('data-selection-column');
    rerender(<UpSetChart ref={ref} {...props} selectedMask={null} />);
    expect(container.querySelector('[data-selection-column]')).not.toBeInTheDocument();
  });
});
