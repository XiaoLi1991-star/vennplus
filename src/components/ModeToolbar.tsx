import type { ViewMode } from '../types';
import { MAX_EULER_SET_COUNT, MAX_VENN_SET_COUNT } from '../data/limits';

interface ModeToolbarProps {
  mode: ViewMode;
  setCount: number;
  onModeChange: (mode: ViewMode) => void;
}

const MODES: Array<{ id: ViewMode; label: string }> = [
  { id: 'venn', label: 'Venn' },
  { id: 'euler', label: 'Euler' },
  { id: 'upset', label: 'UpSet' },
];

export function ModeToolbar({ mode, setCount, onModeChange }: ModeToolbarProps) {
  const recommendation =
    setCount >= 6
      ? `${setCount}组推荐 UpSet`
      : setCount === 5
        ? '五组 Venn 建议双栏，UpSet 作为备选'
        : '经典集合交集';

  return (
    <div className="mode-toolbar">
      <div className="segmented-control" aria-label="图形模式">
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
              title={disabled ? `当前 ${setCount} 组不建议使用此模式` : undefined}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <span className="mode-recommendation">{recommendation}</span>
    </div>
  );
}
