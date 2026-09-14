import type { ExampleDefinition, SetDefinition } from '../types';
import { DEFAULT_PALETTE } from './palettes';

function setsFromRegions(names: string[], regions: Record<number, string[]>): SetDefinition[] {
  return names.map((name, setIndex) => {
    const members: string[] = [];
    Object.entries(regions).forEach(([maskValue, regionMembers]) => {
      if ((Number(maskValue) & (1 << setIndex)) !== 0) members.push(...regionMembers);
    });
    return {
      id: `set-${setIndex + 1}`,
      name,
      color: DEFAULT_PALETTE.colors[setIndex],
      text: members.join('\n'),
    };
  });
}

const twoSetRegions: Record<number, string[]> = {
  1: ['ESR1', 'PGR', 'FOXA1', 'GATA3', 'KRT18', 'KRT8', 'XBP1'],
  2: ['EGFR', 'ALK', 'ROS1', 'MET', 'RET', 'NTRK1'],
  3: ['TP53', 'PIK3CA', 'ERBB2', 'AKT1', 'MAPK1'],
};

const threeSetRegions: Record<number, string[]> = {
  1: ['ESR1', 'PGR', 'FOXA1', 'GATA3', 'KRT18', 'KRT8'],
  2: ['EGFR', 'ALK', 'ROS1', 'MET', 'RET'],
  3: ['ERBB2', 'CCND1', 'FGFR1'],
  4: ['KRAS', 'BRAF', 'NRAS', 'RAF1', 'MAP2K1'],
  5: ['CDH1', 'RB1', 'ATM'],
  6: ['PTEN', 'NF1', 'STK11'],
  7: ['TP53', 'PIK3CA', 'AKT1', 'MAPK1'],
};

const proportionalEulerRegions: Record<number, string[]> = {
  1: ['ESR1', 'PGR', 'FOXA1', 'GATA3', 'KRT18', 'KRT8', 'XBP1', 'BCL2', 'MUC1', 'AGR2'],
  2: ['EGFR', 'ALK', 'ROS1', 'MET'],
  3: ['ERBB2', 'CCND1', 'FGFR1'],
  4: ['BRCA1', 'BRCA2'],
  5: ['ATM', 'CHEK2'],
  6: ['PTEN'],
  7: ['TP53'],
};

const fourSetRegions: Record<number, string[]> = {
  1: ['ESR1', 'PGR', 'FOXA1', 'GATA3', 'KRT18', 'KRT8'],
  2: ['EGFR', 'ALK', 'ROS1', 'MET', 'RET'],
  3: ['ERBB2', 'CCND1', 'FGFR1'],
  4: ['KRAS', 'BRAF', 'NRAS', 'RAF1', 'MAP2K1'],
  5: ['CDH1', 'RB1', 'ATM'],
  6: ['PTEN', 'NF1', 'STK11'],
  7: ['MDM2', 'CDK4'],
  8: ['BRCA1', 'BRCA2', 'PALB2', 'RAD51', 'CHEK2'],
  9: ['AR', 'RUNX1', 'KMT2C'],
  10: ['JAK2', 'STAT3', 'IL6R'],
  11: ['MYC', 'MAX'],
  12: ['APC', 'CTNNB1', 'AXIN1'],
  13: ['MTOR', 'TSC1'],
  14: ['SMAD4', 'TGFBR2'],
  15: ['TP53', 'PIK3CA', 'AKT1', 'MAPK1'],
};

const fiveSetRegions: Record<number, string[]> = {
  1: ['ESR1', 'PGR', 'FOXA1', 'GATA3'],
  2: ['EGFR', 'ALK', 'ROS1', 'MET'],
  3: ['ERBB2', 'CCND1', 'FGFR1'],
  4: ['KRAS', 'BRAF', 'NRAS', 'RAF1'],
  6: ['PTEN', 'NF1', 'STK11'],
  7: ['MDM2', 'CDK4'],
  8: ['BRCA1', 'BRCA2', 'PALB2', 'RAD51'],
  12: ['AR', 'RUNX1', 'KMT2C'],
  14: ['JAK2', 'STAT3', 'IL6R'],
  15: ['MYC', 'MAX'],
  16: ['SMAD2', 'SMAD3', 'TGFBR1', 'TGFBR2'],
  17: ['ATM', 'ATR', 'CHEK1'],
  18: ['MTOR', 'TSC1', 'RHEB'],
  19: ['CDH1', 'CTNNA1'],
  20: ['APC', 'CTNNB1', 'AXIN1'],
  21: ['NOTCH1', 'JAG1'],
  24: ['BMP4', 'BMPR1A', 'ACVR1'],
  25: ['RB1', 'E2F1'],
  28: ['SKI', 'TGIF1'],
  30: ['MRE11', 'NBN'],
  31: ['TP53', 'PIK3CA', 'AKT1', 'MAPK1', 'PTEN'],
};

const sixSetGenes = [
  'TP53', 'PIK3CA', 'ERBB2', 'AKT1', 'MAPK1', 'PTEN', 'ESR1', 'PGR', 'FOXA1', 'GATA3',
  'EGFR', 'ALK', 'ROS1', 'MET', 'RET', 'KRAS', 'BRAF', 'NRAS', 'RAF1', 'MAP2K1',
  'BRCA1', 'BRCA2', 'PALB2', 'RAD51', 'CHEK2', 'ATM', 'ATR', 'MRE11', 'NBN', 'RAD50',
  'MYC', 'MAX', 'MXD1', 'CCND1', 'CDK4', 'CDK6', 'RB1', 'E2F1', 'MDM2', 'CDKN2A',
  'JAK1', 'JAK2', 'STAT3', 'STAT5A', 'IL6R', 'IFNGR1', 'IRF1', 'SOCS1', 'TYK2', 'CXCL10',
  'MTOR', 'TSC1', 'TSC2', 'RHEB', 'RPTOR', 'RICTOR', 'ULK1', 'EIF4EBP1', 'RPS6KB1', 'LKB1',
  'APC', 'CTNNB1', 'AXIN1', 'GSK3B', 'WNT3A', 'FZD7', 'DVL2', 'TCF7L2', 'LEF1', 'RNF43',
  'SMAD2', 'SMAD3', 'SMAD4', 'TGFBR1', 'TGFBR2', 'BMP4', 'BMPR1A', 'ACVR1', 'SKI', 'TGIF1',
  'NOTCH1', 'NOTCH2', 'JAG1', 'DLL4', 'HES1', 'HEY1', 'MAML1', 'RBPJ', 'NUMB', 'FBXW7',
];

const sixSetMasks = [
  1, 1, 1, 1, 1, 1, 1, 1,
  2, 2, 2, 2, 2, 2, 2,
  4, 4, 4, 4, 4, 4,
  8, 8, 8, 8, 8, 8,
  16, 16, 16, 16, 16,
  32, 32, 32, 32, 32,
  3, 3, 3, 5, 5, 6, 6, 9, 9, 10, 12,
  17, 18, 20, 24, 33, 34, 36, 40, 48,
  7, 7, 11, 13, 14, 19, 21, 22, 25, 26, 28,
  35, 37, 38, 41, 42, 44, 49, 50, 52, 56,
  15, 23, 27, 29, 30, 39, 43, 47, 63,
];

const sixSetRegions = sixSetGenes.reduce<Record<number, string[]>>((accumulator, gene, index) => {
  const mask = sixSetMasks[index] ?? 63;
  (accumulator[mask] ??= []).push(gene);
  return accumulator;
}, {});

export const EXAMPLES: readonly ExampleDefinition[] = [
  {
    id: 'two-cohorts',
    name: '2组 · Venn · 队列比较',
    description: '经典两集合 Venn',
    sets: setsFromRegions(['Discovery', 'Validation'], twoSetRegions),
    defaultMode: 'venn',
  },
  {
    id: 'three-treatments',
    name: '3组 · Venn · 入门示例',
    description: '经典三集合 Venn',
    sets: setsFromRegions(['Control', 'Treatment A', 'Treatment B'], threeSetRegions),
    defaultMode: 'venn',
  },
  {
    id: 'three-proportional-euler',
    name: '3组 · Euler · 面积比例示例',
    description: '集合面积随组大小变化',
    sets: setsFromRegions(
      ['Discovery', 'Validation', 'Curated'],
      proportionalEulerRegions,
    ),
    defaultMode: 'euler',
  },
  {
    id: 'four-biomarkers',
    name: '4组 · Venn · 经典交集',
    description: '对称四椭圆 Venn',
    sets: setsFromRegions(
      ['Control', 'Treatment A', 'Treatment B', 'Validation'],
      fourSetRegions,
    ),
    defaultMode: 'venn',
  },
  {
    id: 'five-pathways',
    name: '5组 · Venn / UpSet · 通路比较',
    description: 'venn 参考五组布局，正文建议双栏',
    sets: setsFromRegions(
      ['Luminal', 'Receptor', 'MAPK', 'DNA repair', 'TGF-beta'],
      fiveSetRegions,
    ),
    defaultMode: 'venn',
  },
  {
    id: 'six-cohorts',
    name: '6组 · 仅 UpSet · 多队列整合',
    description: '六组默认 UpSet',
    sets: setsFromRegions(
      ['Control', 'Treatment A', 'Treatment B', 'Cohort 2', 'Validation', 'External'],
      sixSetRegions,
    ),
    defaultMode: 'upset',
  },
] as const;

export const DEFAULT_EXAMPLE = EXAMPLES.find((example) => example.id === 'three-treatments')!;

export function cloneExample(example: ExampleDefinition): SetDefinition[] {
  return example.sets.map((set, index) => ({ ...set, id: `set-${index + 1}-${Date.now()}` }));
}
