import { Download, SlidersHorizontal } from 'lucide-react';
import {
  getPublicationPixelDimensions,
  type PublicationAssessment,
} from '../data/publication';
import type { PalettePreset } from '../data/palettes';
import type {
  DisplayOptions,
  FigureStyleOptions,
  PublicationSettings,
  UpSetSort,
  ViewMode,
} from '../types';
import { FigureControls } from './FigureControls';

export type InspectorTab = 'style' | 'export';

interface InspectorPanelProps {
  activeTab: InspectorTab;
  mode: ViewMode;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  hasCustomLabelPositions: boolean;
  palettes: readonly PalettePreset[];
  paletteId: string;
  topN: number;
  sort: UpSetSort;
  publication: PublicationSettings;
  assessment: PublicationAssessment;
  onTabChange: (tab: InspectorTab) => void;
  onDisplayChange: (patch: Partial<DisplayOptions>) => void;
  onFigureStyleChange: (patch: Partial<FigureStyleOptions>) => void;
  onResetSetLabelPositions: () => void;
  onPaletteChange: (id: string) => void;
  onTopNChange: (value: number) => void;
  onSortChange: (value: UpSetSort) => void;
  onPublicationChange: (patch: Partial<PublicationSettings>) => void;
}

const TABS: Array<{ id: InspectorTab; label: string; icon: typeof SlidersHorizontal }> = [
  { id: 'style', label: '样式', icon: SlidersHorizontal },
  { id: 'export', label: '导出设置', icon: Download },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function InspectorPanel({
  activeTab,
  mode,
  display,
  figureStyle,
  hasCustomLabelPositions,
  palettes,
  paletteId,
  topN,
  sort,
  publication,
  assessment,
  onTabChange,
  onDisplayChange,
  onFigureStyleChange,
  onResetSetLabelPositions,
  onPaletteChange,
  onTopNChange,
  onSortChange,
  onPublicationChange,
}: InspectorPanelProps) {
  const pixels = getPublicationPixelDimensions(publication);
  const updateNumber = (
    key: 'widthMm' | 'heightMm' | 'rasterDpi',
    value: string,
  ) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) onPublicationChange({ [key]: parsed });
  };
  const normalizeNumber = (
    key: 'widthMm' | 'heightMm' | 'rasterDpi',
    minimum: number,
    maximum: number,
  ) => {
    onPublicationChange({ [key]: clamp(publication[key], minimum, maximum) });
  };

  return (
    <aside className="panel inspector-panel" aria-label="图形设置">
      <nav className="inspector-tabs" aria-label="设置页面">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'is-active' : ''}
            aria-pressed={activeTab === id}
            onClick={() => onTabChange(id)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className={`inspector-content inspector-content-${activeTab}`}>
        {activeTab === 'style' ? (
          <FigureControls
            mode={mode}
            display={display}
            figureStyle={figureStyle}
            hasCustomLabelPositions={hasCustomLabelPositions}
            palettes={palettes}
            paletteId={paletteId}
            topN={topN}
            sort={sort}
            onDisplayChange={onDisplayChange}
            onFigureStyleChange={onFigureStyleChange}
            onResetSetLabelPositions={onResetSetLabelPositions}
            onPaletteChange={onPaletteChange}
            onTopNChange={onTopNChange}
            onSortChange={onSortChange}
          />
        ) : null}

        {activeTab === 'export' ? (
          <div className="publication-export-panel">
            <section className="inspector-section output-size-section">
              <h3>成品尺寸</h3>
              <p className="inspector-section-note">
                直接填写最终文件尺寸（40–320 mm，72–600 DPI）。画布会自动适配新比例，图形几何不会被拉伸。
              </p>
              <div className="output-dimension-grid">
                <label className="dimension-field">
                  <span>宽度 <small>Width</small></span>
                  <span className="dimension-input">
                    <input
                      type="number"
                      aria-label="成品宽度 mm"
                      min={40}
                      max={320}
                      step={1}
                      value={publication.widthMm}
                      onChange={(event) => updateNumber('widthMm', event.target.value)}
                      onBlur={() => normalizeNumber('widthMm', 40, 320)}
                    />
                    <i>mm</i>
                  </span>
                </label>
                <label className="dimension-field">
                  <span>高度 <small>Height</small></span>
                  <span className="dimension-input">
                    <input
                      type="number"
                      aria-label="成品高度 mm"
                      min={40}
                      max={320}
                      step={1}
                      value={publication.heightMm}
                      onChange={(event) => updateNumber('heightMm', event.target.value)}
                      onBlur={() => normalizeNumber('heightMm', 40, 320)}
                    />
                    <i>mm</i>
                  </span>
                </label>
                <label className="dimension-field">
                  <span>分辨率 <small>Raster DPI</small></span>
                  <span className="dimension-input">
                    <input
                      type="number"
                      aria-label="位图分辨率 DPI"
                      min={72}
                      max={600}
                      step={1}
                      value={publication.rasterDpi}
                      onChange={(event) => updateNumber('rasterDpi', event.target.value)}
                      onBlur={() => normalizeNumber('rasterDpi', 72, 600)}
                    />
                    <i>dpi</i>
                  </span>
                </label>
              </div>
            </section>

            <section className="inspector-section current-output-section">
              <h3>文件规格</h3>
              <dl className="publication-specs">
                <div><dt>Physical size</dt><dd>{publication.widthMm} × {publication.heightMm} mm</dd></div>
                <div><dt>Raster size</dt><dd>{pixels.width} × {pixels.height} px</dd></div>
                <div><dt>Vector</dt><dd>SVG · PDF</dd></div>
              </dl>
            </section>

            <section className="inspector-section export-options-section">
              <h3>背景 Background</h3>
              <label className="inspector-field">
                <span>导出背景</span>
                <select
                  aria-label="导出背景"
                  value={publication.background}
                  onChange={(event) =>
                    onPublicationChange({
                      background: event.target.value as PublicationSettings['background'],
                    })
                  }
                >
                  <option value="white">白色 White</option>
                  <option value="transparent">透明 Transparent</option>
                </select>
              </label>
            </section>

            {assessment.status !== 'ready' && assessment.messages.length > 0 ? (
              <section className="publication-warnings" aria-label="导出检查提示">
                <div className="publication-warning-heading">
                  <strong>{assessment.label}</strong>
                  <span>{assessment.minimumFontPt.toFixed(1)} pt</span>
                </div>
                {assessment.messages.map((message) => <p key={message}>{message}</p>)}
              </section>
            ) : null}

            <details className="output-guidance-disclosure">
              <summary>计算与导出说明</summary>
              <div>
                <p>交集按精确成员关系统计；百分比以全部集合的并集为分母。</p>
                <p>SVG 与 PDF 为矢量格式；PNG 与 TIFF 使用上方物理尺寸和 DPI。</p>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
