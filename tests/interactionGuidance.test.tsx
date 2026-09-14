import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { cloneExample, DEFAULT_EXAMPLE, EXAMPLES } from '../src/data/examples';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { DEFAULT_PALETTE } from '../src/data/palettes';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { loadWorkspaceDraft } from '../src/lib/persistence';
import type { WorkspaceState } from '../src/types';

vi.mock('../src/lib/persistence', async (original) => ({
  ...await original<typeof import('../src/lib/persistence')>(),
  loadWorkspaceDraft: vi.fn(async () => null),
  saveWorkspaceDraft: vi.fn(async () => undefined),
}));
vi.mock('../src/lib/figureMetrics', () => ({ measureFigureFonts: () => ({ minimum: 10, labels: 12, values: 10 }) }));

beforeEach(() => {
  vi.mocked(loadWorkspaceDraft).mockResolvedValue(null);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openApp() {
  const result = render(<App />);
  await waitFor(() => expect(screen.queryByText('正在恢复本机草稿')).not.toBeInTheDocument());
  return result;
}
function example(id: string) { fireEvent.change(screen.getByLabelText('示例'), { target: { value: id } }); }
function mode(name: string) { return screen.getByRole('button', { name }); }

describe('contextual drawing guidance', () => {
  it('starts new workspaces with a three-set colored Venn and mode-labeled examples', async () => {
    const { container } = await openApp();
    expect(DEFAULT_EXAMPLE.sets).toHaveLength(3);
    expect(screen.getByLabelText('填充模式')).toHaveValue('filled');
    expect(container.querySelector('.venn-set-layer > *')).toHaveAttribute('fill-opacity', '0.42');
    expect(screen.getByLabelText('不透明度数值')).toHaveValue(42);
    expect(screen.getByRole('option', { name: /6组 · 仅 UpSet/ })).toBeInTheDocument();
    expect(screen.getByText(/本工具 Venn 支持 2–5 组，Euler 支持 2–4 组/)).toBeInTheDocument();
  });

  it('respects saved outline styling, resets appearance only, and undoes the reset', async () => {
    const draft: WorkspaceState = {
      projectTitle: 'Saved', sets: cloneExample(EXAMPLES.find((e) => e.id === 'four-biomarkers')!),
      mode: 'venn', display: { regionLabelMode: 'none', showSetNames: false, showEmpty: false },
      figureStyle: { ...DEFAULT_FIGURE_STYLE, fillMode: 'outline', fillOpacity: 0, strokeWidth: 3 },
      setLabelPositions: { venn: {}, euler: {} }, paletteId: DEFAULT_PALETTE.id,
      selectedMask: 0, topN: 50, sort: 'degree', publication: { ...DEFAULT_PUBLICATION_SETTINGS, widthMm: 210 },
    };
    vi.mocked(loadWorkspaceDraft).mockResolvedValue(draft);
    const { container } = await openApp();
    expect(screen.getByLabelText('填充模式')).toHaveValue('outline');
    const data = screen.getByLabelText('Control 的成员标识列表');
    expect(data).toHaveValue(draft.sets[0].text);
    fireEvent.click(screen.getByRole('button', { name: '恢复默认样式' }));
    expect(screen.getByLabelText('填充模式')).toHaveValue('filled');
    expect(screen.getByLabelText('不透明度数值')).toHaveValue(42);
    expect(container.querySelector('.venn-set-layer > *')).toHaveAttribute('fill-opacity', '0.42');
    expect(data).toHaveValue(draft.sets[0].text);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(screen.getByLabelText('填充模式')).toHaveValue('outline');
    expect(screen.queryByText(/已恢复默认彩色填充/)).not.toBeInTheDocument();
    fireEvent.click(mode('UpSet'));
    expect(screen.getByText(/当前显示 15\/15/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '前 50 个' }).parentElement).toHaveValue('50');
    fireEvent.click(screen.getByRole('button', { name: '导出' }));
    expect(screen.getByLabelText('成品宽度 mm')).toHaveValue(210);
  });

  it('keeps intentional outline styling when loading examples', async () => {
    await openApp();
    fireEvent.change(screen.getByLabelText('填充模式'), { target: { value: 'outline' } });
    example('two-cohorts');
    expect(screen.getByLabelText('填充模式')).toHaveValue('outline');
    expect(screen.getByText(/保留当前样式，可撤销恢复原数据/)).toBeInTheDocument();
  });

  it('distinguishes unavailable modes from crowded but supported five-set Venn', async () => {
    await openApp();
    example('five-pathways');
    expect(mode('Venn')).toBeEnabled();
    expect(mode('Euler')).toBeDisabled();
    expect(screen.getByText(/五组 Venn 可用但较拥挤/)).toBeInTheDocument();
    expect(mode('Euler')).toHaveAttribute('title', expect.stringContaining('2–4 组'));
    example('six-cohorts');
    expect(mode('Venn')).toBeDisabled();
    expect(mode('Euler')).toBeDisabled();
    expect(mode('UpSet')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/当前组数仅支持 UpSet/)).toBeInTheDocument();
    const hint = document.getElementById(mode('Venn').getAttribute('aria-describedby')!);
    expect(hint).toHaveTextContent('本工具 Venn 支持');
  });

  it.each(['添加集合', '复制组'])('explains automatic switching after %s and clears the reason on undo', async (action) => {
    await openApp();
    example(action === '添加集合' ? 'five-pathways' : 'four-biomarkers');
    if (action === '复制组') fireEvent.click(mode('Euler'));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(mode('UpSet')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/超过 .* 组上限，已自动切换为 UpSet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(screen.queryByText(/超过 .* 组上限，已自动切换为 UpSet/)).not.toBeInTheDocument();
    expect(mode(action === '添加集合' ? 'Venn' : 'Euler')).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains a six-set import and opens complete unfiltered intersections from the chart', async () => {
    await openApp();
    fireEvent.click(screen.getByRole('button', { name: '粘贴表格／导入文件' }));
    fireEvent.change(screen.getByLabelText('粘贴集合表格'), { target: { value: 'A\tB\tC\tD\tE\tF\nx\tx\tx\tx\tx\tx' } });
    fireEvent.click(screen.getByRole('button', { name: '确认导入并替换' }));
    expect(document.querySelector('.mode-switch-reason')).toHaveTextContent('导入后共有 6 个集合');
    example('six-cohorts');
    expect(screen.getByText(/当前显示 20\/50 个非空交集/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看全部交集' }));
    expect(screen.getByLabelText('搜索全部交集')).toHaveFocus();
    expect(screen.getAllByRole('row')).toHaveLength(51);
    fireEvent.change(screen.getByLabelText('搜索全部交集'), { target: { value: 'no-match-123' } });
    fireEvent.click(screen.getByRole('button', { name: '收起结果区' }));
    fireEvent.click(screen.getByRole('button', { name: '查看全部交集' }));
    expect(screen.getByLabelText('搜索全部交集')).toHaveValue('');
    expect(screen.getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText(/当前显示 20\/50 个非空交集/)).toBeInTheDocument();
  });

  it('describes Euler approximation in Chinese and matches opacity endpoints', async () => {
    const { container } = await openApp();
    fireEvent.change(screen.getByLabelText('不透明度数值'), { target: { value: '100' } });
    expect(container.querySelector('.venn-set-layer > *')).toHaveAttribute('fill-opacity', '1');
    fireEvent.change(screen.getByLabelText('不透明度数值'), { target: { value: '0' } });
    expect(container.querySelector('.venn-set-layer > *')).toHaveAttribute('fill', 'none');
    expect(screen.getByText(/当前填充不可见/)).toBeInTheDocument();
    example('three-proportional-euler');
    expect(within(document.querySelector('.mode-guidance') as HTMLElement).getByText(/精确比较请以交集数值为准/)).toBeInTheDocument();
  });
});
