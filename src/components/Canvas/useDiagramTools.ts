import { useCallback, useRef, useState } from 'react';
import type {
  CADElement,
  DiagramTool,
  FlowchartShape,
  FlowchartShapeKind,
  Connector,
  DiagramContainer,
  GridSettings,
  Point,
} from '../../engine/types';
import { snapToGrid } from '../../engine/geometry';
import {
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_STROKE,
  DEFAULT_SHAPE_TEXT,
  DEFAULT_CONNECTOR_STROKE,
  DEFAULT_CONTAINER_FILL,
  DEFAULT_CONTAINER_STROKE,
  pointInShape,
} from '../../engine/diagram-shapes';

let nextId = 1;
function genId(prefix: string) {
  return `${prefix}-${nextId++}-${Date.now()}`;
}

const TOOL_TO_SHAPE: Partial<Record<DiagramTool, FlowchartShapeKind>> = {
  box: 'rectangle',
  rounded: 'rounded',
  ellipse: 'ellipse',
  diamond: 'diamond',
  parallelogram: 'parallelogram',
  cylinder: 'cylinder',
  hexagon: 'hexagon',
};

interface UseDiagramToolsProps {
  activeTool: DiagramTool;
  activeLayerId: string;
  grid: GridSettings;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  connectorRouting: 'orthogonal' | 'straight' | 'bezier';
  elements: CADElement[];
  onElementCreated: (element: CADElement) => void;
  onPreviewChange: (preview: CADElement | null) => void;
  /** Called when connector tool is mid-flight; passes the from-shape id. */
  onPendingConnectorChange?: (fromShapeId: string | null) => void;
  routeConnector: (connector: Connector, elements: CADElement[]) => Connector;
}

export function useDiagramTools({
  activeTool,
  activeLayerId,
  grid,
  fillColor,
  strokeColor,
  strokeWidth,
  connectorRouting,
  elements,
  onElementCreated,
  onPreviewChange,
  onPendingConnectorChange,
  routeConnector,
}: UseDiagramToolsProps) {
  const startPointRef = useRef<Point | null>(null);
  const pendingFromRef = useRef<string | null>(null);
  const [, forceRender] = useState(0);

  const findShapeAt = useCallback(
    (point: Point): FlowchartShape | null => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'flowchart-shape') {
          if (pointInShape(point, { x: el.origin.x, y: el.origin.y, width: el.width, height: el.height }, el.shape)) {
            return el;
          }
        }
      }
      return null;
    },
    [elements]
  );

  const handleDiagramDown = useCallback(
    (rawPoint: Point) => {
      const point = snapToGrid(rawPoint, grid);

      if (activeTool === 'connector') {
        const shape = findShapeAt(point);
        if (!shape) return;
        if (!pendingFromRef.current) {
          pendingFromRef.current = shape.id;
          onPendingConnectorChange?.(shape.id);
          forceRender((n) => n + 1);
        } else {
          if (shape.id !== pendingFromRef.current) {
            const connector: Connector = {
              type: 'connector',
              id: genId('conn'),
              fromShapeId: pendingFromRef.current,
              toShapeId: shape.id,
              fromAnchor: 'auto',
              toAnchor: 'auto',
              routing: connectorRouting,
              layerId: 'connectors',
              strokeColor: strokeColor || DEFAULT_CONNECTOR_STROKE,
              strokeWidth: 1.5,
              endCap: 'arrow',
            };
            onElementCreated(routeConnector(connector, elements));
          }
          pendingFromRef.current = null;
          onPendingConnectorChange?.(null);
          forceRender((n) => n + 1);
        }
        return;
      }

      if (activeTool === 'select') {
        return;
      }

      startPointRef.current = point;
    },
    [activeTool, grid, findShapeAt, connectorRouting, strokeColor, onElementCreated, onPendingConnectorChange, routeConnector, elements]
  );

  const handleDiagramMove = useCallback(
    (rawPoint: Point) => {
      const start = startPointRef.current;
      if (!start) return;
      const point = snapToGrid(rawPoint, grid);

      const shapeKind = TOOL_TO_SHAPE[activeTool];
      if (shapeKind) {
        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.abs(point.x - start.x);
        const height = Math.abs(point.y - start.y);
        if (width < 1 && height < 1) return;
        const preview: FlowchartShape = {
          type: 'flowchart-shape',
          id: 'preview',
          shape: shapeKind,
          origin: { x, y },
          width,
          height,
          layerId: activeLayerId,
          fillColor,
          strokeColor: strokeColor || DEFAULT_SHAPE_STROKE,
          strokeWidth,
          textColor: DEFAULT_SHAPE_TEXT,
        };
        onPreviewChange(preview);
        return;
      }

      if (activeTool === 'swimlane-h' || activeTool === 'swimlane-v' || activeTool === 'group') {
        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.abs(point.x - start.x);
        const height = Math.abs(point.y - start.y);
        if (width < 4 && height < 4) return;
        const preview: DiagramContainer = {
          type: 'container',
          id: 'preview',
          origin: { x, y },
          width,
          height,
          layerId: activeLayerId,
          fillColor: DEFAULT_CONTAINER_FILL,
          strokeColor: strokeColor || DEFAULT_CONTAINER_STROKE,
          strokeWidth,
          containerType: activeTool,
          laneCount: activeTool === 'group' ? 0 : 3,
          title: activeTool === 'group' ? undefined : 'Swimlane',
        };
        onPreviewChange(preview);
      }
    },
    [activeTool, grid, activeLayerId, fillColor, strokeColor, strokeWidth, onPreviewChange]
  );

  const handleDiagramUp = useCallback(
    (rawPoint: Point) => {
      const start = startPointRef.current;
      startPointRef.current = null;
      if (!start) return;
      const point = snapToGrid(rawPoint, grid);

      const shapeKind = TOOL_TO_SHAPE[activeTool];
      if (shapeKind) {
        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.abs(point.x - start.x);
        const height = Math.abs(point.y - start.y);
        if (width < 4 || height < 4) {
          const w = Math.max(width, 120);
          const h = Math.max(height, 60);
          const shape: FlowchartShape = {
            type: 'flowchart-shape',
            id: genId('shape'),
            shape: shapeKind,
            origin: { x: start.x, y: start.y },
            width: w,
            height: h,
            layerId: activeLayerId,
            fillColor,
            strokeColor: strokeColor || DEFAULT_SHAPE_STROKE,
            strokeWidth,
            textColor: DEFAULT_SHAPE_TEXT,
          };
          onElementCreated(shape);
          onPreviewChange(null);
          return;
        }
        const shape: FlowchartShape = {
          type: 'flowchart-shape',
          id: genId('shape'),
          shape: shapeKind,
          origin: { x, y },
          width,
          height,
          layerId: activeLayerId,
          fillColor,
          strokeColor: strokeColor || DEFAULT_SHAPE_STROKE,
          strokeWidth,
          textColor: DEFAULT_SHAPE_TEXT,
        };
        onElementCreated(shape);
        onPreviewChange(null);
        return;
      }

      if (activeTool === 'swimlane-h' || activeTool === 'swimlane-v' || activeTool === 'group') {
        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.max(Math.abs(point.x - start.x), activeTool === 'group' ? 120 : 240);
        const height = Math.max(Math.abs(point.y - start.y), activeTool === 'group' ? 80 : 160);
        const container: DiagramContainer = {
          type: 'container',
          id: genId('container'),
          origin: { x, y },
          width,
          height,
          layerId: activeLayerId,
          fillColor: DEFAULT_CONTAINER_FILL,
          strokeColor: strokeColor || DEFAULT_CONTAINER_STROKE,
          strokeWidth,
          containerType: activeTool,
          laneCount: activeTool === 'group' ? 0 : 3,
          laneLabels: activeTool === 'group' ? undefined : ['Lane 1', 'Lane 2', 'Lane 3'],
          title: activeTool === 'group' ? undefined : 'Swimlane',
        };
        onElementCreated(container);
        onPreviewChange(null);
      }
    },
    [activeTool, grid, activeLayerId, fillColor, strokeColor, strokeWidth, onElementCreated, onPreviewChange]
  );

  const cancelPendingConnector = useCallback(() => {
    if (pendingFromRef.current) {
      pendingFromRef.current = null;
      onPendingConnectorChange?.(null);
      forceRender((n) => n + 1);
    }
  }, [onPendingConnectorChange]);

  return {
    handleDiagramDown,
    handleDiagramMove,
    handleDiagramUp,
    cancelPendingConnector,
    pendingFromShapeId: pendingFromRef.current,
  };
}
