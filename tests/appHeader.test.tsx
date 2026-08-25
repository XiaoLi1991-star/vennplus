import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../src/components/AppHeader';
import type { ExampleDefinition } from '../src/types';

afterEach(cleanup);

function renderHeader(
  onExportSvg = vi.fn(),
  examples: readonly ExampleDefinition[] = [],
  onLoadExample: (id: string) => void = () => undefined,
) {
  const { container } = render(
    <AppHeader
      examples={examples}
      onLoadExample={onLoadExample}
      saveStatus="saved"
      isAnalyzing={false}
      canUndo={false}
      canRedo={false}
      onUndo={() => undefined}
      onRedo={() => undefined}
      onExportProjectJson={() => undefined}
      onImportProjectJson={() => undefined}
      onExportSvg={onExportSvg}
      onExportPng={() => undefined}
      onExportPdf={() => undefined}
      onExportTiff={() => undefined}
      onExportXlsx={() => undefined}
      onExportManifest={() => undefined}
      onExportIntersectionsCsv={() => undefined}
      onExportSetsTxt={() => undefined}
      onExportIntersectionsTxt={() => undefined}
    />,
  );
  return container.querySelector('details.export-menu') as HTMLDetailsElement;
}

describe('AppHeader export menu', () => {
  it('closes after an export action', () => {
    const onExportSvg = vi.fn();
    const menu = renderHeader(onExportSvg);
    menu.open = true;

    fireEvent.click(screen.getByRole('menuitem', { name: /SVG 矢量图/ }));

    expect(onExportSvg).toHaveBeenCalledOnce();
    expect(menu.open).toBe(false);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    const menu = renderHeader();
    const trigger = menu.querySelector('summary') as HTMLElement;
    menu.open = true;

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(menu.open).toBe(false);
    expect(trigger).toHaveFocus();
  });

  it('closes when the user clicks outside', () => {
    const menu = renderHeader();
    menu.open = true;

    fireEvent.pointerDown(document.body);

    expect(menu.open).toBe(false);
  });

  it('acts as a loader and returns to the placeholder after loading an example', () => {
    const onLoadExample = vi.fn();
    const example: ExampleDefinition = {
      id: 'two-set-example',
      name: '2组：测试示例',
      description: 'Test fixture',
      defaultMode: 'venn',
      sets: [],
    };
    renderHeader(vi.fn(), [example], onLoadExample);
    const picker = screen.getByRole('combobox', { name: '示例' });

    fireEvent.change(picker, { target: { value: example.id } });

    expect(onLoadExample).toHaveBeenCalledWith(example.id);
    expect(picker).toHaveValue('');
  });
});
