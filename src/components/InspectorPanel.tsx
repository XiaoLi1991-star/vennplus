import { SlidersHorizontal } from 'lucide-react';
import type { ComponentProps } from 'react';
import { FigureControls } from './FigureControls';
import type { FigureFontMetrics } from '../lib/figureMetrics';

type InspectorPanelProps = ComponentProps<typeof FigureControls> & { fontMetrics?: FigureFontMetrics };

export function InspectorPanel({ fontMetrics, ...controls }: InspectorPanelProps) {
  return <aside className="panel inspector-panel" aria-label="图形设置">
    <div className="inspector-heading"><SlidersHorizontal size={17} /><h2>图形设置</h2></div>
    <div className="inspector-content inspector-content-style">
      {fontMetrics ? <div className="output-font-size"><strong>成品字号</strong><span>组名 {fontMetrics.labels ? `${fontMetrics.labels.toFixed(1)} pt` : '未显示'} · 交集值 {fontMetrics.values ? `${fontMetrics.values.toFixed(1)} pt` : '未显示'}</span><small>以下比例仅调整图中文字，不改变界面字号。</small></div> : null}
      <FigureControls {...controls} />
    </div>
  </aside>;
}
