import type { FlowchartShapeKind } from '../engine/types';

export type SymbolLibraryId = 'flowchart' | 'network' | 'aws' | 'azure' | 'gcp';

export interface DiagramSymbol {
  id: string;
  library: SymbolLibraryId;
  label: string;
  description: string;
  shape: FlowchartShapeKind;
  defaultWidth: number;
  defaultHeight: number;
  /** Optional tag — when set, BPMN reading software treats this as a specific element. */
  bpmnRole?: 'task' | 'gateway' | 'event-start' | 'event-end' | 'subprocess' | 'data-object' | 'data-store';
  /** Suggested fill color (overrides palette default for semantic clarity) */
  defaultFill?: string;
  /** Group label within the library (used to cluster in the browser) */
  group?: string;
  /** Optional icon registry key (rendered as overlay glyph on the shape) */
  iconRef?: string;
  /** Override the icon's default color */
  iconColor?: string;
}

// ── Flowchart / BPMN-lite ─────────────────────────────────────────────────────

const FLOWCHART_SYMBOLS: DiagramSymbol[] = [
  { id: 'process',     library: 'flowchart', label: 'Process',     description: 'A task or activity step',          shape: 'rectangle',     defaultWidth: 160, defaultHeight: 80,  bpmnRole: 'task',        defaultFill: '#dbeafe', group: 'Activities' },
  { id: 'subprocess',  library: 'flowchart', label: 'Subprocess',  description: 'Predefined / nested process',      shape: 'rounded',       defaultWidth: 160, defaultHeight: 80,  bpmnRole: 'subprocess',  defaultFill: '#bfdbfe', group: 'Activities' },
  { id: 'decision',    library: 'flowchart', label: 'Decision',    description: 'Branch point — yes/no, true/false', shape: 'diamond',       defaultWidth: 140, defaultHeight: 100, bpmnRole: 'gateway',     defaultFill: '#fef3c7', group: 'Gateways' },
  { id: 'event-start', library: 'flowchart', label: 'Start',       description: 'Process start event',              shape: 'ellipse',       defaultWidth: 100, defaultHeight: 100, bpmnRole: 'event-start', defaultFill: '#dcfce7', group: 'Events' },
  { id: 'event-end',   library: 'flowchart', label: 'End',         description: 'Process end event',                shape: 'ellipse',       defaultWidth: 100, defaultHeight: 100, bpmnRole: 'event-end',   defaultFill: '#fee2e2', group: 'Events' },
  { id: 'data-object', library: 'flowchart', label: 'Data',        description: 'Data input or output',             shape: 'parallelogram', defaultWidth: 140, defaultHeight: 80,  bpmnRole: 'data-object', defaultFill: '#e9d5ff', group: 'Data' },
  { id: 'document',    library: 'flowchart', label: 'Document',    description: 'Printed report or document',       shape: 'rounded',       defaultWidth: 140, defaultHeight: 80,                                  defaultFill: '#fce7f3', group: 'Data' },
  { id: 'data-store',  library: 'flowchart', label: 'Database',    description: 'Persistent data store',            shape: 'cylinder',      defaultWidth: 120, defaultHeight: 100, bpmnRole: 'data-store',  defaultFill: '#cffafe', group: 'Data' },
  { id: 'manual-op',   library: 'flowchart', label: 'Manual Op',   description: 'Manually-performed operation',     shape: 'hexagon',       defaultWidth: 140, defaultHeight: 80,                                  defaultFill: '#fed7aa', group: 'Activities' },
];

// ── Network / IT ──────────────────────────────────────────────────────────────

const NETWORK_SYMBOLS: DiagramSymbol[] = [
  { id: 'router',          library: 'network', label: 'Router',           description: 'Layer-3 routing device',                    shape: 'rounded',   defaultWidth: 140, defaultHeight: 70, defaultFill: '#cffafe', group: 'Network Devices' },
  { id: 'switch',          library: 'network', label: 'Switch',           description: 'Layer-2 LAN switch',                        shape: 'rectangle', defaultWidth: 140, defaultHeight: 60, defaultFill: '#bae6fd', group: 'Network Devices' },
  { id: 'firewall',        library: 'network', label: 'Firewall',         description: 'Perimeter / edge firewall',                 shape: 'hexagon',   defaultWidth: 150, defaultHeight: 80, defaultFill: '#fecaca', group: 'Network Devices' },
  { id: 'load-balancer',   library: 'network', label: 'Load Balancer',    description: 'Distributes traffic across backends',       shape: 'diamond',   defaultWidth: 150, defaultHeight: 100, defaultFill: '#fde68a', group: 'Network Devices' },
  { id: 'wireless-ap',     library: 'network', label: 'Wireless AP',      description: '802.11 access point',                       shape: 'ellipse',   defaultWidth: 130, defaultHeight: 70, defaultFill: '#ddd6fe', group: 'Network Devices' },
  { id: 'nat',             library: 'network', label: 'NAT',              description: 'Network address translator',                shape: 'parallelogram', defaultWidth: 130, defaultHeight: 70, defaultFill: '#fde68a', group: 'Network Devices' },
  { id: 'server',          library: 'network', label: 'Server',           description: 'Physical or virtual server',                shape: 'cylinder',  defaultWidth: 110, defaultHeight: 110, defaultFill: '#e5e7eb', group: 'Endpoints' },
  { id: 'workstation',     library: 'network', label: 'Workstation',      description: 'User desktop / laptop',                     shape: 'rounded',   defaultWidth: 130, defaultHeight: 80, defaultFill: '#f3f4f6', group: 'Endpoints' },
  { id: 'cloud',           library: 'network', label: 'Cloud',            description: 'External cloud / Internet boundary',        shape: 'ellipse',   defaultWidth: 170, defaultHeight: 100, defaultFill: '#e0f2fe', group: 'Boundaries' },
  { id: 'internet',        library: 'network', label: 'Internet',         description: 'The public Internet',                       shape: 'ellipse',   defaultWidth: 170, defaultHeight: 100, defaultFill: '#dbeafe', group: 'Boundaries' },
  { id: 'vpn-gateway',     library: 'network', label: 'VPN Gateway',      description: 'Site-to-site or client VPN endpoint',       shape: 'hexagon',   defaultWidth: 150, defaultHeight: 80, defaultFill: '#a7f3d0', group: 'Boundaries' },
  { id: 'ids-ips',         library: 'network', label: 'IDS / IPS',        description: 'Intrusion detection / prevention',          shape: 'diamond',   defaultWidth: 150, defaultHeight: 100, defaultFill: '#fecaca', group: 'Security' },
];

// ── AWS ───────────────────────────────────────────────────────────────────────

const AWS_FILL = '#fff7ed';
const AWS_STROKE_GROUPS = {
  Compute: 'Compute',
  Storage: 'Storage',
  Database: 'Database',
  Networking: 'Networking',
  Security: 'Security & Identity',
  Messaging: 'Messaging & Integration',
  Analytics: 'Analytics & AI',
};

const AWS_SYMBOLS: DiagramSymbol[] = [
  { id: 'aws-ec2',           library: 'aws', label: 'EC2',              description: 'Elastic Compute Cloud — virtual server',                shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Compute, iconRef: 'aws.ec2' },
  { id: 'aws-lambda',        library: 'aws', label: 'Lambda',           description: 'Serverless function',                                   shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Compute, iconRef: 'aws.lambda' },
  { id: 'aws-ecs',           library: 'aws', label: 'ECS / Fargate',    description: 'Elastic Container Service / Fargate',                   shape: 'rounded',   defaultWidth: 160, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Compute, iconRef: 'aws.ecs' },
  { id: 'aws-fargate',       library: 'aws', label: 'Fargate',          description: 'Serverless compute for containers',                     shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Compute, iconRef: 'aws.fargate' },
  { id: 'aws-eks',           library: 'aws', label: 'EKS',              description: 'Elastic Kubernetes Service',                            shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Compute, iconRef: 'aws.eks' },
  { id: 'aws-beanstalk',     library: 'aws', label: 'Elastic Beanstalk', description: 'Application platform',                                 shape: 'rounded',   defaultWidth: 170, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Compute, iconRef: 'aws.beanstalk' },

  { id: 'aws-s3',            library: 'aws', label: 'S3',               description: 'Simple Storage Service — object storage',               shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Storage, iconRef: 'aws.s3' },
  { id: 'aws-efs',           library: 'aws', label: 'EFS',              description: 'Elastic File System — managed NFS',                     shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Storage, iconRef: 'aws.efs' },
  { id: 'aws-glacier',       library: 'aws', label: 'S3 Glacier',       description: 'Cold archival storage',                                  shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Storage, iconRef: 'aws.glacier' },
  { id: 'aws-fsx',           library: 'aws', label: 'FSx',              description: 'Managed Windows / Lustre / OpenZFS file storage',       shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Storage, iconRef: 'aws.fsx' },

  { id: 'aws-rds',           library: 'aws', label: 'RDS',              description: 'Relational Database Service',                            shape: 'rounded',   defaultWidth: 140, defaultHeight: 100, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Database, iconRef: 'aws.rds' },
  { id: 'aws-dynamodb',      library: 'aws', label: 'DynamoDB',         description: 'Managed NoSQL key-value / document DB',                 shape: 'rounded',   defaultWidth: 150, defaultHeight: 100, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Database, iconRef: 'aws.dynamodb' },
  { id: 'aws-aurora',        library: 'aws', label: 'Aurora',           description: 'Cloud-native relational DB (MySQL / PostgreSQL compat)', shape: 'rounded',   defaultWidth: 140, defaultHeight: 100, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Database, iconRef: 'aws.aurora' },
  { id: 'aws-redshift',      library: 'aws', label: 'Redshift',         description: 'Columnar data warehouse',                               shape: 'rounded',   defaultWidth: 150, defaultHeight: 100, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Database, iconRef: 'aws.redshift' },
  { id: 'aws-documentdb',    library: 'aws', label: 'DocumentDB',       description: 'Managed MongoDB-compatible DB',                         shape: 'rounded',   defaultWidth: 150, defaultHeight: 100, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Database, iconRef: 'aws.documentdb' },

  { id: 'aws-cloudfront',    library: 'aws', label: 'CloudFront',       description: 'Content delivery network',                              shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Networking, iconRef: 'aws.cloudfront' },
  { id: 'aws-route53',       library: 'aws', label: 'Route 53',         description: 'DNS and traffic routing',                               shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Networking, iconRef: 'aws.route53' },
  { id: 'aws-api-gateway',   library: 'aws', label: 'API Gateway',      description: 'HTTP / REST / WebSocket gateway',                       shape: 'rounded',   defaultWidth: 160, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Networking, iconRef: 'aws.api-gateway' },
  { id: 'aws-alb',           library: 'aws', label: 'ALB',              description: 'Application Load Balancer (HTTP/HTTPS)',                shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Networking, iconRef: 'aws.alb' },
  { id: 'aws-nlb',           library: 'aws', label: 'NLB',              description: 'Network Load Balancer (TCP/UDP)',                       shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Networking, iconRef: 'aws.nlb' },
  { id: 'aws-vpc',           library: 'aws', label: 'VPC',              description: 'Virtual Private Cloud',                                  shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Networking, iconRef: 'aws.vpc' },

  { id: 'aws-iam',           library: 'aws', label: 'IAM',              description: 'Identity and Access Management',                        shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Security, iconRef: 'aws.iam' },
  { id: 'aws-kms',           library: 'aws', label: 'KMS',              description: 'Key Management Service',                                shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Security, iconRef: 'aws.kms' },
  { id: 'aws-secrets',       library: 'aws', label: 'Secrets Manager',  description: 'Secrets storage and rotation',                          shape: 'rounded',   defaultWidth: 160, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Security, iconRef: 'aws.secrets-manager' },
  { id: 'aws-cognito',       library: 'aws', label: 'Cognito',          description: 'User authentication and identity pools',                shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Security, iconRef: 'aws.cognito' },
  { id: 'aws-waf',           library: 'aws', label: 'WAF',              description: 'Web Application Firewall',                              shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Security, iconRef: 'aws.waf' },

  { id: 'aws-sqs',           library: 'aws', label: 'SQS',              description: 'Simple Queue Service',                                  shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Messaging, iconRef: 'aws.sqs' },
  { id: 'aws-sns',           library: 'aws', label: 'SNS',              description: 'Simple Notification Service — pub/sub',                 shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Messaging, iconRef: 'aws.sns' },
  { id: 'aws-eventbridge',   library: 'aws', label: 'EventBridge',      description: 'Event bus / event-driven integration',                  shape: 'rounded',   defaultWidth: 160, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Messaging, iconRef: 'aws.eventbridge' },
  { id: 'aws-step',          library: 'aws', label: 'Step Functions',   description: 'Orchestrated workflows / state machines',               shape: 'rounded',   defaultWidth: 160, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Messaging, iconRef: 'aws.step-functions' },
  { id: 'aws-kinesis',       library: 'aws', label: 'Kinesis',          description: 'Real-time data streaming',                              shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Messaging, iconRef: 'aws.kinesis' },

  { id: 'aws-athena',        library: 'aws', label: 'Athena',           description: 'Serverless SQL on S3',                                  shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Analytics, iconRef: 'aws.athena' },
  { id: 'aws-cloudwatch',    library: 'aws', label: 'CloudWatch',       description: 'Metrics, logs, and monitoring',                         shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Analytics, iconRef: 'aws.cloudwatch' },
  { id: 'aws-xray',          library: 'aws', label: 'X-Ray',            description: 'Distributed tracing',                                    shape: 'rounded',   defaultWidth: 140, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Analytics, iconRef: 'aws.x-ray' },
  { id: 'aws-bedrock',       library: 'aws', label: 'Bedrock',          description: 'Foundation models / generative AI',                      shape: 'rounded',   defaultWidth: 150, defaultHeight: 90, defaultFill: AWS_FILL, group: AWS_STROKE_GROUPS.Analytics, iconRef: 'aws.bedrock' },
];

// ── Azure ─────────────────────────────────────────────────────────────────────

const AZURE_FILL = '#eff6ff';
const AZ_GROUPS = {
  Compute: 'Compute',
  Storage: 'Storage',
  Database: 'Database',
  Networking: 'Networking',
  Security: 'Security & Identity',
  Messaging: 'Messaging & Integration',
  Monitoring: 'Monitoring & AI',
};

const AZURE_SYMBOLS: DiagramSymbol[] = [
  { id: 'az-vm',                 library: 'azure', label: 'Virtual Machine',     description: 'Azure VM compute',                                    shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.vm' },
  { id: 'az-functions',          library: 'azure', label: 'Functions',           description: 'Serverless functions',                                shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.functions' },
  { id: 'az-app-service',        library: 'azure', label: 'App Service',         description: 'Managed web app platform',                            shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.app-service' },
  { id: 'az-aks',                library: 'azure', label: 'AKS',                 description: 'Azure Kubernetes Service',                            shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.aks' },
  { id: 'az-aci',                library: 'azure', label: 'Container Instances', description: 'Single-container compute',                            shape: 'rounded', defaultWidth: 170, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.container-instances' },
  { id: 'az-container-apps',     library: 'azure', label: 'Container Apps',      description: 'Microservices on Kubernetes',                         shape: 'rounded', defaultWidth: 160, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.container-apps' },
  { id: 'az-batch',              library: 'azure', label: 'Batch',               description: 'Large-scale parallel and HPC compute',                shape: 'rounded', defaultWidth: 130, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Compute, iconRef: 'azure.batch' },

  { id: 'az-blob',               library: 'azure', label: 'Blob Storage',        description: 'Object storage',                                       shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Storage, iconRef: 'azure.blob' },
  { id: 'az-files',              library: 'azure', label: 'Files',               description: 'Managed SMB / NFS file shares',                        shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Storage, iconRef: 'azure.files' },
  { id: 'az-queue',              library: 'azure', label: 'Queue Storage',       description: 'Message queue storage',                                shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Storage, iconRef: 'azure.queue-storage' },
  { id: 'az-disks',              library: 'azure', label: 'Managed Disks',       description: 'Block storage for VMs',                                shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Storage, iconRef: 'azure.disks' },

  { id: 'az-sql-db',             library: 'azure', label: 'SQL Database',        description: 'Managed SQL Server',                                   shape: 'rounded', defaultWidth: 150, defaultHeight: 100, defaultFill: AZURE_FILL, group: AZ_GROUPS.Database, iconRef: 'azure.sql-db' },
  { id: 'az-cosmos',             library: 'azure', label: 'Cosmos DB',           description: 'Globally distributed multi-model DB',                  shape: 'rounded', defaultWidth: 150, defaultHeight: 100, defaultFill: AZURE_FILL, group: AZ_GROUPS.Database, iconRef: 'azure.cosmos-db' },
  { id: 'az-synapse',            library: 'azure', label: 'Synapse Analytics',   description: 'Data warehouse / analytics platform',                  shape: 'rounded', defaultWidth: 170, defaultHeight: 100, defaultFill: AZURE_FILL, group: AZ_GROUPS.Database, iconRef: 'azure.synapse' },
  { id: 'az-table',              library: 'azure', label: 'Table Storage',       description: 'NoSQL key-attribute table store',                      shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Database, iconRef: 'azure.table-storage' },

  { id: 'az-vnet',               library: 'azure', label: 'Virtual Network',     description: 'VNet — isolated network',                              shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Networking, iconRef: 'azure.vnet' },
  { id: 'az-app-gateway',        library: 'azure', label: 'Application Gateway', description: 'Web traffic load balancer (L7)',                       shape: 'rounded', defaultWidth: 170, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Networking, iconRef: 'azure.app-gateway' },
  { id: 'az-front-door',         library: 'azure', label: 'Front Door',          description: 'Global HTTP load balancer + WAF',                      shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Networking, iconRef: 'azure.front-door' },
  { id: 'az-load-balancer',      library: 'azure', label: 'Load Balancer',       description: 'Layer-4 load balancer',                                shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Networking, iconRef: 'azure.load-balancer' },
  { id: 'az-dns',                library: 'azure', label: 'DNS',                 description: 'Managed DNS service',                                  shape: 'rounded', defaultWidth: 130, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Networking, iconRef: 'azure.dns' },
  { id: 'az-cdn',                library: 'azure', label: 'CDN',                 description: 'Content delivery network',                             shape: 'rounded', defaultWidth: 130, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Networking, iconRef: 'azure.cdn' },

  { id: 'az-aad',                library: 'azure', label: 'Active Directory',    description: 'Azure AD / Entra ID',                                  shape: 'rounded', defaultWidth: 160, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Security, iconRef: 'azure.aad' },
  { id: 'az-key-vault',          library: 'azure', label: 'Key Vault',           description: 'Keys, secrets, certificates',                          shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Security, iconRef: 'azure.key-vault' },
  { id: 'az-firewall',           library: 'azure', label: 'Firewall',            description: 'Stateful network firewall',                            shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Security, iconRef: 'azure.firewall' },
  { id: 'az-nsg',                library: 'azure', label: 'NSG',                 description: 'Network Security Group',                               shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Security, iconRef: 'azure.nsg' },

  { id: 'az-service-bus',        library: 'azure', label: 'Service Bus',         description: 'Enterprise messaging',                                 shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Messaging, iconRef: 'azure.service-bus' },
  { id: 'az-event-grid',         library: 'azure', label: 'Event Grid',          description: 'Event routing for reactive apps',                      shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Messaging, iconRef: 'azure.event-grid' },
  { id: 'az-event-hubs',         library: 'azure', label: 'Event Hubs',          description: 'Big data streaming ingest',                            shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Messaging, iconRef: 'azure.event-hubs' },
  { id: 'az-logic-apps',         library: 'azure', label: 'Logic Apps',          description: 'Workflow automation',                                  shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Messaging, iconRef: 'azure.logic-apps' },
  { id: 'az-api-management',     library: 'azure', label: 'API Management',      description: 'API gateway + developer portal',                       shape: 'rounded', defaultWidth: 170, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Messaging, iconRef: 'azure.api-management' },

  { id: 'az-monitor',            library: 'azure', label: 'Monitor',             description: 'Metrics, logs, App Insights',                          shape: 'rounded', defaultWidth: 130, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Monitoring, iconRef: 'azure.monitor' },
  { id: 'az-openai',             library: 'azure', label: 'OpenAI Service',      description: 'GPT models on Azure',                                  shape: 'rounded', defaultWidth: 160, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Monitoring, iconRef: 'azure.openai' },
  { id: 'az-static-web-apps',    library: 'azure', label: 'Static Web Apps',     description: 'Static sites + APIs',                                  shape: 'rounded', defaultWidth: 170, defaultHeight: 90,  defaultFill: AZURE_FILL, group: AZ_GROUPS.Monitoring, iconRef: 'azure.static-web-apps' },
];

// ── GCP ───────────────────────────────────────────────────────────────────────

const GCP_FILL = '#f0f9ff';
const GCP_GROUPS = {
  Compute: 'Compute',
  Storage: 'Storage',
  Database: 'Database',
  Networking: 'Networking',
  Security: 'Security & Identity',
  Messaging: 'Messaging & Workflow',
  Analytics: 'Analytics & AI',
};

const GCP_SYMBOLS: DiagramSymbol[] = [
  { id: 'gcp-compute',       library: 'gcp', label: 'Compute Engine',  description: 'VMs',                                                  shape: 'rounded', defaultWidth: 160, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Compute, iconRef: 'gcp.compute-engine' },
  { id: 'gcp-functions',     library: 'gcp', label: 'Cloud Functions', description: 'Serverless functions',                                 shape: 'rounded', defaultWidth: 160, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Compute, iconRef: 'gcp.cloud-functions' },
  { id: 'gcp-run',           library: 'gcp', label: 'Cloud Run',       description: 'Serverless containers',                                shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Compute, iconRef: 'gcp.cloud-run' },
  { id: 'gcp-gke',           library: 'gcp', label: 'GKE',             description: 'Google Kubernetes Engine',                             shape: 'rounded', defaultWidth: 130, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Compute, iconRef: 'gcp.gke' },
  { id: 'gcp-app-engine',    library: 'gcp', label: 'App Engine',      description: 'Managed application platform',                         shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Compute, iconRef: 'gcp.app-engine' },

  { id: 'gcp-storage',       library: 'gcp', label: 'Cloud Storage',   description: 'Object storage buckets',                               shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Storage, iconRef: 'gcp.cloud-storage' },
  { id: 'gcp-filestore',     library: 'gcp', label: 'Filestore',       description: 'Managed NFS file storage',                             shape: 'rounded', defaultWidth: 130, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Storage, iconRef: 'gcp.filestore' },
  { id: 'gcp-pd',            library: 'gcp', label: 'Persistent Disk', description: 'Block storage for VMs',                                shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Storage, iconRef: 'gcp.persistent-disk' },

  { id: 'gcp-sql',           library: 'gcp', label: 'Cloud SQL',       description: 'Managed MySQL / PostgreSQL / SQL Server',              shape: 'rounded', defaultWidth: 150, defaultHeight: 100, defaultFill: GCP_FILL, group: GCP_GROUPS.Database, iconRef: 'gcp.cloud-sql' },
  { id: 'gcp-spanner',       library: 'gcp', label: 'Spanner',         description: 'Globally distributed strongly-consistent SQL',         shape: 'rounded', defaultWidth: 140, defaultHeight: 100, defaultFill: GCP_FILL, group: GCP_GROUPS.Database, iconRef: 'gcp.spanner' },
  { id: 'gcp-firestore',     library: 'gcp', label: 'Firestore',       description: 'Document database',                                    shape: 'rounded', defaultWidth: 140, defaultHeight: 100, defaultFill: GCP_FILL, group: GCP_GROUPS.Database, iconRef: 'gcp.firestore' },
  { id: 'gcp-bigtable',      library: 'gcp', label: 'Bigtable',        description: 'Wide-column NoSQL DB',                                 shape: 'rounded', defaultWidth: 140, defaultHeight: 100, defaultFill: GCP_FILL, group: GCP_GROUPS.Database, iconRef: 'gcp.bigtable' },
  { id: 'gcp-bigquery',      library: 'gcp', label: 'BigQuery',        description: 'Serverless data warehouse',                            shape: 'rounded', defaultWidth: 140, defaultHeight: 100, defaultFill: GCP_FILL, group: GCP_GROUPS.Database, iconRef: 'gcp.bigquery' },

  { id: 'gcp-vpc',           library: 'gcp', label: 'VPC',             description: 'Virtual Private Cloud',                                shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Networking, iconRef: 'gcp.vpc' },
  { id: 'gcp-lb',            library: 'gcp', label: 'Cloud LB',        description: 'Cloud Load Balancing',                                 shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Networking, iconRef: 'gcp.cloud-lb' },
  { id: 'gcp-cdn',           library: 'gcp', label: 'Cloud CDN',       description: 'Edge cache',                                           shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Networking, iconRef: 'gcp.cloud-cdn' },
  { id: 'gcp-dns',           library: 'gcp', label: 'Cloud DNS',       description: 'Managed DNS',                                          shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Networking, iconRef: 'gcp.cloud-dns' },
  { id: 'gcp-armor',         library: 'gcp', label: 'Cloud Armor',     description: 'Edge WAF / DDoS',                                      shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Networking, iconRef: 'gcp.cloud-armor' },
  { id: 'gcp-nat',           library: 'gcp', label: 'Cloud NAT',       description: 'Outbound NAT for private instances',                   shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Networking, iconRef: 'gcp.cloud-nat' },

  { id: 'gcp-iam',           library: 'gcp', label: 'Cloud IAM',       description: 'Identity and access',                                  shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Security, iconRef: 'gcp.iam' },
  { id: 'gcp-kms',           library: 'gcp', label: 'Cloud KMS',       description: 'Key Management Service',                               shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Security, iconRef: 'gcp.kms' },
  { id: 'gcp-secret-mgr',    library: 'gcp', label: 'Secret Manager',  description: 'Secret storage',                                       shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Security, iconRef: 'gcp.secret-manager' },

  { id: 'gcp-pubsub',        library: 'gcp', label: 'Pub/Sub',         description: 'Async messaging',                                      shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Messaging, iconRef: 'gcp.pubsub' },
  { id: 'gcp-tasks',         library: 'gcp', label: 'Cloud Tasks',     description: 'Async task queue',                                     shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Messaging, iconRef: 'gcp.cloud-tasks' },
  { id: 'gcp-workflows',     library: 'gcp', label: 'Workflows',       description: 'Service orchestration',                                shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Messaging, iconRef: 'gcp.workflows' },
  { id: 'gcp-build',         library: 'gcp', label: 'Cloud Build',     description: 'Continuous integration',                               shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Messaging, iconRef: 'gcp.cloud-build' },

  { id: 'gcp-dataflow',      library: 'gcp', label: 'Dataflow',        description: 'Stream / batch data processing',                       shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Analytics, iconRef: 'gcp.dataflow' },
  { id: 'gcp-dataproc',      library: 'gcp', label: 'Dataproc',        description: 'Managed Spark / Hadoop',                               shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Analytics, iconRef: 'gcp.dataproc' },
  { id: 'gcp-vertex',        library: 'gcp', label: 'Vertex AI',       description: 'ML platform / model training and serving',             shape: 'rounded', defaultWidth: 140, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Analytics, iconRef: 'gcp.vertex-ai' },
  { id: 'gcp-monitoring',    library: 'gcp', label: 'Cloud Monitoring', description: 'Metrics and dashboards',                              shape: 'rounded', defaultWidth: 170, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Analytics, iconRef: 'gcp.cloud-monitoring' },
  { id: 'gcp-logging',       library: 'gcp', label: 'Cloud Logging',   description: 'Centralized log aggregation',                          shape: 'rounded', defaultWidth: 150, defaultHeight: 90,  defaultFill: GCP_FILL, group: GCP_GROUPS.Analytics, iconRef: 'gcp.cloud-logging' },
];

// ── Public registry ───────────────────────────────────────────────────────────

export const SYMBOL_LIBRARIES: { id: SymbolLibraryId; label: string; description: string; symbols: DiagramSymbol[] }[] = [
  { id: 'flowchart', label: 'Flowchart',    description: 'BPMN-lite process flow shapes',                               symbols: FLOWCHART_SYMBOLS },
  { id: 'network',   label: 'Network',      description: 'Network and infrastructure devices',                          symbols: NETWORK_SYMBOLS },
  { id: 'aws',       label: 'AWS',          description: 'Amazon Web Services',                                          symbols: AWS_SYMBOLS },
  { id: 'azure',     label: 'Azure',        description: 'Microsoft Azure',                                              symbols: AZURE_SYMBOLS },
  { id: 'gcp',       label: 'GCP',          description: 'Google Cloud Platform',                                        symbols: GCP_SYMBOLS },
];

/** Backwards-compatible flat list — used by anything that was importing DIAGRAM_SYMBOLS before libraries existed. */
export const DIAGRAM_SYMBOLS: DiagramSymbol[] = SYMBOL_LIBRARIES.flatMap((lib) => lib.symbols);

export function findDiagramSymbol(id: string): DiagramSymbol | undefined {
  return DIAGRAM_SYMBOLS.find((s) => s.id === id);
}

export function getSymbolLibrary(id: SymbolLibraryId): DiagramSymbol[] {
  return SYMBOL_LIBRARIES.find((lib) => lib.id === id)?.symbols ?? [];
}
