export interface FigureFontMetrics { minimum: number; labels: number; values: number }

/** Measure rendered/exportable text in user space, converted to physical points. */
export function measureFigureFonts(svg: SVGSVGElement, widthMm: number): FigureFontMetrics {
  const rootMatrix = svg.getCTM();
  const rootScale = rootMatrix ? Math.sqrt(Math.abs(rootMatrix.a * rootMatrix.d - rootMatrix.b * rootMatrix.c)) : 1;
  const toPt = widthMm / 25.4 * 72 / svg.viewBox.baseVal.width;
  const sizes: number[] = [], labels: number[] = [], values: number[] = [];
  for (const node of svg.querySelectorAll<SVGTextElement>('text')) {
    if (!node.textContent?.trim() || node.closest('[data-export-ignore]')) continue;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const matrix = node.getCTM();
    const scale = matrix ? Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) / rootScale : 1;
    const pt = parseFloat(style.fontSize) * scale * toPt;
    if (!Number.isFinite(pt) || pt <= 0) continue;
    sizes.push(pt);
    if (node.closest('.venn-set-labels, .euler-set-labels') || node.classList.contains('upset-set-name')) labels.push(pt);
    if (node.closest('.venn-region-labels, .euler-region-labels') || node.classList.contains('upset-value-label')) values.push(pt);
  }
  const min = (items: number[]) => items.length ? Math.min(...items) : 0;
  return { minimum: min(sizes), labels: min(labels), values: min(values) };
}
