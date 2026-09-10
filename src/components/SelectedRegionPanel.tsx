import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clipboard, Download, MousePointer2, Search, TextSelect, X } from 'lucide-react';
import type { Region, SetAnalysis } from '../types';
import { describeRegion, queryIntersection } from '../lib/sets';

interface SelectedRegionPanelProps {
  region: Region | null;
  onClearSelection: () => void;
  onDownloadTxt: (region: Region) => void;
  onDownloadCsv: (region: Region) => void;
  analysis?: SetAnalysis;
}

async function copyText(text: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-10000px';
    textarea.setAttribute('readonly', '');
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

export function SelectedRegionPanel({
  region: exactRegion,
  onClearSelection,
  onDownloadTxt,
  onDownloadCsv,
  analysis,
}: SelectedRegionPanelProps) {
  const [inclusive, setInclusive] = useState(false);
  const [scope, setScope] = useState<'visible' | 'all'>('visible');
  const region = useMemo(() => exactRegion && analysis ? queryIntersection(exactRegion, analysis, inclusive) : exactRegion, [exactRegion, analysis, inclusive]);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setQuery('');
    setCopied(false);
  }, [region?.key, region?.mask]);

  const filteredMembers = useMemo(() => {
    if (!region) return [];
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return region.members;
    return region.members.filter((member) => member.toLocaleLowerCase().includes(normalizedQuery));
  }, [deferredQuery, region]);
  const memberText = useMemo(() => filteredMembers.join('\n'), [filteredMembers]);
  const actionMembers = scope === 'all' ? region?.members ?? [] : filteredMembers;
  const actionRegion = region ? { ...region, members: actionMembers, count: actionMembers.length } : null;
  const memberPlaceholder = !region
    ? '选择非空交集后，成员会在这里逐行显示。'
    : query === deferredQuery && query.trim() && filteredMembers.length === 0
      ? '未找到匹配的成员，请尝试其他关键词。'
      : '';

  const selectAll = () => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  };

  const copyVisible = async () => {
    if (!actionMembers.length) return;
    await copyText(actionMembers.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className={`selected-region-panel ${region ? '' : 'is-empty'}`} aria-label="选中区域成员">
      <header className="selected-region-header">
        <div className="selected-region-identity">
          <span className="selected-region-kicker">
            <MousePointer2 size={13} aria-hidden="true" />
            选中区域
          </span>
          {region ? (
            <div className="selected-region-title-row">
              <strong>{region.key}</strong>
              <span>{region.count} 个成员</span>
              <button
                className="selected-region-clear-button"
                type="button"
                aria-label="取消选择"
                title="取消选择"
                onClick={onClearSelection}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p>点击 Venn、Euler 区域或 UpSet 柱形查看成员。</p>
          )}
        </div>

        <div className="selected-region-actions">
          <label className="selected-region-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label="搜索选中区域成员"
              placeholder="搜索基因或成员标识"
              value={query}
              disabled={!region}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="button" disabled={!memberText} onClick={selectAll}>
            <TextSelect size={15} aria-hidden="true" />
            全选
          </button>
          <select aria-label="复制与下载范围" value={scope} onChange={(e) => setScope(e.target.value as 'visible' | 'all')}>
            <option value="visible">当前搜索结果</option><option value="all">整个区域</option>
          </select>
          <button type="button" disabled={!actionMembers.length || query !== deferredQuery} onClick={() => void copyVisible()}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Clipboard size={15} aria-hidden="true" />}
            {copied ? '已复制' : query && scope === 'visible' ? '复制结果' : '复制全部'}
          </button>
          <button type="button" disabled={!actionMembers.length || query !== deferredQuery} onClick={() => actionRegion && onDownloadTxt(actionRegion)}>
            <Download size={15} aria-hidden="true" />
            TXT
          </button>
          <button type="button" disabled={!actionMembers.length || query !== deferredQuery} onClick={() => actionRegion && onDownloadCsv(actionRegion)}>
            <Download size={15} aria-hidden="true" />
            CSV
          </button>
        </div>
      </header>

      {region ? <div className="region-semantics">
        {analysis ? <select aria-label="交集口径" value={inclusive ? 'inclusive' : 'exact'} onChange={(e) => setInclusive(e.target.value === 'inclusive')}>
          <option value="exact">仅这些组（精确区域）</option><option value="inclusive">至少这些组</option>
        </select> : null}
        <span>{describeRegion(region)}</span>
        {inclusive ? <small>图中高亮仍表示原精确区域。</small> : null}
      </div> : null}

      <div className="selected-region-body">
        <textarea
          ref={textareaRef}
          aria-label="选中区域成员文本"
          value={memberText}
          readOnly
          spellCheck={false}
          placeholder={memberPlaceholder}
        />
        <footer aria-live="polite">
          {region ? (
            query !== deferredQuery
              ? '正在筛选…'
              : query
                ? `显示 ${filteredMembers.length} / ${region.count} 项`
                : `共 ${region.count} 项 · 点击画布空白处可取消选择 · Ctrl/⌘ + A/C 可全选复制`
          ) : (
            '成员保留输入时的大小写，集合内重复值已去除。'
          )}
        </footer>
      </div>
    </section>
  );
}
