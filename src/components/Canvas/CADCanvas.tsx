import React, { useRef, useEffect, useCallback, useState } from 'react';
import getStroke from 'perfect-freehand';
import type {
  AppMode,
  CADTool,
  CADElement,
  StrokePoint,
  ViewState,
  DrawBrush,
  ColorBrush,
  FreehandStroke,
  TextElement,
  PlantPlacement,
} from '../../engine/types';
import { renderAll } from './renderer';
import { usePointerEvents } from './usePointerEvents';
import { useZoomPan } from './useZoomPan';
import { useCADTools } from './useCADTools';
import { useDrawingTools } from './useDrawingTools';
import { useLayers } from './useLayers';
import { useGrid } from './useGrid';
import { createHistory, pushState, undo, redo } from '../../engine/history';
import { ModeToolbar } from '../Toolbar/ModeToolbar';
import { CADToolbar } from '../Toolbar/CADToolbar';
import { DrawToolbar } from '../Toolbar/DrawToolbar';
import { ColorToolbar } from '../Toolbar/ColorToolbar';
import { LayerPanel } from '../Toolbar/LayerPanel';
import { PlantBrowser } from '../PlantPanel/PlantBrowser';

let plantPlaceId = 1;

export const CADCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // App state
  const [mode, setMode] = useState<AppMode>('cad');
  const [cadTool, setCadTool] = useState<CADTool>('line');
  const [elements, setElements] = useState<CADElement[]>([]);
  const [preview, setPreview] = useState<CADElement | null>(null);
  const [liveStrokePoints, setLiveStrokePoints] = useState<StrokePoint[]>([]);
  const [view, setView] = useState<ViewState>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [historyState, setHistoryState] = useState(() => createHistory([]));

  // Drawing settings
  const [drawBrush, setDrawBrush] = useState<DrawBrush>('pen');
  const [colorBrush, setColorBrush] = useState<ColorBrush>('watercolor');
  const [penColor, setPenColor] = useState('#333333');
  const [colorColor, setColorColor] = useState('#4caf50');
  const [penSize, setPenSize] = useState(4);
  const [colorSize, setColorSize] = useState(20);
  const [penOpacity, setPenOpacity] = useState(1);
  const [colorOpacity, setColorOpacity] = useState(0.4);
  const [cadStrokeColor, setCadStrokeColor] = useState('#ffffff');
  const [cadStrokeWidth, setCadStrokeWidth] = useState(2);

  // Text mode
  const [textInput, setTextInput] = useState('');

  // Plant placement
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [showPlantPanel, setShowPlantPanel] = useState(false);

  // Layer & grid hooks
  const {
    layers,
    activeLayerId,
    setActiveLayerId,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    addLayer,
    removeLayer,
  } = useLayers();

  const { grid, toggleGrid, toggleSnap } = useGrid();

  // Show layer panel
  const [showLayers, setShowLayers] = useState(false);

  // Get the active layer id based on mode
  const getActiveLayer = useCallback((): string => {
    switch (mode) {
      case 'draw': return 'drawing';
      case 'color': return 'color';
      case 'text': return 'text';
      default: return activeLayerId;
    }
  }, [mode, activeLayerId]);

  // Add element with history
  const addElement = useCallback(
    (el: CADElement) => {
      const next = [...elements, el];
      setElements(next);
      setHistoryState((h) => pushState(h, next));
    },
    [elements]
  );

  // Convert pointer event to canvas coordinates
  const getCanvasPoint = useCallback(
    (e: PointerEvent): StrokePoint => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - view.offsetX) / view.zoom;
      const y = (e.clientY - rect.top - view.offsetY) / view.zoom;
      return {
        x,
        y,
        pressure: e.pressure || 0.5,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        timestamp: e.timeStamp,
      };
    },
    [view]
  );

  // CAD tools
  const { handleCADDown, handleCADMove, handleCADUp } = useCADTools({
    activeTool: cadTool,
    activeLayerId: getActiveLayer(),
    grid,
    strokeColor: cadStrokeColor,
    strokeWidth: cadStrokeWidth,
    onElementCreated: addElement,
    onPreviewChange: setPreview,
  });

  // Drawing tools
  const { handleDrawStart, handleDrawMove, handleDrawEnd } = useDrawingTools({
    activeLayerId: mode === 'color' ? 'color' : 'drawing',
    brush: mode === 'color' ? colorBrush : drawBrush,
    color: mode === 'color' ? colorColor : penColor,
    size: mode === 'color' ? colorSize : penSize,
    opacity: mode === 'color' ? colorOpacity : penOpacity,
    onStrokeCreated: addElement,
    onLiveStroke: setLiveStrokePoints,
  });

  // Zoom/pan
  const { handleWheel, startPan, movePan, endPan, resetView } = useZoomPan({
    view,
    setView,
  });

  // Two-finger pan tracking
  const twoFingerRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isPanningRef = useRef(false);
  const lastPointRef = useRef<StrokePoint | null>(null);

  // Pointer event handlers — dispatch based on mode
  const onStrokeStart = useCallback(
    (point: StrokePoint) => {
      if (mode === 'cad') {
        if (cadTool === 'select' || cadTool === 'move') {
          // Pan mode
          isPanningRef.current = true;
          const canvas = canvasRef.current!;
          const rect = canvas.getBoundingClientRect();
          startPan(point.x * view.zoom + view.offsetX + rect.left, point.y * view.zoom + view.offsetY + rect.top);
        } else {
          lastPointRef.current = point;
          handleCADDown(point);
        }
      } else if (mode === 'draw' || mode === 'color') {
        handleDrawStart(point);
      } else if (mode === 'text') {
        // Place text at click point
        if (textInput.trim()) {
          const el: TextElement = {
            type: 'text',
            id: `text-${Date.now()}`,
            position: { x: point.x, y: point.y },
            content: textInput,
            layerId: 'text',
            fontSize: 14,
            fontFamily: "'Architects Daughter', cursive, sans-serif",
            color: penColor,
            rotation: 0,
          };
          addElement(el);
        }
      }
    },
    [mode, cadTool, handleCADDown, handleDrawStart, startPan, view, textInput, penColor, addElement]
  );

  const onStrokeMove = useCallback(
    (point: StrokePoint) => {
      lastPointRef.current = point;
      if (isPanningRef.current) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        movePan(point.x * view.zoom + view.offsetX + rect.left, point.y * view.zoom + view.offsetY + rect.top);
      } else if (mode === 'cad') {
        handleCADMove(point);
      } else if (mode === 'draw' || mode === 'color') {
        handleDrawMove(point);
      }
    },
    [mode, handleCADMove, handleDrawMove, movePan, view, isPanningRef]
  );

  const onStrokeEnd = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      endPan();
    } else if (mode === 'cad') {
      const lastPoint = lastPointRef.current;
      if (lastPoint) {
        handleCADUp(lastPoint);
        lastPointRef.current = null;
      }
    } else if (mode === 'draw' || mode === 'color') {
      handleDrawEnd();
    }
  }, [mode, handleCADUp, handleDrawEnd, endPan]);

  // Pointer events hook — but we need raw events for two-finger detection
  const { handlePointerDown: ptrDown, handlePointerMove: ptrMove, handlePointerUp: ptrUp } =
    usePointerEvents({
      onStrokeStart,
      onStrokeMove,
      onStrokeEnd,
      getCanvasPoint,
    });

  // Handle canvas pointer events with two-finger pan detection
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });

      if (twoFingerRef.current.size === 2) {
        // Two fingers — enter pan mode
        isPanningRef.current = true;
        startPan(pe.clientX, pe.clientY);
        return;
      }

      // Plant placement
      if (selectedPlantId && mode === 'cad') {
        const point = getCanvasPoint(pe);
        const placement: PlantPlacement = {
          type: 'plant',
          id: `plant-${plantPlaceId++}`,
          position: { x: point.x, y: point.y },
          plantId: selectedPlantId,
          layerId: 'planting',
          scale: 1,
        };
        addElement(placement);
        return;
      }

      ptrDown(pe);
    },
    [ptrDown, startPan, selectedPlantId, mode, getCanvasPoint, addElement]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });

      if (twoFingerRef.current.size === 2 && isPanningRef.current) {
        movePan(pe.clientX, pe.clientY);
        return;
      }

      ptrMove(pe);
    },
    [ptrMove, movePan]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.delete(pe.pointerId);

      if (twoFingerRef.current.size < 2 && isPanningRef.current) {
        isPanningRef.current = false;
        endPan();
      }

      ptrUp(pe);
    },
    [ptrUp, endPan]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          setHistoryState((h) => {
            const next = redo(h);
            setElements(next.present);
            return next;
          });
        } else {
          setHistoryState((h) => {
            const next = undo(h);
            setElements(next.present);
            return next;
          });
        }
        return;
      }

      // Mode shortcuts
      if (e.key === '1') setMode('cad');
      if (e.key === '2') setMode('draw');
      if (e.key === '3') setMode('color');
      if (e.key === '4') setMode('text');

      // CAD tool shortcuts
      if (mode === 'cad') {
        if (e.key === 'v') setCadTool('select');
        if (e.key === 'l') setCadTool('line');
        if (e.key === 'r') setCadTool('rectangle');
        if (e.key === 'c') setCadTool('circle');
        if (e.key === 'd') setCadTool('dimension');
        if (e.key === 'g') toggleGrid();
        if (e.key === 's' && !e.metaKey && !e.ctrlKey) toggleSnap();
      }

      // Reset view
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        resetView();
      }

      // Delete last element
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setElements((prev) => {
          const next = prev.slice(0, -1);
          setHistoryState((h) => pushState(h, next));
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, toggleGrid, toggleSnap, resetView]);

  // Canvas resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Wheel handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Combine committed elements + preview
      const allElements = preview ? [...elements, preview] : elements;

      renderAll(ctx, allElements, layers, view, grid, width, height);

      // Render live freehand stroke on top
      if (liveStrokePoints.length > 1) {
        ctx.save();
        const dpr2 = window.devicePixelRatio || 1;
        ctx.setTransform(dpr2, 0, 0, dpr2, 0, 0);
        ctx.translate(view.offsetX, view.offsetY);
        ctx.scale(view.zoom, view.zoom);

        const strokePts = liveStrokePoints.map((p) => [p.x, p.y, p.pressure]);
        const isColor = mode === 'color';
        const isWatercolor = isColor && colorBrush === 'watercolor';

        const outlinePoints = getStroke(strokePts, {
          size: isColor ? colorSize : penSize,
          thinning: isWatercolor ? 0.1 : 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: false,
        });

        if (outlinePoints.length > 1) {
          ctx.globalAlpha = isWatercolor
            ? (isColor ? colorOpacity : penOpacity) * 0.4
            : isColor
              ? colorOpacity
              : penOpacity;
          ctx.fillStyle = isColor ? colorColor : penColor;
          ctx.beginPath();
          ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
          for (let i = 1; i < outlinePoints.length; i++) {
            ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
          }
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      // Draw plant cursor if plant selected
      if (selectedPlantId) {
        // Handled via CSS cursor for now
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [elements, preview, liveStrokePoints, layers, view, grid, mode, penColor, penSize, penOpacity, colorColor, colorSize, colorOpacity, colorBrush, selectedPlantId]);

  // Save to localStorage periodically
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem(
          'netrun-cad-state',
          JSON.stringify({ elements, layers, view, grid })
        );
      } catch {
        // localStorage full — skip
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [elements, layers, view, grid]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('netrun-cad-state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.elements) setElements(state.elements);
        if (state.view) setView(state.view);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleClearCanvas = useCallback(() => {
    setElements([]);
    setHistoryState(createHistory([]));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cad-bg">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Mode Toolbar */}
      <ModeToolbar mode={mode} setMode={setMode} />

      {/* Tool-specific toolbar */}
      {mode === 'cad' && (
        <CADToolbar
          tool={cadTool}
          setTool={setCadTool}
          strokeColor={cadStrokeColor}
          setStrokeColor={setCadStrokeColor}
          strokeWidth={cadStrokeWidth}
          setStrokeWidth={setCadStrokeWidth}
          gridEnabled={grid.enabled}
          snapEnabled={grid.snap}
          toggleGrid={toggleGrid}
          toggleSnap={toggleSnap}
        />
      )}
      {mode === 'draw' && (
        <DrawToolbar
          brush={drawBrush}
          setBrush={setDrawBrush}
          color={penColor}
          setColor={setPenColor}
          size={penSize}
          setSize={setPenSize}
          opacity={penOpacity}
          setOpacity={setPenOpacity}
        />
      )}
      {mode === 'color' && (
        <ColorToolbar
          brush={colorBrush}
          setBrush={setColorBrush}
          color={colorColor}
          setColor={setColorColor}
          size={colorSize}
          setSize={setColorSize}
          opacity={colorOpacity}
          setOpacity={setColorOpacity}
        />
      )}
      {mode === 'text' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg px-4 py-2 flex items-center gap-3">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type text, then click canvas to place..."
            className="bg-transparent text-cad-text border-b border-cad-accent outline-none px-2 py-1 w-64 text-sm"
          />
          <span className="text-cad-dim text-xs">Click canvas to place text</span>
        </div>
      )}

      {/* Layer Panel Toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className="absolute top-2 right-2 bg-cad-surface/90 backdrop-blur-sm border border-cad-accent text-cad-text px-3 py-1.5 rounded-lg text-sm hover:bg-cad-accent/30 transition-colors z-20"
      >
        Layers
      </button>

      {showLayers && (
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectLayer={setActiveLayerId}
          onToggleVisibility={toggleLayerVisibility}
          onToggleLock={toggleLayerLock}
          onSetOpacity={setLayerOpacity}
          onClose={() => setShowLayers(false)}
        />
      )}

      {/* Plant Panel Toggle */}
      <button
        onClick={() => setShowPlantPanel(!showPlantPanel)}
        className="absolute top-2 right-24 bg-cad-surface/90 backdrop-blur-sm border border-cad-accent text-cad-text px-3 py-1.5 rounded-lg text-sm hover:bg-cad-accent/30 transition-colors z-20"
      >
        Plants {selectedPlantId ? '(placing)' : ''}
      </button>

      {showPlantPanel && (
        <PlantBrowser
          selectedPlantId={selectedPlantId}
          onSelectPlant={(id) => {
            setSelectedPlantId(id === selectedPlantId ? null : id);
            setMode('cad');
          }}
          onClose={() => setShowPlantPanel(false)}
        />
      )}

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-cad-surface/90 backdrop-blur-sm border-t border-cad-accent px-4 py-1 flex items-center justify-between text-xs text-cad-dim z-10">
        <div className="flex items-center gap-4">
          <span>Mode: <span className="text-cad-text font-medium uppercase">{mode}</span></span>
          {mode === 'cad' && <span>Tool: <span className="text-cad-text font-medium">{cadTool}</span></span>}
          <span>Layer: <span className="text-cad-text font-medium">{layers.find(l => l.id === getActiveLayer())?.name}</span></span>
          <span>Grid: <span className={grid.enabled ? 'text-green-400' : 'text-red-400'}>{grid.enabled ? 'ON' : 'OFF'}</span></span>
          <span>Snap: <span className={grid.snap ? 'text-green-400' : 'text-red-400'}>{grid.snap ? 'ON' : 'OFF'}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span>Zoom: {(view.zoom * 100).toFixed(0)}%</span>
          <span>Elements: {elements.length}</span>
          <button
            onClick={handleClearCanvas}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={resetView}
            className="text-cad-text hover:text-white transition-colors"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts overlay — toggle with ? */}
      <div className="absolute bottom-8 left-2 text-[10px] text-cad-dim/60 leading-relaxed">
        <div>1-4: modes | V: select | L: line | R: rect | C: circle</div>
        <div>G: grid | S: snap | Cmd+Z: undo | Cmd+Shift+Z: redo</div>
        <div>Scroll: pan | Ctrl+Scroll: zoom | Backspace: delete last</div>
      </div>
    </div>
  );
};
