import type {
  FigureStyleOptions,
  PublicationSettings,
  ViewMode,
} from '../types';

export interface PublicationAssessment {
  minimumFontPt: number;
  status: 'ready' | 'check' | 'unsafe';
  label: string;
  messages: string[];
}

export const DEFAULT_PUBLICATION_SETTINGS: PublicationSettings = {
  widthMm: 180,
  heightMm: 120,
  rasterDpi: 600,
  background: 'white',
};

export function getPublicationPixelDimensions(settings: PublicationSettings): {
  width: number;
  height: number;
} {
  return {
    width: Math.round((settings.widthMm / 25.4) * settings.rasterDpi),
    height: Math.round((settings.heightMm / 25.4) * settings.rasterDpi),
  };
}

export function getMinimumFigureFontUserUnits(
  mode: ViewMode,
  setCount: number,
  figureStyle: FigureStyleOptions,
): number {
  if (mode === 'upset') {
    return Math.min(
      11 * figureStyle.upsetLabelFontScale,
      11 * figureStyle.upsetValueFontScale,
    );
  }
  if (mode === 'euler') {
    return Math.min(
      12 * figureStyle.regionLabelFontScale,
      13 * figureStyle.setLabelFontScale,
    );
  }
  const regionBase = setCount === 4 ? 0.13 : 0.145;
  const setBase = setCount >= 5 ? 0.19 : 0.15;
  return Math.min(
    regionBase * figureStyle.regionLabelFontScale,
    setBase * figureStyle.setLabelFontScale,
  );
}

export function assessPublicationFigure({
  mode,
  setCount,
  topN,
  figureStyle,
  viewBoxWidth,
  settings,
}: {
  mode: ViewMode;
  setCount: number;
  topN: number;
  figureStyle: FigureStyleOptions;
  viewBoxWidth: number;
  settings: PublicationSettings;
}): PublicationAssessment {
  const widthPt = (settings.widthMm / 25.4) * 72;
  const minimumFontPt =
    viewBoxWidth > 0
      ? (getMinimumFigureFontUserUnits(mode, setCount, figureStyle) / viewBoxWidth) * widthPt
      : 0;
  const messages: string[] = [];

  if (minimumFontPt < 6) messages.push('最终字号低于 6 pt，正文阅读风险较高。');
  else if (minimumFontPt < 7) messages.push('最终字号接近下限，建议按原尺寸检查。');

  if (mode === 'venn' && setCount === 5) {
    messages.push('五组 Venn 结构较密，正文建议使用双栏并保留 UpSet 作为备选。');
  }
  if (mode === 'upset' && topN > 20 && settings.widthMm < 240) {
    messages.push(`Top ${topN} 建议使用至少 240 mm 宽的成品画布。`);
  }
  if (mode === 'euler' && setCount === 4) {
    messages.push('四组 Euler 需要检查中央区域标签是否被自动省略。');
  }

  const unsafe = minimumFontPt < 6 || (mode === 'upset' && topN > 30 && settings.widthMm < 280);
  const check = messages.length > 0;
  return {
    minimumFontPt,
    status: unsafe ? 'unsafe' : check ? 'check' : 'ready',
    label: unsafe ? '不建议直接投稿' : check ? '需要检查' : '发表尺寸通过',
    messages,
  };
}
