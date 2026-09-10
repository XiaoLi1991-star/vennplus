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
  estimateSvgTextWidth,
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
  const separateRegionLabels = regionLabelItems.filter(
    ({ item }) => sets.length === 4 && !exactRegionAnchors.has(item.data.mask),
  );
  const separateLabelFontSize = Math.min(setNameFontSize * 0.82, regionFontSize);
  const separateLabelGap = separateLabelFontSize * 2.75;
  const separateLabelKeys = separateRegionLabels.map(
    ({ item }) => analysis.regionByMask.get(item.data.mask)?.key ?? item.data.sets.join(' ∩ '),
  );
  const separateKeyLines = separateLabelKeys.map((key) => {
    const parts = key.split(' ∩ ');
    if (parts.length < 2) return [key];
    const splitAt = Math.ceil(parts.length / 2);
    return [
      `${parts.slice(0, splitAt).join(' ∩ ')} ∩`,
      parts.slice(splitAt).join(' ∩ '),
    ];
  });
  const separateValues = separateRegionLabels.map(({ lines }) => lines.join(' · '));
  const separateValueWidth = Math.max(
    0,
    ...separateValues.map((value) => estimateSvgTextWidth(value, regionFontSize, 0)),
  );
  const separateListWidth = 118;
  const separateListX = 720 - separateListWidth - 7;
  const separateKeyWidth = separateListWidth - separateValueWidth - regionFontSize * 0.8;
  const separateListHeight = separateLabelFontSize * 1.7 + separateRegionLabels.length * separateLabelGap;
  const separateListY = center.y - separateListHeight / 2;
  const contentViewBox: [number, number, number, number] = [baseContentViewBox[0], baseContentViewBox[1], baseContentViewBox[2], baseContentViewBox[3] + 26];
  const figureViewBox = fitViewBoxToAspectRatio(
    contentViewBox,
    targetAspectRatio ?? contentViewBox[2] / contentViewBox[3],
  );
  const renderedRegionLabelCount = spatialRegionLabels.length + separateRegionLabels.length;

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
      data-separate-region-label-count={separateRegionLabels.length}
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
      <text x={360} y={baseContentViewBox[1] + baseContentViewBox[3] + 15} textAnchor="middle" fontSize={10}
        fill={fit.maxRegionError > 0.01 ? '#995620' : '#69777e'} data-euler-fit="true">
        {`Area fit: max region error ${(fit.maxRegionError * 100).toFixed(2)}% of union${fit.maxRegionError > 0.01 ? ' — use counts / UpSet for exact comparison' : ''}`}
      </text>

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

      {separateRegionLabels.length > 0 ? (
        <g className="euler-separate-region-labels">
          <title>
            These exact intersections cannot be separated by the fitted circle topology and are shown alongside the diagram.
          </title>
          <line
            x1={separateListX - regionFontSize * 0.85}
            x2={separateListX - regionFontSize * 0.85}
            y1={separateListY}
            y2={separateListY + separateListHeight}
            stroke="#c7d0d4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={separateListX}
            y={separateListY + separateLabelFontSize}
            fill="#69777e"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={separateLabelFontSize * 0.86}
            fontWeight={650}
            letterSpacing="0.025em"
          >
            EXACT INTERSECTIONS
          </text>
          {separateRegionLabels.map(({ item, lines }, index) => {
            const key = separateLabelKeys[index];
            const keyLines = separateKeyLines[index];
            const longestKeyLineWidth = Math.max(
              ...keyLines.map((line) => estimateSvgTextWidth(line, separateLabelFontSize, 0)),
            );
            const keyFontSize = Math.max(
              separateLabelFontSize * 0.68,
              Math.min(
                separateLabelFontSize,
                separateLabelFontSize * (separateKeyWidth / longestKeyLineWidth),
              ),
            );
            const y = separateListY + separateLabelFontSize * 2.35 + index * separateLabelGap;
            const regionKey = analysis.regionByMask.get(item.data.mask)?.key ?? key;
            const isSelected = item.data.mask === activeSelectedMask;
            return (
              <g
                key={`separate-${item.data.mask}`}
                data-region-interaction="true"
                role="button"
                tabIndex={0}
                aria-label={`${regionKey}，${item.data.exactSize} 个成员`}
                aria-pressed={isSelected}
                className={
                  isSelected ? 'region-is-selected' : activeSelectedMask ? 'region-is-muted' : undefined
                }
                onClick={() => onSelectRegion(item.data.mask)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectRegion(item.data.mask);
                  }
                }}
              >
                <rect
                  data-export-ignore="true"
                  x={separateListX - separateLabelFontSize * 0.35}
                  y={y - separateLabelFontSize * 0.85}
                  width={separateListWidth}
                  height={separateLabelGap}
                  fill="transparent"
                />
                <text
                  x={separateListX}
                  y={y - keyFontSize * 0.45}
                  fill="#4f5d64"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize={keyFontSize}
                  fontWeight={500}
                >
                  {keyLines.map((line, lineIndex) => (
                    <tspan
                      key={`${line}-${lineIndex}`}
                      x={separateListX}
                      dy={lineIndex === 0 ? 0 : keyFontSize * 1.22}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
                <text
                  className="euler-separate-region-value"
                  x={separateListX + separateListWidth}
                  y={y + keyFontSize * 0.77}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#30383c"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize={regionFontSize}
                  fontWeight={figureStyle.regionLabelsBold ? 700 : 400}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {lines.map((line, lineIndex) => (
                    <tspan key={`${line}-${lineIndex}`}>
                      {lineIndex === 0 ? '' : ' · '}{line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

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
