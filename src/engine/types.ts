// Core geometry types for the CAD engine

export interface Point {
  x: number;
  y: number;
}

export interface StrokePoint extends Point {
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  timestamp?: number;
}

export type AppMode = 'cad' | 'draw' | 'color' | 'text';

export type CADTool = 'select' | 'line' | 'rectangle' | 'circle' | 'dimension' | 'move';

export type DrawBrush = 'pen' | 'pencil' | 'marker';
export type ColorBrush = 'watercolor' | 'marker' | 'fill';

export interface CADLine {
  type: 'line';
  id: string;
  p1: Point;
  p2: Point;
  layerId: string;
  strokeColor: string;
  strokeWidth: number;
}

export interface CADRectangle {
  type: 'rectangle';
  id: string;
  origin: Point;
  width: number;
  height: number;
  layerId: string;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
}

export interface CADCircle {
  type: 'circle';
  id: string;
  center: Point;
  radius: number;
  layerId: string;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
}

export interface CADDimension {
  type: 'dimension';
  id: string;
  p1: Point;
  p2: Point;
  offset: number;
  layerId: string;
  label?: string;
}

export interface FreehandStroke {
  type: 'freehand';
  id: string;
  points: StrokePoint[];
  layerId: string;
  color: string;
  size: number;
  opacity: number;
  brush: DrawBrush | ColorBrush;
}

export interface TextElement {
  type: 'text';
  id: string;
  position: Point;
  content: string;
  layerId: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
}

export interface PlantPlacement {
  type: 'plant';
  id: string;
  position: Point;
  plantId: string;
  layerId: string;
  scale: number;
  label?: string;
}

export type CADElement =
  | CADLine
  | CADRectangle
  | CADCircle
  | CADDimension
  | FreehandStroke
  | TextElement
  | PlantPlacement;

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string; // Default color for new elements on this layer
  order: number;
}

export interface ViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface GridSettings {
  enabled: boolean;
  size: number; // Grid spacing in pixels at zoom=1
  snap: boolean;
  snapSize: number; // Snap increment
  unit: 'ft' | 'in' | 'cm' | 'm';
  pixelsPerUnit: number; // Scale: how many pixels = 1 unit
}

export interface DrawingState {
  elements: CADElement[];
  layers: Layer[];
  activeLayerId: string;
  gridSettings: GridSettings;
  view: ViewState;
}

export const DEFAULT_LAYERS: Layer[] = [
  { id: 'site', name: 'Site', visible: true, locked: false, opacity: 1, color: '#888888', order: 0 },
  { id: 'hardscape', name: 'Hardscape', visible: true, locked: false, opacity: 1, color: '#a0826d', order: 1 },
  { id: 'planting', name: 'Planting', visible: true, locked: false, opacity: 1, color: '#4caf50', order: 2 },
  { id: 'irrigation', name: 'Irrigation', visible: true, locked: false, opacity: 1, color: '#2196f3', order: 3 },
  { id: 'drawing', name: 'Drawing', visible: true, locked: false, opacity: 1, color: '#333333', order: 4 },
  { id: 'color', name: 'Color', visible: true, locked: false, opacity: 1, color: '#66bb6a', order: 5 },
  { id: 'text', name: 'Text', visible: true, locked: false, opacity: 1, color: '#212121', order: 6 },
];

export const DEFAULT_GRID: GridSettings = {
  enabled: true,
  size: 48,
  snap: true,
  snapSize: 12,
  unit: 'ft',
  pixelsPerUnit: 48,
};
