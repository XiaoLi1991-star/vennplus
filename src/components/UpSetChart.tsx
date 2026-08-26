import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { scaleLinear } from 'd3-scale';
import type {
  DisplayOptions,
  FigureStyleOptions,
  SetAnalysis,
  SetDefinition,
  UpSetSort,
} from '../types';
import { estimateSvgTextWidth } from '../lib/labelLayout';
import { formatRegionLabelLines, getSetDisplayName } from '../lib/sets';
import {
  createUpSetLayout,
  UPSET_MIN_RENDER_SCALE,
  UPSET_SET_BAR_WIDTH,
  UPSET_SET_BAR_X,
  UPSET_SET_COUNT_X,
} from '../lib/upsetLayout';

export type { UpSetSort } from '../types';

interface UpSetChartProps {
  sets: SetDefinition[];
  analysis: SetAnalysis;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  topN: number;
  sort: UpSetSort;
  onSelectRegion: (mask: number) => void;
}

interface SetLaneProps {
  sets: SetDefinition[];
  setNames: string[];
  setCounts: number[];
  setNameX: number;
  matrixTop: number;
  rowStep: number;
  setScale: (value: number) => number;
  labelFontSize: number;
  labelFontWeight: number;
  valueFontSize: number;
  valueFontWeight: number;
}

const BASE_BAR_TOP = 64;
const BAR_BOTTOM = 190;
const HORIZONTAL_VALUE_LABEL_GAP = 20;
const ANGLED_VALUE_LABEL_GAP = 22;
const VALUE_LINE_HEIGHT = 11.5;
const VALUE_LABEL_FONT_SIZE = 11;
const ANGLED_VALUE_LABEL_DEGREES = -75;
const VALUE_LABEL_SAFE_TOP = 28;
const INTERSECTION_TITLE_Y = 20;
const SET_SIZE_TITLE_Y = 218;

function scaledFontSize(base: number, scale: number): number {
  return Number((base * scale).toFixed(2));
}

function SetLaneMarks({
  sets,
  setNames,
  setCounts,
  setNameX,
  matrixTop,
  rowStep,
  setScale,
  labelFontSize,
  labelFontWeight,
  valueFontSize,
  valueFontWeight,
}: SetLaneProps) {
  return (
    <g className="upset-set-sizes">
      {sets.map((set, rowIndex) => {
        const y = matrixTop + rowStep * rowIndex;
        const setCount = setCounts[rowIndex] ?? 0;
        const barLength = setScale(setCount);
        return (
          <g key={set.id}>
            <rect
              x={UPSET_SET_BAR_X}
              y={y - 6}
              width={barLength}
              height={12}
              fill={set.color}
              rx={1.5}
            />
            <text
              x={UPSET_SET_COUNT_X}
              y={y}
              textAnchor="start"
              dominantBaseline="middle"
              className="upset-set-count"
              data-bar-end={UPSET_SET_BAR_X + barLength}
              style={{ fontSize: valueFontSize, fontWeight: valueFontWeight }}
            >
              {setCount}
            </text>
            <text
              x={setNameX}
              y={y}
              dominantBaseline="middle"
              className="upset-set-name"
              fill={set.color}
              style={{ fontSize: labelFontSize, fontWeight: labelFontWeight }}
            >
              {setNames[rowIndex]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export const UpSetChart = forwardRef<SVGSVGElement, UpSetChartProps>(function UpSetChart(
  { sets, analysis, display, figureStyle, topN, sort, onSelectRegion },
  ref,
) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const frozenLaneRef = useRef<SVGSVGElement>(null);
  const minimumMobileScrollLeftRef = useRef(0);
  const visibleRegions = useMemo(() => {
    return [...analysis.regions]
      .sort((a, b) => {
        if (sort === 'degree') {
          return b.setIndices.length - a.setIndices.length || b.count - a.count || a.mask - b.mask;
        }
        return b.count - a.count || b.setIndices.length - a.setIndices.length || a.mask - b.mask;
      })
      .slice(0, topN);
  }, [analysis.regions, sort, topN]);

  const setNames = useMemo(
    () => sets.map((set, index) => getSetDisplayName(set, index)),
    [sets],
  );
  const setCounts = useMemo(
    () => analysis.parsedSets.map((members) => members.length),
    [analysis.parsedSets],
  );
  const labelFontSize = scaledFontSize(11.5, figureStyle.upsetLabelFontScale);
  const axisTitleFontSize = scaledFontSize(12, figureStyle.upsetLabelFontScale);
  const noteFontSize = scaledFontSize(10.5, figureStyle.upsetLabelFontScale);
  const valueFontSize = scaledFontSize(VALUE_LABEL_FONT_SIZE, figureStyle.upsetValueFontScale);
  const setCountFontSize = scaledFontSize(11, figureStyle.upsetValueFontScale);
  const tickFontSize = scaledFontSize(11, figureStyle.upsetValueFontScale);
  const labelFontWeight = figureStyle.upsetLabelsBold ? 700 : 500;
  const valueFontWeight = figureStyle.upsetValuesBold ? 700 : 500;
  const layout = useMemo(
    () =>
      createUpSetLayout(setNames, visibleRegions.length, setCounts, {
        labelScale: figureStyle.upsetLabelFontScale,
        valueScale: figureStyle.upsetValueFontScale,
        columnScale: figureStyle.upsetColumnScale,
        rowScale: figureStyle.upsetRowScale,
      }),
    [
      figureStyle.upsetColumnScale,
      figureStyle.upsetLabelFontScale,
      figureStyle.upsetRowScale,
      figureStyle.upsetValueFontScale,
      setCounts,
      setNames,
      visibleRegions.length,
    ],
  );
  const {
    width,
    height,
    plotLeft,
    plotRight,
    columnStep,
    matrixTop,
    matrixBottom,
    rowStep,
    noteY,
    isDense,
    minViewportWidth,
    setNameX,
  } = layout;
  const barWidth = Math.max(8, Math.min(27, columnStep * 0.62));
  const maxRegion = Math.max(1, ...visibleRegions.map((region) => region.count));
  const maxSet = Math.max(1, ...setCounts);
  const valueLabelLines = visibleRegions.map((region) =>
    formatRegionLabelLines(region.count, region.percentage, display.regionLabelMode),
  );
  const denseValues = valueLabelLines.map((lines) => lines.join(' · '));
  const maxDenseValueWidth = Math.max(
    0,
    ...denseValues.map((value) => estimateSvgTextWidth(value, valueFontSize, 0)),
  );
  const denseLabelsAreAngled = isDense && maxDenseValueWidth > columnStep - 6;
  const projectedAngledLabelHeight =
    maxDenseValueWidth * Math.sin((Math.abs(ANGLED_VALUE_LABEL_DEGREES) * Math.PI) / 180) +
    valueFontSize * Math.cos((Math.abs(ANGLED_VALUE_LABEL_DEGREES) * Math.PI) / 180);
  const barTop = denseLabelsAreAngled
    ? Math.max(
        BASE_BAR_TOP,
        Math.ceil(VALUE_LABEL_SAFE_TOP + ANGLED_VALUE_LABEL_GAP + projectedAngledLabelHeight),
      )
    : BASE_BAR_TOP;
  const valueLabelGap =
    (denseLabelsAreAngled ? ANGLED_VALUE_LABEL_GAP : HORIZONTAL_VALUE_LABEL_GAP) +
    Math.max(0, valueFontSize - VALUE_LABEL_FONT_SIZE) * 0.45;
  const valueLineHeight = VALUE_LINE_HEIGHT * figureStyle.upsetValueFontScale;
  const barScale = scaleLinear().domain([0, maxRegion]).range([BAR_BOTTOM, barTop]).nice();
  const setScale = scaleLinear().domain([0, maxSet]).range([0, UPSET_SET_BAR_WIDTH]);
  const ticks = barScale.ticks(4);
  const totalActual = analysis.regions.length;
  const visibleActual = visibleRegions.length;
  // Keep the interactive preview on the chart's natural coordinate ratio.
  // The export clone redistributes vertical anchors for the requested physical
  // aspect ratio, while the live chart retains a compact scrolling viewport.
  const figureViewBox = [0, 0, width, height] as const;

  const chartStyle = {
    '--upset-mobile-width': `${Math.ceil(width * UPSET_MIN_RENDER_SCALE)}px`,
    '--upset-mobile-height': `${Math.ceil(height * UPSET_MIN_RENDER_SCALE)}px`,
    '--upset-mobile-lane-width': `${Math.ceil(plotLeft * UPSET_MIN_RENDER_SCALE)}px`,
    '--upset-desktop-lane-width': `${Math.ceil(plotLeft * UPSET_MIN_RENDER_SCALE)}px`,
    '--upset-desktop-lane-height': `${Math.ceil(height * UPSET_MIN_RENDER_SCALE)}px`,
  } as CSSProperties;

  const assignChartRef = useCallback(
    (node: SVGSVGElement | null) => {
      chartRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    const alignChartChrome = () => {
      const viewport = scrollViewportRef.current;
      const frozenLane = frozenLaneRef.current;
      const chart = chartRef.current;
      const shell = viewport?.parentElement;
      if (!viewport || !frozenLane || !chart || !shell || !isDense) {
        minimumMobileScrollLeftRef.current = 0;
        return;
      }

      if (window.innerWidth > 760) {
        minimumMobileScrollLeftRef.current = 0;
        const chartRect = chart.getBoundingClientRect();
        if (chartRect.width > 0 && chartRect.height > 0) {
          const scale = Math.min(chartRect.width / width, chartRect.height / height);
          shell.style.setProperty('--upset-desktop-lane-width', `${plotLeft * scale}px`);
          shell.style.setProperty('--upset-desktop-lane-height', `${height * scale}px`);
        }
        return;
      }

      const naturalLaneWidth = Number.parseFloat(
        getComputedStyle(viewport.parentElement!).getPropertyValue('--upset-mobile-lane-width'),
      );
      const visibleLaneWidth = frozenLane.getBoundingClientRect().width;
      const minimumScrollLeft = Math.max(0, Math.ceil(naturalLaneWidth - visibleLaneWidth));
      minimumMobileScrollLeftRef.current = minimumScrollLeft;
      viewport.scrollLeft = Math.max(viewport.scrollLeft, minimumScrollLeft);
    };

    alignChartChrome();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(alignChartChrome);
    if (resizeObserver) {
      if (scrollViewportRef.current) resizeObserver.observe(scrollViewportRef.current);
      if (chartRef.current) resizeObserver.observe(chartRef.current);
    }
    window.addEventListener('resize', alignChartChrome);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', alignChartChrome);
    };
  }, [height, isDense, plotLeft, width]);

  return (
    <div
      className={`upset-chart-shell${isDense ? ' is-dense' : ''}`}
      data-upset-dense={isDense ? 'true' : 'false'}
      style={chartStyle}
    >
      <div
        ref={scrollViewportRef}
        className="upset-scroll-viewport"
        onScroll={(event) => {
          const minimumScrollLeft = minimumMobileScrollLeftRef.current;
          if (event.currentTarget.scrollLeft < minimumScrollLeft) {
            event.currentTarget.scrollLeft = minimumScrollLeft;
          }
        }}
      >
        <svg
          ref={assignChartRef}
          className="scientific-figure upset-figure"
          viewBox={figureViewBox.join(' ')}
          preserveAspectRatio={isDense ? 'xMinYMid meet' : 'xMidYMid meet'}
          role="img"
          aria-labelledby="upset-title upset-description"
          data-figure="upset"
          data-column-step={columnStep}
          data-column-scale={figureStyle.upsetColumnScale}
          data-row-step={rowStep}
          data-row-scale={figureStyle.upsetRowScale}
          data-matrix-top={matrixTop}
          data-matrix-bottom={matrixBottom}
          data-set-name-gap={layout.setNameGap}
          data-set-count-x={UPSET_SET_COUNT_X}
          data-set-name-x={setNameX}
          data-upset-scrollable={isDense ? 'true' : 'false'}
          data-bar-top={barTop}
          data-value-label-gap={valueLabelGap}
          data-value-label-layout={denseLabelsAreAngled ? 'angled' : 'horizontal'}
          data-export-content-top={Math.max(0, INTERSECTION_TITLE_Y - axisTitleFontSize)}
          data-export-content-bottom={matrixBottom + 8}
          style={minViewportWidth ? { minWidth: `${minViewportWidth}px` } : undefined}
        >
          <title id="upset-title">{sets.length}-set UpSet plot</title>
          <desc id="upset-description">
            Bars show exact intersection sizes. The matrix marks participating sets. Percentages use the union as denominator.
          </desc>
          <rect
            data-figure-background="true"
            x={figureViewBox[0]}
            y={figureViewBox[1]}
            width={figureViewBox[2]}
            height={figureViewBox[3]}
            fill="#ffffff"
          />

          <text
            x={isDense ? 22 : plotLeft}
            y={INTERSECTION_TITLE_Y}
            className="upset-axis-title"
            style={{ fontSize: axisTitleFontSize, fontWeight: labelFontWeight }}
          >
            Intersection size
          </text>
          <text
            x={22}
            y={SET_SIZE_TITLE_Y}
            className="upset-axis-title"
            style={{ fontSize: axisTitleFontSize, fontWeight: labelFontWeight }}
          >
            Set size
          </text>

          <g className="upset-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={plotLeft} x2={plotRight} y1={barScale(tick)} y2={barScale(tick)} />
                <text
                  x={plotLeft - 12}
                  y={barScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ fontSize: tickFontSize, fontWeight: valueFontWeight }}
                >
                  {tick}
                </text>
              </g>
            ))}
          </g>

          <g className="upset-axes" aria-hidden="true">
            <line
              className="upset-axis-line"
              data-axis="x"
              x1={plotLeft}
              x2={plotRight}
              y1={BAR_BOTTOM}
              y2={BAR_BOTTOM}
            />
            <line
              className="upset-axis-line"
              data-axis="y"
              x1={plotLeft}
              x2={plotLeft}
              y1={barTop}
              y2={BAR_BOTTOM}
            />
          </g>

          <g className="upset-bars">
            {visibleRegions.map((region, columnIndex) => {
              const x = plotLeft + columnStep * columnIndex + columnStep / 2;
              const y = barScale(region.count);
              const barHeight = BAR_BOTTOM - y;
              const lines = valueLabelLines[columnIndex];
              const labelY = y - valueLabelGap;
              const denseValue = denseValues[columnIndex];
              return (
                <g
                  key={region.mask}
                  data-region-interaction="true"
                  role={region.count > 0 ? 'button' : undefined}
                  tabIndex={region.count > 0 ? 0 : -1}
                  aria-label={`${region.key}，${region.count} 个成员`}
                  onClick={() => region.count > 0 && onSelectRegion(region.mask)}
                  onKeyDown={(event) => {
                    if (region.count > 0 && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onSelectRegion(region.mask);
                    }
                  }}
                >
                  <title>{`${region.key}: ${region.count}`}</title>
                  <rect
                    className="upset-intersection-bar"
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={Math.max(1, barHeight)}
                    rx={1.5}
                    fill="#60748d"
                  />
                  {lines.length > 0 ? (
                    denseLabelsAreAngled ? (
                      <text
                        x={x}
                        y={labelY}
                        data-bar-y={y}
                        textAnchor="start"
                        className="upset-value-label upset-value-label-dense"
                        transform={`rotate(${ANGLED_VALUE_LABEL_DEGREES} ${x} ${labelY})`}
                        style={{ fontSize: valueFontSize, fontWeight: valueFontWeight }}
                      >
                        {denseValue}
                      </text>
                    ) : (
                      <text
                        x={x}
                        y={labelY - (lines.length - 1) * valueLineHeight}
                        data-bar-y={y}
                        textAnchor="middle"
                        className="upset-value-label"
                        style={{ fontSize: valueFontSize, fontWeight: valueFontWeight }}
                      >
                        {lines.map((line, lineIndex) => (
                          <tspan
                            key={`${line}-${lineIndex}`}
                            x={x}
                            dy={lineIndex === 0 ? 0 : valueLineHeight}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    )
                  ) : null}
                  <rect
                    data-export-ignore="true"
                    x={x - columnStep / 2}
                    y={barTop}
                    width={columnStep}
                    height={matrixBottom - barTop + 16}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </g>

          <SetLaneMarks
            sets={sets}
            setNames={setNames}
            setCounts={setCounts}
            setNameX={setNameX}
            matrixTop={matrixTop}
            rowStep={rowStep}
            setScale={setScale}
            labelFontSize={labelFontSize}
            labelFontWeight={labelFontWeight}
            valueFontSize={setCountFontSize}
            valueFontWeight={valueFontWeight}
          />

          <g className="upset-matrix">
            {visibleRegions.map((region, columnIndex) => {
              if (region.setIndices.length < 2) return null;
              const x = plotLeft + columnStep * columnIndex + columnStep / 2;
              const first = region.setIndices[0];
              const last = region.setIndices[region.setIndices.length - 1];
              return (
                <line
                  key={`connector-${region.mask}`}
                  x1={x}
                  x2={x}
                  y1={matrixTop + rowStep * first}
                  y2={matrixTop + rowStep * last}
                  stroke="#5b666d"
                  strokeWidth={1.15}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {sets.map((set, rowIndex) => {
              const y = matrixTop + rowStep * rowIndex;
              return visibleRegions.map((region, columnIndex) => {
                const x = plotLeft + columnStep * columnIndex + columnStep / 2;
                const active = (region.mask & (1 << rowIndex)) !== 0;
                return (
                  <circle
                    key={`${region.mask}-${set.id}`}
                    cx={x}
                    cy={y}
                    r={active ? 5.2 : 4.5}
                    fill={active ? set.color : '#dfe5e8'}
                  />
                );
              });
            })}
          </g>

          <text
            x={plotLeft}
            y={noteY}
            className="upset-note"
            data-export-ignore="true"
            style={{ fontSize: noteFontSize, fontWeight: labelFontWeight }}
          >
            {`Showing ${visibleActual} of ${totalActual} observed intersections`}
          </text>
        </svg>
      </div>

      {isDense ? (
        <div className="upset-scroll-hint" aria-hidden="true">
          Scroll horizontally to explore →
        </div>
      ) : null}

      <svg
        ref={frozenLaneRef}
        className="upset-frozen-lane"
        viewBox={`0 0 ${plotLeft} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect width={plotLeft} height={height} fill="#ffffff" />
        {isDense ? (
          <text
            x={22}
            y={INTERSECTION_TITLE_Y}
            className="upset-axis-title"
            style={{ fontSize: axisTitleFontSize, fontWeight: labelFontWeight }}
          >
            Intersection size
          </text>
        ) : null}
        <text
          x={22}
          y={SET_SIZE_TITLE_Y}
          className="upset-axis-title"
          style={{ fontSize: axisTitleFontSize, fontWeight: labelFontWeight }}
        >
          Set size
        </text>
        <g className="upset-grid">
          {ticks.map((tick) => (
            <text
              key={tick}
              x={plotLeft - 12}
              y={barScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fontSize: tickFontSize, fontWeight: valueFontWeight }}
            >
              {tick}
            </text>
          ))}
        </g>
        <line
          className="upset-axis-line"
          data-axis="y"
          x1={plotLeft - 1}
          x2={plotLeft - 1}
          y1={barTop}
          y2={BAR_BOTTOM}
        />
        <SetLaneMarks
          sets={sets}
          setNames={setNames}
          setCounts={setCounts}
          setNameX={setNameX}
          matrixTop={matrixTop}
          rowStep={rowStep}
          setScale={setScale}
          labelFontSize={labelFontSize}
          labelFontWeight={labelFontWeight}
          valueFontSize={setCountFontSize}
          valueFontWeight={valueFontWeight}
        />
        <line
          className="upset-frozen-divider"
          x1={plotLeft - 1}
          x2={plotLeft - 1}
          y1={28}
          y2={noteY}
        />
      </svg>
    </div>
  );
});
