import { useRef, useState } from 'react';
import { Download, FileUp, Redo2, ShieldCheck, Undo2 } from 'lucide-react';
import type { ExampleDefinition } from '../types';
import { BrandMark } from './BrandMark';
import { ExportDialog, type ExportOptions } from './ExportDialog';

type Action = () => void | Promise<void>;
interface AppHeaderProps extends ExportOptions {
  examples: readonly ExampleDefinition[];
  onLoadExample: (id: string) => void;
  saveStatus: 'loading' | 'saving' | 'saved' | 'error';
  isAnalyzing: boolean;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  onExportProjectJson: Action; onImportProjectJson: (file: File) => void | Promise<void>;
  onExportSvg: Action; onExportPng: Action; onExportPdf: Action; onExportTiff: Action;
  onExportXlsx: Action; onExportManifest: Action; onExportIntersectionsCsv: Action;
  onExportSetsTxt: Action; onExportIntersectionsTxt: Action;
}

export function AppHeader(props: AppHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const { examples, onLoadExample, saveStatus, isAnalyzing, canUndo, canRedo, onUndo, onRedo } = props;
  const statusText = isAnalyzing ? '本机计算中' : saveStatus === 'loading' ? '正在恢复本机草稿' : saveStatus === 'saving' ? '正在保存到本机' : saveStatus === 'error' ? '本机草稿未保存' : '已保存到本机';
  const actions = [
    { id: 'svg', label: 'SVG 矢量图', description: '可缩放、可编辑', run: props.onExportSvg },
    { id: 'pdf', label: 'PDF 矢量图', description: '适合排版与打印', run: props.onExportPdf },
    { id: 'png', label: 'PNG 位图', description: '通用图片格式', run: props.onExportPng },
    { id: 'tiff', label: 'TIFF 位图', description: '包含物理分辨率', run: props.onExportTiff },
    { id: 'xlsx', label: 'XLSX 汇总工作簿', description: '集合、交集与元数据', run: props.onExportXlsx },
    { id: 'sets', label: 'TXT 输入集合', description: '每组一列，可重新导入', run: props.onExportSetsTxt },
    { id: 'members', label: 'TXT 全部交集成员', description: '完整区域成员列表', run: props.onExportIntersectionsTxt },
    { id: 'csv', label: 'CSV 交集统计', description: '成员数与占比', run: props.onExportIntersectionsCsv },
    { id: 'project', label: 'JSON 项目文件', description: '保存数据与绘图设置', run: props.onExportProjectJson },
    { id: 'manifest', label: 'JSON 复现清单', description: '记录计算与导出参数', run: props.onExportManifest },
  ];
  return <header className="app-header">
    <div className="brand-lockup"><BrandMark /><span className="brand-name">VennPlus</span></div>
    <div className="header-divider" />
    <div className="history-controls" aria-label="编辑历史">
      <button type="button" aria-label="撤销" title="撤销（⌘/Ctrl + Z）" disabled={!canUndo} onClick={onUndo}><Undo2 size={17} /></button>
      <button type="button" aria-label="重做" title="重做（⌘/Ctrl + Shift + Z）" disabled={!canRedo} onClick={onRedo}><Redo2 size={17} /></button>
    </div>
    <label className="example-picker" title="加载示例会替换数据并选择推荐图形，保留当前样式；可撤销"><span>示例</span><select aria-label="示例" value="" onChange={(e) => { if (e.target.value) onLoadExample(e.target.value); }}>
      <option value="" disabled>选择组数示例</option>{examples.map((example) => <option key={example.id} value={example.id}>{example.name}</option>)}
    </select></label>
    <div className={`local-status local-status-${saveStatus}`} title="输入不会上传；草稿自动保存在当前浏览器" aria-live="polite"><ShieldCheck size={17} /><span>{statusText}</span></div>
    <button type="button" className="button project-open-button" title="导入 VennPlus 项目" onClick={() => projectFileRef.current?.click()}><FileUp size={17} /><span>打开项目</span></button>
    <button type="button" className="button button-primary" onClick={() => setExportOpen(true)}><Download size={18} />导出</button>
    {exportOpen ? <ExportDialog actions={actions} onClose={() => setExportOpen(false)} isAnalyzing={isAnalyzing} publication={props.publication} minimumFontPt={props.minimumFontPt} onPublicationChange={props.onPublicationChange} /> : null}
    <input ref={projectFileRef} type="file" aria-label="导入 VennPlus 项目" accept=".json,.vennplus.json,application/json" hidden onChange={(e) => {
      const file = e.target.files?.[0]; if (file) void props.onImportProjectJson(file); e.target.value = '';
    }} />
  </header>;
}
