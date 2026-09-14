import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FigureControls } from '../src/components/FigureControls';
import { InspectorPanel } from '../src/components/InspectorPanel';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { PALETTES } from '../src/data/palettes';
import type { DisplayOptions, FigureStyleOptions, ViewMode } from '../src/types';

const display: DisplayOptions = {
  regionLabelMode: 'count',
  showSetNames: true,
  showEmpty: false,
};

afterEach(cleanup);

function renderFigureControls({
  mode = 'venn',
  figureStyle = DEFAULT_FIGURE_STYLE,
  displayOptions = display,
  hasCustomLabelPositions = false,
  onFigureStyleChange = () => undefined,
}: {
  mode?: ViewMode;
  figureStyle?: FigureStyleOptions;
  displayOptions?: DisplayOptions;
  hasCustomLabelPositions?: boolean;
  onFigureStyleChange?: (patch: Partial<FigureStyleOptions>) => void;
} = {}) {
  return render(
    <FigureControls
      mode={mode}
      display={displayOptions}
      figureStyle={figureStyle}
      hasCustomLabelPositions={hasCustomLabelPositions}
      palettes={PALETTES}
      paletteId={PALETTES[0].id}
      topN={20}
      sort="size"
      onDisplayChange={() => undefined}
      onFigureStyleChange={onFigureStyleChange}
      onResetSetLabelPositions={() => undefined}
      onPaletteChange={() => undefined}
      onTopNChange={() => undefined}
      onSortChange={() => undefined}
    />,
  );
}

describe('simplified figure controls', () => {
  it('keeps group and region typography together while hiding inactive actions', () => {
    renderFigureControls();

    expect(screen.getByText('标签与文字')).toBeInTheDocument();
    expect(screen.getByText('组名')).toBeInTheDocument();
    expect(screen.getByText('交集值')).toBeInTheDocument();
    expect(screen.getAllByLabelText('字号')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '重置位置' })).not.toBeInTheDocument();
  });

  it('only shows controls that apply to outline mode', () => {
    renderFigureControls({
      figureStyle: { ...DEFAULT_FIGURE_STYLE, fillMode: 'outline' },
    });

    expect(screen.queryByLabelText('不透明度')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('边框颜色模式')).not.toBeInTheDocument();
    expect(screen.getByLabelText('线宽')).toBeInTheDocument();
  });

  it('keeps the opacity control available when filled opacity reaches zero', () => {
    renderFigureControls({
      figureStyle: { ...DEFAULT_FIGURE_STYLE, fillOpacity: 0 },
    });

    expect(screen.getByLabelText('不透明度')).toBeInTheDocument();
    expect(screen.getByText(/当前填充不可见/)).toBeInTheDocument();
    expect(screen.queryByLabelText('边框颜色模式')).not.toBeInTheDocument();
  });

  it('keeps UpSet label and value typography separate without Venn shape controls', () => {
    const onFigureStyleChange = vi.fn();
    renderFigureControls({ mode: 'upset', onFigureStyleChange });

    expect(screen.getByText('集合名称与坐标')).toBeInTheDocument();
    expect(screen.getByText('交集值')).toBeInTheDocument();
    expect(screen.getAllByLabelText('字号')).toHaveLength(2);
    expect(screen.getByLabelText('交集列距')).toHaveValue('1');
    expect(screen.getByLabelText('集合行距')).toHaveValue('1');
    expect(screen.getByText('仅调整矩阵疏密，不改变统计值')).toBeInTheDocument();
    expect(screen.queryByLabelText('填充模式')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('交集列距'), { target: { value: '0.75' } });
    expect(onFigureStyleChange).toHaveBeenCalledWith({ upsetColumnScale: 0.75 });
    fireEvent.change(screen.getByLabelText('集合行距'), { target: { value: '1.25' } });
    expect(onFigureStyleChange).toHaveBeenCalledWith({ upsetRowScale: 1.25 });
  });
});

describe('style-only inspector', () => {
  it('keeps figure controls and font metrics separate from export actions', () => {
    render(
      <InspectorPanel
        onResetStyle={() => undefined}
        mode="venn"
        display={display}
        figureStyle={DEFAULT_FIGURE_STYLE}
        hasCustomLabelPositions={false}
        palettes={PALETTES}
        paletteId={PALETTES[0].id}
        topN={20}
        sort="size"
        fontMetrics={{ minimum: 8.2, labels: 10, values: 8.2 }}
        onDisplayChange={() => undefined}
        onFigureStyleChange={() => undefined}
        onResetSetLabelPositions={() => undefined}
        onPaletteChange={() => undefined}
        onTopNChange={() => undefined}
        onSortChange={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: '图形设置' })).toBeInTheDocument();
    expect(screen.getByText('成品字号')).toBeInTheDocument();
    expect(screen.queryByText('成品尺寸')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SVG' })).not.toBeInTheDocument();
    expect(screen.queryByText('发表尺寸通过')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /ggvenn 柔和/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
