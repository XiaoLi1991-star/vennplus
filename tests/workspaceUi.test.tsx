import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetImportDialog } from '../src/components/SetImportDialog';
import { ExportDialog } from '../src/components/ExportDialog';
import { NumberField } from '../src/components/NumberField';
import { IntersectionResults } from '../src/components/IntersectionResults';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { analyzeSets } from '../src/lib/sets';
import { FigureControls } from '../src/components/FigureControls';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { PALETTES } from '../src/data/palettes';

afterEach(cleanup);

describe('preview-first imports', () => {
  it('previews names and unique counts without replacing data until confirmation', async () => {
    const onImport = vi.fn(), onClose = vi.fn();
    render(<SetImportDialog onClose={onClose} onImport={onImport} />);
    expect(screen.getByRole('button', { name: '确认导入并替换' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('粘贴集合表格'), { target: { value: '发现队列\t验证队列\nTP53\tEGFR\nTP53\tBRCA1' } });
    await screen.findByText('识别到 2 个集合');
    expect(screen.getByText('1 个成员')).toBeInTheDocument();
    expect(screen.getByText('2 个成员')).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认导入并替换' }));
    expect(onImport).toHaveBeenCalledWith([{ name: '发现队列', text: 'TP53\nTP53' }, { name: '验证队列', text: 'EGFR\nBRCA1' }]);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('blocks malformed data and recovers after corrections', async () => {
    render(<SetImportDialog onClose={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('粘贴集合表格'), { target: { value: 'A\tA\nx\ty' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('组名重复');
    expect(screen.getByRole('button', { name: '确认导入并替换' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('粘贴集合表格'), { target: { value: 'A\tB\nx\ty' } });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '确认导入并替换' })).toBeEnabled();
  });
  it('requires confirmation for files too, and preserves separate paste drafts', async () => {
    const onImport = vi.fn();
    render(<SetImportDialog onClose={vi.fn()} onImport={onImport} />);
    fireEvent.change(screen.getByLabelText('粘贴集合表格'), { target: { value: 'Paste A\tPaste B\nx\ty' } });
    fireEvent.click(screen.getByRole('button', { name: '选择文件' }));
    const file = { name: 'cohorts.tsv', size: 25, text: async () => 'File A\tFile B\nx\ty' };
    fireEvent.change(screen.getByLabelText('导入集合文件'), { target: { files: [file] } });
    await screen.findByText('File A');
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '粘贴表格' }));
    expect(screen.getByLabelText('粘贴集合表格')).toHaveValue('Paste A\tPaste B\nx\ty');
  });
  it('rejects oversized and unreadable files without enabling confirmation', async () => {
    render(<SetImportDialog onClose={vi.fn()} onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '选择文件' }));
    fireEvent.change(screen.getByLabelText('导入集合文件'), { target: { files: [{ name: 'large.csv', size: 21 * 1024 * 1024 }] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('20 MB');
    fireEvent.change(screen.getByLabelText('导入集合文件'), { target: { files: [{ name: 'bad.csv', size: 10, text: async () => { throw new Error(); } }] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('文件读取失败'));
    expect(screen.getByRole('button', { name: '确认导入并替换' })).toBeDisabled();
  });
});

describe('unified export settings', () => {
  const actions = ['svg', 'png', 'pdf', 'tiff', 'csv', 'xlsx', 'project', 'manifest'].map((id) => ({ id, label: id.toUpperCase(), description: id, run: vi.fn() }));
  function Example({ run = vi.fn(), analyzing = false }: { run?: () => Promise<void> | void; analyzing?: boolean }) {
    const [publication, update] = useState(DEFAULT_PUBLICATION_SETTINGS);
    return <ExportDialog publication={publication} minimumFontPt={10.8} onPublicationChange={(patch) => update((p) => ({ ...p, ...patch }))}
      actions={actions.map((a) => ({ ...a, run }))} onClose={vi.fn()} isAnalyzing={analyzing} />;
  }
  it('shows DPI only for raster and preserves settings when switching formats', () => {
    render(<Example />);
    expect(screen.queryByLabelText('位图分辨率 DPI')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    fireEvent.change(screen.getByLabelText('位图分辨率 DPI'), { target: { value: '300' } });
    fireEvent.blur(screen.getByLabelText('位图分辨率 DPI'));
    fireEvent.change(screen.getByLabelText('成品宽度 mm'), { target: { value: '210' } });
    fireEvent.blur(screen.getByLabelText('成品宽度 mm'));
    fireEvent.click(screen.getByRole('button', { name: 'SVG' }));
    expect(screen.getByLabelText('成品宽度 mm')).toHaveValue(210);
    expect(screen.queryByLabelText('位图分辨率 DPI')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'TIFF' }));
    expect(screen.getByLabelText('位图分辨率 DPI')).toHaveValue(300);
    fireEvent.click(screen.getByRole('button', { name: '数据表' }));
    expect(screen.queryByText('成品尺寸')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载 XLSX' })).toBeInTheDocument();
  });
  it('prevents duplicate downloads while busy, then reports a retryable failure', async () => {
    let reject!: (error: Error) => void;
    const run = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    render(<Example run={run} />);
    fireEvent.click(screen.getByRole('button', { name: '下载 SVG' }));
    expect(screen.getByRole('button', { name: '正在导出…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PNG' })).toBeDisabled();
    await act(async () => reject(new Error('test failure')));
    expect(screen.getByRole('alert')).toHaveTextContent('文件生成失败');
    expect(screen.getByRole('button', { name: '下载 SVG' })).toBeEnabled();
    expect(run).toHaveBeenCalledOnce();
  });
  it('disables download during analysis', () => {
    render(<Example analyzing />);
    expect(screen.getByRole('button', { name: '下载 SVG' })).toBeDisabled();
  });
});

describe('precise values and readable result controls', () => {
  it('does not commit empty/out-of-range drafts, clamps on blur and restores empty fields', () => {
    const change = vi.fn();
    render(<NumberField label="宽度" value={180} min={40} max={320} onChange={change} />);
    const field = screen.getByLabelText('宽度');
    fireEvent.change(field, { target: { value: '' } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(field).toHaveValue(180);
    fireEvent.change(field, { target: { value: '999' } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(change).toHaveBeenLastCalledWith(320);
  });
  it('converts percentage fields to figure scales and exposes full palette names', () => {
    const change = vi.fn(), palette = vi.fn();
    render(<FigureControls mode="venn" display={{ showSetNames: true, showEmpty: false, regionLabelMode: 'count' }} figureStyle={DEFAULT_FIGURE_STYLE} hasCustomLabelPositions={false} palettes={PALETTES} paletteId={PALETTES[0].id} topN={20} sort="size" onDisplayChange={vi.fn()} onFigureStyleChange={change} onResetSetLabelPositions={vi.fn()} onPaletteChange={palette} onTopNChange={vi.fn()} onSortChange={vi.fn()} />);
    fireEvent.change(screen.getAllByLabelText('字号数值')[0], { target: { value: '125' } });
    expect(change).toHaveBeenCalledWith({ setLabelFontScale: 1.25 });
    fireEvent.click(screen.getByRole('button', { name: '冷色矿物' }));
    expect(palette).toHaveBeenCalledWith('cool-mineral');
    expect(screen.getByRole('button', { name: /ggvenn 柔和/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('renders named group chips and preserves the table query through collapse/expand', () => {
    const sets = [{ id: 'a', name: '发现组', text: 'shared\nA', color: '#123456' }, { id: 'b', name: '验证组', text: 'shared\nB', color: '#654321' }];
    const { container } = render(<IntersectionResults sets={sets} analysis={analyzeSets(sets)} region={null} onSelect={vi.fn()} onClear={vi.fn()} onDownloadTxt={vi.fn()} onDownloadCsv={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '全部交集（3）' }));
    fireEvent.change(screen.getByLabelText('搜索全部交集'), { target: { value: 'shared' } });
    expect(container.querySelectorAll('.group-chip')).toHaveLength(2);
    expect(screen.getByText('排除：无')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起结果区' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '展开结果区' }));
    expect(screen.getByLabelText('搜索全部交集')).toHaveValue('shared');
    expect(container.querySelector('.intersection-results')).toHaveClass('is-expanded-results');
    fireEvent.click(screen.getByRole('button', { name: '还原结果区' }));
    expect(container.querySelector('.intersection-results')).not.toHaveClass('is-expanded-results');
  });
});
