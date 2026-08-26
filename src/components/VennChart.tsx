import { forwardRef, useId, useMemo, type ReactNode } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  DisplayOptions,
  FigureStyleOptions,
  SetAnalysis,
  SetDefinition,
  SetLabelPositions,
} from '../types';
import { hasFigureFill, resolveFigureStrokeColor } from '../data/figureStyle';
import {
  contourPath,
  ellipseTransform,
  findLabelPointsBySampling,
  getVennTemplate,
  pointToMask,
} from '../lib/geometry';
import {
  formatRegionLabelLines,
  getSetDisplayName,
  maskToIndices,
  maskToKey,
} from '../lib/sets';
import {
  clampSetLabelPosition,
  createAdaptiveSetLabelLayout,
} from '../lib/labelLayout';
import { fitViewBoxToAspectRatio } from '../lib/viewBox';
import { DraggableSetLabel } from './DraggableSetLabel';

interface VennChartProps {
  sets: SetDefinition[];
  analysis: SetAnalysis;
  selectedMask?: number | null;
  display: DisplayOptions;
  figureStyle: FigureStyleOptions;
  labelPositions: SetLabelPositions;
  onSelectRegion: (mask: number) => void;
  onClearSelection?: () => void;
  onSetLabelPositionChange: (setId: string, position: { x: number; y: number }) => void;
  targetAspectRatio?: number;
}

function eventToSvgPoint(event: ReactPointerEvent<SVGElement>): { x: number; y: number } | null {
  const svg = event.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}

export const VennChart = forwardRef<SVGSVGElement, VennChartProps>(function VennChart(
  {
    sets,
    analysis,
    selectedMask = null,
    display,
    figureStyle,
    labelPositions,
    onSelectRegion,
    onClearSelection = () => undefined,
    onSetLabelPositionChange,
    targetAspectRatio,
  },
  ref,
) {
  const selectionId = `venn-selection-${useId().replace(/:/g, '')}`;
  const template = getVennTemplate(sets.length);
  const labelPoints = useMemo(() => findLabelPointsBySampling(template), [template]);
  const labelFontSize = Number(
    (
      (sets.length >= 5 ? 0.145 : sets.length === 4 ? 0.13 : 0.145) *
      figureStyle.regionLabelFontScale
    ).toFixed(4),
  );
  const nameFontSize = Number(
    ((sets.length >= 5 ? 0.19 : 0.15) * figureStyle.setLabelFontScale).toFixed(4),
  );
  const hasFill = hasFigureFill(figureStyle);
  const setLabelTexts = sets.map(getSetDisplayName);
  const setLabelTextKey = setLabelTexts.join('\u0000');
  const adaptiveSetLabels = useMemo(
    () => createAdaptiveSetLabelLayout(template.setLabels, setLabelTexts, nameFontSize, template.viewBox),
    [nameFontSize, setLabelTextKey, template],
  );
  // The authoritative five-set geometry remains square. A custom export ratio
  // only adds symmetric canvas space around it; the paths are never stretched.
  const contentViewBox = sets.length === 5 ? template.viewBox : adaptiveSetLabels.viewBox;
  const figureViewBox = fitViewBoxToAspectRatio(
    contentViewBox,
    targetAspectRatio ?? contentViewBox[2] / contentViewBox[3],
  );
  const regionLabelItems = useMemo(
    () =>
      [...labelPoints.entries()].flatMap(([mask, labelPoint]) => {
        const region = analysis.regionByMask.get(mask) ?? {
          mask,
          key: maskToKey(mask, sets),
          setIndices: maskToIndices(mask, sets.length),
          members: [],
          count: 0,
          percentage: 0,
        };
        // Every fixed Venn region has a meaningful exact count. Rendering zero
        // explicitly prevents an empty compartment from being misread as a
        // missing or clipped label. Sparse analysis only stores real regions,
        // so fixed Venn templates materialize their zero cells locally.
        const lines = formatRegionLabelLines(
          region.count,
          region.percentage,
          display.regionLabelMode,
        );
        if (lines.length === 0) return [];
        return [{ region, labelPoint, lines }];
      }),
    [analysis.regionByMask, display.regionLabelMode, labelPoints, sets],
  );
  // The fixed templates provide one tested anchor for every exact region.
  // Do not silently drop labels: complete region accounting is more important
  // than heuristic label suppression in a publication figure.
  const renderedRegionLabels = regionLabelItems;
  const activeSelectedMask =
    selectedMask && (analysis.regionByMask.get(selectedMask)?.count ?? 0) > 0
      ? selectedMask
      : null;
  const selectedSetIndices = activeSelectedMask
    ? maskToIndices(activeSelectedMask, sets.length)
    : [];
  const excludedSetIndices = activeSelectedMask
    ? sets.map((_, index) => index).filter((index) => !(activeSelectedMask & (1 << index)))
    : [];
  const selectionMaskId = `${selectionId}-outside`;

  const renderMaskShape = (index: number, fill: string, key: string) => {
    const shape = template.shapes[index];
    return shape.kind === 'contour' ? (
      <path key={key} d={contourPath(shape)} fill={fill} />
    ) : (
      <ellipse
        key={key}
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        transform={ellipseTransform(shape)}
        fill={fill}
      />
    );
  };

  const wrapWithSelectedSetClips = (content: ReactNode) =>
    selectedSetIndices.reduce<ReactNode>(
      (child, index) => (
        <g key={`selected-clip-${index}`} clipPath={`url(#${selectionId}-clip-${index})`}>
          {child}
        </g>
      ),
      content,
    );

  const selectAtPoint = (event: ReactPointerEvent<SVGRectElement>) => {
    const point = eventToSvgPoint(event);
    if (!point) return;
    const mask = pointToMask(point.x, point.y, template.shapes);
    if ((analysis.regionByMask.get(mask)?.count ?? 0) > 0) onSelectRegion(mask);
    else onClearSelection();
    event.stopPropagation();
  };

  return (
    <svg
      ref={ref}
      className="scientific-figure venn-figure"
      viewBox={figureViewBox.join(' ')}
      role="img"
      aria-labelledby="venn-title venn-description"
      data-figure="venn"
      data-geometry-source={
        sets.length === 5
          ? 'Adrian Dusa (2026), venn 1.13, https://CRAN.R-project.org/package=venn'
          : undefined
      }
      data-region-label-count={renderedRegionLabels.length}
      data-omitted-region-label-count={regionLabelItems.length - renderedRegionLabels.length}
    >
      <title id="venn-title">{sets.length} 组 Venn 图</title>
      <desc id="venn-description">
        每条彩色轮廓代表一个集合，文本标签显示精确交集的数量或百分比。
      </desc>
      <rect
        data-figure-background="true"
        x={figureViewBox[0]}
        y={figureViewBox[1]}
        width={figureViewBox[2]}
        height={figureViewBox[3]}
        fill="#ffffff"
      />

      {activeSelectedMask ? (
        <defs data-export-ignore="true">
          {selectedSetIndices.map((index) => (
            <clipPath
              key={`clip-${index}`}
              id={`${selectionId}-clip-${index}`}
              clipPathUnits="userSpaceOnUse"
            >
              {renderMaskShape(index, '#ffffff', `clip-shape-${index}`)}
            </clipPath>
          ))}
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
            {wrapWithSelectedSetClips(
              <g>
                <rect
                  x={figureViewBox[0]}
                  y={figureViewBox[1]}
                  width={figureViewBox[2]}
                  height={figureViewBox[3]}
                  fill="#000000"
                />
                {excludedSetIndices.map((index) =>
                  renderMaskShape(index, '#ffffff', `excluded-shape-${index}`),
                )}
              </g>,
            )}
          </mask>
        </defs>
      ) : null}

      <g aria-hidden="true" className="venn-set-layer">
        {template.shapes.map((shape, index) => {
          const commonProps = {
            fill: hasFill ? sets[index].color : 'none',
            fillOpacity: hasFill ? figureStyle.fillOpacity : undefined,
            stroke: resolveFigureStrokeColor(sets[index].color, figureStyle),
            strokeOpacity: 1,
            strokeWidth: figureStyle.strokeWidth,
            vectorEffect: 'non-scaling-stroke' as const,
          };
          return shape.kind === 'contour' ? (
            <path key={sets[index].id} d={contourPath(shape)} {...commonProps} />
          ) : (
            <ellipse
              key={sets[index].id}
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.rx}
              ry={shape.ry}
              transform={ellipseTransform(shape)}
              {...commonProps}
            />
          );
        })}
      </g>

      {activeSelectedMask ? (
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

      <rect
        data-export-ignore="true"
        x={figureViewBox[0]}
        y={figureViewBox[1]}
        width={figureViewBox[2]}
        height={figureViewBox[3]}
        fill="transparent"
        className="venn-hit-area"
        onClick={selectAtPoint}
      />

      <g className="venn-region-labels">
        {renderedRegionLabels.map(({ region, labelPoint, lines }) => {
          const isSelected = region.mask === activeSelectedMask;
          return (
            <g
              key={region.mask}
              data-region-interaction="true"
              role={region.count > 0 ? 'button' : undefined}
              tabIndex={region.count > 0 ? 0 : -1}
              aria-label={`${region.key}，${region.count} 个成员`}
              aria-pressed={region.count > 0 ? isSelected : undefined}
              className={[
                'venn-region-label',
                isSelected ? 'region-is-selected' : activeSelectedMask ? 'region-is-muted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => region.count > 0 && onSelectRegion(region.mask)}
              onKeyDown={(event) => {
                if (region.count > 0 && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onSelectRegion(region.mask);
                }
              }}
            >
              <title>{`${region.key}: ${region.count}`}</title>
              <text
                x={labelPoint.x}
                y={labelPoint.y - (lines.length - 1) * labelFontSize * 0.56}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#30383c"
                fontSize={labelFontSize}
                fontWeight={figureStyle.regionLabelsBold ? 700 : 400}
                fontFamily="Inter, system-ui, sans-serif"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {lines.map((line, lineIndex) => (
                  <tspan key={line} x={labelPoint.x} dy={lineIndex === 0 ? 0 : labelFontSize * 1.05}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>

      {display.showSetNames ? (
        <g className="venn-set-labels" aria-label="集合名称">
          {adaptiveSetLabels.labels.map((defaultLabel, index) => {
            const set = sets[index];
            const position = clampSetLabelPosition(
              labelPositions[set.id] ?? defaultLabel,
              defaultLabel.estimatedWidth,
              nameFontSize,
              figureViewBox,
            );
            return (
              <DraggableSetLabel
                key={set.id}
                setId={set.id}
                text={setLabelTexts[index]}
                position={position}
                estimatedWidth={defaultLabel.estimatedWidth}
                fontSize={nameFontSize}
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
