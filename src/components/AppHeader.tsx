import { useEffect, useRef } from 'react';
import {
  Download,
  FileDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  Redo2,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import type { ExampleDefinition } from '../types';
import { BrandMark } from './BrandMark';

interface AppHeaderProps {
  examples: readonly ExampleDefinition[];
  onLoadExample: (id: string) => void;
  saveStatus: 'loading' | 'saving' | 'saved' | 'error';
  isAnalyzing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportProjectJson: () => void;
  onImportProjectJson: (file: File) => void | Promise<void>;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportTiff: () => void;
  onExportXlsx: () => void;
  onExportManifest: () => void;
  onExportIntersectionsCsv: () => void;
  onExportSetsTxt: () => void;
  onExportIntersectionsTxt: () => void;
}

export function AppHeader({
  examples,
  onLoadExample,
  saveStatus,
  isAnalyzing,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportProjectJson,
  onImportProjectJson,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onExportTiff,
  onExportXlsx,
  onExportManifest,
  onExportIntersectionsCsv,
  onExportSetsTxt,
  onExportIntersectionsTxt,
}: AppHeaderProps) {
  const projectFileRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);

  const closeExportMenu = (restoreFocus = false) => {
    const menu = exportMenuRef.current;
    if (!menu) return;
    menu.open = false;
    if (restoreFocus) menu.querySelector<HTMLElement>('summary')?.focus();
  };

  const runExportAction = (action: () => void) => {
    closeExportMenu();
    action();
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const menu = exportMenuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        closeExportMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && exportMenuRef.current?.open) {
        event.preventDefault();
        closeExportMenu(true);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const statusText = isAnalyzing
    ? '本机计算中'
    : saveStatus === 'loading'
      ? '正在恢复本机草稿'
      : saveStatus === 'saving'
        ? '正在保存到本机'
        : saveStatus === 'error'
          ? '本机草稿未保存'
          : '已保存到本机';

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <BrandMark />
        <span className="brand-name">VennPlus</span>
      </div>

      <div className="header-divider" />

      <div className="history-controls" aria-label="编辑历史">
        <button
          type="button"
          aria-label="撤销"
          title="撤销（⌘/Ctrl + Z）"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="重做"
          title="重做（⌘/Ctrl + Shift + Z）"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={17} aria-hidden="true" />
        </button>
      </div>

      <label className="example-picker">
        <span>示例</span>
        <select
          aria-label="示例"
          value=""
          onChange={(event) => {
            if (event.target.value) onLoadExample(event.target.value);
          }}
        >
          <option value="" disabled>
            选择组数示例
          </option>
          {examples.map((example) => (
            <option key={example.id} value={example.id}>
              {example.name}
            </option>
          ))}
        </select>
      </label>

      <div
        className={`local-status local-status-${saveStatus}`}
        title="输入不会上传；草稿自动保存在当前浏览器"
        aria-live="polite"
      >
        <ShieldCheck size={17} aria-hidden="true" />
        <span>{statusText}</span>
      </div>

      <details ref={exportMenuRef} className="export-menu">
        <summary className="button button-primary" aria-label="导出">
          <Download size={18} aria-hidden="true" />
          <span>导出</span>
        </summary>
        <div className="menu-popover" role="menu">
          <div className="menu-label">科研图形</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportSvg)}
            disabled={isAnalyzing}
          >
            <FileImage size={17} /> SVG 矢量图
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportPdf)}
            disabled={isAnalyzing}
          >
            <FileText size={17} /> PDF 矢量图
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportTiff)}
            disabled={isAnalyzing}
          >
            <FileImage size={17} /> TIFF 投稿图
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportPng)}
            disabled={isAnalyzing}
          >
            <FileImage size={17} /> PNG 高清图
          </button>
          <div className="menu-separator" />
          <div className="menu-label">数据表</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportXlsx)}
            disabled={isAnalyzing}
          >
            <FileSpreadsheet size={17} /> XLSX 汇总工作簿
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportSetsTxt)}
            disabled={isAnalyzing}
          >
            <FileText size={17} /> 输入集合 TXT（Tab 分隔）
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportIntersectionsTxt)}
            disabled={isAnalyzing}
          >
            <FileText size={17} /> 全部交集成员 TXT
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExportAction(onExportIntersectionsCsv)}
            disabled={isAnalyzing}
          >
            <FileText size={17} /> 交集统计 CSV
          </button>
          <div className="menu-separator" />
          <details className="menu-disclosure">
            <summary role="menuitem">
              <FileDown size={17} />
              <span>项目与复现</span>
            </summary>
            <div className="menu-disclosure-content">
              <button
                type="button"
                role="menuitem"
                onClick={() => runExportAction(onExportManifest)}
                disabled={isAnalyzing}
              >
                <FileText size={17} /> 复现清单 JSON
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runExportAction(onExportProjectJson)}
              >
                <FileDown size={17} /> 导出 VennPlus 项目
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runExportAction(() => projectFileRef.current?.click())}
              >
                <FileUp size={17} /> 导入 VennPlus 项目
              </button>
            </div>
          </details>
        </div>
      </details>
      <input
        ref={projectFileRef}
        type="file"
        accept=".json,.vennplus.json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImportProjectJson(file);
          event.target.value = '';
        }}
      />
    </header>
  );
}
