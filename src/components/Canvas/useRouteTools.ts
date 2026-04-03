import { useCallback, useRef, useState } from 'react';
import type { Point, GridSettings, CADElement, CADLine, CADCircle, ViewState } from '../../engine/types';
import { snapToGrid, distance } from '../../engine/geometry';
import type { UtilityType, Route, RoutePoint, RouteSegment } from '../../engine/route-types';
import { UTILITY_LAYER_MAP, UTILITY_COLORS } from '../../engine/route-types';

let nextRouteId = 1;
function genId(prefix: string) {
  return `${prefix}-${nextRouteId++}-${Date.now()}`;
}

interface UseRouteToolsProps {
  activeUtilityType: UtilityType;
  view: ViewState;
  grid: GridSettings;
  elements: CADElement[];
  setElements: React.Dispatch<React.SetStateAction<CADElement[]>>;
}

export function useRouteTools({
  activeUtilityType,
  view,
  grid,
  elements,
  setElements,
}: UseRouteToolsProps) {
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const currentRouteRef = useRef<Route | null>(null);
  const previewPointRef = useRef<Point | null>(null);

  /** Convert screen coords to canvas coords accounting for view offset and zoom */
  const screenToCanvas = useCallback(
    (screenPoint: Point): Point => {
      return {
        x: (screenPoint.x - view.offsetX) / view.zoom,
        y: (screenPoint.y - view.offsetY) / view.zoom,
      };
    },
    [view]
  );

  /** Convert pixel distance to feet using grid scale */
  const pxToFeet = useCallback(
    (px: number): number => {
      return px / grid.pixelsPerUnit;
    },
    [grid.pixelsPerUnit]
  );

  const layerId = UTILITY_LAYER_MAP[activeUtilityType];
  const color = UTILITY_COLORS[activeUtilityType];

  /** Add a CAD line segment to the elements array */
  const addSegmentElements = useCallback(
    (from: Point, to: Point, segId: string) => {
      const line: CADLine = {
        type: 'line',
        id: `route-seg-${segId}`,
        p1: from,
        p2: to,
        layerId,
        strokeColor: color,
        strokeWidth: 2,
      };
      const dot: CADCircle = {
        type: 'circle',
        id: `route-pt-${segId}`,
        center: to,
        radius: 4,
        layerId,
        strokeColor: color,
        strokeWidth: 1,
        fillColor: color,
      };
      setElements((prev) => [...prev, line, dot]);
    },
    [layerId, color, setElements]
  );

  const handlePointerDown = useCallback(
    (rawPoint: Point) => {
      const canvasPoint = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;

      if (!currentRouteRef.current) {
        // Start a new route
        const pointId = genId('rpt');
        const startPoint: RoutePoint = {
          id: pointId,
          x: canvasPoint.x,
          y: canvasPoint.y,
          type: 'start',
        };

        const route: Route = {
          id: genId('route'),
          name: `${activeUtilityType} route`,
          utilityType: activeUtilityType,
          points: [startPoint],
          segments: [],
          totalLength: 0,
          status: 'draft',
        };

        currentRouteRef.current = route;
        setCurrentRoute(route);

        // Draw start dot
        const dot: CADCircle = {
          type: 'circle',
          id: `route-start-${pointId}`,
          center: canvasPoint,
          radius: 5,
          layerId,
          strokeColor: color,
          strokeWidth: 2,
          fillColor: color,
        };
        setElements((prev) => [...prev, dot]);
        return;
      }

      // Add a waypoint to the existing route
      const route = currentRouteRef.current;
      const prevPoint = route.points[route.points.length - 1];
      const newPointId = genId('rpt');
      const newPoint: RoutePoint = {
        id: newPointId,
        x: canvasPoint.x,
        y: canvasPoint.y,
        type: 'waypoint',
      };

      const segLengthPx = distance(
        { x: prevPoint.x, y: prevPoint.y },
        canvasPoint
      );
      const segLengthFt = pxToFeet(segLengthPx);

      const segment: RouteSegment = {
        id: genId('rseg'),
        startPointId: prevPoint.id,
        endPointId: newPointId,
        length: segLengthFt,
      };

      const updated: Route = {
        ...route,
        points: [...route.points, newPoint],
        segments: [...route.segments, segment],
        totalLength: route.totalLength + segLengthFt,
      };

      currentRouteRef.current = updated;
      setCurrentRoute(updated);

      addSegmentElements(
        { x: prevPoint.x, y: prevPoint.y },
        canvasPoint,
        segment.id
      );
    },
    [grid, activeUtilityType, layerId, color, pxToFeet, addSegmentElements, setElements]
  );

  const handlePointerMove = useCallback(
    (rawPoint: Point) => {
      const canvasPoint = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;
      previewPointRef.current = canvasPoint;
    },
    [grid]
  );

  const finishRoute = useCallback((): Route | null => {
    const route = currentRouteRef.current;
    if (!route || route.points.length < 2) {
      // Cancel if fewer than 2 points
      currentRouteRef.current = null;
      setCurrentRoute(null);
      return null;
    }

    // Mark last point as 'end'
    const updatedPoints = [...route.points];
    updatedPoints[updatedPoints.length - 1] = {
      ...updatedPoints[updatedPoints.length - 1],
      type: 'end',
    };

    const finished: Route = {
      ...route,
      points: updatedPoints,
    };

    currentRouteRef.current = null;
    setCurrentRoute(null);
    return finished;
  }, []);

  const cancelRoute = useCallback(() => {
    if (!currentRouteRef.current) return;

    // Remove elements we created for this route
    const routeId = currentRouteRef.current.id;
    setElements((prev) =>
      prev.filter(
        (el) =>
          !el.id.startsWith('route-seg-') &&
          !el.id.startsWith('route-pt-') &&
          !el.id.startsWith('route-start-')
      )
    );

    currentRouteRef.current = null;
    setCurrentRoute(null);
  }, [setElements]);

  return {
    handlePointerDown,
    handlePointerMove,
    currentRoute,
    finishRoute,
    cancelRoute,
  };
}
