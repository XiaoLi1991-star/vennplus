export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  colors: readonly string[];
}

export const PALETTES: readonly PalettePreset[] = [
  {
    id: 'ggvenn-soft',
    name: 'ggvenn 柔和',
    description: '沿用蓝、黄、绿、红的经典顺序，降低饱和度以适合科研图稿。',
    colors: [
      '#4E79A7', '#B08A34', '#4D8B68', '#C76460',
      '#8B6AA7', '#B97443', '#3F8393', '#9E657A',
    ],
  },
  {
    id: 'color-safe-muted',
    name: '色觉友好',
    description: '以明度和色相双重区分，对常见色觉缺陷更友好。',
    colors: [
      '#3E7195', '#B8873F', '#458377', '#9B6F8A',
      '#6E9EB2', '#B56B50', '#6D73A3', '#77824F',
    ],
  },
  {
    id: 'cool-mineral',
    name: '冷色矿物',
    description: '蓝绿与灰紫为主，适合临床、组学和多队列数据。',
    colors: [
      '#357D87', '#5978A6', '#7895A3', '#657F91',
      '#89759A', '#609080', '#7E6F79', '#496D78',
    ],
  },
  {
    id: 'warm-botanical',
    name: '暖调植物',
    description: '砖红、陶土、赭石与鼠尾草色，克制而不灰暗。',
    colors: [
      '#A85E56', '#B77E4D', '#A99551', '#6F8B68',
      '#7E708E', '#A36F7F', '#5E8187', '#88745D',
    ],
  },
  {
    id: 'journal-neutral',
    name: '期刊中性',
    description: '适合单色打印，依靠明度与轮廓区分集合。',
    colors: [
      '#3E566B', '#60778A', '#7C8F9C', '#687B74',
      '#8A8292', '#A49B87', '#6E6880', '#8B6F69',
    ],
  },
] as const;

export const DEFAULT_PALETTE = PALETTES[0];
