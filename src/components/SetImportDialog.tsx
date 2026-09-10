import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { FileUp, ClipboardPaste } from 'lucide-react';
import { parseSetTable } from '../lib/setImport';
import { WorkspaceDialog } from './WorkspaceDialog';

export function SetImportDialog({ onClose, onImport }: {
  onClose: () => void;
  onImport: (sets: Array<{ name: string; text: string }>) => void;
}) {
  const [tab, setTab] = useState<'paste' | 'file'>('paste');
  const [text, setText] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const sequence = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const source = tab === 'paste' ? text : fileText;
  const deferred = useDeferredValue(source);
  const preview = useMemo(() => {
    if (!deferred.trim()) return { sets: [], error: '' };
    try { return { sets: parseSetTable(deferred), error: '' }; }
    catch (error) { return { sets: [], error: error instanceof Error ? error.message : '无法识别表格' }; }
  }, [deferred]);
  const columns = useMemo(() => preview.sets.map((set) => ({ ...set, members: [...new Set(set.text.split('\n').filter(Boolean))] })), [preview.sets]);
  const error = tab === 'file' && fileError ? fileError : preview.error;
  const pending = deferred !== source || (tab === 'file' && reading);
  return <WorkspaceDialog title="导入集合" onClose={onClose}>
    <div className="dialog-body">
      <p className="dialog-intro">每组一列，首行为组名。支持 2–8 组，数据仅在本机处理。</p>
      <div className="dialog-tabs" aria-label="导入方式">
        <button type="button" aria-pressed={tab === 'paste'} onClick={() => setTab('paste')}><ClipboardPaste size={16} />粘贴表格</button>
        <button type="button" aria-pressed={tab === 'file'} onClick={() => setTab('file')}><FileUp size={16} />选择文件</button>
      </div>
      {tab === 'paste' ? <label className="import-source"><span>从表格复制并粘贴</span>
        <textarea autoFocus aria-label="粘贴集合表格" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder={'发现队列\t验证队列\nTP53\tEGFR\nBRCA1\tTP53'} />
        <small>支持制表符分隔和 CSV；空行忽略，重复成员自动去重。</small>
      </label> : <div className="file-picker">
        <FileUp size={28} aria-hidden="true" />
        <strong>{fileName || '选择集合表格'}</strong>
        <span>TXT、TSV 或 CSV，最大 20 MB</span>
        <button type="button" className="button" onClick={() => fileRef.current?.click()} disabled={reading}>{reading ? '正在读取…' : fileName ? '重新选择文件' : '浏览文件'}</button>
        <input hidden ref={fileRef} aria-label="导入集合文件" type="file" accept=".txt,.tsv,.csv" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          const ticket = ++sequence.current;
          setFileText(''); setFileName(file.name); setFileError('');
          if (file.size > 20 * 1024 * 1024) { setFileError('文件不能超过 20 MB'); return; }
          setReading(true);
          try { const content = await file.text(); if (ticket === sequence.current) setFileText(content); }
          catch { if (ticket === sequence.current) setFileError('文件读取失败，请重新选择'); }
          finally { if (ticket === sequence.current) setReading(false); }
        }} />
      </div>}
      {error ? <p className="dialog-error" role="alert">{error}</p> : null}
      {columns.length && !error ? <section className="import-preview" aria-label="表格预览" aria-busy={pending}>
        <h3>识别到 {columns.length} 个集合 <small>每组预览前 5 个唯一成员</small></h3>
        <div className="import-preview-scroll"><table><thead><tr>{columns.map((col) => <th key={col.name}>{col.name}<small>{col.members.length} 个成员</small></th>)}</tr></thead>
          <tbody>{Array.from({ length: Math.min(5, Math.max(...columns.map((col) => col.members.length))) }, (_, i) => <tr key={i}>{columns.map((col) => <td key={col.name}>{col.members[i] ?? '—'}</td>)}</tr>)}</tbody>
        </table></div>
      </section> : null}
    </div>
    <footer className="dialog-footer"><p>确认后替换当前集合；可通过撤销恢复。</p>
      <button type="button" className="button" onClick={onClose}>取消</button>
      <button type="button" className="button button-primary" disabled={!columns.length || !!error || pending} onClick={() => { onImport(preview.sets); onClose(); }}>确认导入并替换</button>
    </footer>
  </WorkspaceDialog>;
}
