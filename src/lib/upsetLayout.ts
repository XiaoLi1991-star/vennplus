import { estimateSvgTextWidth } from './labelLayout';

export const UPSET_BASE_WIDTH = 860;
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
const STANDARD_COLUMN_STEP = 30;
const COMPACT_COLUMN_STEP = 36;
const MIN_PLOT_WIDTH = 144;
const RIGHT_PADDING = 24;
const LONG_SET_NAME_SCROLL_WIDTH = 190;
export const UPSET_MIN_RENDER_SCALE = 0.72;
export const UPSET_MIN_COLUMN_SCALE = 0.75;
export const UPSET_MAX_COLUMN_SCALE = 1.5;
export const UPSET_MIN_ROW_SCALE = 0.75;
export const UPSET_MAX_ROW_SCALE = 1.5;

const MATRIX_TOP = 240;
const NOTE_GAP = 45;
const BOTTOM_PADDING = 25;
const MIN_HEIGHT = 350;

export interface UpSetLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotWidth: number;
  columnStep: number;
  matrixTop: number;
  matrixBottom: number;
  rowStep: number;
  noteY: number;
  setNameX: number;
  setNameGap: number;
  isDense: boolean;
  minViewportWidth?: number;
}

export interface UpSetLayoutTypography {
  labelScale: number;
  valueScale: number;
  columnScale?: number;
  rowScale?: number;
}

function getBaseColumnStep(regionCount: number): number {
  if (regionCount <= 10) return COMPACT_COLUMN_STEP;
  if (regionCount <= 20) return STANDARD_COLUMN_STEP;
  return DENSE_COLUMN_STEP;
}

function getBaseRowStep(setCount: number): number {
  if (setCount <= 4) return 28;
  if (setCount <= 6) return 24;
  return 20;
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
  const columnScale = Math.min(
    UPSET_MAX_COLUMN_SCALE,
    Math.max(UPSET_MIN_COLUMN_SCALE, typography.columnScale ?? 1),
  );
  // A fixed full-width plot makes the seven possible intersections of a
  // three-set UpSet look unnaturally sparse. Derive the plot width from the
  // number of observed intersections instead, while keeping a readable
  // minimum lane and the established dense Top 50 spacing.
  const targetColumnStep = getBaseColumnStep(safeRegionCount) * columnScale;
  const plotWidth = Math.max(MIN_PLOT_WIDTH, safeRegionCount * targetColumnStep);
  const plotRight = plotLeft + plotWidth;
  const width = plotRight + RIGHT_PADDING;
  const columnStep = safeRegionCount > 0 ? plotWidth / safeRegionCount : 40;
  const rowScale = Math.min(
    UPSET_MAX_ROW_SCALE,
    Math.max(UPSET_MIN_ROW_SCALE, typography.rowScale ?? 1),
  );
  const rowStep = setNames.length > 1 ? getBaseRowStep(setNames.length) * rowScale : 0;
  const matrixBottom = MATRIX_TOP + rowStep * Math.max(0, setNames.length - 1);
  const noteY = matrixBottom + NOTE_GAP;
  const height = Math.max(MIN_HEIGHT, noteY + BOTTOM_PADDING);
  // Long set names can make the complete chart wider than the standard
  // viewport even when there are only 20 intersections. Treat that case as
  // dense as well so the preview keeps a readable scale and scrolls instead
  // of shrinking the whole SVG to fit.
  const isDense = plotWidth > BASE_PLOT_WIDTH || maxSetNameWidth > LONG_SET_NAME_SCROLL_WIDTH;

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotWidth,
    columnStep,
    matrixTop: MATRIX_TOP,
    matrixBottom,
    rowStep,
    noteY,
    setNameX,
    setNameGap: plotLeft - (setNameX + maxSetNameWidth),
    isDense,
    minViewportWidth: isDense ? Math.ceil(width * UPSET_MIN_RENDER_SCALE) : undefined,
  };
}
