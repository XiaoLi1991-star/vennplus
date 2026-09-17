import { forwardRef, useId, useMemo } from 'react';
import { layout, venn, type ICircle, type ISetOverlap } from '@upsetjs/venn.js';
import type {
  DisplayOptions,
  FigureStyleOptions,
  SetAnalysis,
  SetDefinition,
  SetLabelPositions,
} from '../types';
import { hasFigureFill, resolveFigureStrokeColor } from '../data/figureStyle';
import {
  formatRegionLabelLines,
  getSetDisplayName,
  maskToIndices,
  inclusiveIntersectionCount,
} from '../lib/sets';
import {
  clampSetLabelPosition,
  createAdaptiveSetLabelLayout,
  createOutsideCircleLabelPoints,
  findExactCircleRegionAnchors,
} from '../lib/labelLayout';
import { fitViewBoxToAspectRatio } from '../lib/viewBox';
import { DraggableSetLabel } from './DraggableSetLabel';
import { assessEulerFit } from '../lib/eulerFit';

interface EulerChartProps {
  sets: SetDefinition[];
  analysis: SetAnalysis;
  selectedMask?: number | null;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  labelPositions: SetLabelPositions;
  onSelectRegion: (mask: number) => void;
  onSetLabelPositionChange: (setId: string, position: { x: number; y: number }) => void;
  targetAspectRatio?: number;
}

interface EulerDatum extends ISetOverlap {
  mask: number;
  exactSize: number;
  percentage: number;
}

export const EulerChart = forwardRef<SVGSVGElement, EulerChartProps>(function EulerChart(
  {
    sets,
    analysis,
    selectedMask = null,
    display,
    figureStyle,
    labelPositions,
    onSelectRegion,
    onSetLabelPositionChange,
    targetAspectRatio,
  },
  ref,
) {
  const selectionId = `euler-selection-${useId().replace(/:/g, '')}`;
  const letters = useMemo(() => sets.map((_, index) => String.fromCharCode(65 + index)), [sets.length]);
  const layoutItems = useMemo(() => {
    const data: EulerDatum[] = [];
    // Euler's layout solver needs explicit zero-valued singleton and pairwise
    // terms to preserve every circle. The shared analysis remains sparse; this
    // small dense contract is bounded to the 2–4 groups supported by Euler.
    for (let mask = 1; mask < 1 << sets.length; mask += 1) {
      const region = analysis.regionByMask.get(mask);
      const count = region?.count ?? 0;
      data.push({
        sets: maskToIndices(mask, sets.length).map((index) => letters[index]),
        // The library's distinct conversion only fixes degrees 1 and 2.
        // Feed inclusive counts at EVERY degree; labels retain exact counts.
        size: inclusiveIntersectionCount(mask, analysis),
        exactSize: count,
        percentage: region?.percentage ?? 0,
        mask,
      });
    }
    return layout(data, {
      width: 720,
      height: 530,
      padding: 46,
      distinct: false,
      layoutFunction: (items, options) => {
        // A containment chain has an exact concentric solution. Avoid the
        // solver's internally tangent circles and unstable degenerate arcs.
        const chain = sets.every((_, i) => sets.every((__, j) => i === j ||
          inclusiveIntersectionCount((1 << i) | (1 << j), analysis) ===
          Math.min(analysis.parsedSets[i].length, analysis.parsedSets[j].length)));
        return chain ? Object.fromEntries(letters.map((letter, i) => [letter, {
          setid: letter, x: 0, y: 0, radius: Math.sqrt(analysis.parsedSets[i].length / Math.PI),
        }])) : venn(items, options);
      },
      round: 3,
      orientation: Math.PI / 2,
    });
  }, [analysis.regionByMask, letters, sets.length]);

  const circles = useMemo(() => {
    const values = new Map<string, ICircle>();
    layoutItems.forEach((item) => {
      if (item.data.sets.length !== 1) return;
      const circle = item.circles[0];
      if (circle) values.set(item.data.sets[0], circle);
    });
    return letters.map((letter) => values.get(letter)).filter((circle): circle is ICircle => Boolean(circle));
  }, [layoutItems, letters]);
  const fit = useMemo(() => assessEulerFit(circles, analysis), [circles, analysis]);

  const center = circles.reduce(
    (value, circle) => ({ x: value.x + circle.x / circles.length, y: value.y + circle.y / circles.length }),
    { x: 0, y: 0 },
  );
  const hasFill = hasFigureFill(figureStyle);
  const regionFontSize = Number((12 * figureStyle.regionLabelFontScale).toFixed(2));
  const setNameFontSize = Number((13 * figureStyle.setLabelFontScale).toFixed(2));
  const setLabelTexts = sets.map(getSetDisplayName);
  const setLabelTextKey = setLabelTexts.join('\u0000');
  const baseSetLabelPoints = useMemo(
    () =>
      createOutsideCircleLabelPoints(
        circles,
        setLabelTexts,
        setNameFontSize,
        center,
      ),
    [center.x, center.y, circles, setLabelTextKey, setNameFontSize],
  );
  const adaptiveSetLabels = useMemo(
    () =>
      createAdaptiveSetLabelLayout(
        baseSetLabelPoints,
        setLabelTexts,
        setNameFontSize,
        [0, 0, 720, 530],
        { shiftLongLabelsOutward: false },
      ),
    [baseSetLabelPoints, setLabelTextKey, setNameFontSize],
  );
  const baseContentViewBox = adaptiveSetLabels.viewBox;
  const regionLabelItems = useMemo(
    () =>
      layoutItems.flatMap((item) => {
        if (item.data.exactSize === 0) return [];
        const lines = formatRegionLabelLines(
          item.data.exactSize,
          item.data.percentage,
          display.regionLabelMode,
        );
        return lines.length > 0 ? [{ item, lines }] : [];
      }),
    [display.regionLabelMode, layoutItems],
  );
  const exactRegionAnchors = useMemo(
    () =>
      sets.length === 4
        ? findExactCircleRegionAnchors(circles, [0, 0, 720, 530])
        : new Map<number, { x: number; y: number; clearance: number }>(),
    [circles, sets.length],
  );
  const activeSelectedMask =
    selectedMask && (analysis.regionByMask.get(selectedMask)?.count ?? 0) > 0
      ? selectedMask
      : null;
  const selectedLayoutItem = activeSelectedMask
    ? layoutItems.find((item) => item.data.mask === activeSelectedMask)
    : undefined;
  const selectedSpatialPath =
    selectedLayoutItem && (sets.length < 4 || exactRegionAnchors.has(selectedLayoutItem.data.mask))
      ? selectedLayoutItem.distinctPath || selectedLayoutItem.path
      : '';
  const selectionMaskId = `${selectionId}-outside`;
  const spatialRegionLabels = regionLabelItems.filter(
    ({ item }) => sets.length < 4 || exactRegionAnchors.has(item.data.mask),
  );
  const figureViewBox = fitViewBoxToAspectRatio(
    baseContentViewBox,
    targetAspectRatio ?? baseContentViewBox[2] / baseContentViewBox[3],
  );
  // Non-spatial exact regions remain available in the complete results table.
  const renderedRegionLabelCount = spatialRegionLabels.length;

  return (
    <svg
      ref={ref}
      className="scientific-figure euler-figure"
      viewBox={figureViewBox.join(' ')}
      role="img"
      aria-labelledby="euler-title euler-description"
      data-figure="euler"
      data-max-region-error={fit.maxRegionError}
      data-region-label-count={renderedRegionLabelCount}
      data-spatial-region-label-count={spatialRegionLabels.length}
      data-separate-region-label-count={0}
      data-omitted-region-label-count={regionLabelItems.length - renderedRegionLabelCount}
    >
      <title id="euler-title">{sets.length} 组 Euler 图</title>
      <desc id="euler-description">圆形面积与集合大小近似成比例的 Euler 图。</desc>
      <rect
        data-figure-background="true"
        x={figureViewBox[0]}
        y={figureViewBox[1]}
        width={figureViewBox[2]}
        height={figureViewBox[3]}
        fill="#ffffff"
      />

      {selectedSpatialPath ? (
        <defs data-export-ignore="true">
          <mask
            id={selectionMaskId}
            x={figureViewBox[0]}
            y={figureViewBox[1]}
            width={figureViewBox[2]}
            height={figureViewBox[3]}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
          >
            <rect
              x={figureViewBox[0]}
              y={figureViewBox[1]}
              width={figureViewBox[2]}
              height={figureViewBox[3]}
              fill="#ffffff"
            />
            <path d={selectedSpatialPath} fill="#000000" fillRule="evenodd" />
          </mask>
        </defs>
      ) : null}

      <g aria-hidden="true">
        {circles.map((circle, index) => (
          <circle
            key={letters[index]}
            cx={circle.x}
            cy={circle.y}
            r={circle.radius}
            fill={hasFill ? sets[index].color : 'none'}
            fillOpacity={hasFill ? figureStyle.fillOpacity : undefined}
            stroke={resolveFigureStrokeColor(sets[index].color, figureStyle)}
            strokeOpacity={1}
            strokeWidth={figureStyle.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {selectedSpatialPath ? (
        <rect
          data-export-ignore="true"
          data-selection-veil="true"
          aria-hidden="true"
          className="region-selection-veil"
          x={figureViewBox[0]}
          y={figureViewBox[1]}
          width={figureViewBox[2]}
          height={figureViewBox[3]}
          mask={`url(#${selectionMaskId})`}
        />
      ) : null}

      <g className="euler-hit-layer" data-export-ignore="true">
        {layoutItems.map((item) =>
          item.data.exactSize > 0 ? (
            <path
              key={`hit-${item.data.mask}`}
              data-region-interaction="true"
              d={item.distinctPath || item.path}
              fill="transparent"
              fillRule="evenodd"
              onClick={() => onSelectRegion(item.data.mask)}
            />
          ) : null,
        )}
      </g>

      <g className="euler-region-labels">
        {spatialRegionLabels.map(({ item, lines }) => {
          const labelPoint = exactRegionAnchors.get(item.data.mask) ?? item.text;
          const isSelected = item.data.mask === activeSelectedMask;
          return (
            <text
              key={item.data.mask}
              data-region-interaction="true"
              x={labelPoint.x}
              y={labelPoint.y - (lines.length - 1) * regionFontSize * 0.58}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#30383c"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={regionFontSize}
              fontWeight={figureStyle.regionLabelsBold ? 700 : 400}
              style={{ fontVariantNumeric: 'tabular-nums' }}
              className={
                isSelected ? 'region-is-selected' : activeSelectedMask ? 'region-is-muted' : undefined
              }
              role="button"
              aria-label={`${analysis.regionByMask.get(item.data.mask)?.key ?? item.data.sets.join(' ∩ ')}，${item.data.exactSize} 个成员`}
              aria-pressed={isSelected}
              tabIndex={0}
              onClick={() => onSelectRegion(item.data.mask)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectRegion(item.data.mask);
              }}
            >
              {lines.map((line, index) => (
                  <tspan
                    key={line}
                    x={labelPoint.x}
                    dy={index === 0 ? 0 : regionFontSize * 1.16}
                  >
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </g>

      {display.showSetNames ? (
        <g className="euler-set-labels">
          {adaptiveSetLabels.labels.map((defaultLabel, index) => {
            const set = sets[index];
            const position = clampSetLabelPosition(
              labelPositions[set.id] ?? defaultLabel,
              defaultLabel.estimatedWidth,
              setNameFontSize,
              figureViewBox,
            );
            return (
              <DraggableSetLabel
                key={set.id}
                setId={set.id}
                text={setLabelTexts[index]}
                position={position}
                estimatedWidth={defaultLabel.estimatedWidth}
                fontSize={setNameFontSize}
                fontWeight={figureStyle.setLabelsBold ? 700 : 400}
                color={set.color}
                viewBox={figureViewBox}
                onPositionChange={(nextPosition) =>
                  onSetLabelPositionChange(set.id, nextPosition)
                }
              />
            );
          })}
        </g>
      ) : null}
    </svg>
  );
});
