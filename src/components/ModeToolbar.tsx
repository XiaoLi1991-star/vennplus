import type { ViewMode } from '../types';
import { MAX_EULER_SET_COUNT, MAX_VENN_SET_COUNT } from '../data/limits';

interface ModeToolbarProps {
  mode: ViewMode;
  setCount: number;
  onModeChange: (mode: ViewMode) => void;
  descriptionId?: string;
}

const MODES: Array<{ id: ViewMode; label: string }> = [
  { id: 'venn', label: 'Venn' },
  { id: 'euler', label: 'Euler' },
  { id: 'upset', label: 'UpSet' },
];

export function ModeToolbar({ mode, setCount, onModeChange, descriptionId }: ModeToolbarProps) {
  return (
    <div className="mode-toolbar">
      <div className="segmented-control" role="group" aria-label="图形模式" aria-describedby={descriptionId}>
        {MODES.map((item) => {
          const disabled =
            (item.id === 'euler' && setCount > MAX_EULER_SET_COUNT) ||
            (item.id === 'venn' && setCount > MAX_VENN_SET_COUNT);
          return (
            <button
              key={item.id}
              className={mode === item.id ? 'is-active' : ''}
              aria-pressed={mode === item.id}
              type="button"
              disabled={disabled}
              aria-describedby={descriptionId}
              title={disabled ? `当前 ${setCount} 组超出本工具 ${item.label} 的支持范围（2–${item.id === 'venn' ? MAX_VENN_SET_COUNT : MAX_EULER_SET_COUNT} 组），请使用 UpSet` : undefined}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModeGuidance({ mode, setCount, id, modeNotice }: {
  mode: ViewMode; setCount: number; id: string; modeNotice?: string;
}) {
  return <div className="mode-guidance" id={id} aria-live="polite">
    {modeNotice ? <p className="mode-switch-reason">{modeNotice}</p> : null}
    <p>当前 {setCount} 个集合，使用 {MODES.find((item) => item.id === mode)?.label}。
      本工具 Venn 支持 2–{MAX_VENN_SET_COUNT} 组，Euler 支持 2–{MAX_EULER_SET_COUNT} 组。
      {setCount > MAX_VENN_SET_COUNT ? '当前组数仅支持 UpSet。' : setCount === MAX_VENN_SET_COUNT ? '五组 Venn 可用但较拥挤，建议双栏尺寸或改用 UpSet。Euler 不可用。' : null}
    </p>
    {mode === 'euler' ? <p>Euler 圆形面积为近似拟合，部分精确交集无法由圆形区域表达，可在“全部交集”查看完整数据。精确比较请以交集数值为准，也可切换 UpSet。</p> : mode === 'venn' ? <p>Venn 展示集合交叠关系，区域面积不代表成员数量。</p> : null}
  </div>;
}
