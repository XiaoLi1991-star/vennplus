import { useEffect, useMemo, useState } from 'react';
import type { Region, SetAnalysis, SetDefinition } from '../types';
import { getSetDisplayName } from '../lib/sets';
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { SelectedRegionPanel } from './SelectedRegionPanel';

interface Props {
  sets: SetDefinition[];
  analysis: SetAnalysis;
  region: Region | null;
  onSelect: (mask: number) => void;
  onClear: () => void;
  onDownloadTxt: (region: Region) => void;
  onDownloadCsv: (region: Region) => void;
}

export function IntersectionResults({ sets, analysis, region, onSelect, onClear, onDownloadTxt, onDownloadCsv }: Props) {
  const [tab, setTab] = useState<'members' | 'all'>('members');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState(260);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (region) { setTab('members'); setCollapsed(false); } }, [region?.mask, region?.key]);
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const index = sets.findIndex((set) => set.id === group);
    return analysis.regions.filter((r) => (index < 0 || (r.mask & (1 << index))) &&
      (!q || r.key.toLocaleLowerCase().includes(q) || r.members.some((m) => m.toLocaleLowerCase().includes(q))))
      .sort((a, b) => b.count - a.count || a.mask - b.mask);
  }, [analysis, query, group, sets]);
  const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const currentPage = Math.min(page, lastPage);
  const compact = !region && tab === 'members';
  return <section className={`intersection-results ${compact ? 'is-compact' : ''} ${collapsed ? 'is-collapsed' : ''} ${expanded && !collapsed ? 'is-expanded-results' : ''}`} style={{ height: collapsed ? 48 : expanded ? 'min(65dvh, 560px)' : compact ? 114 : height }}>
    <div className="results-resizer" role="separator" aria-label="调整结果区高度" aria-orientation="horizontal"
      aria-valuemin={190} aria-valuemax={500} aria-valuenow={height} tabIndex={0}
      onKeyDown={(e) => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setHeight((h) => Math.max(190, Math.min(500, h + (e.key === 'ArrowUp' ? 20 : -20)))); } }}
      onPointerDown={(e) => { const actual = e.currentTarget.parentElement!.getBoundingClientRect().height;
        setExpanded(false); setCollapsed(false); setHeight(Math.max(190, actual));
        e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.dataset.start = `${e.clientY},${Math.max(190, actual)}`;
      }}
      onPointerMove={(e) => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const [y, h] = e.currentTarget.dataset.start!.split(',').map(Number);
        setHeight(Math.max(190, Math.min(500, h + y - e.clientY)));
      }} />
    <nav className="results-tabs" aria-label="交集结果页面">
      <button type="button" aria-pressed={tab === 'members'} onClick={() => { setTab('members'); setCollapsed(false); }}>区域成员</button>
      <button type="button" aria-pressed={tab === 'all'} onClick={() => { setTab('all'); setCollapsed(false); }}>全部交集（{analysis.regions.length}）</button>
      <div className="results-window-actions">
        <button type="button" aria-label={expanded ? '还原结果区' : '展开结果区'} title={expanded ? '还原结果区' : '展开结果区'} onClick={() => { setExpanded(!expanded); setCollapsed(false); }}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <button type="button" aria-label={collapsed ? '显示结果区' : '收起结果区'} aria-expanded={!collapsed} title={collapsed ? '显示结果区' : '收起结果区'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      </div>
    </nav>
    <div className="results-content" hidden={collapsed}>
    {tab === 'members' ? <SelectedRegionPanel region={region} analysis={analysis} onClearSelection={onClear} onDownloadTxt={onDownloadTxt} onDownloadCsv={onDownloadCsv} /> :
      <div className="all-intersections">
        <div className="intersection-filters">
          <input type="search" aria-label="搜索全部交集" placeholder="搜索组名或成员" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          <select aria-label="按组筛选交集" value={sets.some((set) => set.id === group) ? group : ''} onChange={(e) => { setGroup(e.target.value); setPage(0); }}>
            <option value="">全部组</option>{sets.map((set, i) => <option key={set.id} value={set.id}>包含 {getSetDisplayName(set, i)}</option>)}
          </select>
          <span>{rows.length} 个精确交集 · 不受图中显示数量限制</span>
        </div>
        <div className="intersection-table-scroll"><table>
          <thead><tr><th>包含／排除的组</th><th>成员数</th><th>占并集</th><th>操作</th></tr></thead>
          <tbody>{rows.slice(currentPage * 50, (currentPage + 1) * 50).map((r) => <tr key={r.mask} aria-selected={region?.mask === r.mask}>
            <td><div className="intersection-tags" aria-label="包含的组">{sets.map((set, i) => r.mask & (1 << i) ? <span className="group-chip" key={set.id}><i style={{ backgroundColor: set.color }} />{getSetDisplayName(set, i)}</span> : null)}</div>
              <small className="excluded-groups">排除：{sets.filter((_, i) => !(r.mask & (1 << i))).map((set) => getSetDisplayName(set, sets.indexOf(set))).join('、') || '无'}</small>
            </td><td className="numeric-cell">{r.count}</td><td className="numeric-cell">{(r.percentage * 100).toFixed(2)}%</td>
            <td><button type="button" onClick={() => { onSelect(r.mask); setTab('members'); }}>查看成员</button></td>
          </tr>)}</tbody>
        </table>{!rows.length ? <p>没有匹配的交集。</p> : null}</div>
        <div className="intersection-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button>
          <span>{currentPage + 1} / {lastPage + 1}</span><button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>下一页</button></div>
      </div>}
    </div>
  </section>;
}
