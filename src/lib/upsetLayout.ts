import { estimateSvgTextWidth } from './labelLayout';

export const UPSET_BASE_WIDTH = 860;
export const UPSET_HEIGHT = 430;
export const UPSET_SET_BAR_X = 18;
export const UPSET_SET_BAR_WIDTH = 118;
export const UPSET_SET_COUNT_X = UPSET_SET_BAR_X + UPSET_SET_BAR_WIDTH + 12;
export const UPSET_SET_COUNT_FONT_SIZE = 11;
export const UPSET_SET_NAME_X = 164;
export const UPSET_SET_NAME_FONT_SIZE = 11.5;

const BASE_PLOT_LEFT = 218;
const BASE_PLOT_WIDTH = 618;
const MIN_SET_NAME_GAP = 18;
const MIN_COUNT_NAME_GAP = 12;
const DENSE_COLUMN_STEP = 22;
const RIGHT_PADDING = 24;
const LONG_SET_NAME_SCROLL_WIDTH = 190;
export const UPSET_MIN_RENDER_SCALE = 0.72;

export interface UpSetLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotWidth: number;
  columnStep: number;
  setNameX: number;
  setNameGap: number;
  isDense: boolean;
  minViewportWidth?: number;
}

export interface UpSetLayoutTypography {
  labelScale: number;
  valueScale: number;
}

export function createUpSetLayout(
  setNames: string[],
  regionCount: number,
  setCounts: number[] = [],
  typography: UpSetLayoutTypography = { labelScale: 1, valueScale: 1 },
): UpSetLayout {
  const safeRegionCount = Math.max(0, Math.floor(regionCount));
  const maxSetCountWidth = Math.max(
    0,
    ...setCounts.map((count) =>
      estimateSvgTextWidth(
        String(Math.max(0, Math.floor(count))),
        UPSET_SET_COUNT_FONT_SIZE * typography.valueScale,
        0,
      ),
    ),
  );
  const setNameX = Math.max(
    UPSET_SET_NAME_X,
    Math.ceil(UPSET_SET_COUNT_X + maxSetCountWidth + MIN_COUNT_NAME_GAP),
  );
  const maxSetNameWidth = Math.max(
    0,
    ...setNames.map((name) =>
      estimateSvgTextWidth(name, UPSET_SET_NAME_FONT_SIZE * typography.labelScale),
    ),
  );
  const plotLeft = Math.max(
    BASE_PLOT_LEFT,
    Math.ceil(setNameX + maxSetNameWidth + MIN_SET_NAME_GAP),
  );
  const plotWidth = Math.max(BASE_PLOT_WIDTH, safeRegionCount * DENSE_COLUMN_STEP);
  const plotRight = plotLeft + plotWidth;
  const width = plotRight + RIGHT_PADDING;
  const columnStep = safeRegionCount > 0 ? plotWidth / safeRegionCount : 40;
  // Long set names can make the complete chart wider than the standard
  // viewport even when there are only 20 intersections. Treat that case as
  // dense as well so the preview keeps a readable scale and scrolls instead
  // of shrinking the whole SVG to fit.
  const isDense = plotWidth > BASE_PLOT_WIDTH || maxSetNameWidth > LONG_SET_NAME_SCROLL_WIDTH;

  return {
    width,
    height: UPSET_HEIGHT,
    plotLeft,
    plotRight,
    plotWidth,
    columnStep,
    setNameX,
    setNameGap: plotLeft - (setNameX + maxSetNameWidth),
    isDense,
    minViewportWidth: isDense ? Math.ceil(width * UPSET_MIN_RENDER_SCALE) : undefined,
  };
}
