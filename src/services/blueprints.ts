export interface BlueprintUploadResponse {
  id: string;
  scan_id: string;
  filename: string;
  layer_count: number;
  element_count: number;
  detected_systems: string[];
  message: string;
}

export interface DeviationResult {
  id: string;
  deviation_type: string;
  severity: string;
  distance_mm: number;
  detection_id?: string;
  blueprint_element_id?: string;
  planned_type?: string;
  actual_type?: string;
  message: string;
}

export interface DeviationReport {
  scan_id: string;
  blueprint_id: string;
  tolerance_mm: number;
  total_elements: number;
  matches: number;
  position_deviations: number;
  type_mismatches: number;
  missing_in_scan: number;
  extra_in_scan: number;
  pass_rate: number;
  deviations: DeviationResult[];
}
