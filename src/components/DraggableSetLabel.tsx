import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { LabelPoint } from '../types';
import { clampSetLabelPosition } from '../lib/labelLayout';

interface DraggableSetLabelProps {
  setId: string;
  text: string;
  position: LabelPoint;
  estimatedWidth: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  viewBox: [number, number, number, number];
  onPositionChange: (position: LabelPoint) => void;
}

function eventToSvgPoint(event: ReactPointerEvent<SVGGElement>): LabelPoint | null {
  const svg = event.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}

export function DraggableSetLabel({
  setId,
  text,
  position,
  estimatedWidth,
  fontSize,
  fontWeight,
  color,
  viewBox,
  onPositionChange,
}: DraggableSetLabelProps) {
  const dragOffset = useRef<LabelPoint | null>(null);
  const [dragging, setDragging] = useState(false);

  const moveTo = (point: LabelPoint) => {
    onPositionChange(clampSetLabelPosition(point, estimatedWidth, fontSize, viewBox));
  };

  const endDrag = (event: ReactPointerEvent<SVGGElement>) => {
    dragOffset.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.stopPropagation();
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    const distance = fontSize * (event.shiftKey ? 2.4 : 0.72);
    const changes: Record<string, LabelPoint> = {
      ArrowLeft: { x: position.x - distance, y: position.y },
      ArrowRight: { x: position.x + distance, y: position.y },
      ArrowUp: { x: position.x, y: position.y - distance },
      ArrowDown: { x: position.x, y: position.y + distance },
    };
    const next = changes[event.key];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    moveTo(next);
  };

  return (
    <g
      className={`draggable-set-label ${dragging ? 'is-dragging' : ''}`}
      data-set-label-id={setId}
      transform={`translate(${position.x} ${position.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${text}，可拖动调整位置`}
      onPointerDown={(event) => {
        const point = eventToSvgPoint(event);
        if (!point) return;
        dragOffset.current = { x: position.x - point.x, y: position.y - point.y };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerMove={(event) => {
        const offset = dragOffset.current;
        const point = eventToSvgPoint(event);
        if (!offset || !point) return;
        moveTo({ x: point.x + offset.x, y: point.y + offset.y });
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
    >
      <rect
        data-export-ignore="true"
        x={-estimatedWidth / 2 - fontSize * 0.55}
        y={-fontSize * 0.9}
        width={estimatedWidth + fontSize * 1.1}
        height={fontSize * 1.8}
        rx={fontSize * 0.35}
        fill="transparent"
      />
      <text
        data-set-label-text={setId}
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}
