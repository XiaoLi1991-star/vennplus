import { useState } from 'react';
import { Download } from 'lucide-react';
import type { PublicationSettings } from '../types';
import { getPublicationPixelDimensions } from '../data/publication';
import { NumberField } from './NumberField';
import { WorkspaceDialog } from './WorkspaceDialog';

export type ExportAction = { id: string; label: string; description: string; run: () => void | Promise<void> };
export interface ExportOptions {
  publication: PublicationSettings;
  minimumFontPt: number;
  onPublicationChange: (patch: Partial<PublicationSettings>) => void;
}

export function ExportDialog({ onClose, actions, isAnalyzing, publication, minimumFontPt, onPublicationChange }: ExportOptions & {
  onClose: () => void; actions: ExportAction[]; isAnalyzing: boolean;
}) {
  const [category, setCategory] = useState('figure');
  const [format, setFormat] = useState('svg');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const raster = format === 'png' || format === 'tiff';
  const visible = actions.filter((a) => category === 'figure' ? ['svg', 'pdf', 'png', 'tiff'].includes(a.id) : category === 'data' ? ['xlsx', 'sets', 'members', 'csv'].includes(a.id) : ['project', 'manifest'].includes(a.id));
  const action = visible.find((a) => a.id === format) ?? visible[0];
  const pixels = getPublicationPixelDimensions(publication);
  return <WorkspaceDialog title="导出" onClose={() => { if (!busy) onClose(); }}>
    <div className="dialog-body">
      <div className="dialog-tabs" aria-label="导出类型">{[['figure', '图形'], ['data', '数据表'], ['project', '项目与复现']].map(([id, label]) =>
        <button type="button" key={id} disabled={busy} aria-pressed={category === id} onClick={() => { setCategory(id); setFormat(id === 'figure' ? 'svg' : id === 'data' ? 'xlsx' : 'project'); setMessage(''); }}>{label}</button>)}</div>
      <fieldset disabled={busy} className="export-fields"><legend className="sr-only">文件格式与设置</legend>
        <div className="export-format-grid" aria-label="文件格式">{visible.map((a) => <button type="button" key={a.id} aria-label={a.label} aria-pressed={action.id === a.id} onClick={() => { setFormat(a.id); setMessage(''); }}><strong>{a.label}</strong><span>{a.description}</span></button>)}</div>
        {category === 'figure' ? <>
          <section className="export-dimensions"><h3>成品尺寸</h3><p>修改后同步应用到画布，图形几何不会被拉伸。</p>
            <div className="export-field-grid">
              <label>宽度<NumberField label="成品宽度 mm" value={publication.widthMm} min={40} max={320} unit="mm" onChange={(widthMm) => onPublicationChange({ widthMm })} /></label>
              <label>高度<NumberField label="成品高度 mm" value={publication.heightMm} min={40} max={320} unit="mm" onChange={(heightMm) => onPublicationChange({ heightMm })} /></label>
              {raster ? <label>位图分辨率<NumberField label="位图分辨率 DPI" value={publication.rasterDpi} min={72} max={600} unit="DPI" onChange={(rasterDpi) => onPublicationChange({ rasterDpi })} /></label> : null}
              <label>背景<select aria-label="导出背景" value={publication.background} onChange={(e) => onPublicationChange({ background: e.target.value as PublicationSettings['background'] })}><option value="white">白色</option><option value="transparent">透明</option></select></label>
            </div>
          </section>
          <div className="export-specification"><span>文件尺寸 <strong>{publication.widthMm} × {publication.heightMm} mm</strong></span>
            <span>{raster ? <>像素尺寸 <strong>{pixels.width} × {pixels.height} px</strong></> : '矢量格式，不受 DPI 限制'}</span>
            <span>最小成品字号 <strong>{minimumFontPt.toFixed(1)} pt</strong></span></div>
        </> : <p className="dialog-intro">{category === 'data' ? '导出完整数据，不受图中显示数量或结果表搜索条件限制。' : '项目文件保存集合与绘图设置，可重新导入继续编辑；复现清单用于记录计算与导出参数。'}</p>}
      </fieldset>
      <details className="export-help"><summary>计算与导出说明</summary><p>交集按精确成员关系统计；百分比以全部集合的并集为分母。界面字号不影响成品字号。矢量格式可缩放，PNG 和 TIFF 使用指定的尺寸与 DPI。</p></details>
      {message ? <p role={failed ? 'alert' : 'status'} className={failed ? 'dialog-error' : 'dialog-success'}>{message}</p> : null}
    </div>
    <footer className="dialog-footer"><p>{busy ? '正在生成文件，请稍候…' : isAnalyzing ? '等待当前集合计算完成' : `当前选择：${action.label}`}</p>
      <button type="button" className="button" disabled={busy} onClick={onClose}>关闭</button>
      <button type="button" className="button button-primary" disabled={busy || isAnalyzing} onClick={async () => {
        setBusy(true); setMessage(''); setFailed(false);
        try { await action.run(); setMessage(`${action.label} 已生成，请查看浏览器下载。`); }
        catch { setFailed(true); setMessage('文件生成失败，请重试。当前设置已保留。'); }
        finally { setBusy(false); }
      }}><Download size={17} />{busy ? '正在导出…' : `下载 ${action.label.split(' ')[0]}`}</button>
    </footer>
  </WorkspaceDialog>;
}
