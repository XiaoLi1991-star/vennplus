import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FIGURE_STYLE } from '../src/data/figureStyle';
import { DEFAULT_PALETTE } from '../src/data/palettes';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';
import { useWorkspaceHistory } from '../src/hooks/useWorkspaceHistory';
import type { WorkspaceState } from '../src/types';

const INITIAL_STATE: WorkspaceState = {
  projectTitle: 'Initial',
  sets: [
    { id: 'a', name: 'Alpha', color: DEFAULT_PALETTE.colors[0], text: 'A\nB' },
    { id: 'b', name: 'Beta', color: DEFAULT_PALETTE.colors[1], text: 'B\nC' },
  ],
  mode: 'venn',
  display: { regionLabelMode: 'count', showSetNames: true, showEmpty: false },
  figureStyle: DEFAULT_FIGURE_STYLE,
  setLabelPositions: { venn: {}, euler: {} },
  paletteId: DEFAULT_PALETTE.id,
  selectedMask: 3,
  topN: 20,
  sort: 'size',
  publication: DEFAULT_PUBLICATION_SETTINGS,
};

function HistoryHarness() {
  const [state, setState] = useState(INITIAL_STATE);
  const history = useWorkspaceHistory({ state, enabled: true, onRestore: setState });
  return (
    <div>
      <span data-testid="title">{state.projectTitle}</span>
      <button type="button" onClick={() => setState((current) => ({ ...current, projectTitle: 'First' }))}>
        First
      </button>
      <button type="button" onClick={() => setState((current) => ({ ...current, projectTitle: 'Second' }))}>
        Second
      </button>
      <button type="button" onClick={history.undo} disabled={!history.canUndo}>Undo</button>
      <button type="button" onClick={history.redo} disabled={!history.canRedo}>Redo</button>
    </div>
  );
}

describe('workspace history', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('undoes and redoes a durable workspace change', () => {
    render(<HistoryHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(screen.getByTestId('title')).toHaveTextContent('First');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('title')).toHaveTextContent('Initial');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByTestId('title')).toHaveTextContent('First');
  });

  it('coalesces consecutive edits into one history step', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T02:00:00Z'));
    render(<HistoryHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    vi.advanceTimersByTime(100);
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('title')).toHaveTextContent('Initial');
  });
});
