// AutoCAD LT 2014 command registry for netrun-cad-web
// Maps all 88 standard AutoCAD command aliases + Netrun landscape extensions

export interface Command {
  aliases: string[];       // All aliases that trigger this command (lowercase)
  action: string;          // Internal action ID dispatched to executeCommand()
  description: string;     // Help text shown in command line
  requiresPoints?: number; // How many canvas clicks needed (0 or undefined = immediate)
  category: string;        // draw | modify | edit | display | layer | dimension | text | snap | file | landscape
}

// ─── Full AutoCAD LT 2014 alias table ────────────────────────────────────────
// Source: AutoCAD LT 2014 aclt.pgp + standard PGP alias file (88 entries)
export const COMMANDS: Command[] = [

  // ── DRAW ──────────────────────────────────────────────────────────────────
  { aliases: ['l', 'line'],                 action: 'tool:line',        description: 'Draw a line',                  requiresPoints: 2, category: 'draw' },
  { aliases: ['pl', 'pline'],               action: 'tool:polyline',    description: 'Draw a polyline',              requiresPoints: 2, category: 'draw' },
  { aliases: ['rec', 'rect', 'rectangle'],  action: 'tool:rectangle',   description: 'Draw a rectangle',             requiresPoints: 2, category: 'draw' },
  { aliases: ['c', 'circle'],              action: 'tool:circle',       description: 'Draw a circle',                requiresPoints: 2, category: 'draw' },
  { aliases: ['a', 'arc'],                 action: 'tool:arc',          description: 'Draw an arc',                  requiresPoints: 3, category: 'draw' },
  { aliases: ['el', 'ellipse'],            action: 'tool:ellipse',      description: 'Draw an ellipse',              requiresPoints: 2, category: 'draw' },
  { aliases: ['spl', 'spline'],            action: 'tool:spline',       description: 'Draw a spline',                requiresPoints: 2, category: 'draw' },
  { aliases: ['xl', 'xline'],             action: 'tool:xline',         description: 'Draw an infinite construction line', requiresPoints: 2, category: 'draw' },
  { aliases: ['ray'],                      action: 'tool:ray',          description: 'Draw a ray',                   requiresPoints: 2, category: 'draw' },
  { aliases: ['pol', 'polygon'],           action: 'tool:polygon',      description: 'Draw a regular polygon',       requiresPoints: 2, category: 'draw' },
  { aliases: ['do', 'donut'],              action: 'tool:donut',        description: 'Draw a filled circle (donut)', requiresPoints: 1, category: 'draw' },
  { aliases: ['h', 'bh', 'hatch'],        action: 'tool:hatch',         description: 'Draw hatch fill',              requiresPoints: 1, category: 'draw' },
  { aliases: ['bo', 'boundary'],           action: 'tool:boundary',     description: 'Create boundary from points',  requiresPoints: 1, category: 'draw' },
  { aliases: ['reg', 'region'],            action: 'tool:region',       description: 'Create region from objects',   requiresPoints: 0, category: 'draw' },
  { aliases: ['po', 'point'],              action: 'tool:point',        description: 'Place a point',                requiresPoints: 1, category: 'draw' },
  { aliases: ['mline', 'ml'],             action: 'tool:mline',         description: 'Draw multiline',               requiresPoints: 2, category: 'draw' },
  { aliases: ['sketch'],                   action: 'mode:draw',         description: 'Freehand sketch mode',         requiresPoints: 0, category: 'draw' },
  { aliases: ['rev', 'revcloud'],          action: 'tool:revcloud',     description: 'Draw revision cloud',          requiresPoints: 2, category: 'draw' },
  { aliases: ['wipeout'],                  action: 'tool:wipeout',      description: 'Draw wipeout frame',           requiresPoints: 2, category: 'draw' },

  // ── MODIFY ────────────────────────────────────────────────────────────────
  { aliases: ['e', 'del', 'erase'],        action: 'delete',            description: 'Delete selected elements',     requiresPoints: 0, category: 'modify' },
  { aliases: ['m', 'mv', 'move'],          action: 'tool:move',         description: 'Move elements',                requiresPoints: 2, category: 'modify' },
  { aliases: ['co', 'cp', 'copy'],         action: 'tool:copy',         description: 'Copy elements',                requiresPoints: 2, category: 'modify' },
  { aliases: ['ro', 'rotate'],             action: 'tool:rotate',       description: 'Rotate elements',              requiresPoints: 2, category: 'modify' },
  { aliases: ['sc', 'scale'],              action: 'tool:scale',        description: 'Scale elements',               requiresPoints: 2, category: 'modify' },
  { aliases: ['str', 'stretch'],           action: 'tool:stretch',      description: 'Stretch elements',             requiresPoints: 2, category: 'modify' },
  { aliases: ['tr', 'trim'],               action: 'tool:trim',         description: 'Trim elements',                requiresPoints: 0, category: 'modify' },
  { aliases: ['ex', 'extend'],             action: 'tool:extend',       description: 'Extend elements to boundary',  requiresPoints: 0, category: 'modify' },
  { aliases: ['f', 'fillet'],              action: 'tool:fillet',       description: 'Fillet corners',               requiresPoints: 0, category: 'modify' },
  { aliases: ['cha', 'chamfer'],           action: 'tool:chamfer',      description: 'Chamfer corners',              requiresPoints: 0, category: 'modify' },
  { aliases: ['ar', 'array'],              action: 'tool:array',        description: 'Array (rectangular or polar)', requiresPoints: 0, category: 'modify' },
  { aliases: ['mi', 'mirror'],             action: 'tool:mirror',       description: 'Mirror elements',              requiresPoints: 2, category: 'modify' },
  { aliases: ['o', 'offset'],              action: 'tool:offset',       description: 'Offset element',               requiresPoints: 1, category: 'modify' },
  { aliases: ['br', 'break'],              action: 'tool:break',        description: 'Break element at two points',  requiresPoints: 2, category: 'modify' },
  { aliases: ['join', 'j'],               action: 'tool:join',          description: 'Join elements',                requiresPoints: 0, category: 'modify' },
  { aliases: ['len', 'lengthen'],          action: 'tool:lengthen',     description: 'Change element length',        requiresPoints: 0, category: 'modify' },
  { aliases: ['pe', 'pedit'],              action: 'tool:pedit',        description: 'Edit polyline',                requiresPoints: 0, category: 'modify' },
  { aliases: ['ed', 'ddedit'],             action: 'tool:textedit',     description: 'Edit text',                    requiresPoints: 0, category: 'modify' },
  { aliases: ['x', 'explode'],             action: 'tool:explode',      description: 'Explode compound objects',     requiresPoints: 0, category: 'modify' },
  { aliases: ['al', 'align'],              action: 'tool:align',        description: 'Align elements',               requiresPoints: 0, category: 'modify' },

  // ── EDIT ──────────────────────────────────────────────────────────────────
  { aliases: ['u', 'undo'],                action: 'undo',              description: 'Undo last action',             requiresPoints: 0, category: 'edit' },
  { aliases: ['redo'],                     action: 'redo',              description: 'Redo last undone action',      requiresPoints: 0, category: 'edit' },
  { aliases: ['co2', 'copyclip'],         action: 'edit:copy',          description: 'Copy to clipboard',            requiresPoints: 0, category: 'edit' },
  { aliases: ['cu', 'cutclip'],           action: 'edit:cut',           description: 'Cut to clipboard',             requiresPoints: 0, category: 'edit' },
  { aliases: ['pa', 'pasteclip'],         action: 'edit:paste',         description: 'Paste from clipboard',         requiresPoints: 0, category: 'edit' },
  { aliases: ['v', 'select', 'ss'],       action: 'tool:select',        description: 'Select elements',              requiresPoints: 0, category: 'edit' },
  { aliases: ['se', 'selectall'],         action: 'select:all',         description: 'Select all elements',          requiresPoints: 0, category: 'edit' },
  { aliases: ['pr', 'props', 'properties'], action: 'panel:properties', description: 'Open properties panel',       requiresPoints: 0, category: 'edit' },
  { aliases: ['ch', 'change'],            action: 'tool:change',        description: 'Change element properties',    requiresPoints: 0, category: 'edit' },

  // ── DISPLAY / VIEW ────────────────────────────────────────────────────────
  { aliases: ['z', 'zoom'],               action: 'zoom:in',            description: 'Zoom in',                      requiresPoints: 0, category: 'display' },
  { aliases: ['zi'],                       action: 'zoom:in',           description: 'Zoom in',                      requiresPoints: 0, category: 'display' },
  { aliases: ['zo'],                       action: 'zoom:out',          description: 'Zoom out',                     requiresPoints: 0, category: 'display' },
  { aliases: ['za', 'ze', 'zoomall', 'zoomaall'], action: 'zoom:all',  description: 'Zoom to fit all elements',     requiresPoints: 0, category: 'display' },
  { aliases: ['zw', 'zoomwindow'],        action: 'zoom:window',        description: 'Zoom to window',               requiresPoints: 2, category: 'display' },
  { aliases: ['zp', 'zoomprevious'],      action: 'zoom:previous',      description: 'Zoom to previous view',        requiresPoints: 0, category: 'display' },
  { aliases: ['p', 'pan'],               action: 'pan',                 description: 'Pan view',                     requiresPoints: 0, category: 'display' },
  { aliases: ['re', 'regen', 'regenerate'], action: 'view:regen',       description: 'Regenerate display',           requiresPoints: 0, category: 'display' },
  { aliases: ['ortho'],                   action: 'ortho:toggle',       description: 'Toggle ortho mode',            requiresPoints: 0, category: 'display' },

  // ── LAYER ─────────────────────────────────────────────────────────────────
  { aliases: ['la', 'lay', 'layer'],      action: 'layer:dialog',       description: 'Open layer manager',           requiresPoints: 0, category: 'layer' },
  { aliases: ['lm', 'lman'],             action: 'layer:dialog',        description: 'Layer Manager',                requiresPoints: 0, category: 'layer' },
  { aliases: ['lp', 'lprops'],           action: 'panel:properties',    description: 'Layer properties',             requiresPoints: 0, category: 'layer' },

  // ── DIMENSION ─────────────────────────────────────────────────────────────
  { aliases: ['d', 'dim'],               action: 'tool:dimension',      description: 'Enter dimension mode',         requiresPoints: 0, category: 'dimension' },
  { aliases: ['dli', 'dimlinear'],       action: 'tool:dimension',      description: 'Linear dimension',             requiresPoints: 2, category: 'dimension' },
  { aliases: ['dal', 'dimaligned'],      action: 'tool:dim:aligned',    description: 'Aligned dimension',            requiresPoints: 2, category: 'dimension' },
  { aliases: ['dan', 'dimangular'],      action: 'tool:dim:angular',    description: 'Angular dimension',            requiresPoints: 3, category: 'dimension' },
  { aliases: ['dra', 'dimradius'],       action: 'tool:dim:radius',     description: 'Radius dimension',             requiresPoints: 1, category: 'dimension' },
  { aliases: ['ddi', 'dimdiameter'],     action: 'tool:dim:diameter',   description: 'Diameter dimension',           requiresPoints: 1, category: 'dimension' },
  { aliases: ['dco', 'dimcontinue'],     action: 'tool:dim:continue',   description: 'Continue dimension',           requiresPoints: 1, category: 'dimension' },
  { aliases: ['dba', 'dimbaseline'],     action: 'tool:dim:baseline',   description: 'Baseline dimension',           requiresPoints: 1, category: 'dimension' },
  { aliases: ['dle', 'dimleader', 'le', 'leader'], action: 'tool:dim:leader', description: 'Leader / note',        requiresPoints: 2, category: 'dimension' },
  { aliases: ['tol', 'tolerance'],       action: 'tool:dim:tolerance',  description: 'Geometric tolerance',         requiresPoints: 1, category: 'dimension' },
  { aliases: ['dov', 'dimoverride'],     action: 'tool:dim:override',   description: 'Override dimension variable', requiresPoints: 0, category: 'dimension' },

  // ── TEXT ──────────────────────────────────────────────────────────────────
  { aliases: ['t', 'mtext', 'mt'],       action: 'mode:text',           description: 'Multiline text (text mode)',   requiresPoints: 1, category: 'text' },
  { aliases: ['dt', 'dtext', 'text', 'st'], action: 'mode:text',        description: 'Single-line text',            requiresPoints: 1, category: 'text' },
  { aliases: ['st', 'style'],            action: 'text:style',          description: 'Text style manager',          requiresPoints: 0, category: 'text' },
  { aliases: ['sp', 'spell'],            action: 'text:spell',          description: 'Spell check',                 requiresPoints: 0, category: 'text' },
  { aliases: ['find'],                   action: 'text:find',           description: 'Find and replace text',       requiresPoints: 0, category: 'text' },

  // ── SNAP / SETTINGS ───────────────────────────────────────────────────────
  { aliases: ['os', 'osnap'],            action: 'snap:toggle',         description: 'Toggle object snap',          requiresPoints: 0, category: 'snap' },
  { aliases: ['g', 'grid'],             action: 'grid:toggle',          description: 'Toggle grid display',         requiresPoints: 0, category: 'display' },
  { aliases: ['sn', 'snap'],            action: 'snap:toggle',          description: 'Toggle snap',                 requiresPoints: 0, category: 'snap' },
  { aliases: ['orto', 'f8'],            action: 'ortho:toggle',         description: 'Toggle ortho mode',           requiresPoints: 0, category: 'snap' },
  { aliases: ['un', 'units'],           action: 'settings:units',       description: 'Units settings',              requiresPoints: 0, category: 'snap' },
  { aliases: ['limits'],                action: 'settings:limits',      description: 'Drawing limits',              requiresPoints: 0, category: 'snap' },
  { aliases: ['ds', 'ddrmodes', 'dsettings'], action: 'settings:drafting', description: 'Drafting settings',      requiresPoints: 0, category: 'snap' },

  // ── FILE ──────────────────────────────────────────────────────────────────
  { aliases: ['new', 'qnew'],           action: 'file:new',             description: 'New drawing',                 requiresPoints: 0, category: 'file' },
  { aliases: ['open'],                  action: 'file:open',            description: 'Open drawing',                requiresPoints: 0, category: 'file' },
  { aliases: ['save', 'qsave'],         action: 'file:save',            description: 'Save drawing',                requiresPoints: 0, category: 'file' },
  { aliases: ['saveas'],                action: 'file:saveas',          description: 'Save As',                     requiresPoints: 0, category: 'file' },
  { aliases: ['plot', 'print'],         action: 'file:pdf',             description: 'Plot / export PDF',           requiresPoints: 0, category: 'file' },
  { aliases: ['export'],                action: 'file:export',          description: 'Export drawing',              requiresPoints: 0, category: 'file' },
  { aliases: ['import'],                action: 'file:import',          description: 'Import file (DXF/GIS/scan)',  requiresPoints: 0, category: 'file' },
  { aliases: ['close'],                 action: 'file:close',           description: 'Close current drawing',       requiresPoints: 0, category: 'file' },
  { aliases: ['quit', 'exit'],          action: 'file:close',           description: 'Exit (close)',                requiresPoints: 0, category: 'file' },

  // ── BLOCK / INSERT ────────────────────────────────────────────────────────
  { aliases: ['b', 'block'],            action: 'block:define',         description: 'Define block',                requiresPoints: 0, category: 'block' },
  { aliases: ['i', 'insert'],           action: 'block:insert',         description: 'Insert block',                requiresPoints: 1, category: 'block' },
  { aliases: ['w', 'wblock'],           action: 'block:wblock',         description: 'Write block to file',         requiresPoints: 0, category: 'block' },
  { aliases: ['be', 'bedit'],           action: 'block:edit',           description: 'Edit block in place',         requiresPoints: 0, category: 'block' },
  { aliases: ['xr', 'xref'],           action: 'file:xref',             description: 'External reference manager',  requiresPoints: 0, category: 'block' },

  // ── LANDSCAPE (Netrun additions) ──────────────────────────────────────────
  { aliases: ['plant', 'plantdb'],      action: 'panel:plants',         description: 'Open plant database browser', requiresPoints: 0, category: 'landscape' },
  { aliases: ['basemap', 'sat'],        action: 'basemap:toggle',       description: 'Toggle satellite basemap',    requiresPoints: 0, category: 'landscape' },
  { aliases: ['scan'],                  action: 'file:scan',            description: 'Import 3D scan (local file)', requiresPoints: 0, category: 'landscape' },
  { aliases: ['survai', 'cloud'],       action: 'panel:survai',         description: 'Open Survai cloud scans',     requiresPoints: 0, category: 'landscape' },
  { aliases: ['gis'],                   action: 'file:gis',             description: 'Import GIS / GeoJSON data',   requiresPoints: 0, category: 'landscape' },
  { aliases: ['clearall', 'cl'],        action: 'file:clearall',        description: 'Clear all elements',          requiresPoints: 0, category: 'landscape' },
  { aliases: ['help', '?'],            action: 'help',                  description: 'Show command help',           requiresPoints: 0, category: 'file' },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Find a command by exact alias match (case-insensitive) */
export function findCommand(input: string): Command | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  return COMMANDS.find((cmd) => cmd.aliases.includes(key)) ?? null;
}

/**
 * Return all commands whose aliases START WITH the given prefix.
 * Used for tab-completion suggestions.
 */
export function getCompletions(prefix: string): Command[] {
  const key = prefix.trim().toLowerCase();
  if (!key) return [];
  return COMMANDS.filter((cmd) => cmd.aliases.some((a) => a.startsWith(key)));
}

/**
 * Returns the shortest/primary alias for a command action.
 * Used to display the "last command" label.
 */
export function getShortAlias(action: string): string {
  const cmd = COMMANDS.find((c) => c.action === action);
  if (!cmd) return action;
  // Prefer aliases of length ≤ 3, otherwise take the first
  const short = cmd.aliases.find((a) => a.length <= 3);
  return (short ?? cmd.aliases[0]).toUpperCase();
}
