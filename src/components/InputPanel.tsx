import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SetImportDialog } from './SetImportDialog';
import { MAX_SET_COUNT, MIN_SET_COUNT } from '../data/limits';
import type { SetAnalysis, SetDefinition } from '../types';

interface InputPanelProps {
  sets: SetDefinition[];
  analysis: SetAnalysis;
  isAnalyzing: boolean;
  expandedSetId: string;
  onExpandedSetIdChange: (id: string) => void;
  onChangeSet: (id: string, patch: Partial<Pick<SetDefinition, 'name' | 'text'>>) => void;
  onAddSet: () => void;
  onRemoveSet: (id: string) => void;
  onDuplicateSet: (id: string) => void;
  onImportSets?: (sets: Array<{ name: string; text: string }>) => void;
}

export function InputPanel({
  sets,
  analysis,
  isAnalyzing,
  expandedSetId,
  onExpandedSetIdChange,
  onChangeSet,
  onAddSet,
  onRemoveSet,
  onDuplicateSet,
  onImportSets,
}: InputPanelProps) {
  const [tableOpen, setTableOpen] = useState(false);
  return (
    <aside className="panel input-panel" aria-label="输入集合" aria-busy={isAnalyzing}>
      <div className="panel-heading">
        <div>
          <h2>输入集合</h2>
          <p>每行一个成员标识</p>
        </div>
        <span className="panel-count">{sets.length} / {MAX_SET_COUNT}</span>
      </div>

      {onImportSets ? <div className="table-import">
        <button type="button" onClick={() => setTableOpen(!tableOpen)}>粘贴表格／导入文件</button>
        {tableOpen ? <SetImportDialog onClose={() => setTableOpen(false)} onImport={onImportSets} /> : null}
      </div> : null}
      <div className="set-accordion">
        {sets.map((set, index) => {
          const expanded = expandedSetId === set.id;
          const count = analysis.parsedSets[index]?.length ?? 0;
          const duplicateCount = analysis.duplicateCounts[index] ?? 0;
          return (
            <section className={`set-editor ${expanded ? 'is-expanded' : ''}`} key={set.id}>
              <div className="set-row">
                <span className="set-color" style={{ backgroundColor: set.color }} />
                <input
                  aria-label={`第 ${index + 1} 组名称`}
                  className="set-name-input"
                  value={set.name}
                  onChange={(event) => onChangeSet(set.id, { name: event.target.value })}
                />
                <span className="set-count">{count}</span>
                <button
                  className="icon-button small"
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? '收起集合' : '编辑集合'}
                  onClick={() => onExpandedSetIdChange(expanded ? '' : set.id)}
                >
                  {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>
              </div>

              {sets.some((other) => other.id !== set.id && other.name.trim() === set.name.trim()) ? <p className="input-warning" role="status">组名重复，请修改以区分集合。</p> : null}

              {expanded ? (
                <div className="set-editor-body">
                  <div className="set-editor-actions">
                    {isAnalyzing ? <span>正在计算唯一值…</span> : null}
                    <div>
                      <button
                        type="button"
                        onClick={() => onDuplicateSet(set.id)}
                        disabled={sets.length >= MAX_SET_COUNT}
                      >
                        <Copy size={15} /> 复制组
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveSet(set.id)}
                        disabled={sets.length <= MIN_SET_COUNT}
                      >
                        <Trash2 size={15} /> 删除
                      </button>
                    </div>
                  </div>
                  <textarea
                    aria-label={`${set.name} 的成员标识列表`}
                    spellCheck={false}
                    value={set.text}
                    onChange={(event) => onChangeSet(set.id, { text: event.target.value })}
                  />
                  <div className="set-input-meta">
                    {set.text.includes('\t') ? <span className="input-warning">检测到 Tab：多列表格请使用上方“粘贴表格”入口。</span> : null}
                    <span>空行将被忽略，大小写敏感</span>
                    {duplicateCount > 0 ? <span>{duplicateCount} 个组内重复已去除</span> : null}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <button
        className="add-set-button"
        type="button"
        onClick={onAddSet}
        disabled={sets.length >= MAX_SET_COUNT}
      >
        <Plus size={18} />
        {sets.length >= MAX_SET_COUNT ? `已达 ${MAX_SET_COUNT} 组上限` : '添加集合'}
      </button>
    </aside>
  );
}
