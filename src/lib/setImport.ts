import { MAX_SET_COUNT, MIN_SET_COUNT } from '../data/limits';
import type { SetDefinition } from '../types';

/** CSV/TSV with RFC-style quotes; never silently split a single identifier. */
export function parseSetTable(source: string): Array<{ name: string; text: string }> {
  if (source.length > 20 * 1024 * 1024 || new TextEncoder().encode(source).length > 20 * 1024 * 1024) throw new Error('表格不能超过 20 MB');
  const input = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const delimiter = input.split('\n')[0].includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === delimiter || ch === '\n') {
      row.push(cell); cell = ''; closed = false;
      if (ch === '\n') { rows.push(row); row = []; }
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (closed) throw new Error('引号后只能是分隔符或换行');
    else cell += ch;
  }
  if (quoted) throw new Error('表格中有未闭合的引号');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every((v) => !v.trim())) rows.pop();
  const names = rows.shift()?.map((name) => name.trim()) ?? [];
  if (names.length < MIN_SET_COUNT || names.length > MAX_SET_COUNT) throw new Error('请提供 2–8 列，每列一个集合');
  if (names.some((name) => !name)) throw new Error('首行每一列都需要组名');
  if (new Set(names).size !== names.length) throw new Error('组名重复，请使用不同的组名');
  for (const values of rows) {
    if (values.length > names.length) throw new Error('数据列数超过首行组名数');
    if (values.some((v) => v.includes('\n'))) throw new Error('单个成员标识不能包含换行');
  }
  return names.map((name, i) => ({ name, text: rows.map((values) => values[i]?.trim() ?? '').filter(Boolean).join('\n') }));
}

export function nextSetColor(sets: SetDefinition[], colors: readonly string[]): string {
  const used = new Set(sets.map((set) => set.color.toLowerCase()));
  return colors.find((color) => !used.has(color.toLowerCase())) ?? colors[sets.length % colors.length];
}

export function uniqueSetName(base: string, sets: SetDefinition[]): string {
  const used = new Set(sets.map((set) => set.name.trim()));
  let name = base, suffix = 2;
  while (used.has(name)) name = `${base} ${suffix++}`;
  return name;
}
