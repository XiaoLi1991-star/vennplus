import type { FigureStyleOptions } from '../types';

export const DEFAULT_FIGURE_STYLE: FigureStyleOptions = {
  fillMode: 'filled',
  fillOpacity: 0.42,
  strokeWidth: 1.25,
  strokeColorMode: 'palette',
  customStrokeColor: '#566169',
  setLabelFontScale: 1,
  setLabelsBold: false,
  regionLabelFontScale: 1,
  regionLabelsBold: false,
  upsetLabelFontScale: 1,
  upsetLabelsBold: false,
  upsetValueFontScale: 1,
  upsetValuesBold: false,
  upsetColumnScale: 1,
  upsetRowScale: 1,
};

export function hasFigureFill(style: FigureStyleOptions): boolean {
  return style.fillMode === 'filled' && style.fillOpacity > 0;
}

export function resolveFigureStrokeColor(setColor: string, style: FigureStyleOptions): string {
  if (!hasFigureFill(style) || style.strokeColorMode === 'palette') return setColor;
  return style.customStrokeColor;
}
