import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FigureControls } from '../src/components/FigureControls';
import { InspectorPanel } from '../src/components/InspectorPanel';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { PALETTES } from '../src/data/palettes';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
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
}: {
  mode?: ViewMode;
  figureStyle?: FigureStyleOptions;
  displayOptions?: DisplayOptions;
  hasCustomLabelPositions?: boolean;
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
      onFigureStyleChange={() => undefined}
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

    expect(screen.queryByLabelText('透明度')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('边框颜色模式')).not.toBeInTheDocument();
    expect(screen.getByLabelText('线宽')).toBeInTheDocument();
  });

  it('keeps the opacity control available when filled opacity reaches zero', () => {
    renderFigureControls({
      figureStyle: { ...DEFAULT_FIGURE_STYLE, fillOpacity: 0 },
    });

    expect(screen.getByLabelText('透明度')).toBeInTheDocument();
    expect(screen.queryByLabelText('边框颜色模式')).not.toBeInTheDocument();
  });

  it('keeps UpSet label and value typography separate without Venn shape controls', () => {
    renderFigureControls({ mode: 'upset' });

    expect(screen.getByText('集合名称与坐标')).toBeInTheDocument();
    expect(screen.getByText('交集值')).toBeInTheDocument();
    expect(screen.getAllByLabelText('字号')).toHaveLength(2);
    expect(screen.queryByLabelText('填充模式')).not.toBeInTheDocument();
  });
});

describe('output settings inspector', () => {
  it('contains output parameters without duplicating download actions', () => {
    const onPublicationChange = vi.fn();
    render(
      <InspectorPanel
        activeTab="export"
        mode="venn"
        display={display}
        figureStyle={DEFAULT_FIGURE_STYLE}
        hasCustomLabelPositions={false}
        palettes={PALETTES}
        paletteId={PALETTES[0].id}
        topN={20}
        sort="size"
        publication={DEFAULT_PUBLICATION_SETTINGS}
        assessment={{
          minimumFontPt: 8.2,
          status: 'ready',
          label: '发表尺寸通过',
          messages: [],
        }}
        onTabChange={() => undefined}
        onDisplayChange={() => undefined}
        onFigureStyleChange={() => undefined}
        onResetSetLabelPositions={() => undefined}
        onPaletteChange={() => undefined}
        onTopNChange={() => undefined}
        onSortChange={() => undefined}
        onPublicationChange={onPublicationChange}
      />,
    );

    expect(screen.getByRole('button', { name: '导出设置' })).toBeInTheDocument();
    expect(screen.getByText('成品尺寸')).toBeInTheDocument();
    expect(screen.getByText('文件规格')).toBeInTheDocument();
    expect(screen.getByText('计算与导出说明')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SVG' })).not.toBeInTheDocument();
    expect(screen.queryByText('发表尺寸通过')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('成品宽度 mm'), { target: { value: '210' } });
    expect(onPublicationChange).toHaveBeenCalledWith({ widthMm: 210 });
  });
});
