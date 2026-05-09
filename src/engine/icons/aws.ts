import type { IconData } from '../diagram-icons';
import { VENDOR_COLORS } from '../diagram-icons';

const AWS = VENDOR_COLORS.aws;

/**
 * AWS service glyphs. Hand-crafted single-path SVG icons at 24×24 viewBox.
 * Visually distinctive but not the official AWS brand marks. Drop the official
 * archive into public/icons/aws/ and the loader will override these by id.
 */
export const AWS_ICONS: IconData[] = [
  // ── Compute ─────────────────────────────────────────────────────────────
  {
    id: 'aws.ec2',
    vendor: 'aws',
    label: 'EC2',
    color: AWS,
    // Server with horizontal slats
    path: 'M3 4h18v16H3V4zm2 2v3h14V6H5zm0 5v3h14v-3H5zm0 5v2h14v-2H5zM7 7.25h2v.5H7v-.5zm0 5h2v.5H7v-.5z',
  },
  {
    id: 'aws.lambda',
    vendor: 'aws',
    label: 'Lambda',
    color: AWS,
    // Lightning bolt
    path: 'M13 2L4 14h7l-2 8 9-12h-7l2-8z',
  },
  {
    id: 'aws.ecs',
    vendor: 'aws',
    label: 'ECS / Fargate',
    color: AWS,
    // Container stack (3 boxes)
    path: 'M3 5h6v6H3V5zm0 8h6v6H3v-6zm8 0h6v6h-6v-6zm0-8h6v6h-6V5zm-6 2v2h2V7H5zm0 8v2h2v-2H5zm8 0v2h2v-2h-2zm0-8v2h2V7h-2z',
  },
  {
    id: 'aws.eks',
    vendor: 'aws',
    label: 'EKS (Kubernetes)',
    color: AWS,
    // Heptagon (k8s wheel)
    path: 'M12 2l8 4v8l-3.5 6h-9L4 14V6l8-4zm0 4l-5 2.5v6l2.5 4h5l2.5-4v-6L12 6zm0 3l3 1.5v3.5l-1.5 2.5h-3L9 14v-3.5L12 9z',
  },
  {
    id: 'aws.fargate',
    vendor: 'aws',
    label: 'Fargate',
    color: AWS,
    // Container with rocket fin
    path: 'M5 8l7-4 7 4v8l-7 4-7-4V8zm2 1.2v6l5 2.85V12L7 9.2zm10 0L12 12v6.05l5-2.85v-6z',
  },
  {
    id: 'aws.beanstalk',
    vendor: 'aws',
    label: 'Elastic Beanstalk',
    color: AWS,
    // Sprout / leaves
    path: 'M12 22V11c0-3 1.5-6 6-7-1 4-2.5 6-6 7zm0-3c-3.5-1-5-3-6-7 4.5 1 6 4 6 7z',
  },

  // ── Storage ─────────────────────────────────────────────────────────────
  {
    id: 'aws.s3',
    vendor: 'aws',
    label: 'S3',
    color: AWS,
    // Bucket
    path: 'M5 5h14l-1.5 15h-11L5 5zm2.5 2l1 12h7l1-12h-9z',
  },
  {
    id: 'aws.efs',
    vendor: 'aws',
    label: 'EFS',
    color: AWS,
    // Folder with files
    path: 'M3 6h6l2 2h10v11H3V6zm2 2v9h14v-7h-9.41L7.41 8H5z',
  },
  {
    id: 'aws.glacier',
    vendor: 'aws',
    label: 'S3 Glacier',
    color: AWS,
    // Snowflake
    path: 'M11 2h2v5l3-2 1 1.5L13 9v6l4-2.5 1.5 1L14 16l4 2.5-1.5 1L13 17v5h-2v-5l-3 2-1-1.5L11 15V9l-4 2.5-1-1L10 8 6 5.5l1.5-1L11 7V2z',
  },
  {
    id: 'aws.fsx',
    vendor: 'aws',
    label: 'FSx',
    color: AWS,
    path: 'M4 6h16v3H4V6zm0 5h16v3H4v-3zm0 5h16v3H4v-3zM6 7.25h2v.5H6v-.5zm0 5h2v.5H6v-.5zm0 5h2v.5H6v-.5z',
  },

  // ── Database ────────────────────────────────────────────────────────────
  {
    id: 'aws.rds',
    vendor: 'aws',
    label: 'RDS',
    color: AWS,
    // Cylinder
    path: 'M4 5c0-1.5 3.5-3 8-3s8 1.5 8 3v14c0 1.5-3.5 3-8 3s-8-1.5-8-3V5zm2 0c0 .8 2.7 2 6 2s6-1.2 6-2-2.7-2-6-2-6 1.2-6 2zm0 3v11c0 .8 2.7 2 6 2s6-1.2 6-2V8c-1.5.7-3.7 1-6 1s-4.5-.3-6-1z',
  },
  {
    id: 'aws.dynamodb',
    vendor: 'aws',
    label: 'DynamoDB',
    color: AWS,
    // Stacked layers cylinder
    path: 'M4 5c0-1.5 3.5-3 8-3s8 1.5 8 3-3.5 3-8 3-8-1.5-8-3zm0 4c0 1.5 3.5 3 8 3s8-1.5 8-3v3c0 1.5-3.5 3-8 3s-8-1.5-8-3V9zm0 6c0 1.5 3.5 3 8 3s8-1.5 8-3v3c0 1.5-3.5 3-8 3s-8-1.5-8-3v-3z',
  },
  {
    id: 'aws.aurora',
    vendor: 'aws',
    label: 'Aurora',
    color: AWS,
    // Database with curve overlay
    path: 'M4 5c0-1.5 3.5-3 8-3s8 1.5 8 3v14c0 1.5-3.5 3-8 3s-8-1.5-8-3V5zm2 0c0 .8 2.7 2 6 2s6-1.2 6-2-2.7-2-6-2-6 1.2-6 2zm0 3v3.5c1 1.5 3.3 2.5 6 2.5s5-1 6-2.5V8c-1.5.7-3.7 1-6 1s-4.5-.3-6-1z',
  },
  {
    id: 'aws.redshift',
    vendor: 'aws',
    label: 'Redshift',
    color: AWS,
    // Star burst (warehouse data)
    path: 'M12 2l2 5 5 1-3.5 4 1 5L12 15l-4.5 2 1-5L5 8l5-1z',
  },
  {
    id: 'aws.documentdb',
    vendor: 'aws',
    label: 'DocumentDB',
    color: AWS,
    path: 'M5 3h11l4 4v14H5V3zm2 2v14h11V8h-3V5H7zm9 .5L18.5 8H16V5.5z',
  },

  // ── Networking ──────────────────────────────────────────────────────────
  {
    id: 'aws.cloudfront',
    vendor: 'aws',
    label: 'CloudFront',
    color: AWS,
    // Globe with longitude lines
    path: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 2c-1.5 2-2.5 4.5-2.5 8s1 6 2.5 8c1.5-2 2.5-4.5 2.5-8s-1-6-2.5-8zm-2 .8C7 6 5 9 5 12s2 6 5 7.2c-1-2-1.5-4.5-1.5-7.2s.5-5.2 1.5-7.2zm4 0c1 2 1.5 4.5 1.5 7.2s-.5 5.2-1.5 7.2c3-1.2 5-4.2 5-7.2s-2-6-5-7.2zM4 12h16v1.5H4V12z',
  },
  {
    id: 'aws.route53',
    vendor: 'aws',
    label: 'Route 53',
    color: AWS,
    // Octagonal compass
    path: 'M9 2h6l5 5v10l-5 5H9l-5-5V7l5-5zm.83 2L6 7.83v8.34L9.83 20h4.34L18 16.17V7.83L14.17 4H9.83zM12 7l3 5-3 5-3-5 3-5z',
  },
  {
    id: 'aws.api-gateway',
    vendor: 'aws',
    label: 'API Gateway',
    color: AWS,
    // Gateway arch
    path: 'M3 11C3 6 7 3 12 3s9 3 9 8v9h-3v-9c0-3.5-2.7-6-6-6s-6 2.5-6 6v9H3v-9zm6 3h6v6H9v-6z',
  },
  {
    id: 'aws.alb',
    vendor: 'aws',
    label: 'ALB',
    color: AWS,
    // Diamond with branching arrows
    path: 'M12 2l8 8-8 8-8-8 8-8zm0 3.5L6.5 11h3v3h2v-3h3L12 5.5z',
  },
  {
    id: 'aws.nlb',
    vendor: 'aws',
    label: 'NLB',
    color: AWS,
    // Two stacked diamonds
    path: 'M12 2l5 5-5 5-5-5 5-5zm0 10l5 5-5 5-5-5 5-5z',
  },
  {
    id: 'aws.vpc',
    vendor: 'aws',
    label: 'VPC',
    color: AWS,
    // Hexagon
    path: 'M12 2l8.5 5v10L12 22 3.5 17V7L12 2zm0 2.3L5.5 8.2v7.6L12 19.7l6.5-3.9V8.2L12 4.3z',
  },

  // ── Security & Identity ─────────────────────────────────────────────────
  {
    id: 'aws.iam',
    vendor: 'aws',
    label: 'IAM',
    color: AWS,
    // Shield
    path: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4zm0 2.2L5 7.3V12c0 4 3 7 7 7.9 4-.9 7-3.9 7-7.9V7.3l-7-3.1z',
  },
  {
    id: 'aws.kms',
    vendor: 'aws',
    label: 'KMS',
    color: AWS,
    // Key
    path: 'M14 2a6 6 0 015 9.4l4.6 4.6V20H21v-2h-2v-2h-2v-2h-2.6A6 6 0 1114 2zm0 2a4 4 0 100 8 4 4 0 000-8zm-1 3a1 1 0 110 2 1 1 0 010-2z',
  },
  {
    id: 'aws.secrets-manager',
    vendor: 'aws',
    label: 'Secrets Manager',
    color: AWS,
    // Vault dial
    path: 'M5 4h14v16H5V4zm2 2v12h10V6H7zm5 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  },
  {
    id: 'aws.cognito',
    vendor: 'aws',
    label: 'Cognito',
    color: AWS,
    // User silhouette
    path: 'M12 4a4 4 0 110 8 4 4 0 010-8zm0 10c4.4 0 8 2.7 8 6v2H4v-2c0-3.3 3.6-6 8-6z',
  },
  {
    id: 'aws.waf',
    vendor: 'aws',
    label: 'WAF',
    color: AWS,
    // Brick wall
    path: 'M3 4h18v4H3V4zm0 5h6v3H3V9zm7 0h11v3H10V9zm-7 4h11v3H3v-3zm12 0h6v3h-6v-3zm-12 4h18v3H3v-3z',
  },

  // ── Messaging / Integration ─────────────────────────────────────────────
  {
    id: 'aws.sqs',
    vendor: 'aws',
    label: 'SQS',
    color: AWS,
    // Queue lines with arrow
    path: 'M2 11h12V7l8 5-8 5v-4H2v-2zm2-5h6v2H4V6zm0 10h6v2H4v-2z',
  },
  {
    id: 'aws.sns',
    vendor: 'aws',
    label: 'SNS',
    color: AWS,
    // Megaphone / fan-out
    path: 'M12 2v20l-3-4H3V6h6l3-4zm2 2.5v15l5-3v-9l-5-3z',
  },
  {
    id: 'aws.eventbridge',
    vendor: 'aws',
    label: 'EventBridge',
    color: AWS,
    // Hub with spokes
    path: 'M12 9a3 3 0 110 6 3 3 0 010-6zm0-7v5l-3-3 3-2zm0 17l-3 3 3-2v-1h0v0zm-7-9H2l3-3v6l-3-3zm17 0h3l-3-3v6l3-3z',
  },
  {
    id: 'aws.step-functions',
    vendor: 'aws',
    label: 'Step Functions',
    color: AWS,
    // State machine: 3 connected nodes
    path: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zm0 10h6v6h-6v-6zM4 14h6v6H4v-6zm6-7h4v1h-4V7zm5 4v3h1v-3h-1zm-5 4h4v1h-4v-1z',
  },
  {
    id: 'aws.kinesis',
    vendor: 'aws',
    label: 'Kinesis',
    color: AWS,
    // Streaming waves
    path: 'M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2v2c-2 0-2-2-4-2s-2 2-4 2-2-2-4-2-2 2-4 2-2-2-4-2V8zm0 6c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2v2c-2 0-2-2-4-2s-2 2-4 2-2-2-4-2-2 2-4 2-2-2-4-2v-2z',
  },

  // ── Analytics & AI ──────────────────────────────────────────────────────
  {
    id: 'aws.athena',
    vendor: 'aws',
    label: 'Athena',
    color: AWS,
    // Owl / column query
    path: 'M5 4h2v16H5V4zm4 0h2v10H9V4zm4 0h2v16h-2V4zm4 0h2v8h-2V4z',
  },
  {
    id: 'aws.cloudwatch',
    vendor: 'aws',
    label: 'CloudWatch',
    color: AWS,
    // Eye / monitoring
    path: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 2c4 0 7 3.5 8 5-1 1.5-4 5-8 5s-7-3.5-8-5c1-1.5 4-5 8-5zm0 2a3 3 0 100 6 3 3 0 000-6z',
  },
  {
    id: 'aws.x-ray',
    vendor: 'aws',
    label: 'X-Ray',
    color: AWS,
    // Crosshair / radar
    path: 'M11 2h2v3a7 7 0 016 6h3v2h-3a7 7 0 01-6 6v3h-2v-3a7 7 0 01-6-6H2v-2h3a7 7 0 016-6V2zm1 5a5 5 0 100 10 5 5 0 000-10zm0 3a2 2 0 110 4 2 2 0 010-4z',
  },
  {
    id: 'aws.bedrock',
    vendor: 'aws',
    label: 'Bedrock (AI)',
    color: AWS,
    // Stylized brain / layered foundation
    path: 'M3 12c0-3 3-5 6-5 1 0 2 .3 3 1 1-.7 2-1 3-1 3 0 6 2 6 5 0 1.5-.7 2.7-1.7 3.5 1 .8 1.7 2 1.7 3.5 0 3-3 5-6 5-1 0-2-.3-3-1-1 .7-2 1-3 1-3 0-6-2-6-5 0-1.5.7-2.7 1.7-3.5C3.7 14.7 3 13.5 3 12zm5 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4z',
  },
];
