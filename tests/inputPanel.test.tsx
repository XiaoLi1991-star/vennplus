import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InputPanel } from '../src/components/InputPanel';
import { DEFAULT_PALETTE } from '../src/data/palettes';
import { analyzeSets } from '../src/lib/sets';
import type { SetDefinition } from '../src/types';

function createSets(count: number): SetDefinition[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `set-${index + 1}`,
    name: `Group ${index + 1}`,
    color: DEFAULT_PALETTE.colors[index],
    text: `member-${index + 1}`,
  }));
}

function renderPanel(count: number) {
  const sets = createSets(count);
  return render(
    <InputPanel
      sets={sets}
      analysis={analyzeSets(sets)}
      isAnalyzing={false}
      expandedSetId=""
      onExpandedSetIdChange={() => undefined}
      onChangeSet={() => undefined}
      onAddSet={() => undefined}
      onRemoveSet={() => undefined}
      onDuplicateSet={() => undefined}
    />,
  );
}

describe('input set limit', () => {
  it('allows a seventh set when six are present', () => {
    renderPanel(6);
    expect(screen.getByRole('button', { name: '添加集合' })).toBeEnabled();
  });

  it('stops adding and duplicating sets at eight', () => {
    renderPanel(8);
    expect(screen.getByText('8 / 8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已达 8 组上限' })).toBeDisabled();
  });
});
