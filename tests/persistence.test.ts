import { describe, expect, it } from 'vitest';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { cloneExample, DEFAULT_EXAMPLE } from '../src/data/examples';
import {
  createWorkspaceProject,
  normalizeWorkspaceState,
  parseWorkspaceProject,
} from '../src/lib/persistence';
import type { WorkspaceState } from '../src/types';

function workspace(): WorkspaceState {
  return {
    projectTitle: '持久化测试',
    sets: cloneExample(DEFAULT_EXAMPLE),
    mode: 'venn',
    display: { regionLabelMode: 'both', showSetNames: true, showEmpty: false },
    figureStyle: DEFAULT_FIGURE_STYLE,
    setLabelPositions: { venn: {}, euler: {} },
    paletteId: 'ggvenn-soft',
    selectedMask: 15,
    topN: 20,
    sort: 'size',
    publication: DEFAULT_PUBLICATION_SETTINGS,
  };
}

describe('VennPlus workspace persistence', () => {
  it('round-trips a versioned project file without storing derived analysis', () => {
    const original = workspace();
    const project = createWorkspaceProject(original);
    const restored = parseWorkspaceProject(JSON.parse(JSON.stringify(project)) as unknown);

    expect(restored).toEqual(original);
    expect(project).not.toHaveProperty('analysis');
  });

  it('rejects non-project JSON and unsupported versions', () => {
    expect(() => parseWorkspaceProject({})).toThrow('不是 VennPlus');
    expect(() =>
      parseWorkspaceProject({ ...createWorkspaceProject(workspace()), version: 99 }),
    ).toThrow('不支持的项目文件版本');
  });

  it('normalizes unsafe display and style values', () => {
    const original = workspace();
    const normalized = normalizeWorkspaceState({
      ...original,
      display: { regionLabelMode: 'invalid', showSetNames: false, showEmpty: true },
      figureStyle: { ...original.figureStyle, fillOpacity: 9, strokeWidth: -4 },
    });

    expect(normalized.display).toEqual({
      regionLabelMode: 'count',
      showSetNames: false,
      showEmpty: true,
    });
    expect(normalized.figureStyle.fillOpacity).toBe(1);
    expect(normalized.figureStyle.strokeWidth).toBe(0.5);
  });

  it('migrates the former shared Venn/Euler typography without changing UpSet defaults', () => {
    const original = workspace();
    const {
      setLabelFontScale: _setScale,
      setLabelsBold: _setBold,
      regionLabelFontScale: _regionScale,
      regionLabelsBold: _regionBold,
      upsetLabelFontScale: _upsetLabelScale,
      upsetLabelsBold: _upsetLabelBold,
      upsetValueFontScale: _upsetValueScale,
      upsetValuesBold: _upsetValueBold,
      upsetColumnScale: _upsetColumnScale,
      upsetRowScale: _upsetRowScale,
      ...paintStyle
    } = original.figureStyle;
    const normalized = normalizeWorkspaceState({
      ...original,
      figureStyle: { ...paintStyle, fontScale: 1.35, labelsBold: true },
    });

    expect(normalized.figureStyle.setLabelFontScale).toBe(1.35);
    expect(normalized.figureStyle.regionLabelFontScale).toBe(1.35);
    expect(normalized.figureStyle.setLabelsBold).toBe(true);
    expect(normalized.figureStyle.regionLabelsBold).toBe(true);
    expect(normalized.figureStyle.upsetLabelFontScale).toBe(1);
    expect(normalized.figureStyle.upsetValueFontScale).toBe(1);
    expect(normalized.figureStyle.upsetLabelsBold).toBe(false);
    expect(normalized.figureStyle.upsetValuesBold).toBe(false);
    expect(normalized.figureStyle.upsetColumnScale).toBe(1);
    expect(normalized.figureStyle.upsetRowScale).toBe(1);
  });

  it('persists an explicitly cleared selection', () => {
    const normalized = normalizeWorkspaceState({ ...workspace(), selectedMask: 0 });
    expect(normalized.selectedMask).toBe(0);
  });

  it('restores publication defaults from older project state', () => {
    const { publication: _publication, ...legacy } = workspace();
    const normalized = normalizeWorkspaceState(legacy);
    expect(normalized.publication).toEqual(DEFAULT_PUBLICATION_SETTINGS);
  });

  it('accepts projects containing eight sets', () => {
    const original = workspace();
    const source = original.sets[0];
    const sets = Array.from({ length: 8 }, (_, index) => ({
      ...source,
      id: `set-${index + 1}`,
      name: `Group ${index + 1}`,
    }));

    const normalized = normalizeWorkspaceState({ ...original, sets });
    expect(normalized.sets).toHaveLength(8);
    expect(normalized.mode).toBe('upset');
  });
});
