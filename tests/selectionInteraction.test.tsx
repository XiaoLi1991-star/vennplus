import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FigurePanel } from '../src/components/FigurePanel';
import { EXAMPLES } from '../src/data/examples';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { analyzeSets } from '../src/lib/sets';
import type { ViewMode } from '../src/types';

const sets = EXAMPLES.find((example) => example.id === 'three-treatments')!.sets.map((set) => ({
  ...set,
}));
const analysis = analyzeSets(sets);
const selectedRegion = analysis.regions.find((region) => region.count > 0)!;

const regionSelector: Record<ViewMode, string> = {
  venn: '.venn-region-label[data-region-interaction="true"][role="button"]',
  euler: '.euler-hit-layer [data-region-interaction="true"]',
  upset: '.upset-bars [data-region-interaction="true"]',
};

describe.each<ViewMode>(['venn', 'euler', 'upset'])('%s selection interaction', (mode) => {
  it('clears from canvas whitespace but preserves region clicks', () => {
    const onClearSelection = vi.fn();
    const onSelectRegion = vi.fn();
    const { container } = render(
      <FigurePanel
        sets={sets}
        analysis={analysis}
        isAnalyzing={false}
        mode={mode}
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        publication={DEFAULT_PUBLICATION_SETTINGS}
        selectedRegion={selectedRegion}
        labelPositions={{}}
        topN={20}
        sort="size"
        inputCollapsed={false}
        inspectorCollapsed={false}
        isPresentationPreview={false}
        onModeChange={() => undefined}
        onSelectRegion={onSelectRegion}
        onClearSelection={onClearSelection}
        onSetLabelPositionChange={() => undefined}
        onToggleInput={() => undefined}
        onToggleInspector={() => undefined}
        onTogglePresentationPreview={() => undefined}
        onDownloadRegionTxt={() => undefined}
        onDownloadRegionCsv={() => undefined}
      />,
    );

    fireEvent.click(container.querySelector('.figure-stage')!);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    onClearSelection.mockClear();

    fireEvent.click(container.querySelector(regionSelector[mode])!);
    expect(onSelectRegion).toHaveBeenCalledTimes(1);
    expect(onClearSelection).not.toHaveBeenCalled();
  });
});

describe('Venn canvas hit testing', () => {
  it('clears selection when the click is outside every set shape', () => {
    const onClearSelection = vi.fn();
    const { container } = render(
      <FigurePanel
        sets={sets}
        analysis={analysis}
        isAnalyzing={false}
        mode="venn"
        display={{ regionLabelMode: 'count', showSetNames: true, showEmpty: false }}
        figureStyle={DEFAULT_FIGURE_STYLE}
        publication={DEFAULT_PUBLICATION_SETTINGS}
        selectedRegion={selectedRegion}
        labelPositions={{}}
        topN={20}
        sort="size"
        inputCollapsed={false}
        inspectorCollapsed={false}
        isPresentationPreview={false}
        onModeChange={() => undefined}
        onSelectRegion={() => undefined}
        onClearSelection={onClearSelection}
        onSetLabelPositionChange={() => undefined}
        onToggleInput={() => undefined}
        onToggleInspector={() => undefined}
        onTogglePresentationPreview={() => undefined}
        onDownloadRegionTxt={() => undefined}
        onDownloadRegionCsv={() => undefined}
      />,
    );
    const svg = container.querySelector<SVGSVGElement>('svg.venn-figure')!;
    Object.defineProperty(svg, 'getScreenCTM', {
      value: () => ({ inverse: () => ({}) }),
    });
    Object.defineProperty(svg, 'createSVGPoint', {
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      }),
    });

    fireEvent.click(container.querySelector('.venn-hit-area')!, {
      clientX: -100,
      clientY: -100,
    });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
