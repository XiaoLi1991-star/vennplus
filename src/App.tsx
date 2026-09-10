import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { FigurePanel } from './components/FigurePanel';
import { InputPanel } from './components/InputPanel';
import { InspectorPanel } from './components/InspectorPanel';
import type { UpSetSort } from './components/UpSetChart';
import { cloneExample, DEFAULT_EXAMPLE, EXAMPLES } from './data/examples';
import { DEFAULT_FIGURE_STYLE } from './data/figureStyle';
import { MAX_EULER_SET_COUNT, MAX_SET_COUNT, MAX_VENN_SET_COUNT } from './data/limits';
import { DEFAULT_PALETTE, PALETTES } from './data/palettes';
import {
  DEFAULT_PUBLICATION_SETTINGS,
} from './data/publication';
import { useSetAnalysis } from './hooks/useSetAnalysis';
import { useWorkspaceHistory } from './hooks/useWorkspaceHistory';
import {
  exportIntersectionsCsv,
  exportIntersectionsTxt,
  exportPdf,
  exportPng,
  exportPublicationManifest,
  exportRegionCsv,
  exportRegionTxt,
  exportSetsTxt,
  exportSvg,
  exportTiff,
  exportWorkbook,
} from './lib/download';
import { createPublicationManifest } from './lib/publicationManifest';
import { nextSetColor, uniqueSetName } from './lib/setImport';
import { measureFigureFonts } from './lib/figureMetrics';
import {
  exportWorkspaceProject,
  importWorkspaceProject,
  loadWorkspaceDraft,
  saveWorkspaceDraft,
} from './lib/persistence';
import type {
  DisplayOptions,
  FigureStyleOptions,
  LabelPoint,
  PublicationSettings,
  SetDefinition,
  SetLabelPositions,
  ViewMode,
  WorkspaceState,
} from './types';

const DEFAULT_DISPLAY: DisplayOptions = {
  regionLabelMode: 'count',
  showSetNames: true,
  showEmpty: false,
};

const PROJECT_TITLE = 'vennplus-figure';

function createSetId(): string {
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function App() {
  const initialSets = useMemo(() => cloneExample(DEFAULT_EXAMPLE), []);
  const [sets, setSets] = useState<SetDefinition[]>(initialSets);
  const [expandedSetId, setExpandedSetId] = useState(() =>
    window.matchMedia('(max-width: 760px)').matches ? '' : initialSets[0].id,
  );
  const projectTitle = PROJECT_TITLE;
  const [mode, setMode] = useState<ViewMode>(DEFAULT_EXAMPLE.defaultMode);
  const [display, setDisplay] = useState<DisplayOptions>(DEFAULT_DISPLAY);
  const [figureStyle, setFigureStyle] = useState<FigureStyleOptions>(DEFAULT_FIGURE_STYLE);
  const [setLabelPositions, setSetLabelPositions] = useState<
    Record<'venn' | 'euler', SetLabelPositions>
  >({ venn: {}, euler: {} });
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE.id);
  const [selectedMask, setSelectedMask] = useState(0);
  const [topN, setTopN] = useState(20);
  const [sort, setSort] = useState<UpSetSort>('size');
  const [publication, setPublication] = useState<PublicationSettings>(DEFAULT_PUBLICATION_SETTINGS);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [isPresentationPreview, setIsPresentationPreview] = useState(false);
  const [fontMetrics, setFontMetrics] = useState({ minimum: 0, labels: 0, values: 0 });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const figureRef = useRef<SVGSVGElement>(null);
  const dirtyDraftRef = useRef(false);
  const saveSequenceRef = useRef(0);

  const { analysis, isAnalyzing } = useSetAnalysis(sets);
  const selectedRegion = useMemo(() => {
    if (selectedMask === 0) return null;
    const requested = analysis.regionByMask.get(selectedMask);
    return requested?.count ? requested : null;
  }, [analysis, selectedMask]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 2400);
  };

  const workspaceState = useMemo<WorkspaceState>(
    () => ({
      projectTitle,
      sets,
      mode,
      display,
      figureStyle,
      setLabelPositions,
      paletteId,
      selectedMask,
      topN,
      sort,
      publication,
    }),
    [
      display,
      figureStyle,
      mode,
      paletteId,
      projectTitle,
      selectedMask,
      setLabelPositions,
      sets,
      sort,
      topN,
      publication,
    ],
  );

  const applyWorkspaceState = (next: WorkspaceState) => {
    setSets(next.sets);
    setMode(next.mode);
    setDisplay(next.display);
    setFigureStyle(next.figureStyle);
    setSetLabelPositions(next.setLabelPositions);
    setPaletteId(next.paletteId);
    setSelectedMask(next.selectedMask);
    setTopN(next.topN);
    setSort(next.sort);
    setPublication(next.publication);
    setExpandedSetId(window.matchMedia('(max-width: 760px)').matches ? '' : next.sets[0].id);
  };

  const history = useWorkspaceHistory({
    state: workspaceState,
    enabled: draftReady,
    onRestore: applyWorkspaceState,
  });

  useEffect(() => {
    let active = true;
    loadWorkspaceDraft()
      .then((draft) => {
        if (!active) return;
        if (draft) applyWorkspaceState(draft);
        setDraftReady(true);
        setSaveStatus('saved');
      })
      .catch(() => {
        if (!active) return;
        setDraftReady(true);
        setSaveStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    const updateViewBoxWidth = () => {
      if (figureRef.current) setFontMetrics(measureFigureFonts(figureRef.current, publication.widthMm));
    };
    updateViewBoxWidth();
    const frame = window.requestAnimationFrame(updateViewBoxWidth);
    return () => window.cancelAnimationFrame(frame);
  }, [analysis, display, figureStyle, isPresentationPreview, mode, publication, sets, sort, topN]);

  useEffect(() => {
    if (!draftReady) return undefined;
    const saveSequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = saveSequence;
    dirtyDraftRef.current = true;
    setSaveStatus('saving');
    const timeout = window.setTimeout(() => {
      saveWorkspaceDraft(workspaceState)
        .then(() => {
          if (saveSequence !== saveSequenceRef.current) return;
          dirtyDraftRef.current = false;
          setSaveStatus('saved');
        })
        .catch(() => {
          if (saveSequence !== saveSequenceRef.current) return;
          setSaveStatus('error');
        });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [draftReady, workspaceState]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirtyDraftRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, []);

  const updateSet = (id: string, patch: Partial<Pick<SetDefinition, 'name' | 'text'>>) => {
    setSets((current) => current.map((set) => (set.id === id ? { ...set, ...patch } : set)));
  };

  const addSet = () => {
    setSetLabelPositions({ venn: {}, euler: {} });
    setSets((current) => {
      if (current.length >= MAX_SET_COUNT) return current;
      const nextIndex = current.length;
      const next = [
        ...current,
        {
          id: createSetId(),
          name: uniqueSetName(`Group ${String.fromCharCode(65 + nextIndex)}`, current),
          color: nextSetColor(current, (PALETTES.find((palette) => palette.id === paletteId) ?? DEFAULT_PALETTE).colors),
          text: '',
        },
      ];
      setExpandedSetId(next[next.length - 1].id);
      if (
        next.length > MAX_VENN_SET_COUNT ||
        (mode === 'euler' && next.length > MAX_EULER_SET_COUNT)
      ) setMode('upset');
      return next;
    });
  };

  const removeSet = (id: string) => {
    setSelectedMask(0);
    setSetLabelPositions({ venn: {}, euler: {} });
    setSets((current) => {
      if (current.length <= 2) return current;
      const next = current.filter((set) => set.id !== id);
      if (expandedSetId === id) setExpandedSetId(next[0].id);
      return next;
    });
  };

  const duplicateSet = (id: string) => {
    setSetLabelPositions({ venn: {}, euler: {} });
    setSets((current) => {
      if (current.length >= MAX_SET_COUNT) return current;
      const source = current.find((set) => set.id === id);
      if (!source) return current;
      const nextIndex = current.length;
      const duplicate = {
        ...source,
        id: createSetId(),
        name: uniqueSetName(`${source.name} copy`, current),
        color: nextSetColor(current, (PALETTES.find((palette) => palette.id === paletteId) ?? DEFAULT_PALETTE).colors),
      };
      setExpandedSetId(duplicate.id);
      if (
        nextIndex + 1 > MAX_VENN_SET_COUNT ||
        (mode === 'euler' && nextIndex + 1 > MAX_EULER_SET_COUNT)
      ) setMode('upset');
      return [...current, duplicate];
    });
  };

  const loadExample = (exampleId: string) => {
    const example = EXAMPLES.find((item) => item.id === exampleId);
    if (!example) return;
    const next = cloneExample(example).map((set, index) => ({
      ...set,
      color: (PALETTES.find((palette) => palette.id === paletteId) ?? DEFAULT_PALETTE).colors[index],
    }));
    setSets(next);
    setExpandedSetId(window.matchMedia('(max-width: 760px)').matches ? '' : next[0].id);
    setMode(example.defaultMode);
    setSetLabelPositions({ venn: {}, euler: {} });
    setSelectedMask(0);
    showNotice('success', `已加载${example.name}`);
  };

  const changePalette = (id: string) => {
    const palette = PALETTES.find((item) => item.id === id);
    if (!palette) return;
    setPaletteId(id);
    setSets((current) => current.map((set, index) => ({ ...set, color: palette.colors[index] })));
  };

  const runExport = async (task: (svg: SVGSVGElement) => void | Promise<void>, success: string) => {
    const svg = figureRef.current;
    if (!svg) throw new Error('图形尚未就绪');
    try {
      await task(svg);
      showNotice('success', success);
    } catch (error) {
      console.error(error);
      showNotice('error', '导出失败，请重试');
      throw error;
    }
  };

  const handleExportSvg = () =>
    runExport((svg) => exportSvg(svg, projectTitle, publication), 'SVG 已按当前尺寸导出');
  const handleExportPng = () =>
    runExport((svg) => exportPng(svg, projectTitle, publication), 'PNG 已按当前尺寸导出');
  const handleExportPdf = () =>
    runExport((svg) => exportPdf(svg, projectTitle, publication), 'PDF 已按当前尺寸导出');
  const handleExportTiff = () =>
    runExport((svg) => exportTiff(svg, projectTitle, publication), 'TIFF 已写入当前物理 DPI');
  const handleExportXlsx = async () => {
    try {
      await exportWorkbook(sets, analysis, projectTitle, publication);
      showNotice('success', 'XLSX 汇总表与复现元数据已导出');
    } catch (error) {
      console.error(error);
      showNotice('error', 'XLSX 导出失败，请重试');
      throw error;
    }
  };
  const handleExportManifest = async () => {
    const svg = figureRef.current;
    if (!svg) throw new Error('图形尚未就绪');
    try {
      const manifest = await createPublicationManifest({
        state: workspaceState,
        analysis,
      });
      exportPublicationManifest(manifest, projectTitle);
      showNotice('success', '复现清单 JSON 已导出');
    } catch (error) {
      console.error(error);
      showNotice('error', '复现清单导出失败，请重试');
      throw error;
    }
  };

  const selectRegion = (mask: number) => {
    setSelectedMask(mask);
  };

  const movableMode = mode === 'venn' || mode === 'euler' ? mode : null;
  const currentSetLabelPositions = movableMode ? setLabelPositions[movableMode] : {};
  const updateSetLabelPosition = (setId: string, position: LabelPoint) => {
    if (!movableMode) return;
    setSetLabelPositions((current) => ({
      ...current,
      [movableMode]: { ...current[movableMode], [setId]: position },
    }));
  };
  const resetSetLabelPositions = () => {
    if (!movableMode) return;
    setSetLabelPositions((current) => ({ ...current, [movableMode]: {} }));
  };

  return (
    <div className={`app-shell ${isPresentationPreview ? 'is-presentation-preview' : ''}`}>
      <AppHeader
        publication={publication}
        minimumFontPt={fontMetrics.minimum}
        onPublicationChange={(patch) => setPublication((current) => ({ ...current, ...patch }))}
        examples={EXAMPLES}
        onLoadExample={loadExample}
        saveStatus={saveStatus}
        isAnalyzing={isAnalyzing}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onExportProjectJson={() => {
          exportWorkspaceProject(workspaceState);
          showNotice('success', 'VennPlus 项目文件已导出');
        }}
        onImportProjectJson={async (file) => {
          try {
            const imported = await importWorkspaceProject(file);
            applyWorkspaceState(imported);
            showNotice('success', 'VennPlus 项目文件已恢复');
          } catch (error) {
            console.error(error);
            showNotice('error', error instanceof Error ? error.message : '项目文件导入失败');
          }
        }}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onExportTiff={handleExportTiff}
        onExportXlsx={handleExportXlsx}
        onExportManifest={handleExportManifest}
        onExportIntersectionsCsv={() => {
          exportIntersectionsCsv(analysis, projectTitle);
          showNotice('success', '交集 CSV 已导出');
        }}
        onExportSetsTxt={() => {
          exportSetsTxt(sets, analysis, projectTitle);
          showNotice('success', '集合 TXT 已导出');
        }}
        onExportIntersectionsTxt={() => {
          exportIntersectionsTxt(analysis, projectTitle);
          showNotice('success', '全部交集成员 TXT 已导出');
        }}
      />

      <div
        className={`workspace-grid ${inputCollapsed ? 'is-input-collapsed' : ''} ${
          inspectorCollapsed ? 'is-inspector-collapsed' : ''
        }`}
      >
        {!inputCollapsed ? <InputPanel
          sets={sets}
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          expandedSetId={expandedSetId}
          onExpandedSetIdChange={setExpandedSetId}
          onChangeSet={updateSet}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onDuplicateSet={duplicateSet}
          onImportSets={(items) => {
            const palette = PALETTES.find((item) => item.id === paletteId) ?? DEFAULT_PALETTE;
            const imported = items.map((item, i) => ({ ...item, id: createSetId(), color: palette.colors[i] }));
            setSets(imported);
            setExpandedSetId(imported[0].id);
            setSelectedMask(0);
            setSetLabelPositions({ venn: {}, euler: {} });
            if (imported.length > (mode === 'euler' ? MAX_EULER_SET_COUNT : MAX_VENN_SET_COUNT)) setMode('upset');
            showNotice('success', `已导入 ${imported.length} 个集合，可撤销恢复原数据`);
          }}
        /> : null}
        <FigurePanel
          ref={figureRef}
          sets={sets}
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          mode={mode}
          display={display}
          figureStyle={figureStyle}
          publication={publication}
          selectedRegion={selectedRegion}
          labelPositions={currentSetLabelPositions}
          topN={topN}
          sort={sort}
          inputCollapsed={inputCollapsed}
          inspectorCollapsed={inspectorCollapsed}
          isPresentationPreview={isPresentationPreview}
          onModeChange={setMode}
          onSelectRegion={selectRegion}
          onClearSelection={() => setSelectedMask(0)}
          onSetLabelPositionChange={updateSetLabelPosition}
          onToggleInput={() => setInputCollapsed((current) => !current)}
          onToggleInspector={() => setInspectorCollapsed((current) => !current)}
          onTogglePresentationPreview={() =>
            setIsPresentationPreview((current) => !current)
          }
          onDownloadRegionTxt={(region) =>
            exportRegionTxt(region, projectTitle)
          }
          onDownloadRegionCsv={(region) =>
            exportRegionCsv(region, projectTitle)
          }
        />
        {!inspectorCollapsed ? (
          <InspectorPanel
            mode={mode}
            display={display}
            figureStyle={figureStyle}
            hasCustomLabelPositions={Object.keys(currentSetLabelPositions).length > 0}
            palettes={PALETTES}
            paletteId={paletteId}
            topN={topN}
            sort={sort}
            fontMetrics={fontMetrics}
            onDisplayChange={(patch) => setDisplay((current) => ({ ...current, ...patch }))}
            onFigureStyleChange={(patch) =>
              setFigureStyle((current) => ({ ...current, ...patch }))
            }
            onResetSetLabelPositions={resetSetLabelPositions}
            onPaletteChange={changePalette}
            onTopNChange={setTopN}
            onSortChange={setSort}
          />
        ) : null}
      </div>

      {notice ? (
        <div className={`notice notice-${notice.type}`} role="status">
          {notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {notice.message}
        </div>
      ) : null}
    </div>
  );
}

export default App;
