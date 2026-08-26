import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectedRegionPanel } from '../src/components/SelectedRegionPanel';
import type { Region } from '../src/types';

afterEach(cleanup);

const region: Region = {
  mask: 7,
  key: 'Control ∩ Treatment A ∩ Treatment B',
  setIndices: [0, 1, 2],
  members: ['TP53', 'PIK3CA', 'AKT1'],
  count: 3,
  percentage: 0.3,
};

describe('selected intersection member panel', () => {
  it('shows selectable text and filters members without changing the region', () => {
    render(
      <SelectedRegionPanel
        region={region}
        onClearSelection={() => undefined}
        onDownloadTxt={() => undefined}
        onDownloadCsv={() => undefined}
      />,
    );

    expect(screen.getByText(region.key)).toBeInTheDocument();
    expect(screen.getByLabelText('选中区域成员文本')).toHaveValue('TP53\nPIK3CA\nAKT1');

    fireEvent.change(screen.getByLabelText('搜索选中区域成员'), { target: { value: 'PIK' } });
    expect(screen.getByLabelText('选中区域成员文本')).toHaveValue('PIK3CA');
    expect(screen.getByText('显示 1 / 3 项')).toBeInTheDocument();
  });

  it('provides direct TXT and CSV download actions', () => {
    const onDownloadTxt = vi.fn();
    const onDownloadCsv = vi.fn();
    render(
      <SelectedRegionPanel
        region={region}
        onClearSelection={() => undefined}
        onDownloadTxt={onDownloadTxt}
        onDownloadCsv={onDownloadCsv}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'TXT' }));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(onDownloadTxt).toHaveBeenCalledTimes(1);
    expect(onDownloadCsv).toHaveBeenCalledTimes(1);
  });

  it('explains an empty search result inside the copyable member area', () => {
    render(
      <SelectedRegionPanel
        region={region}
        onClearSelection={() => undefined}
        onDownloadTxt={() => undefined}
        onDownloadCsv={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText('搜索选中区域成员'), {
      target: { value: 'NOT_A_MEMBER' },
    });
    expect(screen.getByLabelText('选中区域成员文本')).toHaveAttribute(
      'placeholder',
      '未找到匹配的成员，请尝试其他关键词。',
    );
    expect(screen.getByText('显示 0 / 3 项')).toBeInTheDocument();
  });

  it('clears a stale search when the selected intersection identity changes at the same mask', () => {
    const { rerender } = render(
      <SelectedRegionPanel
        region={region}
        onClearSelection={() => undefined}
        onDownloadTxt={() => undefined}
        onDownloadCsv={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText('搜索选中区域成员'), {
      target: { value: 'NO_MATCH' },
    });

    rerender(
      <SelectedRegionPanel
        region={{ ...region, key: 'Discovery ∩ Validation ∩ Curated', members: ['BRCA1'] }}
        onClearSelection={() => undefined}
        onDownloadTxt={() => undefined}
        onDownloadCsv={() => undefined}
      />,
    );

    expect(screen.getByLabelText('搜索选中区域成员')).toHaveValue('');
    expect(screen.getByLabelText('选中区域成员文本')).toHaveValue('BRCA1');
  });

  it('offers an explicit way to clear the selected intersection', () => {
    const onClearSelection = vi.fn();
    render(
      <SelectedRegionPanel
        region={region}
        onClearSelection={onClearSelection}
        onDownloadTxt={() => undefined}
        onDownloadCsv={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '取消选择' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/点击画布空白处可取消选择/)).toBeInTheDocument();
  });
});
