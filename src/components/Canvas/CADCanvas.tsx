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
import { ImportExport } from '../Toolbar/ImportExport';
import { BasemapPanel } from '../Basemap/BasemapPanel';
import type { BasemapState } from '../Basemap/BasemapRenderer';
import { DEFAULT_BASEMAP, renderBasemap } from '../Basemap/BasemapRenderer';
import { ProjectBar } from '../ProjectManager/ProjectBar';
import type { NetrunCADProject } from '../../services/google-drive';
import type { NewProjectOptions } from '../ProjectManager/NewProjectDialog';
import { CommandLine } from '../CommandLine/CommandLine';
import { ContextMenu, type ContextMenuEntry } from '../ContextMenu/ContextMenu';
import { StatusBar } from '../StatusBar/StatusBar';
import { findCommand, getShortAlias } from '../../engine/commands';
import { HelpPanel } from '../HelpPanel/HelpPanel';

let plantPlaceId = 1;

// Long-press duration for iPad right-click emulation (ms)
const LONG_PRESS_MS = 600;

export const CADCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // ── App state ──────────────────────────────────────────────────────────────
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

  // Layer panel
  const [showLayers, setShowLayers] = useState(false);

  // Basemap state
  const [basemap, setBasemap] = useState<BasemapState>(DEFAULT_BASEMAP);
  const [showBasemapPanel, setShowBasemapPanel] = useState(false);

  // Ortho mode (F8 / ORTHO command)
  const [orthoMode, setOrthoMode] = useState(false);

  // ── Command line state ─────────────────────────────────────────────────────
  const [cmdFocused, setCmdFocused] = useState(false);
  const [cmdPrompt, setCmdPrompt] = useState('Command:');
  const [cmdHistory, setCmdHistory] = useState<string[]>([
    'Welcome to Netrun CAD  |  Type a command or alias and press Enter',
    'Press Enter or click here to focus the command line',
    'Esc cancels  |  Tab completes  |  ? for help',
  ]);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // ── Context menu state ─────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  // ── Cursor coordinates for status bar ──────────────────────────────────────
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);

  // ── Help panel ─────────────────────────────────────────────────────────────
  const [showHelp, setShowHelp] = useState(false);

  const handleBasemapChange = useCallback((updates: Partial<BasemapState>) => {
    setBasemap((prev) => ({ ...prev, ...updates }));
  }, []);

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

  // Undo helper
  const doUndo = useCallback(() => {
    setHistoryState((h) => {
      const next = undo(h);
      setElements(next.present);
      return next;
    });
  }, []);

  // Redo helper
  const doRedo = useCallback(() => {
    setHistoryState((h) => {
      const next = redo(h);
      setElements(next.present);
      return next;
    });
  }, []);

  // Delete last element
  const doDelete = useCallback(() => {
    setElements((prev) => {
      const next = prev.slice(0, -1);
      setHistoryState((h) => pushState(h, next));
      return next;
    });
  }, []);

  // ── executeCommand — maps action IDs to real state changes ────────────────
  const executeCommand = useCallback(
    (action: string) => {
      setLastAction(action);
      switch (action) {
        // Draw tools
        case 'tool:line':        setMode('cad'); setCadTool('line');        break;
        case 'tool:circle':      setMode('cad'); setCadTool('circle');      break;
        case 'tool:rectangle':   setMode('cad'); setCadTool('rectangle');   break;
        case 'tool:dimension':   setMode('cad'); setCadTool('dimension');   break;
        case 'tool:select':      setMode('cad'); setCadTool('select');      break;
        case 'tool:move':        setMode('cad'); setCadTool('move');        break;

        // Unimplemented CAD tools — acknowledge but no-op until implemented
        case 'tool:polyline':
        case 'tool:arc':
        case 'tool:ellipse':
        case 'tool:spline':
        case 'tool:xline':
        case 'tool:ray':
        case 'tool:polygon':
        case 'tool:donut':
        case 'tool:hatch':
        case 'tool:boundary':
        case 'tool:region':
        case 'tool:point':
        case 'tool:mline':
        case 'tool:revcloud':
        case 'tool:wipeout':
        case 'tool:copy':
        case 'tool:rotate':
        case 'tool:scale':
        case 'tool:stretch':
        case 'tool:trim':
        case 'tool:extend':
        case 'tool:fillet':
        case 'tool:chamfer':
        case 'tool:array':
        case 'tool:mirror':
        case 'tool:offset':
        case 'tool:break':
        case 'tool:join':
        case 'tool:lengthen':
        case 'tool:pedit':
        case 'tool:textedit':
        case 'tool:explode':
        case 'tool:align':
        case 'tool:change':
        case 'tool:dim:aligned':
        case 'tool:dim:angular':
        case 'tool:dim:radius':
        case 'tool:dim:diameter':
        case 'tool:dim:continue':
        case 'tool:dim:baseline':
        case 'tool:dim:leader':
        case 'tool:dim:tolerance':
        case 'tool:dim:override':
        case 'block:define':
        case 'block:insert':
        case 'block:wblock':
        case 'block:edit':
        case 'file:xref':
          setMode('cad');
          setCmdPrompt(`${action} — not yet implemented`);
          break;

        // Modes
        case 'mode:text':   setMode('text');  break;
        case 'mode:draw':   setMode('draw');  break;
        case 'mode:color':  setMode('color'); break;
        case 'pan':         setMode('cad');   setCadTool('select'); break;

        // Edit
        case 'undo':         doUndo();  break;
        case 'redo':         doRedo();  break;
        case 'delete':       doDelete(); break;
        case 'select:all':   /* future */ break;
        case 'edit:copy':    /* future — clipboard */ break;
        case 'edit:cut':     /* future */ break;
        case 'edit:paste':   /* future */ break;
        case 'panel:properties': /* future */ break;

        // Display
        case 'zoom:in':
          setView((v) => ({ ...v, zoom: Math.min(v.zoom * 1.5, 32) }));
          break;
        case 'zoom:out':
          setView((v) => ({ ...v, zoom: Math.max(v.zoom / 1.5, 0.05) }));
          break;
        case 'zoom:all':
          setView({ offsetX: 0, offsetY: 0, zoom: 1 });
          break;
        case 'zoom:window':  /* future — rubber-band zoom */ break;
        case 'zoom:previous': /* future */ break;
        case 'view:regen':   /* force re-render — already continuous */ break;
        case 'ortho:toggle': setOrthoMode((o) => !o); break;

        // Grid / Snap
        case 'grid:toggle':  toggleGrid();  break;
        case 'snap:toggle':  toggleSnap();  break;
        case 'settings:units':   /* future */ break;
        case 'settings:limits':  /* future */ break;
        case 'settings:drafting': /* future */ break;

        // Layer
        case 'layer:dialog': setShowLayers((s) => !s); break;

        // Text
        case 'text:style':   /* future */ break;
        case 'text:spell':   /* future */ break;
        case 'text:find':    /* future */ break;

        // File
        case 'file:new':
          setElements([]);
          setHistoryState(createHistory([]));
          setView({ offsetX: 0, offsetY: 0, zoom: 1 });
          break;
        case 'file:save':    /* handled by ProjectBar */ break;
        case 'file:saveas':  /* handled by ProjectBar */ break;
        case 'file:open':    /* handled by ProjectBar */ break;
        case 'file:pdf':     /* handled by ImportExport */ break;
        case 'file:export':  /* handled by ImportExport */ break;
        case 'file:import':  /* handled by ImportExport */ break;
        case 'file:close':   /* no-op in web */ break;
        case 'file:clearall':
          setElements([]);
          setHistoryState(createHistory([]));
          break;

        // Landscape
        case 'panel:plants':    setShowPlantPanel((s) => !s); break;
        case 'basemap:toggle':  setBasemap((b) => ({ ...b, enabled: !b.enabled })); break;
        case 'file:scan':       /* handled by ImportExport */ break;
        case 'file:gis':        /* handled by ImportExport */ break;

        case 'help':
          setShowHelp(true);
          setCmdHistory((h) => [...h, 'Help panel opened  — press Esc or ? to close']);
          break;

        default:
          break;
      }
    },
    [doUndo, doRedo, doDelete, toggleGrid, toggleSnap]
  );

  // ── Command line: handle user input ───────────────────────────────────────
  const handleCommandExecute = useCallback(
    (input: string) => {
      const trimmed = input.trim().toLowerCase();
      const cmd = findCommand(trimmed);

      if (cmd) {
        const shortAlias = getShortAlias(cmd.action);
        setCmdHistory((h) => [
          ...h,
          `${shortAlias}  →  ${cmd.description}`,
        ]);
        setCmdPrompt('Command:');
        executeCommand(cmd.action);
      } else {
        setCmdHistory((h) => [...h, `Unknown command: ${input.toUpperCase()}`]);
      }
    },
    [executeCommand]
  );

  const handleCommandCancel = useCallback(() => {
    setCmdPrompt('Command:');
  }, []);

  // ── Context menu items ─────────────────────────────────────────────────────
  const buildContextMenuItems = useCallback((): ContextMenuEntry[] => {
    const hasElements = elements.length > 0;
    const items: ContextMenuEntry[] = [
      {
        label: lastAction ? `Repeat ${getShortAlias(lastAction)}` : 'Repeat Last',
        action: 'repeat',
        disabled: !lastAction,
      },
      { separator: true },
      { label: 'Undo', action: 'undo', disabled: false },
      { label: 'Redo', action: 'redo', disabled: false },
      { separator: true },
      { label: 'Pan', action: 'pan' },
      { label: 'Zoom In', action: 'zoom:in' },
      { label: 'Zoom Out', action: 'zoom:out' },
      { label: 'Zoom to Fit', action: 'zoom:all' },
      { separator: true },
      { label: 'Delete Last Element', action: 'delete', disabled: !hasElements },
    ];
    return items;
  }, [elements.length, lastAction]);

  const handleContextMenuAction = useCallback(
    (action: string) => {
      if (action === 'repeat' && lastAction) {
        executeCommand(lastAction);
      } else {
        executeCommand(action);
      }
      setContextMenu(null);
    },
    [executeCommand, lastAction]
  );

  // ── Long-press for iPad right-click emulation ──────────────────────────────
  const startLongPress = useCallback((x: number, y: number) => {
    longPressStartRef.current = { x, y };
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ x, y });
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  // ── Convert pointer event to canvas coordinates ────────────────────────────
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

  // ── CAD tools ──────────────────────────────────────────────────────────────
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

  // ── Stroke callbacks dispatched from usePointerEvents ─────────────────────
  const onStrokeStart = useCallback(
    (point: StrokePoint) => {
      if (mode === 'cad') {
        if (cadTool === 'select' || cadTool === 'move') {
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
      // Update cursor position for status bar
      setCursorX(point.x);
      setCursorY(point.y);

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

  // Pointer events hook
  const { handlePointerDown: ptrDown, handlePointerMove: ptrMove, handlePointerUp: ptrUp } =
    usePointerEvents({
      onStrokeStart,
      onStrokeMove,
      onStrokeEnd,
      getCanvasPoint,
    });

  // ── Canvas pointer events — two-finger pan + long-press context menu ───────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });

      if (twoFingerRef.current.size === 2) {
        isPanningRef.current = true;
        startPan(pe.clientX, pe.clientY);
        cancelLongPress();
        return;
      }

      // Start long-press timer for iPad context menu
      if (pe.pointerType === 'touch') {
        startLongPress(pe.clientX, pe.clientY);
      }

      // Close context menu on canvas tap
      setContextMenu(null);

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
        cancelLongPress();
        return;
      }

      ptrDown(pe);
    },
    [ptrDown, startPan, selectedPlantId, mode, getCanvasPoint, addElement, startLongPress, cancelLongPress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });

      // Cancel long-press if finger moved
      if (longPressStartRef.current) {
        const dx = pe.clientX - longPressStartRef.current.x;
        const dy = pe.clientY - longPressStartRef.current.y;
        if (Math.hypot(dx, dy) > 8) cancelLongPress();
      }

      if (twoFingerRef.current.size === 2 && isPanningRef.current) {
        movePan(pe.clientX, pe.clientY);
        return;
      }

      ptrMove(pe);
    },
    [ptrMove, movePan, cancelLongPress]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.delete(pe.pointerId);
      cancelLongPress();

      if (twoFingerRef.current.size < 2 && isPanningRef.current) {
        isPanningRef.current = false;
        endPan();
      }

      ptrUp(pe);
    },
    [ptrUp, endPan, cancelLongPress]
  );

  // Native right-click context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // When command line is focused, only intercept Escape
      if (cmdFocused) {
        if (e.key === 'Escape') {
          setCmdFocused(false);
          setCmdPrompt('Command:');
        }
        return; // All other keys go to command line
      }

      // If typing in any other input, ignore
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // ── Enter → focus command line ───────────────────────────────────────
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // Repeat last command on Enter if nothing typed
        if (lastAction) {
          executeCommand(lastAction);
        } else {
          setCmdFocused(true);
        }
        return;
      }

      // ── Escape → cancel and unfocus ──────────────────────────────────────
      if (e.key === 'Escape') {
        setCmdFocused(false);
        setCmdPrompt('Command:');
        return;
      }

      // ── Undo/Redo ────────────────────────────────────────────────────────
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          doRedo();
        } else {
          doUndo();
        }
        return;
      }

      // ── Function keys (AutoCAD standard) ─────────────────────────────────
      if (e.key === 'F2') { e.preventDefault(); toggleSnap(); return; }
      if (e.key === 'F3') { e.preventDefault(); toggleSnap(); return; }
      if (e.key === 'F7') { e.preventDefault(); toggleGrid(); return; }
      if (e.key === 'F8') { e.preventDefault(); setOrthoMode((o) => !o); return; }

      // ── Mode shortcuts 1-4 ───────────────────────────────────────────────
      if (e.key === '1') { setMode('cad');   return; }
      if (e.key === '2') { setMode('draw');  return; }
      if (e.key === '3') { setMode('color'); return; }
      if (e.key === '4') { setMode('text');  return; }

      // ── CAD tool shortcuts (single keys, only in cad mode) ────────────────
      if (mode === 'cad') {
        if (e.key === 'v' || e.key === 'V') { setCadTool('select');    return; }
        if (e.key === 'l' || e.key === 'L') { setCadTool('line');      return; }
        if (e.key === 'r' || e.key === 'R') { setCadTool('rectangle'); return; }
        if (e.key === 'c' || e.key === 'C') { setCadTool('circle');    return; }
        if (e.key === 'd' || e.key === 'D') { setCadTool('dimension'); return; }
        if (e.key === 'g' || e.key === 'G') { toggleGrid(); return; }
        if (e.key === 's' && !e.metaKey && !e.ctrlKey) { toggleSnap(); return; }
      }

      // ── Reset view Cmd/Ctrl+0 ──────────────────────────────────────────────
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        resetView();
        return;
      }

      // ── Delete last element ────────────────────────────────────────────────
      if (e.key === 'Backspace' || e.key === 'Delete') {
        doDelete();
        return;
      }

      // ── ? → toggle help panel ─────────────────────────────────────────────
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }

      // ── Space / any letter key → open command line and start typing ─────────
      // (AutoCAD behavior: typing a letter while idle opens the command line)
      if (
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        /^[a-zA-Z]$/.test(e.key)
      ) {
        // Don't intercept mode keys that were already handled above
        e.preventDefault();
        setCmdFocused(true);
        // Pre-seed the command line with the pressed key
        // We dispatch a fake event to the input via a custom event after render
        window.dispatchEvent(new CustomEvent('cmdline:seed', { detail: e.key.toLowerCase() }));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, cmdFocused, lastAction, toggleGrid, toggleSnap, resetView, doUndo, doRedo, doDelete, executeCommand]);

  // ── Canvas resize handler ──────────────────────────────────────────────────
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

  // ── Wheel handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      const allElements = preview ? [...elements, preview] : elements;

      if (basemap.enabled) {
        const dprPre = window.devicePixelRatio || 1;
        ctx.setTransform(dprPre, 0, 0, dprPre, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#12121f';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(view.offsetX, view.offsetY);
        ctx.scale(view.zoom, view.zoom);
        renderBasemap(ctx, basemap, view.offsetX, view.offsetY, view.zoom, width, height, () => {});
        ctx.restore();

        renderAll(ctx, allElements, layers, view, grid, width, height, true);
      } else {
        renderAll(ctx, allElements, layers, view, grid, width, height, false);
      }

      // Live freehand stroke
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

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [elements, preview, liveStrokePoints, layers, view, grid, mode, penColor, penSize, penOpacity, colorColor, colorSize, colorOpacity, colorBrush, selectedPlantId, basemap]);

  // ── localStorage persistence ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem('netrun-cad-state', JSON.stringify({ elements, layers, view, grid }));
      } catch { /* localStorage full */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [elements, layers, view, grid]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('netrun-cad-state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.elements) setElements(state.elements);
        if (state.view) setView(state.view);
      }
    } catch { /* ignore */ }
  }, []);

  const handleClearCanvas = useCallback(() => {
    setElements([]);
    setHistoryState(createHistory([]));
  }, []);

  // ── Google Drive project handlers ──────────────────────────────────────────
  const handleNewProject = useCallback((_opts: NewProjectOptions) => {
    setElements([]);
    setHistoryState(createHistory([]));
    setView({ offsetX: 0, offsetY: 0, zoom: 1 });
  }, []);

  const handleOpenProject = useCallback((project: NetrunCADProject) => {
    if (project.elements) {
      setElements(project.elements);
      setHistoryState(createHistory(project.elements));
    }
    setView({ offsetX: 0, offsetY: 0, zoom: 1 });
    if (project.basemap) {
      setBasemap((prev) => ({
        ...prev,
        enabled: project.basemap!.enabled,
        centerLat: project.basemap!.lat,
        centerLng: project.basemap!.lng,
        tileZoom: project.basemap!.zoom,
        provider: project.basemap!.provider as BasemapState['provider'],
      }));
    }
  }, []);

  const handleImport = useCallback(
    (imported: CADElement[], newLayers: import('../../engine/types').Layer[]) => {
      if (newLayers.length > 0) {
        newLayers.forEach((l) => addLayer(l.name, l.color));
      }
      setElements((prev) => {
        const next = [...prev, ...imported];
        setHistoryState((h) => pushState(h, next));
        return next;
      });
    },
    [addLayer]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  // Command line is visible in CAD mode (not in draw/color — pencil is primary)
  const cmdVisible = true; // always show for keyboard accessibility

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cad-bg">
      {/* Canvas — leaves room at bottom for command line (72px) + status bar (28px) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
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

      {/* Top center bar — Project management + Import/Export */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
        <ProjectBar
          elements={elements}
          layers={layers}
          grid={grid}
          basemap={basemap}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
        />
        <ImportExport
          elements={elements}
          layers={layers}
          grid={grid}
          onImport={handleImport}
          basemapLat={basemap.centerLat}
          basemapLng={basemap.centerLng}
        />
      </div>

      {/* Help button */}
      <button
        onClick={() => setShowHelp((s) => !s)}
        title="Help & Reference (press ?)"
        className="absolute top-2 right-20 bg-cad-surface/90 backdrop-blur-sm border border-cad-accent text-cad-text px-3 py-1.5 rounded-lg text-sm hover:bg-cad-accent/30 transition-colors z-20 font-bold"
      >
        ?
      </button>

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

      {/* Basemap Toggle */}
      <button
        onClick={() => setShowBasemapPanel(!showBasemapPanel)}
        className={`absolute top-2 right-52 bg-cad-surface/90 backdrop-blur-sm border text-cad-text px-3 py-1.5 rounded-lg text-sm transition-colors z-20 ${
          basemap.enabled
            ? 'border-blue-500 text-blue-300 hover:bg-blue-700/30'
            : 'border-cad-accent hover:bg-cad-accent/30'
        }`}
        title="Toggle satellite basemap"
      >
        {basemap.enabled ? 'Basemap ON' : 'Basemap'}
      </button>

      {showBasemapPanel && (
        <BasemapPanel
          basemap={basemap}
          onChange={handleBasemapChange}
          onClose={() => setShowBasemapPanel(false)}
        />
      )}

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

      {/* Ortho indicator */}
      {orthoMode && (
        <div
          className="absolute top-2 left-1/2 ml-64 text-xs px-2 py-1 rounded"
          style={{ background: '#1a3a1a', color: '#4ade80', border: '1px solid #4ade80' }}
        >
          ORTHO ON
        </div>
      )}

      {/* Keyboard shortcut hint — bottom left above command line */}
      <div
        className="absolute left-2 text-[10px] leading-relaxed z-10"
        style={{ bottom: '108px', color: 'rgba(155,155,175,0.45)' }}
      >
        <div>Enter=command | Esc=cancel | 1-4=modes | V L R C D=tools</div>
        <div>G=grid | S=snap | F7=grid | F8=ortho | Cmd+Z=undo</div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems()}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Command Line — always rendered at bottom, above status bar */}
      <CommandLine
        prompt={cmdPrompt}
        history={cmdHistory}
        visible={cmdVisible}
        focused={cmdFocused}
        onFocusChange={setCmdFocused}
        onExecute={handleCommandExecute}
        onCancel={handleCommandCancel}
      />

      {/* Status Bar — very bottom strip */}
      <StatusBar
        mode={mode}
        cadTool={cadTool}
        grid={grid}
        layers={layers}
        activeLayerId={getActiveLayer()}
        cursorX={cursorX}
        cursorY={cursorY}
        zoom={view.zoom}
        elementCount={elements.length}
        onClearAll={handleClearCanvas}
        onResetView={resetView}
      />

      {/* Help Panel */}
      <HelpPanel open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};
