export type ViewMode = 'venn' | 'euler' | 'upset';
export type UpSetSort = 'size' | 'degree';
export type ExportBackground = 'white' | 'transparent';

export interface SetDefinition {
  id: string;
  name: string;
  color: string;
  text: string;
}

export interface Region {
  mask: number;
  key: string;
  setIndices: number[];
  members: string[];
  count: number;
  percentage: number;
}

export interface SetAnalysis {
  parsedSets: string[][];
  duplicateCounts: number[];
  unionMembers: string[];
  unionCount: number;
  regions: Region[];
  regionByMask: Map<number, Region>;
}

export type RegionLabelMode = 'count' | 'percentage' | 'both' | 'none';

export interface DisplayOptions {
  regionLabelMode: RegionLabelMode;
  showSetNames: boolean;
  showEmpty: boolean;
}

export type FigureFillMode = 'filled' | 'outline';
export type StrokeColorMode = 'palette' | 'custom';

export interface FigureStyleOptions {
  fillMode: FigureFillMode;
  fillOpacity: number;
  strokeWidth: number;
  strokeColorMode: StrokeColorMode;
  customStrokeColor: string;
  setLabelFontScale: number;
  setLabelsBold: boolean;
  regionLabelFontScale: number;
  regionLabelsBold: boolean;
  upsetLabelFontScale: number;
  upsetLabelsBold: boolean;
  upsetValueFontScale: number;
  upsetValuesBold: boolean;
}

export interface PublicationSettings {
  widthMm: number;
  heightMm: number;
  rasterDpi: number;
  background: ExportBackground;
}

export interface ExampleDefinition {
  id: string;
  name: string;
  description: string;
  sets: SetDefinition[];
  defaultMode: ViewMode;
}

export interface EllipseGeometry {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
}

export interface LabelPoint {
  x: number;
  y: number;
}

export interface ContourGeometry {
  kind: 'contour';
  points: LabelPoint[];
}

export type ShapeGeometry = EllipseGeometry | ContourGeometry;

export type SetLabelPositions = Record<string, LabelPoint>;

export interface WorkspaceState {
  projectTitle: string;
  sets: SetDefinition[];
  mode: ViewMode;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  setLabelPositions: Record<'venn' | 'euler', SetLabelPositions>;
  paletteId: string;
  selectedMask: number;
  topN: number;
  sort: UpSetSort;
  publication: PublicationSettings;
}

export interface VennTemplate {
  viewBox: [number, number, number, number];
  shapes: ShapeGeometry[];
  regionLabels: Map<number, LabelPoint>;
  setLabels: LabelPoint[];
}
