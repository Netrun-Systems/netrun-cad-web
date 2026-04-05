import React, { useRef, useEffect, useCallback, useState } from 'react';
import getStroke from 'perfect-freehand';
import type {
  AppMode,
  CADTool,
  CADElement,
  Point,
  StrokePoint,
  ViewState,
  DrawBrush,
  ColorBrush,
  FreehandStroke,
  TextElement,
  PlantPlacement,
  InteriorSymbolPlacement,
} from '../../engine/types';
import { renderAll } from './renderer';
import { usePointerEvents } from './usePointerEvents';
import { useZoomPan } from './useZoomPan';
import { useCADTools } from './useCADTools';
import { useDrawingTools } from './useDrawingTools';
import {
  computeInferenceLines,
  findSnapIndicator,
  renderInferenceLines,
  renderSnapIndicator,
  renderCursorMeasurement,
} from '../../engine/inference';
import { useLayers } from './useLayers';
import { useGrid } from './useGrid';
import { createHistory, pushState, undo, redo } from '../../engine/history';
// Legacy component imports (panels still open as overlays)
import { PlantBrowser } from '../PlantPanel/PlantBrowser';
import { ImportExport } from '../Toolbar/ImportExport';
import { SurvaiPanel } from '../SurvaiPanel/SurvaiPanel';
import { BasemapPanel } from '../Basemap/BasemapPanel';
import type { BasemapState } from '../Basemap/BasemapRenderer';
import { DEFAULT_BASEMAP, renderBasemap } from '../Basemap/BasemapRenderer';
import { ProjectBar } from '../ProjectManager/ProjectBar';
import type { ProjectBarHandle } from '../ProjectManager/ProjectBar';
import type { NetrunCADProject } from '../../services/google-drive';
import type { NewProjectOptions } from '../ProjectManager/NewProjectDialog';
import { CommandLine } from '../CommandLine/CommandLine';
import { ContextMenu, type ContextMenuEntry } from '../ContextMenu/ContextMenu';
import { StatusBar } from '../StatusBar/StatusBar';
import { findCommand, getShortAlias } from '../../engine/commands';
import { findElementAt, moveElement, getBoundingBox } from '../../engine/selection';
import { HelpPanel } from '../HelpPanel/HelpPanel';
import { InteriorPanel } from '../InteriorPanel/InteriorPanel';
import type { PlacingSymbol } from '../InteriorPanel/InteriorPanel';
import { AlignmentEditor } from '../AlignmentEditor/AlignmentEditor';
import type { AlignmentResult } from '../../engine/scan-gis-alignment';
import {
  autoAlignScanToGIS,
  extractScanBoundaryPoints,
  extractParcelBoundaryPoints,
  applyAlignment,
} from '../../engine/scan-gis-alignment';
// New layout system
import { TopBar, TOP_BAR_HEIGHT } from '../TopBar/TopBar';
import { SidePanel, SIDE_PANEL_WIDTH_LANDSCAPE, SIDE_PANEL_WIDTH_PORTRAIT, SIDE_PANEL_WIDTH_COLLAPSED } from '../SidePanel/SidePanel';
import { AppMenu } from '../Menu/AppMenu';
import { useHandedness } from '../../hooks/useHandedness';
import { useOrientation } from '../../hooks/useOrientation';
import { SupportWidget } from '../SupportWidget/SupportWidget';
import { PricingPage } from '../Pricing/PricingPage';
import { AccountPanel } from '../Account/AccountPanel';
import useAuth from '../../contexts/AuthContext';
import { ShortcutBar } from '../ShortcutBar/ShortcutBar';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { ProjectFilesPanel } from '../ProjectManager/ProjectFilesPanel';
import { RevisionHistoryPanel } from '../ProjectManager/RevisionHistoryPanel';
import type { Detection3D } from '../Viewport3D/ModelViewer3D';
import SplitView from '../SplitView/SplitView';
import ModelViewer3D from '../Viewport3D/ModelViewer3D';
import type { PointCloudData } from '../../engine/pointcloud-loader';
import BlueprintPanel from '../BlueprintPanel/BlueprintPanel';
import ProjectDashboard from '../Dashboard/ProjectDashboard';
import type { ProjectInfo } from '../Dashboard/ProjectDashboard';
import { WelcomeModal } from '../Welcome/WelcomeModal';
import type { DemoProject } from '../../data/demo-project';
import { linkAnnotationToDeviation, type LinkedAnnotation } from '../../engine/annotation-linker';
import { RouteTutorialOverlay } from '../RouteEditor/RouteTutorialOverlay';
import { OfflineIndicator } from '../OfflineIndicator/OfflineIndicator';
import { cacheProject } from '../../services/offline-storage';

let plantPlaceId = 1;

// Long-press duration for iPad right-click emulation (ms)
const LONG_PRESS_MS = 600;

export const CADCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const { user, logout } = useAuth();

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

  // Survai panel
  const [showSurvaiPanel, setShowSurvaiPanel] = useState(false);

  // Interior symbol placement
  const [showInteriorPanel, setShowInteriorPanel] = useState(false);
  const [placingInteriorSymbol, setPlacingInteriorSymbol] = useState<PlacingSymbol | null>(null);

  // Element selection (select tool)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const dragElementStartRef = useRef<Point | null>(null);

  // Annotation-to-deviation links (Apple Pencil annotations near deviation markers)
  const [annotationLinks, setAnnotationLinks] = useState<LinkedAnnotation[]>([]);

  // Scan-GIS alignment
  const [showAlignmentEditor, setShowAlignmentEditor] = useState(false);
  const [alignment, setAlignment] = useState<AlignmentResult | null>(null);
  const [alignmentNotification, setAlignmentNotification] = useState<string | null>(null);

  // Blueprint / 3D / split view state
  const [show3DView, setShow3DView] = useState(false);
  const [splitMode, setSplitMode] = useState<'cad-only' | 'split' | '3d-only'>('cad-only');
  const [scan3DDetections, setScan3DDetections] = useState<Detection3D[]>([]);
  const [scanPointCloud, setScanPointCloud] = useState<PointCloudData | undefined>(undefined);
  const [scanMeshUrl, setScanMeshUrl] = useState<string | undefined>(undefined);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [showBlueprintPanel, setShowBlueprintPanel] = useState(false);
  const [activeBlueprintId, setActiveBlueprintId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

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

  // ── Intuitive CAD behavior state ───────────────────────────────────────────
  /** Last drawing tool used (for Spacebar repeat) */
  const [lastDrawTool, setLastDrawTool] = useState<CADTool>('line');
  /** Timestamp of last Escape press (for two-stage escape) */
  const lastEscRef = useRef<number>(0);
  /** Inline text editing state */
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingTextPos, setEditingTextPos] = useState<{ x: number; y: number } | null>(null);
  /** Track middle-mouse panning */
  const middleMousePanRef = useRef(false);

  // ── Command line state ─────────────────────────────────────────────────────
  const [cmdFocused, setCmdFocused] = useState(false);
  const [cmdPrompt, setCmdPrompt] = useState('Command:');
  const [cmdHistory, setCmdHistory] = useState<string[]>([
    'Welcome to Survai Construction  |  Type a command or alias and press Enter',
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

  // ── New layout state ────────────────────────────────────────────────────────
  const [hand, setHand, toggleHand] = useHandedness();
  const { orientation, isTouch } = useOrientation();
  const installPrompt = useInstallPrompt();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  // Project name for top bar (syncs via ProjectBar ref pattern)
  const [projectName, setProjectNameState] = useState('Untitled Project');
  const [saveStatusLabel, setSaveStatusLabel] = useState('idle');

  // ProjectBar ref for Drive state access
  const projectBarRef = useRef<ProjectBarHandle>(null);

  // Project files panel
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [clientName, setClientName] = useState('');

  // UI visibility states (all panels hideable/collapsible)
  const [shortcutBarCollapsed, setShortcutBarCollapsed] = useState(false);
  const [topBarHidden, setTopBarHidden] = useState(false);
  const [statusBarHidden, setStatusBarHidden] = useState(false);
  const [cmdLineHidden, setCmdLineHidden] = useState(false);

  // Sync save status from ProjectBar to TopBar display
  useEffect(() => {
    const interval = setInterval(() => {
      const pb = projectBarRef.current;
      if (pb) {
        setSaveStatusLabel(pb.saveStatus);
        if (pb.projectName !== projectName) setProjectNameState(pb.projectName);
        if (pb.clientName !== clientName) setClientName(pb.clientName);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [projectName]);

  // Import/Export modal triggers (for hamburger menu)
  const dxfFileInputRef = useRef<HTMLInputElement>(null);
  const [showImportExportPDF, setShowImportExportPDF] = useState(false);
  const [showGISModal, setShowGISModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showPricingPage, setShowPricingPage] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('survai_visited'));
  const [showRouteTutorial, setShowRouteTutorial] = useState(false);

  // ── Save recent project metadata to localStorage (debounced) ───────────────
  const recentProjectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (elements.length === 0) return;
    if (recentProjectTimerRef.current) clearTimeout(recentProjectTimerRef.current);
    recentProjectTimerRef.current = setTimeout(() => {
      try {
        const entry = {
          name: projectName || 'Untitled Project',
          date: new Date().toISOString(),
          elementCount: elements.length,
        };
        const raw = localStorage.getItem('survai_recent_projects');
        let list: { name: string; date: string; elementCount: number }[] = [];
        try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
        // Upsert: remove existing entry with same name, prepend new one, cap at 3
        list = [entry, ...list.filter((p) => p.name !== entry.name)].slice(0, 3);
        localStorage.setItem('survai_recent_projects', JSON.stringify(list));
      } catch { /* localStorage full or unavailable — ignore */ }
    }, 2000);
    return () => {
      if (recentProjectTimerRef.current) clearTimeout(recentProjectTimerRef.current);
    };
  }, [elements.length, projectName]);

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

      // Auto-link freehand strokes to nearby deviation markers
      if (el.type === 'freehand') {
        const link = linkAnnotationToDeviation(el, next);
        if (link) {
          setAnnotationLinks((prev) => [...prev, link]);
        }
      }
    },
    [elements]
  );

  // Blueprint / 3D handlers
  const handleBlueprintImported = useCallback((newElements: CADElement[], blueprintId: string) => {
    setElements(prev => [...prev, ...newElements]);
    setActiveBlueprintId(blueprintId);
  }, []);

  const handleDeviationsComputed = useCallback((devElements: CADElement[]) => {
    setElements(prev => [...prev.filter(e => e.layerId !== 'deviations'), ...devElements]);
  }, []);

  const handleScan3DData = useCallback((
    scanId: string,
    detections: Detection3D[],
    pointCloud?: PointCloudData,
    meshUrl?: string,
  ) => {
    setActiveScanId(scanId);
    setScan3DDetections(detections);
    setScanPointCloud(pointCloud);
    setScanMeshUrl(meshUrl);
  }, []);

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
      let next: typeof prev;
      if (selectedElementId) {
        // Delete the selected element
        next = prev.filter((el) => el.id !== selectedElementId);
        setSelectedElementId(null);
      } else {
        // No selection — delete the last element (legacy behavior)
        next = prev.slice(0, -1);
      }
      setHistoryState((h) => pushState(h, next));
      return next;
    });
  }, [selectedElementId]);

  // ── executeCommand — maps action IDs to real state changes ────────────────
  const executeCommand = useCallback(
    (action: string) => {
      setLastAction(action);
      switch (action) {
        // Draw tools
        case 'tool:line':        setMode('cad'); setCadTool('line');      setLastDrawTool('line');      break;
        case 'tool:circle':      setMode('cad'); setCadTool('circle');    setLastDrawTool('circle');    break;
        case 'tool:rectangle':   setMode('cad'); setCadTool('rectangle');setLastDrawTool('rectangle'); break;
        case 'tool:dimension':   setMode('cad'); setCadTool('dimension');setLastDrawTool('dimension'); break;
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
        case 'setRouteMode':
        case 'mode:route':
          setMode('route');
          if (!localStorage.getItem('survai_route_tutorial_seen')) {
            setShowRouteTutorial(true);
          }
          break;
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

        // ShortcutBar aliases (map to existing actions)
        case 'edit:undo':       doUndo();  break;
        case 'edit:redo':       doRedo();  break;
        case 'view:grid':       toggleGrid(); break;
        case 'view:snap':       toggleSnap(); break;
        case 'view:fit':        setView({ offsetX: 0, offsetY: 0, zoom: 1 }); break;
        case 'mode:cad':        setMode('cad'); break;
        case 'file:export-pdf': setShowImportExportPDF(true); break;
        case 'escape':
          setSelectedElementId(null);
          cancelPending?.();
          setCmdFocused(false);
          setCmdPrompt('Command:');
          break;
        case 'panel:help':      setShowHelp((s) => !s); break;
        case 'panel:interior':  setShowInteriorPanel((s) => !s); break;
        case 'panel:survai':    setShowSurvaiPanel((s) => !s); break;
        case 'panel:files':     setShowProjectFiles((s) => !s); break;
        case 'panel:history':   setShowRevisionHistory((s) => !s); break;
        case 'panel:pricing':   setShowPricingPage((s) => !s); break;
        case 'panel:account':   setShowAccountPanel((s) => !s); break;

        // Landscape
        case 'panel:plants':    setShowPlantPanel((s) => !s); break;
        case 'panel:survai':    setShowSurvaiPanel((s) => !s); break;
        case 'basemap:toggle':  setBasemap((b) => ({ ...b, enabled: !b.enabled })); break;
        case 'file:scan':       /* handled by ImportExport */ break;
        case 'file:gis':        /* handled by ImportExport */ break;

        case 'help':
          setShowHelp(true);
          setCmdHistory((h) => [...h, 'Help panel opened  — press Esc or ? to close']);
          break;

        // Survai panel actions
        case 'openBlueprintPanel':
          setShowBlueprintPanel(true);
          break;
        case 'toggle3DView':
          setShow3DView((s) => !s);
          break;

        // Dashboard
        case 'panel:dashboard':
          setShowDashboard(true);
          break;

        default:
          break;
      }
    },
    [doUndo, doRedo, doDelete, toggleGrid, toggleSnap]
  );

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
  const { handleCADDown, handleCADMove, handleCADUp, pendingInput, handleNumericInput, cancelPending } = useCADTools({
    activeTool: cadTool,
    activeLayerId: getActiveLayer(),
    grid,
    strokeColor: cadStrokeColor,
    strokeWidth: cadStrokeWidth,
    orthoMode,
    onElementCreated: addElement,
    onPreviewChange: setPreview,
  });

  // ── Command line: handle user input ───────────────────────────────────────
  const handleCommandExecute = useCallback(
    (input: string) => {
      const trimmed = input.trim().toLowerCase();
      const cmd = findCommand(trimmed);

      if (cmd) {
        // If switching tools while one is pending, cancel the pending operation
        if (pendingInput) {
          cancelPending();
        }
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
    [executeCommand, pendingInput, cancelPending]
  );

  const handleCommandCancel = useCallback(() => {
    cancelPending();
    setCmdPrompt('Command:');
  }, [cancelPending]);

  // Numeric input handler passed to CommandLine
  const handleNumericInputCmd = useCallback(
    (input: string): boolean => {
      const consumed = handleNumericInput(input);
      if (consumed) {
        setCmdHistory((h) => [...h, `  ${input}  →  Applied`]);
        setCmdPrompt('Command:');
      }
      return consumed;
    },
    [handleNumericInput]
  );

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
        if (cadTool === 'select') {
          // Hit test for element selection
          const hit = findElementAt(elements, point, view.zoom);
          if (hit) {
            setSelectedElementId(hit.id);
            dragStartRef.current = { x: point.x, y: point.y };
            // Store the element's initial position for smooth dragging
            const bb = getBoundingBox(hit);
            dragElementStartRef.current = { x: bb.x, y: bb.y };
          } else {
            setSelectedElementId(null);
            // No element hit — pan instead
            isPanningRef.current = true;
            const canvas = canvasRef.current!;
            const rect = canvas.getBoundingClientRect();
            startPan(point.x * view.zoom + view.offsetX + rect.left, point.y * view.zoom + view.offsetY + rect.top);
          }
        } else if (cadTool === 'move') {
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

      if (selectedElementId && dragStartRef.current && cadTool === 'select') {
        // Drag the selected element
        const dx = point.x - dragStartRef.current.x;
        const dy = point.y - dragStartRef.current.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          setElements((prev) =>
            prev.map((el) =>
              el.id === selectedElementId ? moveElement(el, dx, dy) : el
            )
          );
          dragStartRef.current = { x: point.x, y: point.y };
        }
      } else if (isPanningRef.current) {
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
    dragStartRef.current = null;
    dragElementStartRef.current = null;
    if (isPanningRef.current) {
      isPanningRef.current = false;
      endPan();
    } else if (mode === 'cad') {
      handleCADUp();
      lastPointRef.current = null;
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

      // ── Middle mouse button → pan ────────────────────────────────────────
      if (pe.button === 1) {
        e.preventDefault();
        middleMousePanRef.current = true;
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

      // Interior symbol placement
      if (placingInteriorSymbol && mode === 'cad') {
        const point = getCanvasPoint(pe);
        const sym = placingInteriorSymbol;
        const placement: InteriorSymbolPlacement = {
          type: 'interior-symbol',
          id: `interior-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          position: { x: point.x, y: point.y },
          symbolKey: sym.key,
          width: sym.def.width,
          depth: sym.def.depth,
          layerId: 'interior',
          rotation: sym.rotation,
          color: '#8B7355',
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

      // Always update cursor coordinates for status bar
      const cursorPt = getCanvasPoint(pe);
      setCursorX(cursorPt.x);
      setCursorY(cursorPt.y);

      // When a CAD tool is awaiting a second click, show live preview
      // even when pointer is not down (click-click flow, not drag flow)
      if (pendingInput && mode === 'cad' && !isPanningRef.current) {
        handleCADMove(cursorPt);
      }

      // Cancel long-press if finger moved
      if (longPressStartRef.current) {
        const dx = pe.clientX - longPressStartRef.current.x;
        const dy = pe.clientY - longPressStartRef.current.y;
        if (Math.hypot(dx, dy) > 8) cancelLongPress();
      }

      // Middle-mouse drag panning
      if (middleMousePanRef.current && isPanningRef.current) {
        movePan(pe.clientX, pe.clientY);
        return;
      }

      if (twoFingerRef.current.size === 2 && isPanningRef.current) {
        movePan(pe.clientX, pe.clientY);
        return;
      }

      ptrMove(pe);
    },
    [ptrMove, movePan, cancelLongPress, pendingInput, mode, handleCADMove, getCanvasPoint]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pe = e.nativeEvent;
      twoFingerRef.current.delete(pe.pointerId);
      cancelLongPress();

      // Middle mouse release
      if (pe.button === 1 && middleMousePanRef.current) {
        middleMousePanRef.current = false;
        isPanningRef.current = false;
        endPan();
        return;
      }

      if (twoFingerRef.current.size < 2 && isPanningRef.current && !middleMousePanRef.current) {
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

  // ── Double-click handling ──────────────────────────────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Middle mouse double-click → zoom extents
      if (e.button === 1) {
        e.preventDefault();
        resetView();
        return;
      }

      // Left double-click in select mode → edit text element
      if (mode === 'cad' && cadTool === 'select') {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - view.offsetX) / view.zoom;
        const worldY = (e.clientY - rect.top - view.offsetY) / view.zoom;

        // Hit-test text elements (reverse order for top-most)
        for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i];
          if (el.type === 'text') {
            const dx = worldX - el.position.x;
            const dy = worldY - el.position.y;
            // Rough bounding box (text height ~fontSize, width estimated)
            if (dx >= 0 && dx <= el.content.length * el.fontSize * 0.6 && dy >= 0 && dy <= el.fontSize * 1.2) {
              setEditingTextId(el.id);
              setEditingTextValue(el.content);
              // Convert world position to screen position
              const screenX = el.position.x * view.zoom + view.offsetX + rect.left;
              const screenY = el.position.y * view.zoom + view.offsetY + rect.top;
              setEditingTextPos({ x: screenX, y: screenY });
              return;
            }
          }
        }
      }
    },
    [mode, cadTool, elements, view, resetView]
  );

  // Handle text edit commit
  const commitTextEdit = useCallback(() => {
    if (editingTextId && editingTextValue.trim()) {
      setElements((prev) => prev.map((el) =>
        el.id === editingTextId && el.type === 'text'
          ? { ...el, content: editingTextValue }
          : el
      ));
    }
    setEditingTextId(null);
    setEditingTextValue('');
    setEditingTextPos(null);
  }, [editingTextId, editingTextValue]);

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

      // ── Escape → two-stage: first cancel operation, second switch to select ──
      if (e.key === 'Escape') {
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscRef.current;
        lastEscRef.current = now;

        if (pendingInput) {
          // First Esc: cancel current operation but keep tool
          cancelPending();
          setCmdFocused(false);
          setCmdPrompt('Command:');
        } else if (timeSinceLastEsc < 500) {
          // Second Esc within 500ms: switch to Select tool
          setCadTool('select');
          setMode('cad');
          setCmdFocused(false);
          setCmdPrompt('Command:');
        } else {
          // Single Esc with no operation: deselect element + unfocus
          setSelectedElementId(null);
          setCmdFocused(false);
          setCmdPrompt('Command:');
        }
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

      // ── Spacebar → repeat last drawing tool ────────────────────────────────
      if (e.key === ' ' && !pendingInput) {
        e.preventDefault();
        setMode('cad');
        setCadTool(lastDrawTool);
        setCmdHistory((h) => [...h, `Repeat: ${lastDrawTool.toUpperCase()}`]);
        return;
      }

      // ── Mode shortcuts 1-4 ───────────────────────────────────────────────
      if (e.key === '1') { setMode('cad');   return; }
      if (e.key === '2') { setMode('draw');  return; }
      if (e.key === '3') { setMode('color'); return; }
      if (e.key === '4') { setMode('text');  return; }

      // ── CAD tool shortcuts (single keys, only in cad mode) ────────────────
      if (mode === 'cad') {
        if (e.key === 'v' || e.key === 'V') { setCadTool('select');    return; }
        if (e.key === 'l' || e.key === 'L') { setCadTool('line');      setLastDrawTool('line');      return; }
        if (e.key === 'r' || e.key === 'R') { setCadTool('rectangle'); setLastDrawTool('rectangle'); return; }
        if (e.key === 'c' || e.key === 'C') { setCadTool('circle');    setLastDrawTool('circle');    return; }
        if (e.key === 'd' || e.key === 'D') { setCadTool('dimension'); setLastDrawTool('dimension'); return; }
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

      // ── When a tool is awaiting numeric input, route digits to command line ──
      if (
        pendingInput &&
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        /^[0-9.,'"\-xX]$/.test(e.key)
      ) {
        e.preventDefault();
        setCmdFocused(true);
        window.dispatchEvent(new CustomEvent('cmdline:seed', { detail: e.key }));
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
  }, [mode, cmdFocused, lastAction, toggleGrid, toggleSnap, resetView, doUndo, doRedo, doDelete, executeCommand, pendingInput, cancelPending, lastDrawTool]);

  // ── Compute canvas dimensions based on layout ────────────────────────────
  const sidePanelWidth = sidePanelCollapsed
    ? SIDE_PANEL_WIDTH_COLLAPSED
    : orientation === 'portrait'
      ? SIDE_PANEL_WIDTH_PORTRAIT
      : SIDE_PANEL_WIDTH_LANDSCAPE;

  // Window dimensions for reactive canvas sizing
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const canvasWidth = windowSize.w - sidePanelWidth;
  const canvasHeight = windowSize.h - TOP_BAR_HEIGHT;

  // ── Canvas resize handler ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
  }, [canvasWidth, canvasHeight]);

  // ── Wheel handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Prevent middle-click auto-scroll
    const preventMiddleClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    canvas.addEventListener('mousedown', preventMiddleClick);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', preventMiddleClick);
    };
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

      // ── CAD overlays: inference lines, snap indicators, cursor measurement ──
      if (mode === 'cad' && pendingInput) {
        const dprOverlay = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(dprOverlay, 0, 0, dprOverlay, 0, 0);
        ctx.translate(view.offsetX, view.offsetY);
        ctx.scale(view.zoom, view.zoom);

        const cursorPt = { x: cursorX, y: cursorY };
        const startPt = pendingInput.startPoint;
        const snapDist = grid.snapSize;

        // 1. Inference lines
        const inferenceLines = computeInferenceLines(
          startPt,
          cursorPt,
          width / view.zoom,
          height / view.zoom,
          elements,
          snapDist
        );
        if (inferenceLines.length > 0) {
          renderInferenceLines(ctx, inferenceLines, cursorPt, view.zoom);
        }

        // 2. Dynamic length display at cursor
        const toolType = cadTool as 'line' | 'rectangle' | 'circle';
        if (toolType === 'line' || toolType === 'rectangle' || toolType === 'circle') {
          renderCursorMeasurement(ctx, startPt, cursorPt, toolType, grid, view.zoom);
        }

        ctx.restore();
      }

      // ── Snap indicator (always active in CAD mode) ──────────────────────
      if (mode === 'cad') {
        const dprSnap = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(dprSnap, 0, 0, dprSnap, 0, 0);
        ctx.translate(view.offsetX, view.offsetY);
        ctx.scale(view.zoom, view.zoom);

        const cursorPt = { x: cursorX, y: cursorY };
        const snapInd = findSnapIndicator(cursorPt, elements, grid.snapSize);
        if (snapInd) {
          renderSnapIndicator(ctx, snapInd, view.zoom);
        }

        // Draw selection highlight
        if (selectedElementId) {
          const selEl = elements.find((e) => e.id === selectedElementId);
          if (selEl) {
            const bb = getBoundingBox(selEl);
            const pad = 4 / view.zoom;
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
            ctx.strokeRect(bb.x - pad, bb.y - pad, bb.width + pad * 2, bb.height + pad * 2);
            ctx.setLineDash([]);
            // Corner handles
            const hs = 4 / view.zoom;
            ctx.fillStyle = '#3b82f6';
            for (const [hx, hy] of [
              [bb.x - pad, bb.y - pad],
              [bb.x + bb.width + pad, bb.y - pad],
              [bb.x - pad, bb.y + bb.height + pad],
              [bb.x + bb.width + pad, bb.y + bb.height + pad],
            ]) {
              ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
            }

            // Cross-highlight linked deviation when a linked stroke is selected
            const linkedDev = annotationLinks.find((l) => l.strokeId === selectedElementId);
            if (linkedDev) {
              const devEl = elements.find((e) => e.id === linkedDev.deviationId);
              if (devEl) {
                const devBb = getBoundingBox(devEl);
                const devPad = 6 / view.zoom;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2 / view.zoom;
                ctx.setLineDash([4 / view.zoom, 3 / view.zoom]);
                ctx.strokeRect(devBb.x - devPad, devBb.y - devPad, devBb.width + devPad * 2, devBb.height + devPad * 2);
                ctx.setLineDash([]);
              }
            }

            // Cross-highlight linked stroke when a deviation is selected
            const linkedStroke = annotationLinks.find((l) => l.deviationId === selectedElementId);
            if (linkedStroke) {
              const strokeEl = elements.find((e) => e.id === linkedStroke.strokeId);
              if (strokeEl) {
                const strokeBb = getBoundingBox(strokeEl);
                const strokePad = 6 / view.zoom;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2 / view.zoom;
                ctx.setLineDash([4 / view.zoom, 3 / view.zoom]);
                ctx.strokeRect(strokeBb.x - strokePad, strokeBb.y - strokePad, strokeBb.width + strokePad * 2, strokeBb.height + strokePad * 2);
                ctx.setLineDash([]);
              }
            }
          }
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [elements, preview, liveStrokePoints, layers, view, grid, mode, penColor, penSize, penOpacity, colorColor, colorSize, colorOpacity, colorBrush, selectedPlantId, basemap, pendingInput, cadTool, cursorX, cursorY, selectedElementId, annotationLinks]);

  // ── localStorage + IndexedDB persistence ────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const state = { elements, layers, view, grid };
        localStorage.setItem('netrun-cad-state', JSON.stringify(state));
        // Also persist to IndexedDB for offline durability
        cacheProject('current', state).catch(() => { /* IndexedDB unavailable */ });
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

        // Auto-alignment: check if we now have both scan and GIS data
        const hasScan = next.some((el) => el.layerId === 'scan');
        const hasGIS = next.some((el) => el.layerId === 'gis');

        if (hasScan && hasGIS) {
          // Run alignment in next tick to avoid setState during render
          setTimeout(() => {
            const scanPts = extractScanBoundaryPoints(
              next as Array<{ type: string; p1?: import('../../engine/types').Point; p2?: import('../../engine/types').Point; layerId: string }>
            );
            const parcelPts = extractParcelBoundaryPoints(
              next as Array<{ type: string; p1?: import('../../engine/types').Point; p2?: import('../../engine/types').Point; layerId: string }>
            );
            if (scanPts.length > 0 && parcelPts.length > 0) {
              const result = autoAlignScanToGIS(scanPts, parcelPts);
              setAlignment(result);
              const confPct = Math.round(result.confidence * 100);
              setAlignmentNotification(
                `Scan aligned to property (${confPct}% confidence). Click "Adjust" to fine-tune.`
              );
              // Clear notification after 6 seconds
              setTimeout(() => setAlignmentNotification(null), 6000);
            }
          }, 0);
        }

        return next;
      });
    },
    [addLayer]
  );

  // ── Context-aware status bar prompt ─────────────────────────────────────
  const statusPrompt = (() => {
    if (mode !== 'cad') return undefined;
    if (cadTool === 'select') return 'Select a tool to begin drawing (L=Line, R=Rectangle, C=Circle)';
    if (!pendingInput) {
      switch (cadTool) {
        case 'line': return 'Click to set first point';
        case 'rectangle': return 'Click to set first corner';
        case 'circle': return 'Click to set center point';
        case 'dimension': return 'Click first measurement point';
        default: return undefined;
      }
    }
    // Tool has pending input (first point set)
    switch (cadTool) {
      case 'line': return 'Click second point or type length and press Enter';
      case 'rectangle': return 'Click opposite corner or type Width,Height';
      case 'circle': return 'Click to set radius or type radius value';
      case 'dimension':
        if (pendingInput.phase === 1) return 'Click second measurement point';
        if (pendingInput.phase === 2) return 'Move mouse to set offset distance, click to place';
        return undefined;
      default: return undefined;
    }
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  // Command line is visible in CAD mode (not in draw/color — pencil is primary)
  const cmdVisible = true; // always show for keyboard accessibility

  // Canvas position offset based on side panel and handedness
  const canvasLeftOffset = hand === 'left' ? sidePanelWidth : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cad-bg">
      {/* Offline connectivity banner */}
      <OfflineIndicator />
      {/* Top Bar (hideable — double-tap top edge to restore) */}
      {!topBarHidden ? (
        <TopBar
          onOpenMenu={() => setMenuOpen(true)}
          projectName={projectName}
          saveStatus={saveStatusLabel}
          basemapEnabled={basemap.enabled}
          onToggleBasemap={() => setBasemap((b) => ({ ...b, enabled: !b.enabled }))}
          onShowHelp={() => setShowHelp((s) => !s)}
          hand={hand}
          onToggleHand={toggleHand}
        />
      ) : (
        <button
          onClick={() => setTopBarHidden(false)}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-40 min-w-[44px] min-h-[24px]
                     bg-cad-surface/60 backdrop-blur-sm border-b border-cad-accent/50 rounded-b-lg
                     text-cad-dim/40 hover:text-cad-dim text-xs transition-colors px-4"
          title="Show top bar"
        >
          ▼
        </button>
      )}

      {/* Shortcut Bar — opposite side of tool panel */}
      <ShortcutBar
        hand={hand}
        collapsed={shortcutBarCollapsed}
        onToggleCollapse={() => setShortcutBarCollapsed(c => !c)}
        onExecuteAction={executeCommand}
        activeTool={cadTool}
        activeMode={mode}
      />

      {/* Side Panel */}
      <SidePanel
        orientation={orientation}
        hand={hand}
        collapsed={sidePanelCollapsed}
        onToggleCollapse={() => setSidePanelCollapsed((c) => !c)}
        mode={mode}
        setMode={setMode}
        cadTool={cadTool}
        setCadTool={setCadTool}
        cadStrokeColor={cadStrokeColor}
        setCadStrokeColor={setCadStrokeColor}
        cadStrokeWidth={cadStrokeWidth}
        setCadStrokeWidth={setCadStrokeWidth}
        gridEnabled={grid.enabled}
        snapEnabled={grid.snap}
        toggleGrid={toggleGrid}
        toggleSnap={toggleSnap}
        drawBrush={drawBrush}
        setDrawBrush={setDrawBrush}
        penColor={penColor}
        setPenColor={setPenColor}
        penSize={penSize}
        setPenSize={setPenSize}
        penOpacity={penOpacity}
        setPenOpacity={setPenOpacity}
        colorBrush={colorBrush}
        setColorBrush={setColorBrush}
        colorColor={colorColor}
        setColorColor={setColorColor}
        colorSize={colorSize}
        setColorSize={setColorSize}
        colorOpacity={colorOpacity}
        setColorOpacity={setColorOpacity}
        textInput={textInput}
        setTextInput={setTextInput}
        layers={layers}
        activeLayerId={activeLayerId}
        onSelectLayer={setActiveLayerId}
        onToggleVisibility={toggleLayerVisibility}
        onToggleLock={toggleLayerLock}
        onSetOpacity={setLayerOpacity}
        onTogglePlants={() => setShowPlantPanel((s) => !s)}
        onToggleInterior={() => setShowInteriorPanel((s) => !s)}
        onToggleSurvai={() => setShowSurvaiPanel((s) => !s)}
        showPlantPanel={showPlantPanel}
        showInteriorPanel={showInteriorPanel}
        showSurvaiPanel={showSurvaiPanel}
        selectedPlantId={selectedPlantId}
        placingInteriorSymbol={!!placingInteriorSymbol}
      />

      {/* Hamburger Menu */}
      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        hand={hand}
        onToggleHand={toggleHand}
        onNewProject={() => {
          handleNewProject({ name: 'Untitled Project', client: '', address: '', template: 'blank' });
          setProjectNameState('Untitled Project');
        }}
        onOpenProject={() => {
          // Trigger the ProjectBar's open picker via keyboard shortcut simulation
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, metaKey: true }));
        }}
        onSave={() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, metaKey: true }));
        }}
        onSaveAs={() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, metaKey: true, shiftKey: true }));
        }}
        onShare={() => projectBarRef.current?.triggerShare()}
        canShare={projectBarRef.current?.canShare ?? false}
        signedIn={projectBarRef.current?.signedIn ?? false}
        onSignIn={() => projectBarRef.current?.signIn()}
        onSignOut={() => projectBarRef.current?.signOut()}
        onImportDXF={() => dxfFileInputRef.current?.click()}
        onExportDXF={() => executeCommand('file:export')}
        onExportPDF={() => setShowImportExportPDF(true)}
        onImportGIS={() => setShowGISModal(true)}
        onImport3DScan={() => setShowScanModal(true)}
        onImportSurvai={() => setShowSurvaiPanel(true)}
        elementsCount={elements.length}
        basemapEnabled={basemap.enabled}
        onToggleBasemap={() => setBasemap((b) => ({ ...b, enabled: !b.enabled }))}
        onShowBasemapPanel={() => setShowBasemapPanel(true)}
        gridEnabled={grid.enabled}
        snapEnabled={grid.snap}
        onToggleGrid={toggleGrid}
        onToggleSnap={toggleSnap}
        onResetView={resetView}
        onZoomIn={() => setView((v) => ({ ...v, zoom: Math.min(v.zoom * 1.5, 32) }))}
        onZoomOut={() => setView((v) => ({ ...v, zoom: Math.max(v.zoom / 1.5, 0.05) }))}
        onShowHelp={() => setShowHelp(true)}
        onShowProjectFiles={() => setShowProjectFiles(true)}
        onShowRevisionHistory={() => setShowRevisionHistory(true)}
        onClearAll={handleClearCanvas}
        topBarHidden={topBarHidden}
        onToggleTopBar={() => setTopBarHidden(h => !h)}
        statusBarHidden={statusBarHidden}
        onToggleStatusBar={() => setStatusBarHidden(h => !h)}
        cmdLineHidden={cmdLineHidden}
        onToggleCmdLine={() => setCmdLineHidden(h => !h)}
        shortcutBarCollapsed={shortcutBarCollapsed}
        onToggleShortcutBar={() => setShortcutBarCollapsed(c => !c)}
        sidePanelCollapsed={sidePanelCollapsed}
        onToggleSidePanel={() => setSidePanelCollapsed(c => !c)}
        installPrompt={installPrompt}
        onShowDashboard={() => setShowDashboard(true)}
        onShowPricing={() => setShowPricingPage(true)}
        onShowAccount={() => setShowAccountPanel(true)}
      />

      {/* Canvas — positioned to avoid overlapping with side panel and top bar */}
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{
          touchAction: 'none',
          top: `${TOP_BAR_HEIGHT}px`,
          left: `${canvasLeftOffset}px`,
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          cursor: mode === 'cad'
            ? (cadTool === 'select' ? (selectedElementId ? 'move' : 'default') : cadTool === 'move' ? 'grab' : 'crosshair')
            : mode === 'draw' || mode === 'color'
              ? 'default'
              : 'text',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />

      {/* Route tutorial overlay — shown once on first Route mode entry */}
      <div
        className="absolute overflow-hidden pointer-events-none"
        style={{
          top: `${TOP_BAR_HEIGHT}px`,
          left: `${canvasLeftOffset}px`,
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
        }}
      >
        <div className="pointer-events-auto">
          <RouteTutorialOverlay
            isVisible={showRouteTutorial}
            onDismiss={() => setShowRouteTutorial(false)}
          />
        </div>
      </div>

      {/* Hidden ProjectBar (still handles Drive auth + save/open logic, rendered off-screen) */}
      <div className="hidden">
        <ProjectBar
          ref={projectBarRef}
          elements={elements}
          layers={layers}
          grid={grid}
          basemap={basemap}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
        />
      </div>

      {/* Hidden ImportExport (for modal rendering triggered from menu) */}
      <div className="hidden">
        <ImportExport
          elements={elements}
          layers={layers}
          grid={grid}
          onImport={handleImport}
          basemapLat={basemap.centerLat}
          basemapLng={basemap.centerLng}
        />
      </div>

      {/* Basemap Settings Panel */}
      {showBasemapPanel && (
        <BasemapPanel
          basemap={basemap}
          onChange={handleBasemapChange}
          onClose={() => setShowBasemapPanel(false)}
          onParcelImport={handleImport}
        />
      )}

      {/* Plant Browser Overlay */}
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

      {/* Survai cloud scan panel */}
      {showSurvaiPanel && (
        <SurvaiPanel
          onImport={handleImport}
          onClose={() => setShowSurvaiPanel(false)}
        />
      )}

      {/* Project Dashboard */}
      <ProjectDashboard
        isOpen={showDashboard}
        onClose={() => setShowDashboard(false)}
        onOpenProject={(project: ProjectInfo) => {
          // Load project data from localStorage
          const key = `survai_project_${project.id}`;
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const data = JSON.parse(raw);
              if (data.elements) setElements(data.elements);
            }
          } catch {
            // Failed to load — start fresh
          }
          setShowDashboard(false);
        }}
        onNewProject={() => {
          handleNewProject({ name: 'Untitled Project', client: '', address: '', template: 'blank' });
          setProjectNameState('Untitled Project');
        }}
      />

      {/* Blueprint Comparison panel */}
      <BlueprintPanel
        isOpen={showBlueprintPanel}
        onClose={() => setShowBlueprintPanel(false)}
        activeScanId={activeScanId}
        onBlueprintImported={handleBlueprintImported}
        onDeviationsComputed={handleDeviationsComputed}
        onShowPricing={() => setShowPricingPage(true)}
      />

      {/* Interior Panel */}
      {showInteriorPanel && (
        <InteriorPanel
          placingSymbol={placingInteriorSymbol}
          onSelectSymbol={(sym) => {
            setPlacingInteriorSymbol(sym);
            if (sym) setMode('cad');
          }}
          onClose={() => setShowInteriorPanel(false)}
        />
      )}

      {/* Scan-GIS alignment notification */}
      {alignmentNotification && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-40 bg-green-900/90 border border-green-500/50 rounded-lg px-4 py-2 text-green-300 text-xs flex items-center gap-3"
          style={{ bottom: '120px' }}
        >
          <span>{alignmentNotification}</span>
          {alignment && (
            <button
              onClick={() => setShowAlignmentEditor(true)}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition-colors"
            >
              Adjust
            </button>
          )}
          <button
            onClick={() => setAlignmentNotification(null)}
            className="text-green-400/60 hover:text-green-300 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Scan-GIS alignment editor */}
      {showAlignmentEditor && alignment && (
        <AlignmentEditor
          alignment={alignment}
          canvasRef={canvasRef}
          onChange={(updated) => setAlignment(updated)}
          onAccept={(_final) => setShowAlignmentEditor(false)}
          onReset={() => {
            const scanPts = extractScanBoundaryPoints(
              elements as Array<{ type: string; p1?: import('../../engine/types').Point; p2?: import('../../engine/types').Point; layerId: string }>
            );
            const parcelPts = extractParcelBoundaryPoints(
              elements as Array<{ type: string; p1?: import('../../engine/types').Point; p2?: import('../../engine/types').Point; layerId: string }>
            );
            if (scanPts.length > 0 && parcelPts.length > 0) {
              setAlignment(autoAlignScanToGIS(scanPts, parcelPts));
            }
          }}
        />
      )}

      {/* Ortho indicator */}
      {orthoMode && (
        <div
          className="absolute text-xs px-2 py-1 rounded z-20"
          style={{
            top: `${TOP_BAR_HEIGHT + 8}px`,
            left: `${canvasLeftOffset + 8}px`,
            background: '#1a3a1a',
            color: '#4ade80',
            border: '1px solid #4ade80',
          }}
        >
          ORTHO ON
        </div>
      )}

      {/* Keyboard shortcut hint — bottom left above command line */}
      <div
        className="absolute text-[10px] leading-relaxed z-10"
        style={{
          bottom: '108px',
          left: `${canvasLeftOffset + 8}px`,
          color: 'rgba(155,155,175,0.45)',
        }}
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

      {/* Command Line — bottom of canvas area (hideable) */}
      {!cmdLineHidden && (
        <div
          className="absolute left-0 right-0 z-30"
          style={{
            bottom: statusBarHidden ? 0 : '24px',
            marginLeft: `${canvasLeftOffset}px`,
            marginRight: `${hand === 'right' ? sidePanelWidth : 0}px`,
          }}
        >
          <CommandLine
            prompt={cmdPrompt}
            history={cmdHistory}
            visible={cmdVisible}
            focused={cmdFocused}
            onFocusChange={setCmdFocused}
            onExecute={handleCommandExecute}
            onCancel={handleCommandCancel}
            pendingInput={pendingInput}
            onNumericInput={handleNumericInputCmd}
            gridUnit={grid.unit}
          />
        </div>
      )}

      {/* Status Bar — very bottom strip, spans canvas area only (hideable) */}
      {!statusBarHidden && (
        <div
          className="absolute z-20"
          style={{
            bottom: 0,
            left: `${canvasLeftOffset}px`,
            right: `${hand === 'right' ? sidePanelWidth : 0}px`,
          }}
        >
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
            orthoMode={orthoMode}
            prompt={statusPrompt}
            onClearAll={handleClearCanvas}
            onResetView={resetView}
          />
        </div>
      )}

      {/* Inline text editor (double-click to edit) */}
      {editingTextId && editingTextPos && (
        <div
          className="absolute z-50"
          style={{
            left: `${editingTextPos.x}px`,
            top: `${editingTextPos.y}px`,
          }}
        >
          <input
            autoFocus
            type="text"
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitTextEdit();
              } else if (e.key === 'Escape') {
                setEditingTextId(null);
                setEditingTextPos(null);
              }
            }}
            onBlur={commitTextEdit}
            className="bg-gray-900 border border-amber-500 text-white px-2 py-1 text-sm outline-none"
            style={{
              fontFamily: "'Consolas', 'Courier New', monospace",
              minWidth: '120px',
            }}
          />
        </div>
      )}

      {/* Save failure toast — prominent notification for auto-save errors */}
      {saveStatusLabel === 'error' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-900/95 border border-red-500 text-red-100 px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 text-sm animate-pulse">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>Auto-save failed — your work is not saved to Drive. Try saving manually (Ctrl+S).</span>
          <button onClick={() => projectBarRef.current?.save()} className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs font-medium whitespace-nowrap">
            Retry Save
          </button>
        </div>
      )}

      {/* Help Panel */}
      <HelpPanel open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Revision History Panel */}
      <RevisionHistoryPanel
        open={showRevisionHistory}
        onClose={() => setShowRevisionHistory(false)}
        fileId={projectBarRef.current?.currentFileId ?? null}
        signedIn={projectBarRef.current?.signedIn ?? false}
        onRestore={(project) => {
          // Apply the restored project state to the canvas
          if (project.elements) {
            setElements(project.elements);
            setHistoryState(createHistory(project.elements));
          }
          setShowRevisionHistory(false);
        }}
      />

      {/* Project Files Panel (Client Notes + Materials) */}
      <ProjectFilesPanel
        open={showProjectFiles}
        onClose={() => setShowProjectFiles(false)}
        clientName={clientName || undefined}
        signedIn={projectBarRef.current?.signedIn ?? false}
      />

      {/* Pricing Page */}
      <PricingPage
        isOpen={showPricingPage}
        onClose={() => setShowPricingPage(false)}
      />

      {/* Account Panel */}
      <AccountPanel
        isOpen={showAccountPanel}
        onClose={() => setShowAccountPanel(false)}
        user={user}
        onShowPricing={() => setShowPricingPage(true)}
        onSignOut={() => { logout(); }}
      />

      {/* Support Widget */}
      <SupportWidget />

      {/* Welcome Modal — first visit only */}
      <WelcomeModal
        isOpen={showWelcome}
        onClose={() => {
          localStorage.setItem('survai_visited', '1');
          setShowWelcome(false);
        }}
        onStartTrial={() => {
          localStorage.setItem('survai_visited', '1');
          setShowWelcome(false);
          setShowPricingPage(true);
        }}
        onDemo={() => {
          localStorage.setItem('survai_visited', '1');
          setShowWelcome(false);
        }}
        onLoadDemo={(project: DemoProject) => {
          const allElements = [
            ...project.blueprintElements,
            ...project.scanDetections,
            ...project.deviationElements,
          ];
          setElements(allElements);
          setScan3DDetections(project.detection3D);
          setSplitMode('split');
          setActiveScanId('demo-scan');
        }}
        onLoadRecent={(_name: string) => {
          // TODO: wire to ProjectBar open-by-name once Drive API supports it.
          // For now, dismiss the modal — user can open from the project manager.
          localStorage.setItem('survai_visited', '1');
          setShowWelcome(false);
        }}
      />
    </div>
  );
};
