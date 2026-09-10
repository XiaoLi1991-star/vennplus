import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../src/components/AppHeader';
import type { ExampleDefinition } from '../src/types';
import { DEFAULT_PUBLICATION_SETTINGS } from '../src/data/publication';

afterEach(cleanup);

function renderHeader(
  onExportSvg = vi.fn(),
  examples: readonly ExampleDefinition[] = [],
  onLoadExample: (id: string) => void = () => undefined,
) {
  render(
    <AppHeader
      publication={DEFAULT_PUBLICATION_SETTINGS}
      minimumFontPt={10}
      onPublicationChange={() => undefined}
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
  return screen.getByRole('button', { name: '导出' });
}

describe('AppHeader export dialog', () => {
  it('downloads only on confirmation and reports success', async () => {
    const onExportSvg = vi.fn();
    fireEvent.click(renderHeader(onExportSvg));
    expect(screen.getByRole('dialog', { name: '导出' })).toBeInTheDocument();
    expect(onExportSvg).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '下载 SVG' }));
    await waitFor(() => expect(screen.getByText('SVG 矢量图 已生成，请查看浏览器下载。')).toBeInTheDocument());
    expect(onExportSvg).toHaveBeenCalledOnce();
  });

  it('closes on Escape and restores focus to the trigger', () => {
    const trigger = renderHeader();
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when the user clicks outside', () => {
    fireEvent.click(renderHeader());
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
