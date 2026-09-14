import { forwardRef, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type {
  DisplayOptions,
  FigureStyleOptions,
  PublicationSettings,
  Region,
  SetAnalysis,
  SetDefinition,
  SetLabelPositions,
  ViewMode,
} from '../types';
import { EulerChart } from './EulerChart';
import { PublicationToolbar } from './PublicationToolbar';
import { IntersectionResults, type IntersectionResultsHandle } from './IntersectionResults';
import { UpSetChart, type UpSetSort } from './UpSetChart';
import { VennChart } from './VennChart';

interface FigurePanelProps {
  sets: SetDefinition[];
  analysis: SetAnalysis;
  isAnalyzing: boolean;
  mode: ViewMode;
  modeNotice?: string;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  publication: PublicationSettings;
  selectedRegion: Region | null;
  labelPositions: SetLabelPositions;
  topN: number;
  sort: UpSetSort;
  inputCollapsed: boolean;
  inspectorCollapsed: boolean;
  isPresentationPreview: boolean;
  onModeChange: (mode: ViewMode) => void;
  onSelectRegion: (mask: number) => void;
  onClearSelection: () => void;
  onSetLabelPositionChange: (setId: string, position: { x: number; y: number }) => void;
  onToggleInput: () => void;
  onToggleInspector: () => void;
  onTogglePresentationPreview: () => void;
  onDownloadRegionTxt: (region: Region) => void;
  onDownloadRegionCsv: (region: Region) => void;
}

export const FigurePanel = forwardRef<SVGSVGElement, FigurePanelProps>(function FigurePanel(
  {
    sets,
    analysis,
    isAnalyzing,
    mode,
    modeNotice,
    display,
    figureStyle,
    publication,
    selectedRegion,
    labelPositions,
    topN,
    sort,
    inputCollapsed,
    inspectorCollapsed,
    isPresentationPreview,
    onModeChange,
    onSelectRegion,
    onClearSelection,
    onSetLabelPositionChange,
    onToggleInput,
    onToggleInspector,
    onTogglePresentationPreview,
    onDownloadRegionTxt,
    onDownloadRegionCsv,
  },
  ref,
) {
  const [zoomByMode, setZoomByMode] = useState({ venn: 1, euler: 1 });
  const resultsRef = useRef<IntersectionResultsHandle>(null);
  const intersectionCount = analysis.regions.length;
  const zoomableMode = mode === 'venn' || mode === 'euler' ? mode : null;
  const targetAspectRatio = publication.widthMm / publication.heightMm;
  const zoom = zoomableMode ? zoomByMode[zoomableMode] : 1;
  const updateZoom = (next: number) => {
    if (!zoomableMode) return;
    setZoomByMode((current) => ({
      ...current,
      [zoomableMode]: Math.min(2, Math.max(0.75, next)),
    }));
  };

  return (
    <main className={`figure-workspace ${isPresentationPreview ? 'is-presentation-preview' : ''}`}>
      <PublicationToolbar
        zoomControls={zoomableMode ? (
            <div className="canvas-zoom-controls" aria-label="画布缩放">
              <button
                type="button"
                aria-label="缩小画布"
                title="缩小画布"
                disabled={zoom <= 0.75}
                onClick={() => updateZoom(zoom - 0.25)}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <button
                className="zoom-value-button"
                type="button"
                aria-label="适应视图"
                title="恢复 100% 并适应视图"
                disabled={zoom === 1}
                onClick={() => updateZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="放大画布"
                title="放大画布"
                disabled={zoom >= 2}
                onClick={() => updateZoom(zoom + 0.25)}
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        mode={mode}
        modeNotice={modeNotice}
        setCount={sets.length}
        inputCollapsed={inputCollapsed}
        inspectorCollapsed={inspectorCollapsed}
        isPresentationPreview={isPresentationPreview}
        onModeChange={onModeChange}
        onToggleInput={onToggleInput}
        onToggleInspector={onToggleInspector}
        onTogglePresentationPreview={onTogglePresentationPreview}
      />
      <div className={`figure-surface figure-surface-${mode}`}>
        <div className="figure-meta">
        <div className="figure-summary" data-export-ignore="true" aria-live="polite">
          <span>{sets.length} 个集合</span>
          <span>{analysis.unionCount} 个唯一成员</span>
          <span>{analysis.regions.filter((region) => region.count > 0).length} 个非空交集</span>
          {isAnalyzing ? <span className="analysis-status">正在计算最新输入…</span> : null}

        </div>
        {mode === 'upset' && !isAnalyzing ? <div className="upset-scope" data-export-ignore="true">
          <span aria-live="polite">当前显示 {Math.min(topN, intersectionCount)}/{intersectionCount} 个非空交集{topN < intersectionCount ? '，其余交集未在图中展示。' : '，已全部展示。'}</span>
          <button type="button" disabled={!intersectionCount} onClick={() => {
            onClearSelection(); resultsRef.current?.showAll();
          }}>查看全部交集</button>
        </div> : null}
        </div>
        <div
          className="figure-stage"
          onClick={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest('[data-region-interaction="true"], .draggable-set-label')
            ) return;
            onClearSelection();
          }}
        >
          {isAnalyzing ? <p role="status">正在计算最新输入，完成后显示图形与交集。</p> : mode === 'venn' || mode === 'euler' ? (
            <div
              className="figure-canvas"
              style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
            >
              {mode === 'venn' ? (
                <VennChart
                  ref={ref}
                  sets={sets}
                  analysis={analysis}
                  selectedMask={selectedRegion?.mask ?? null}
                  display={display}
                  figureStyle={figureStyle}
                  labelPositions={labelPositions}
                  targetAspectRatio={targetAspectRatio}
                  onSelectRegion={onSelectRegion}
                  onClearSelection={onClearSelection}
                  onSetLabelPositionChange={onSetLabelPositionChange}
                />
              ) : (
                <EulerChart
                  ref={ref}
                  sets={sets}
                  analysis={analysis}
                  selectedMask={selectedRegion?.mask ?? null}
                  display={display}
                  figureStyle={figureStyle}
                  labelPositions={labelPositions}
                  targetAspectRatio={targetAspectRatio}
                  onSelectRegion={onSelectRegion}
                  onSetLabelPositionChange={onSetLabelPositionChange}
                />
              )}
            </div>
          ) : (
            <UpSetChart
              ref={ref}
              sets={sets}
              analysis={analysis}
              display={display}
              figureStyle={figureStyle}
              topN={topN}
              sort={sort}
              selectedMask={selectedRegion?.mask}
              targetAspectRatio={targetAspectRatio}
              onSelectRegion={onSelectRegion}
            />
          )}
        </div>
      </div>
      <IntersectionResults
        ref={resultsRef}
        sets={sets}
        analysis={analysis}
        region={selectedRegion}
        onSelect={onSelectRegion}
        onClear={onClearSelection}
        onDownloadTxt={onDownloadRegionTxt}
        onDownloadCsv={onDownloadRegionCsv}
      />
    </main>
  );
});
