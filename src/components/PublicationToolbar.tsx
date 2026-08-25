import {
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import type { ViewMode } from '../types';
import { ModeToolbar } from './ModeToolbar';

interface PublicationToolbarProps {
  mode: ViewMode;
  setCount: number;
  inputCollapsed: boolean;
  inspectorCollapsed: boolean;
  isPresentationPreview: boolean;
  onModeChange: (mode: ViewMode) => void;
  onToggleInput: () => void;
  onToggleInspector: () => void;
  onTogglePresentationPreview: () => void;
}

export function PublicationToolbar({
  mode,
  setCount,
  inputCollapsed,
  inspectorCollapsed,
  isPresentationPreview,
  onModeChange,
  onToggleInput,
  onToggleInspector,
  onTogglePresentationPreview,
}: PublicationToolbarProps) {
  return (
    <div className="publication-toolbar" aria-label="图形工具栏">
      <div className="workspace-rail-actions" data-export-ignore="true">
        <button
          type="button"
          className={inputCollapsed ? 'is-collapsed' : ''}
          aria-label={inputCollapsed ? '展开输入集合' : '收起输入集合'}
          aria-pressed={!inputCollapsed}
          onClick={onToggleInput}
        >
          <PanelLeft size={17} />
        </button>
        <button
          type="button"
          className={inspectorCollapsed ? 'is-collapsed' : ''}
          aria-label={inspectorCollapsed ? '展开检查器' : '收起检查器'}
          aria-pressed={!inspectorCollapsed}
          onClick={onToggleInspector}
        >
          <PanelRight size={17} />
        </button>
      </div>

      <ModeToolbar mode={mode} setCount={setCount} onModeChange={onModeChange} />

      <button
        className="presentation-preview-button"
        type="button"
        onClick={onTogglePresentationPreview}
      >
        {isPresentationPreview ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        {isPresentationPreview ? '退出预览' : '专注预览'}
      </button>
    </div>
  );
}
