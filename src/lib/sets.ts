import type { Region, RegionLabelMode, SetAnalysis, SetDefinition } from '../types';

const LINE_BREAKS = /\r?\n/;

export function parseIdentifiers(text: string): string[] {
  return parseIdentifierStats(text).members;
}

export function parseIdentifierStats(text: string): { members: string[]; duplicateCount: number } {
  const seen = new Set<string>();
  const members: string[] = [];
  let duplicateCount = 0;

  for (const line of text.split(LINE_BREAKS)) {
    const value = line.trim();
    if (!value) continue;
    if (seen.has(value)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(value);
    members.push(value);
  }

  return { members, duplicateCount };
}

export function maskToIndices(mask: number, setCount: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < setCount; index += 1) {
    if ((mask & (1 << index)) !== 0) indices.push(index);
  }
  return indices;
}

export function getSetDisplayName(set: SetDefinition, index: number): string {
  return set.name.trim() || String.fromCharCode(65 + index);
}

export function maskToKey(mask: number, sets: SetDefinition[]): string {
  return maskToIndices(mask, sets.length)
    .map((index) => getSetDisplayName(sets[index], index))
    .join(' ∩ ');
}

export function analyzeSets(sets: SetDefinition[]): SetAnalysis {
  const parsed = sets.map((set) => parseIdentifierStats(set.text));
  const parsedSets = parsed.map((item) => item.members);
  const duplicateCounts = parsed.map((item) => item.duplicateCount);
  const membership = new Map<string, number>();

  parsedSets.forEach((members, setIndex) => {
    const bit = 1 << setIndex;
    members.forEach((member) => {
      membership.set(member, (membership.get(member) ?? 0) | bit);
    });
  });

  const membersByMask = new Map<number, string[]>();
  membership.forEach((mask, member) => {
    const values = membersByMask.get(mask);
    if (values) values.push(member);
    else membersByMask.set(mask, [member]);
  });

  const unionMembers = Array.from(membership.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const unionCount = unionMembers.length;
  const regions: Region[] = [...membersByMask.entries()]
    .sort(([maskA], [maskB]) => maskA - maskB)
    .map(([mask, maskMembers]) => {
      const members = [...maskMembers].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
      return {
        mask,
        key: maskToKey(mask, sets),
        setIndices: maskToIndices(mask, sets.length),
        members,
        count: members.length,
        percentage: unionCount === 0 ? 0 : members.length / unionCount,
        includedSets: maskToIndices(mask, sets.length).map((i) => getSetDisplayName(sets[i], i)),
        excludedSets: sets.flatMap((set, i) => mask & (1 << i) ? [] : [getSetDisplayName(set, i)]),
        membershipMode: 'exact' as const,
      };
    });

  return {
    parsedSets,
    duplicateCounts,
    unionMembers,
    unionCount,
    regions,
    regionByMask: new Map(regions.map((region) => [region.mask, region])),
  };
}

export function inclusiveIntersectionCount(regionMask: number, analysis: SetAnalysis): number {
  let count = 0;
  analysis.regions.forEach((region) => {
    if ((region.mask & regionMask) === regionMask) count += region.count;
  });
  return count;
}

export function queryIntersection(region: Region, analysis: SetAnalysis, inclusive: boolean): Region {
  if (!inclusive) return region;
  const members = analysis.regions.filter((item) => (item.mask & region.mask) === region.mask)
    .flatMap((item) => item.members).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { ...region, members, count: members.length, percentage: analysis.unionCount ? members.length / analysis.unionCount : 0,
    excludedSets: [], membershipMode: 'inclusive' };
}

export function describeRegion(region: Region): string {
  const included = region.includedSets?.join(' ∩ ') ?? region.key;
  return `${region.membershipMode === 'inclusive' ? '至少包含' : '仅包含'}：${included}；排除：${region.excludedSets?.join('、') || '无'}`;
}

export function getDuplicateCount(text: string): number {
  return parseIdentifierStats(text).duplicateCount;
}

export function formatPercentage(value: number): string {
  if (value === 0) return '0%';
  if (value < 0.001) return '<0.1%';
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;
}

export function formatRegionLabelLines(
  count: number,
  percentage: number,
  mode: RegionLabelMode,
): string[] {
  if (mode === 'none') return [];
  if (mode === 'count') return [String(count)];
  if (mode === 'percentage') return [formatPercentage(percentage)];
  return [String(count), formatPercentage(percentage)];
}
