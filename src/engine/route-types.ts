export type UtilityType = 'electrical' | 'plumbing' | 'hvac' | 'low_voltage';

export interface RoutePoint {
  id: string;
  x: number; // canvas pixels
  y: number;
  type: 'start' | 'waypoint' | 'end' | 'junction';
}

export interface RouteSegment {
  id: string;
  startPointId: string;
  endPointId: string;
  length: number; // feet
  materialId?: string;
}

export interface Route {
  id: string;
  name: string;
  utilityType: UtilityType;
  points: RoutePoint[];
  segments: RouteSegment[];
  totalLength: number;
  estimatedCost?: number;
  status: 'draft' | 'calculated' | 'approved';
}

export interface Material {
  id: string;
  name: string;
  category: string;
  utilityType: UtilityType;
  unit: string;
  pricePerUnit: number;
  specs?: Record<string, string>;
}

export const UTILITY_LAYER_MAP: Record<UtilityType, string> = {
  electrical: 'electrical-route',
  plumbing: 'plumbing-route',
  hvac: 'hvac-route',
  low_voltage: 'low-voltage-route',
};

export const UTILITY_COLORS: Record<UtilityType, string> = {
  electrical: '#f59e0b',
  plumbing: '#3b82f6',
  hvac: '#06b6d4',
  low_voltage: '#8b5cf6',
};
