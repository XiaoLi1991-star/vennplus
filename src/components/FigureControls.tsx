import { hasFigureFill } from '../data/figureStyle';
import { RotateCcw } from 'lucide-react';
import type { PalettePreset } from '../data/palettes';
import type { DisplayOptions, FigureStyleOptions, ViewMode } from '../types';
import type { UpSetSort } from './UpSetChart';

interface FigureControlsProps {
  mode: ViewMode;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  hasCustomLabelPositions: boolean;
  palettes: readonly PalettePreset[];
  paletteId: string;
  topN: number;
  sort: UpSetSort;
  onDisplayChange: (patch: Partial<DisplayOptions>) => void;
  onFigureStyleChange: (patch: Partial<FigureStyleOptions>) => void;
  onResetSetLabelPositions: () => void;
  onPaletteChange: (id: string) => void;
  onTopNChange: (value: number) => void;
  onSortChange: (value: UpSetSort) => void;
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-control">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
      <span>{label}</span>
    </label>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  output,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  output: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`slider-control ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{output}</output>
    </label>
  );
}

function TypographyRow({
  title,
  scale,
  bold,
  minimum = 0.75,
  maximum,
  onScaleChange,
  onBoldChange,
}: {
  title: string;
  scale: number;
  bold: boolean;
  minimum?: number;
  maximum: number;
  onScaleChange: (value: number) => void;
  onBoldChange: (value: boolean) => void;
}) {
  return (
    <div className="typography-control-row">
      <span className="typography-control-title">{title}</span>
      <SliderControl
        label="字号"
        value={scale}
        min={minimum}
        max={maximum}
        step={0.05}
        output={`${Math.round(scale * 100)}%`}
        onChange={onScaleChange}
      />
      <Toggle checked={bold} label="加粗" onChange={onBoldChange} />
    </div>
  );
}

export function FigureControls({
  mode,
  display,
  figureStyle,
  hasCustomLabelPositions,
  palettes,
  paletteId,
  topN,
  sort,
  onDisplayChange,
  onFigureStyleChange,
  onResetSetLabelPositions,
  onPaletteChange,
  onTopNChange,
  onSortChange,
}: FigureControlsProps) {
  const currentPalette = palettes.find((palette) => palette.id === paletteId) ?? palettes[0];
  const fillEnabled = figureStyle.fillMode === 'filled';
  const hasVisibleFill = hasFigureFill(figureStyle);

  return (
    <div className="figure-controls">
      <div className="figure-controls-primary">
        <div className="control-group label-controls-group">
          <span className="control-group-label">标签与文字</span>

          {mode !== 'upset' ? (
            <div className="semantic-label-setting">
              <div className="semantic-setting-heading">
                <strong>组名</strong>
                <Toggle
                  checked={display.showSetNames}
                  label="显示"
                  onChange={(showSetNames) => onDisplayChange({ showSetNames })}
                />
              </div>
              {display.showSetNames ? (
                <TypographyRow
                  title="文字"
                  scale={figureStyle.setLabelFontScale}
                  bold={figureStyle.setLabelsBold}
                  maximum={1.8}
                  onScaleChange={(setLabelFontScale) =>
                    onFigureStyleChange({ setLabelFontScale })
                  }
                  onBoldChange={(setLabelsBold) => onFigureStyleChange({ setLabelsBold })}
                />
              ) : null}
              {hasCustomLabelPositions ? (
                <button
                  className="label-reset-button"
                  type="button"
                  onClick={onResetSetLabelPositions}
                >
                  <RotateCcw size={14} />
                  重置位置
                </button>
              ) : null}
            </div>
          ) : (
            <div className="semantic-label-setting">
              <TypographyRow
                title="集合名称与坐标"
                scale={figureStyle.upsetLabelFontScale}
                bold={figureStyle.upsetLabelsBold}
                maximum={1.5}
                onScaleChange={(upsetLabelFontScale) =>
                  onFigureStyleChange({ upsetLabelFontScale })
                }
                onBoldChange={(upsetLabelsBold) => onFigureStyleChange({ upsetLabelsBold })}
              />
            </div>
          )}

          <div className="semantic-label-setting">
            <label className="compact-select-control region-label-mode-control">
              <span>交集值</span>
              <select
                aria-label="交集标签"
                value={display.regionLabelMode}
                onChange={(event) =>
                  onDisplayChange({
                    regionLabelMode: event.target.value as DisplayOptions['regionLabelMode'],
                  })
                }
              >
                <option value="count">数量 Count</option>
                <option value="percentage">占并集比例</option>
                <option value="both">数值 + 占并集比例</option>
                <option value="none">不显示</option>
              </select>
            </label>
            {display.regionLabelMode !== 'none' ? (
              <TypographyRow
                title="文字"
                scale={
                  mode === 'upset'
                    ? figureStyle.upsetValueFontScale
                    : figureStyle.regionLabelFontScale
                }
                bold={
                  mode === 'upset'
                    ? figureStyle.upsetValuesBold
                    : figureStyle.regionLabelsBold
                }
                maximum={mode === 'upset' ? 1.4 : 1.6}
                onScaleChange={(value) =>
                  mode === 'upset'
                    ? onFigureStyleChange({ upsetValueFontScale: value })
                    : onFigureStyleChange({ regionLabelFontScale: value })
                }
                onBoldChange={(value) =>
                  mode === 'upset'
                    ? onFigureStyleChange({ upsetValuesBold: value })
                    : onFigureStyleChange({ regionLabelsBold: value })
                }
              />
            ) : null}
          </div>
        </div>

        {mode === 'upset' ? (
          <div className="control-group upset-options">
            <label>
              <span>排序</span>
              <select value={sort} onChange={(event) => onSortChange(event.target.value as UpSetSort)}>
                <option value="size">按交集数量</option>
                <option value="degree">按参与组数</option>
              </select>
            </label>
            <label>
              <span>显示</span>
              <select value={topN} onChange={(event) => onTopNChange(Number(event.target.value))}>
                {[10, 15, 20, 30, 50].map((value) => (
                  <option key={value} value={value}>
                    Top {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <label className="palette-control">
          <span className="control-group-label">配色 Palette</span>
          <div className="palette-select-wrap">
            <div className="palette-swatches" aria-hidden="true">
              {currentPalette.colors.map((color) => (
                <span key={color} style={{ backgroundColor: color }} />
              ))}
            </div>
            <select value={paletteId} onChange={(event) => onPaletteChange(event.target.value)}>
              {palettes.map((palette) => (
                <option key={palette.id} value={palette.id}>
                  {palette.name}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {mode !== 'upset' ? (
        <div className="figure-style-controls" aria-label="图形样式">
          <span className="control-group-label">图形样式</span>
          <label className="compact-select-control">
            <span>填充</span>
            <select
              aria-label="填充模式"
              value={figureStyle.fillMode}
              onChange={(event) =>
                onFigureStyleChange({
                  fillMode: event.target.value as FigureStyleOptions['fillMode'],
                })
              }
            >
              <option value="filled">彩色填充</option>
              <option value="outline">仅边框</option>
            </select>
          </label>

          {fillEnabled ? (
            <SliderControl
              label="透明度"
              value={figureStyle.fillOpacity}
              min={0}
              max={1}
              step={0.05}
              output={`${Math.round(figureStyle.fillOpacity * 100)}%`}
              onChange={(fillOpacity) => onFigureStyleChange({ fillOpacity })}
            />
          ) : null}

          {hasVisibleFill ? (
            <label className="compact-select-control border-color-control">
              <span>边框</span>
              <span className="border-color-fields">
                <select
                  aria-label="边框颜色模式"
                  value={figureStyle.strokeColorMode}
                  onChange={(event) =>
                    onFigureStyleChange({
                      strokeColorMode: event.target.value as FigureStyleOptions['strokeColorMode'],
                    })
                  }
                >
                  <option value="palette">色板同色</option>
                  <option value="custom">自定义</option>
                </select>
                {figureStyle.strokeColorMode === 'custom' ? (
                  <input
                    type="color"
                    aria-label="自定义边框颜色"
                    value={figureStyle.customStrokeColor}
                    onChange={(event) =>
                      onFigureStyleChange({ customStrokeColor: event.target.value })
                    }
                  />
                ) : null}
              </span>
            </label>
          ) : null}

          <SliderControl
            label="线宽"
            value={figureStyle.strokeWidth}
            min={0.5}
            max={4}
            step={0.25}
            output={`${Number(figureStyle.strokeWidth.toFixed(2))} px`}
            onChange={(strokeWidth) => onFigureStyleChange({ strokeWidth })}
          />
        </div>
      ) : null}
    </div>
  );
}
