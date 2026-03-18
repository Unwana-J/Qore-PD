import { PackageConfig, ProductLineConfig, ProjectState } from './types';

export const PACKAGES: PackageConfig[] = [
  { name: 'CBA Program', productLines: ['Bankone'], weight: 1.0 },
  { name: 'Digital Banking Program', productLines: ['Bankone', 'Channels'], weight: 1.5 },
  { name: 'Digital Uplift Program', productLines: ['Channels'], weight: 1.2 },
  { name: 'Retail Banking Program', productLines: ['Bankone', 'Channels', 'Recova'], weight: 2.0 },
  { name: 'Distributed Banking Program', productLines: ['Bankone', 'Channels', 'Cluster'], weight: 2.2 },
  { name: 'Digital Transformation Program', productLines: ['Bankone', 'Channels', 'Cluster', 'Recova'], weight: 3.0 },
  { name: 'Lending as a Service', productLines: ['Recova'], weight: 1.0 },
  { name: 'Cluster Program', productLines: ['Cluster'], weight: 1.0 },
];

export const PRODUCT_LINES: ProductLineConfig[] = [
  { name: 'Bankone', services: ['CBA'] },
  { name: 'Channels', services: ['USSD', 'Transfers', 'Mobile', 'Cards', 'APIs'] },
  { name: 'Recova', services: ['CDR', 'CAS', 'Collections and Recovery'] },
  { name: 'Cluster', services: ['Agency', 'Merchant Banking'] },
];

export const PROJECT_STATES: ProjectState[] = [
  'On-Track',
  'Delayed',
  'Suspended',
  'Signed Off',
  'Billed',
  'Closed',
];

