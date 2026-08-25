import type {
  DisplayOptions,
  FigureStyleOptions,
  LabelPoint,
  RegionLabelMode,
  SetDefinition,
  SetLabelPositions,
  UpSetSort,
  ViewMode,
  WorkspaceState,
} from '../types';
import { DEFAULT_PUBLICATION_SETTINGS } from '../data/publication';
import {
  MAX_EULER_SET_COUNT,
  MAX_SET_COUNT,
  MAX_VENN_SET_COUNT,
  MIN_SET_COUNT,
} from '../data/limits';

const DATABASE_NAME = 'vennplus-workspace';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';
const AUTOSAVE_KEY = 'autosave';
const FALLBACK_STORAGE_KEY = 'vennplus.workspace.v1';

export const WORKSPACE_FILE_VERSION = 1;

interface WorkspaceProjectFile {
  kind: 'vennplus-project';
  version: number;
  savedAt: string;
  state: WorkspaceState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeScale(value: unknown, fallback: number, maximum: number): number {
  return isFiniteNumber(value) ? Math.min(maximum, Math.max(0.75, value)) : fallback;
}

function normalizeLabelPoint(value: unknown): LabelPoint | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  return { x: value.x, y: value.y };
}

function normalizeLabelPositions(value: unknown): SetLabelPositions {
  if (!isRecord(value)) return {};
  const positions: SetLabelPositions = {};
  Object.entries(value).forEach(([key, point]) => {
    const normalized = normalizeLabelPoint(point);
    if (normalized) positions[key] = normalized;
  });
  return positions;
}

function normalizeSets(value: unknown): SetDefinition[] {
  if (!Array.isArray(value) || value.length < MIN_SET_COUNT || value.length > MAX_SET_COUNT) {
    throw new Error(`项目文件需要包含 ${MIN_SET_COUNT}–${MAX_SET_COUNT} 个集合`);
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个集合格式无效`);
    const { id, name, color, text } = item;
    if (![id, name, color, text].every((field) => typeof field === 'string')) {
      throw new Error(`第 ${index + 1} 个集合缺少名称、颜色或输入数据`);
    }
    return { id, name, color, text } as SetDefinition;
  });
}

function normalizeDisplay(value: unknown): DisplayOptions {
  if (!isRecord(value)) throw new Error('标签设置格式无效');
  const labelModes: RegionLabelMode[] = ['count', 'percentage', 'both', 'none'];
  const regionLabelMode = labelModes.includes(value.regionLabelMode as RegionLabelMode)
    ? (value.regionLabelMode as RegionLabelMode)
    : 'count';
  return {
    regionLabelMode,
    showSetNames: value.showSetNames !== false,
    showEmpty: value.showEmpty === true,
  };
}

function normalizeFigureStyle(value: unknown): FigureStyleOptions {
  if (!isRecord(value)) throw new Error('图形样式格式无效');
  const fillMode = value.fillMode === 'outline' ? 'outline' : 'filled';
  const strokeColorMode = value.strokeColorMode === 'custom' ? 'custom' : 'palette';
  // Projects saved before split typography controls used one shared scale and
  // weight for Venn/Euler. Preserve that appearance when the old fields exist;
  // UpSet did not use the legacy controls and therefore starts from 100%.
  const legacyScale = normalizeScale(value.fontScale, 1, 1.6);
  const legacyBold = value.labelsBold === true;
  return {
    fillMode,
    fillOpacity: isFiniteNumber(value.fillOpacity)
      ? Math.min(1, Math.max(0, value.fillOpacity))
      : 0.42,
    strokeWidth: isFiniteNumber(value.strokeWidth)
      ? Math.min(4, Math.max(0.5, value.strokeWidth))
      : 1.25,
    strokeColorMode,
    customStrokeColor:
      typeof value.customStrokeColor === 'string' ? value.customStrokeColor : '#566169',
    setLabelFontScale: normalizeScale(value.setLabelFontScale, legacyScale, 1.8),
    setLabelsBold:
      typeof value.setLabelsBold === 'boolean' ? value.setLabelsBold : legacyBold,
    regionLabelFontScale: normalizeScale(value.regionLabelFontScale, legacyScale, 1.6),
    regionLabelsBold:
      typeof value.regionLabelsBold === 'boolean' ? value.regionLabelsBold : legacyBold,
    upsetLabelFontScale: normalizeScale(value.upsetLabelFontScale, 1, 1.5),
    upsetLabelsBold: value.upsetLabelsBold === true,
    upsetValueFontScale: normalizeScale(value.upsetValueFontScale, 1, 1.4),
    upsetValuesBold: value.upsetValuesBold === true,
  };
}

function normalizePublication(value: unknown) {
  if (!isRecord(value)) return DEFAULT_PUBLICATION_SETTINGS;
  const legacySize =
    value.presetId === 'single-column'
      ? { widthMm: 85, heightMm: 66 }
      : value.presetId === 'supplement-landscape'
        ? { widthMm: 320, heightMm: 180 }
        : DEFAULT_PUBLICATION_SETTINGS;
  return {
    widthMm: isFiniteNumber(value.widthMm)
      ? Math.min(320, Math.max(40, value.widthMm))
      : legacySize.widthMm,
    heightMm: isFiniteNumber(value.heightMm)
      ? Math.min(320, Math.max(40, value.heightMm))
      : legacySize.heightMm,
    rasterDpi: isFiniteNumber(value.rasterDpi)
      ? Math.round(Math.min(600, Math.max(72, value.rasterDpi)))
      : DEFAULT_PUBLICATION_SETTINGS.rasterDpi,
    background: value.background === 'transparent' ? ('transparent' as const) : ('white' as const),
  };
}

export function normalizeWorkspaceState(value: unknown): WorkspaceState {
  if (!isRecord(value)) throw new Error('项目文件内容无效');
  const sets = normalizeSets(value.sets);
  const modes: ViewMode[] = ['venn', 'euler', 'upset'];
  const requestedMode = modes.includes(value.mode as ViewMode) ? (value.mode as ViewMode) : 'venn';
  const mode =
    (requestedMode === 'venn' && sets.length > MAX_VENN_SET_COUNT) ||
    (requestedMode === 'euler' && sets.length > MAX_EULER_SET_COUNT)
      ? 'upset'
      : requestedMode;
  const sorts: UpSetSort[] = ['size', 'degree'];
  const sort = sorts.includes(value.sort as UpSetSort) ? (value.sort as UpSetSort) : 'size';
  const topOptions = [10, 15, 20, 30, 50];
  const topN = topOptions.includes(value.topN as number) ? (value.topN as number) : 20;
  const rawPositions = isRecord(value.setLabelPositions) ? value.setLabelPositions : {};

  return {
    projectTitle: typeof value.projectTitle === 'string' ? value.projectTitle : 'vennplus-figure',
    sets,
    mode,
    display: normalizeDisplay(value.display),
    figureStyle: normalizeFigureStyle(value.figureStyle),
    setLabelPositions: {
      venn: normalizeLabelPositions(rawPositions.venn),
      euler: normalizeLabelPositions(rawPositions.euler),
    },
    paletteId: typeof value.paletteId === 'string' ? value.paletteId : 'ggvenn-soft',
    selectedMask: Number.isInteger(value.selectedMask) ? Math.max(1, Number(value.selectedMask)) : 1,
    topN,
    sort,
    publication: normalizePublication(value.publication),
  };
}

export function createWorkspaceProject(state: WorkspaceState): WorkspaceProjectFile {
  return {
    kind: 'vennplus-project',
    version: WORKSPACE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
}

export function parseWorkspaceProject(value: unknown): WorkspaceState {
  if (!isRecord(value) || value.kind !== 'vennplus-project') {
    throw new Error('这不是 VennPlus 项目文件');
  }
  if (value.version !== WORKSPACE_FILE_VERSION) {
    throw new Error(`不支持的项目文件版本：${String(value.version)}`);
  }
  return normalizeWorkspaceState(value.state);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地草稿数据库'));
  });
}

async function saveToIndexedDb(project: WorkspaceProjectFile): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(project, AUTOSAVE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('本地草稿保存失败'));
      transaction.onabort = () => reject(transaction.error ?? new Error('本地草稿保存已中止'));
    });
  } finally {
    database.close();
  }
}

async function loadFromIndexedDb(): Promise<unknown | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(AUTOSAVE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error('本地草稿读取失败'));
    });
  } finally {
    database.close();
  }
}

export async function saveWorkspaceDraft(state: WorkspaceState): Promise<void> {
  const project = createWorkspaceProject(state);
  if (typeof indexedDB !== 'undefined') {
    try {
      await saveToIndexedDb(project);
      return;
    } catch {
      // Some private browsing modes expose IndexedDB but reject writes.
    }
  }
  localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(project));
}

export async function loadWorkspaceDraft(): Promise<WorkspaceState | null> {
  let stored: unknown | null = null;
  if (typeof indexedDB !== 'undefined') {
    try {
      stored = await loadFromIndexedDb();
    } catch {
      stored = null;
    }
  }
  if (stored === null) {
    const fallback = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!fallback) return null;
    stored = JSON.parse(fallback) as unknown;
  }
  return parseWorkspaceProject(stored);
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'vennplus'
  );
}

export function exportWorkspaceProject(state: WorkspaceState): void {
  const project = createWorkspaceProject(state);
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(state.projectTitle)}.vennplus.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importWorkspaceProject(file: File): Promise<WorkspaceState> {
  const raw = JSON.parse(await file.text()) as unknown;
  return parseWorkspaceProject(raw);
}
