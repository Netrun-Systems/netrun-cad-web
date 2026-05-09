import type { IconData } from '../diagram-icons';
import { VENDOR_COLORS } from '../diagram-icons';

const AZ = VENDOR_COLORS.azure;

export const AZURE_ICONS: IconData[] = [
  // ── Compute ─────────────────────────────────────────────────────────────
  {
    id: 'azure.vm',
    vendor: 'azure',
    label: 'Virtual Machine',
    color: AZ,
    path: 'M3 4h18v14H3V4zm2 2v10h14V6H5zm0 13h14v2H5v-2z',
  },
  {
    id: 'azure.functions',
    vendor: 'azure',
    label: 'Functions',
    color: AZ,
    // Bolt with f mark
    path: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  },
  {
    id: 'azure.app-service',
    vendor: 'azure',
    label: 'App Service',
    color: AZ,
    // Globe with browser
    path: 'M3 4h18v16H3V4zm2 2v2h14V6H5zm0 4v8h14v-8H5zm2 1h4v4H7v-4zm6 0h4v1h-4v-1zm0 2h4v1h-4v-1z',
  },
  {
    id: 'azure.aks',
    vendor: 'azure',
    label: 'AKS (Kubernetes)',
    color: AZ,
    path: 'M12 2l8 4v8l-3.5 6h-9L4 14V6l8-4zm0 4l-5 2.5v6l2.5 4h5l2.5-4v-6L12 6zm0 3l3 1.5v3.5l-1.5 2.5h-3L9 14v-3.5L12 9z',
  },
  {
    id: 'azure.container-instances',
    vendor: 'azure',
    label: 'Container Instances',
    color: AZ,
    path: 'M3 5h6v6H3V5zm0 8h6v6H3v-6zm8 0h6v6h-6v-6zm0-8h6v6h-6V5zm-6 2v2h2V7H5zm0 8v2h2v-2H5zm8 0v2h2v-2h-2zm0-8v2h2V7h-2z',
  },
  {
    id: 'azure.container-apps',
    vendor: 'azure',
    label: 'Container Apps',
    color: AZ,
    path: 'M5 8l7-4 7 4v8l-7 4-7-4V8zm2 1.2v6l5 2.85V12L7 9.2zm10 0L12 12v6.05l5-2.85v-6z',
  },
  {
    id: 'azure.batch',
    vendor: 'azure',
    label: 'Batch',
    color: AZ,
    // Stack of slabs
    path: 'M3 5h18v3H3V5zm0 5h18v3H3v-3zm0 5h18v3H3v-3z',
  },

  // ── Storage ─────────────────────────────────────────────────────────────
  {
    id: 'azure.blob',
    vendor: 'azure',
    label: 'Blob Storage',
    color: AZ,
    // Bucket
    path: 'M5 5h14l-1.5 15h-11L5 5zm2.5 2l1 12h7l1-12h-9z',
  },
  {
    id: 'azure.files',
    vendor: 'azure',
    label: 'Files',
    color: AZ,
    path: 'M3 6h6l2 2h10v11H3V6zm2 2v9h14v-7h-9.41L7.41 8H5z',
  },
  {
    id: 'azure.queue-storage',
    vendor: 'azure',
    label: 'Queue Storage',
    color: AZ,
    path: 'M2 11h12V7l8 5-8 5v-4H2v-2zm2-5h6v2H4V6zm0 10h6v2H4v-2z',
  },
  {
    id: 'azure.disks',
    vendor: 'azure',
    label: 'Managed Disks',
    color: AZ,
    // Hard disk
    path: 'M4 6h16v12H4V6zm2 2v8h12V8H6zm9 1a3 3 0 110 6 3 3 0 010-6z',
  },

  // ── Database ────────────────────────────────────────────────────────────
  {
    id: 'azure.sql-db',
    vendor: 'azure',
    label: 'SQL Database',
    color: AZ,
    path: 'M4 5c0-1.5 3.5-3 8-3s8 1.5 8 3v14c0 1.5-3.5 3-8 3s-8-1.5-8-3V5zm2 0c0 .8 2.7 2 6 2s6-1.2 6-2-2.7-2-6-2-6 1.2-6 2zm0 3v11c0 .8 2.7 2 6 2s6-1.2 6-2V8c-1.5.7-3.7 1-6 1s-4.5-.3-6-1z',
  },
  {
    id: 'azure.cosmos-db',
    vendor: 'azure',
    label: 'Cosmos DB',
    color: AZ,
    // Globe with rings
    path: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 2c-1.5 0-3 3.5-3 8s1.5 8 3 8 3-3.5 3-8-1.5-8-3-8zM4 12c0-1 3.5-2 8-2s8 1 8 2-3.5 2-8 2-8-1-8-2z',
  },
  {
    id: 'azure.synapse',
    vendor: 'azure',
    label: 'Synapse Analytics',
    color: AZ,
    // Brain / analytics
    path: 'M5 6c0-2 1.5-3 3-3h2v3H8a1 1 0 100 2v2H6c-1 0-1 1 0 1h2v2H6c-2 0-2 3 0 3h4v3H8c-3 0-4-3-3-5-1-1-1-3 0-4-1-1-1-4 0-4zm14 0c0-2-1.5-3-3-3h-2v3h2a1 1 0 110 2v2h2c1 0 1 1 0 1h-2v2h2c2 0 2 3 0 3h-4v3h2c3 0 4-3 3-5 1-1 1-3 0-4 1-1 1-4 0-4z',
  },
  {
    id: 'azure.table-storage',
    vendor: 'azure',
    label: 'Table Storage',
    color: AZ,
    path: 'M4 5h16v3H4V5zm0 4h7v3H4V9zm9 0h7v3h-7V9zM4 13h7v3H4v-3zm9 0h7v3h-7v-3zM4 17h7v3H4v-3zm9 0h7v3h-7v-3z',
  },

  // ── Networking ──────────────────────────────────────────────────────────
  {
    id: 'azure.vnet',
    vendor: 'azure',
    label: 'Virtual Network',
    color: AZ,
    // Hexagon
    path: 'M12 2l8.5 5v10L12 22 3.5 17V7L12 2zm0 2.3L5.5 8.2v7.6L12 19.7l6.5-3.9V8.2L12 4.3z',
  },
  {
    id: 'azure.app-gateway',
    vendor: 'azure',
    label: 'Application Gateway',
    color: AZ,
    path: 'M3 11C3 6 7 3 12 3s9 3 9 8v9h-3v-9c0-3.5-2.7-6-6-6s-6 2.5-6 6v9H3v-9zm6 3h6v6H9v-6z',
  },
  {
    id: 'azure.front-door',
    vendor: 'azure',
    label: 'Front Door',
    color: AZ,
    // Doorway with arrow
    path: 'M5 4h14v16H5V4zm2 2v12h2v-9h6v9h2V6H7zm4 5v7h2v-7h-2z',
  },
  {
    id: 'azure.load-balancer',
    vendor: 'azure',
    label: 'Load Balancer',
    color: AZ,
    path: 'M12 2l8 8-8 8-8-8 8-8zm0 3.5L6.5 11h3v3h2v-3h3L12 5.5z',
  },
  {
    id: 'azure.dns',
    vendor: 'azure',
    label: 'DNS',
    color: AZ,
    // Compass-like
    path: 'M9 2h6l5 5v10l-5 5H9l-5-5V7l5-5zm.83 2L6 7.83v8.34L9.83 20h4.34L18 16.17V7.83L14.17 4H9.83zM12 7l3 5-3 5-3-5 3-5z',
  },
  {
    id: 'azure.cdn',
    vendor: 'azure',
    label: 'CDN',
    color: AZ,
    path: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 2c-1.5 2-2.5 4.5-2.5 8s1 6 2.5 8c1.5-2 2.5-4.5 2.5-8s-1-6-2.5-8zM4 12h16v1.5H4V12z',
  },

  // ── Security & Identity ─────────────────────────────────────────────────
  {
    id: 'azure.aad',
    vendor: 'azure',
    label: 'Active Directory',
    color: AZ,
    // Triangle of users
    path: 'M12 3l9 16H3l9-16zm0 4L6.5 17h11L12 7zm0 3l-3 5h6l-3-5z',
  },
  {
    id: 'azure.key-vault',
    vendor: 'azure',
    label: 'Key Vault',
    color: AZ,
    // Vault dial
    path: 'M5 4h14v16H5V4zm2 2v12h10V6H7zm5 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  },
  {
    id: 'azure.firewall',
    vendor: 'azure',
    label: 'Firewall',
    color: AZ,
    // Brick wall with flame
    path: 'M3 4h18v4H3V4zm0 5h6v3H3V9zm7 0h11v3H10V9zm-7 4h11v3H3v-3zm12 0h6v3h-6v-3zm-12 4h18v3H3v-3z',
  },
  {
    id: 'azure.nsg',
    vendor: 'azure',
    label: 'Network Security Group',
    color: AZ,
    // Shield with hex
    path: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4zm0 5l-5 3v4l5 3 5-3v-4l-5-3z',
  },

  // ── Messaging / Integration ─────────────────────────────────────────────
  {
    id: 'azure.service-bus',
    vendor: 'azure',
    label: 'Service Bus',
    color: AZ,
    path: 'M12 9a3 3 0 110 6 3 3 0 010-6zm0-7v5l-3-3 3-2zm0 17l-3 3 3-2v-1zm-7-9H2l3-3v6l-3-3zm17 0h3l-3-3v6l3-3z',
  },
  {
    id: 'azure.event-grid',
    vendor: 'azure',
    label: 'Event Grid',
    color: AZ,
    // Diamond grid
    path: 'M12 2l5 5-5 5-5-5 5-5zm-7 7l5 5-5 5-5-5 5-5zm14 0l5 5-5 5-5-5 5-5zM12 16l5 5-5 5-5-5 5-5z',
  },
  {
    id: 'azure.event-hubs',
    vendor: 'azure',
    label: 'Event Hubs',
    color: AZ,
    path: 'M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2v2c-2 0-2-2-4-2s-2 2-4 2-2-2-4-2-2 2-4 2-2-2-4-2V8zm0 6c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2v2c-2 0-2-2-4-2s-2 2-4 2-2-2-4-2-2 2-4 2-2-2-4-2v-2z',
  },
  {
    id: 'azure.logic-apps',
    vendor: 'azure',
    label: 'Logic Apps',
    color: AZ,
    // Workflow chain
    path: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zm0 10h6v6h-6v-6zM4 14h6v6H4v-6zm6-7h4v1h-4V7zm5 4v3h1v-3h-1zm-5 4h4v1h-4v-1z',
  },
  {
    id: 'azure.api-management',
    vendor: 'azure',
    label: 'API Management',
    color: AZ,
    path: 'M5 5h14v4H5V5zm0 6h14v4H5v-4zm0 6h14v2H5v-2zM7 6.5h2v1H7v-1zm0 6h2v1H7v-1zm6-6h6v1h-6v-1zm0 6h6v1h-6v-1z',
  },

  // ── Monitoring & AI ─────────────────────────────────────────────────────
  {
    id: 'azure.monitor',
    vendor: 'azure',
    label: 'Monitor / App Insights',
    color: AZ,
    path: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 2c4 0 7 3.5 8 5-1 1.5-4 5-8 5s-7-3.5-8-5c1-1.5 4-5 8-5zm0 2a3 3 0 100 6 3 3 0 000-6z',
  },
  {
    id: 'azure.openai',
    vendor: 'azure',
    label: 'OpenAI Service',
    color: AZ,
    // Hex with brain
    path: 'M12 3l9 5v8l-9 5-9-5V8l9-5zm0 2.3L5 9v6l7 3.7L19 15V9l-7-3.7zM10 9h4v2h-4V9zm-1 3h6v2H9v-2zm1 3h4v2h-4v-2z',
  },
  {
    id: 'azure.static-web-apps',
    vendor: 'azure',
    label: 'Static Web Apps',
    color: AZ,
    // Document with web icon
    path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v2H9V7zm0 4h6v2H9v-2zm0 4h4v2H9v-2z',
  },
];
