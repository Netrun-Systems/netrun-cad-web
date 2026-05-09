import type { IconData } from '../diagram-icons';
import { VENDOR_COLORS } from '../diagram-icons';

const G_BLUE = VENDOR_COLORS.gcp;
const G_RED = VENDOR_COLORS.gcp_red;
const G_YELLOW = VENDOR_COLORS.gcp_yellow;
const G_GREEN = VENDOR_COLORS.gcp_green;

export const GCP_ICONS: IconData[] = [
  // ── Compute ─────────────────────────────────────────────────────────────
  {
    id: 'gcp.compute-engine',
    vendor: 'gcp',
    label: 'Compute Engine',
    color: G_BLUE,
    path: 'M3 4h18v14H3V4zm2 2v10h14V6H5zm0 13h14v2H5v-2z',
  },
  {
    id: 'gcp.cloud-functions',
    vendor: 'gcp',
    label: 'Cloud Functions',
    color: G_YELLOW,
    path: 'M13 2L4 14h7l-2 8 9-12h-7l2-8z',
  },
  {
    id: 'gcp.cloud-run',
    vendor: 'gcp',
    label: 'Cloud Run',
    color: G_BLUE,
    // Container with arrow
    path: 'M5 8l7-4 7 4v8l-7 4-7-4V8zm2 1.2v6l5 2.85V12L7 9.2zm10 0L12 12v6.05l5-2.85v-6z',
  },
  {
    id: 'gcp.gke',
    vendor: 'gcp',
    label: 'GKE (Kubernetes)',
    color: G_BLUE,
    path: 'M12 2l8 4v8l-3.5 6h-9L4 14V6l8-4zm0 4l-5 2.5v6l2.5 4h5l2.5-4v-6L12 6zm0 3l3 1.5v3.5l-1.5 2.5h-3L9 14v-3.5L12 9z',
  },
  {
    id: 'gcp.app-engine',
    vendor: 'gcp',
    label: 'App Engine',
    color: G_BLUE,
    // Building with arch
    path: 'M3 19h18v2H3v-2zm2-9l7-6 7 6v8H5v-8zm2 .9V17h10v-6.1l-5-4.3-5 4.3zM10 12h4v5h-4v-5z',
  },

  // ── Storage ─────────────────────────────────────────────────────────────
  {
    id: 'gcp.cloud-storage',
    vendor: 'gcp',
    label: 'Cloud Storage',
    color: G_RED,
    // Bucket
    path: 'M5 5h14l-1.5 15h-11L5 5zm2.5 2l1 12h7l1-12h-9z',
  },
  {
    id: 'gcp.filestore',
    vendor: 'gcp',
    label: 'Filestore',
    color: G_RED,
    path: 'M3 6h6l2 2h10v11H3V6zm2 2v9h14v-7h-9.41L7.41 8H5z',
  },
  {
    id: 'gcp.persistent-disk',
    vendor: 'gcp',
    label: 'Persistent Disk',
    color: G_BLUE,
    path: 'M4 6h16v12H4V6zm2 2v8h12V8H6zm9 1a3 3 0 110 6 3 3 0 010-6z',
  },

  // ── Database ────────────────────────────────────────────────────────────
  {
    id: 'gcp.cloud-sql',
    vendor: 'gcp',
    label: 'Cloud SQL',
    color: G_BLUE,
    path: 'M4 5c0-1.5 3.5-3 8-3s8 1.5 8 3v14c0 1.5-3.5 3-8 3s-8-1.5-8-3V5zm2 0c0 .8 2.7 2 6 2s6-1.2 6-2-2.7-2-6-2-6 1.2-6 2zm0 3v11c0 .8 2.7 2 6 2s6-1.2 6-2V8c-1.5.7-3.7 1-6 1s-4.5-.3-6-1z',
  },
  {
    id: 'gcp.spanner',
    vendor: 'gcp',
    label: 'Spanner',
    color: G_BLUE,
    // Database with global rings
    path: 'M4 5c0-1.5 3.5-3 8-3s8 1.5 8 3v14c0 1.5-3.5 3-8 3s-8-1.5-8-3V5zm2 0c0 .8 2.7 2 6 2s6-1.2 6-2-2.7-2-6-2-6 1.2-6 2zm0 4c0 1 2.7 2 6 2s6-1 6-2v3c0 1-2.7 2-6 2s-6-1-6-2V9zm0 6c0 1 2.7 2 6 2s6-1 6-2v3c0 1-2.7 2-6 2s-6-1-6-2v-3z',
  },
  {
    id: 'gcp.firestore',
    vendor: 'gcp',
    label: 'Firestore',
    color: G_YELLOW,
    // Flame
    path: 'M12 2c0 4-5 6-5 11a5 5 0 1010 0c0-3-2-3-2-7 0-2-1.5-3-3-4zm-1 14a2 2 0 102-3 2 2 0 00-2 3z',
  },
  {
    id: 'gcp.bigtable',
    vendor: 'gcp',
    label: 'Bigtable',
    color: G_BLUE,
    path: 'M4 5h16v3H4V5zm0 4h7v3H4V9zm9 0h7v3h-7V9zM4 13h7v3H4v-3zm9 0h7v3h-7v-3zM4 17h7v3H4v-3zm9 0h7v3h-7v-3z',
  },
  {
    id: 'gcp.bigquery',
    vendor: 'gcp',
    label: 'BigQuery',
    color: G_BLUE,
    // Magnifying glass over data
    path: 'M11 4a7 7 0 014.9 12l4.1 4.1-1.4 1.4L14.5 17.5A7 7 0 1111 4zm0 2a5 5 0 100 10 5 5 0 000-10zm-3 4h2v3H8v-3zm3-2h2v5h-2V8zm3 1h2v4h-2V9z',
  },

  // ── Networking ──────────────────────────────────────────────────────────
  {
    id: 'gcp.vpc',
    vendor: 'gcp',
    label: 'VPC',
    color: G_BLUE,
    path: 'M12 2l8.5 5v10L12 22 3.5 17V7L12 2zm0 2.3L5.5 8.2v7.6L12 19.7l6.5-3.9V8.2L12 4.3z',
  },
  {
    id: 'gcp.cloud-lb',
    vendor: 'gcp',
    label: 'Cloud Load Balancing',
    color: G_BLUE,
    path: 'M12 2l8 8-8 8-8-8 8-8zm0 3.5L6.5 11h3v3h2v-3h3L12 5.5z',
  },
  {
    id: 'gcp.cloud-cdn',
    vendor: 'gcp',
    label: 'Cloud CDN',
    color: G_BLUE,
    path: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 2c-1.5 2-2.5 4.5-2.5 8s1 6 2.5 8c1.5-2 2.5-4.5 2.5-8s-1-6-2.5-8zM4 12h16v1.5H4V12z',
  },
  {
    id: 'gcp.cloud-dns',
    vendor: 'gcp',
    label: 'Cloud DNS',
    color: G_BLUE,
    path: 'M9 2h6l5 5v10l-5 5H9l-5-5V7l5-5zm.83 2L6 7.83v8.34L9.83 20h4.34L18 16.17V7.83L14.17 4H9.83zM12 7l3 5-3 5-3-5 3-5z',
  },
  {
    id: 'gcp.cloud-armor',
    vendor: 'gcp',
    label: 'Cloud Armor',
    color: G_RED,
    // Shield with mark
    path: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4zm0 2.2L5 7.3V12c0 4 3 7 7 7.9 4-.9 7-3.9 7-7.9V7.3l-7-3.1zM10 9h4v2h-4V9zm0 3h4v4h-4v-4z',
  },
  {
    id: 'gcp.cloud-nat',
    vendor: 'gcp',
    label: 'Cloud NAT',
    color: G_GREEN,
    // Two-way arrow router
    path: 'M3 11h6v-3l5 4-5 4v-3H3v-2zm18 2h-6v3l-5-4 5-4v3h6v2z',
  },

  // ── Security & Identity ─────────────────────────────────────────────────
  {
    id: 'gcp.iam',
    vendor: 'gcp',
    label: 'Cloud IAM',
    color: G_BLUE,
    path: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4zm0 2.2L5 7.3V12c0 4 3 7 7 7.9 4-.9 7-3.9 7-7.9V7.3l-7-3.1z',
  },
  {
    id: 'gcp.kms',
    vendor: 'gcp',
    label: 'Cloud KMS',
    color: G_BLUE,
    path: 'M14 2a6 6 0 015 9.4l4.6 4.6V20H21v-2h-2v-2h-2v-2h-2.6A6 6 0 1114 2zm0 2a4 4 0 100 8 4 4 0 000-8zm-1 3a1 1 0 110 2 1 1 0 010-2z',
  },
  {
    id: 'gcp.secret-manager',
    vendor: 'gcp',
    label: 'Secret Manager',
    color: G_BLUE,
    path: 'M5 4h14v16H5V4zm2 2v12h10V6H7zm5 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  },

  // ── Messaging & Workflow ────────────────────────────────────────────────
  {
    id: 'gcp.pubsub',
    vendor: 'gcp',
    label: 'Pub/Sub',
    color: G_BLUE,
    // Megaphone
    path: 'M12 2v20l-3-4H3V6h6l3-4zm2 2.5v15l5-3v-9l-5-3z',
  },
  {
    id: 'gcp.cloud-tasks',
    vendor: 'gcp',
    label: 'Cloud Tasks',
    color: G_BLUE,
    path: 'M2 11h12V7l8 5-8 5v-4H2v-2zm2-5h6v2H4V6zm0 10h6v2H4v-2z',
  },
  {
    id: 'gcp.workflows',
    vendor: 'gcp',
    label: 'Workflows',
    color: G_BLUE,
    path: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zm0 10h6v6h-6v-6zM4 14h6v6H4v-6zm6-7h4v1h-4V7zm5 4v3h1v-3h-1zm-5 4h4v1h-4v-1z',
  },
  {
    id: 'gcp.cloud-build',
    vendor: 'gcp',
    label: 'Cloud Build',
    color: G_BLUE,
    // Hammer/wrench
    path: 'M14 3l7 7-3 3-3-3-7 7-3-3 7-7-3-3 3-3 2 2zm0 9l-1 1 5 5 1-1-5-5z',
  },

  // ── Analytics & AI ──────────────────────────────────────────────────────
  {
    id: 'gcp.dataflow',
    vendor: 'gcp',
    label: 'Dataflow',
    color: G_BLUE,
    // Streaming arrows
    path: 'M3 6h12l3 3-3 3H3V6zm0 8h12l3 3-3 3H3v-6zM5 8v2h8.59L13 9.41V8H5zm0 8v2h8.59L13 17.41V16H5z',
  },
  {
    id: 'gcp.dataproc',
    vendor: 'gcp',
    label: 'Dataproc',
    color: G_BLUE,
    // Spark / hadoop
    path: 'M12 3l4 7h-3v4h-2v-4H8l4-7zm-7 12h2v6H5v-6zm12 0h2v6h-2v-6zm-6 2h2v4h-2v-4z',
  },
  {
    id: 'gcp.vertex-ai',
    vendor: 'gcp',
    label: 'Vertex AI',
    color: G_BLUE,
    // Brain w hex
    path: 'M12 3l9 5v8l-9 5-9-5V8l9-5zm0 2.3L5 9v6l7 3.7L19 15V9l-7-3.7zM10 9h4v2h-4V9zm-1 3h6v2H9v-2zm1 3h4v2h-4v-2z',
  },
  {
    id: 'gcp.cloud-monitoring',
    vendor: 'gcp',
    label: 'Cloud Monitoring',
    color: G_BLUE,
    path: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 2c4 0 7 3.5 8 5-1 1.5-4 5-8 5s-7-3.5-8-5c1-1.5 4-5 8-5zm0 2a3 3 0 100 6 3 3 0 000-6z',
  },
  {
    id: 'gcp.cloud-logging',
    vendor: 'gcp',
    label: 'Cloud Logging',
    color: G_BLUE,
    // Document with lines
    path: 'M5 3h14v18H5V3zm2 2v14h10V5H7zm2 2h6v2H9V7zm0 4h6v2H9v-2zm0 4h4v2H9v-2z',
  },
  {
    id: 'gcp.user',
    vendor: 'gcp',
    label: 'User',
    color: G_BLUE,
    path: 'M12 4a4 4 0 110 8 4 4 0 010-8zm0 10c4.4 0 8 2.7 8 6v2H4v-2c0-3.3 3.6-6 8-6z',
  },
];
