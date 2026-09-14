import {
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import type { ViewMode } from '../types';
import { useId, type ReactNode } from 'react';
import { ModeGuidance, ModeToolbar } from './ModeToolbar';

interface PublicationToolbarProps {
  zoomControls?: ReactNode;
  mode: ViewMode;
  setCount: number;
  modeNotice?: string;
  inputCollapsed: boolean;
  inspectorCollapsed: boolean;
  isPresentationPreview: boolean;
  onModeChange: (mode: ViewMode) => void;
  onToggleInput: () => void;
  onToggleInspector: () => void;
  onTogglePresentationPreview: () => void;
}

export function PublicationToolbar({
  zoomControls,
  mode,
  setCount,
  modeNotice,
  inputCollapsed,
  inspectorCollapsed,
  isPresentationPreview,
  onModeChange,
  onToggleInput,
  onToggleInspector,
  onTogglePresentationPreview,
}: PublicationToolbarProps) {
  const guidanceId = useId();
  return (
    <div className="mode-guidance-block">
    <div className="publication-toolbar" aria-label="图形工具栏">
      <ModeToolbar mode={mode} setCount={setCount} onModeChange={onModeChange} descriptionId={guidanceId} />
      <div className="canvas-tools">
      {zoomControls}
      <div className="workspace-rail-actions" data-export-ignore="true">
        <button
          type="button"
          className={inputCollapsed ? 'is-collapsed' : ''}
          aria-label={inputCollapsed ? '展开输入集合' : '收起输入集合'}
          title={inputCollapsed ? '展开输入集合' : '收起输入集合'}
          aria-pressed={!inputCollapsed}
          onClick={onToggleInput}
        >
          <PanelLeft size={17} />
        </button>
        <button
          type="button"
          className={inspectorCollapsed ? 'is-collapsed' : ''}
          aria-label={inspectorCollapsed ? '展开图形设置' : '收起图形设置'}
          title={inspectorCollapsed ? '展开图形设置' : '收起图形设置'}
          aria-pressed={!inspectorCollapsed}
          onClick={onToggleInspector}
        >
          <PanelRight size={17} />
        </button>
      </div>

      <button
        className="presentation-preview-button"
        type="button"
        onClick={onTogglePresentationPreview}
      >
        {isPresentationPreview ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        {isPresentationPreview ? '退出预览' : '专注预览'}
      </button>
      </div>
    </div>
    <ModeGuidance id={guidanceId} mode={mode} setCount={setCount} modeNotice={modeNotice} />
    </div>
  );
}
