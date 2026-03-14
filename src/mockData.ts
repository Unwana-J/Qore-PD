import { Project, User, AuditLog, AppConfig, WeightHistory } from './types';
import { subDays, format } from 'date-fns';

const now = new Date();

export const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    clientName: 'Global Trust Bank',
    packageName: 'Digital Transformation Program',
    services: ['Core Banking Application (CBA)', 'USSD', 'Mobile Banking', 'Agency Banking', 'Collections & Recovery'],
    productLines: ['Bankone', 'Channels', 'Cluster', 'Recova'],
    assignedPM: 'Sarah Jenkins',
    startDate: format(subDays(now, 45), 'yyyy-MM-dd'),
    value: 250000,
    state: 'Active',
    createdAt: format(subDays(now, 50), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(subDays(now, 40), 'yyyy-MM-dd'), completionDate: format(subDays(now, 42), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm2', name: 'Pre-requisites', targetDate: format(subDays(now, 20), 'yyyy-MM-dd'), completionDate: format(subDays(now, 18), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm3', name: 'Implementation', targetDate: format(now, 'yyyy-MM-dd'), status: 'In Progress' },
      { id: 'm4', name: 'Sign Off', targetDate: format(subDays(now, -30), 'yyyy-MM-dd'), status: 'Pending' },
    ],
    comments: [
      { id: 'c1', author: 'Sarah Jenkins', text: 'Client requested additional USSD flows.', timestamp: format(subDays(now, 5), 'yyyy-MM-dd HH:mm') }
    ],
    risks: [
      { id: 'r1', description: 'Delayed API documentation from client', impact: 'Medium', status: 'Open', createdAt: format(subDays(now, 10), 'yyyy-MM-dd') }
    ]
  },
  {
    id: '2',
    clientName: 'Apex Microfinance',
    packageName: 'CBA Program',
    services: ['Core Banking Application (CBA)'],
    productLines: ['Bankone'],
    assignedPM: 'Michael Chen',
    startDate: format(subDays(now, 10), 'yyyy-MM-dd'),
    value: 85000,
    state: 'Delayed',
    createdAt: format(subDays(now, 15), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(subDays(now, 5), 'yyyy-MM-dd'), status: 'In Progress' },
      { id: 'm2', name: 'Pre-requisites', targetDate: format(subDays(now, -10), 'yyyy-MM-dd'), status: 'Pending' },
    ],
    comments: [],
    risks: [
      { id: 'r2', description: 'Server infrastructure not ready', impact: 'High', status: 'Open', createdAt: format(subDays(now, 2), 'yyyy-MM-dd') }
    ]
  },
  {
    id: '3',
    clientName: 'Zenith Connect',
    packageName: 'Digital Uplift Program',
    services: ['USSD', 'Mobile Banking', 'APIs'],
    productLines: ['Channels'],
    assignedPM: 'Sarah Jenkins',
    startDate: format(subDays(now, 60), 'yyyy-MM-dd'),
    value: 120000,
    state: 'Billed',
    createdAt: format(subDays(now, 65), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(subDays(now, 55), 'yyyy-MM-dd'), completionDate: format(subDays(now, 56), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm2', name: 'Pre-requisites', targetDate: format(subDays(now, 45), 'yyyy-MM-dd'), completionDate: format(subDays(now, 44), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm3', name: 'Implementation', targetDate: format(subDays(now, 15), 'yyyy-MM-dd'), completionDate: format(subDays(now, 10), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm4', name: 'Sign Off', targetDate: format(subDays(now, 5), 'yyyy-MM-dd'), completionDate: format(subDays(now, 2), 'yyyy-MM-dd'), status: 'Completed' },
    ],
    comments: [],
    risks: []
  },
  {
    id: '4',
    clientName: 'Recova Solutions',
    packageName: 'Lending as a Service',
    services: ['Collections & Recovery'],
    productLines: ['Recova'],
    assignedPM: 'David Okoro',
    startDate: format(subDays(now, 5), 'yyyy-MM-dd'),
    value: 45000,
    state: 'Active',
    createdAt: format(subDays(now, 10), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(now, 'yyyy-MM-dd'), status: 'In Progress' },
    ],
    comments: [],
    risks: []
  },
  {
    id: '5',
    clientName: 'First City Bank',
    packageName: 'Retail Banking Program',
    services: ['Core Banking Application (CBA)', 'Cards', 'CAS'],
    productLines: ['Bankone', 'Channels', 'Recova'],
    assignedPM: 'Michael Chen',
    startDate: format(subDays(now, 90), 'yyyy-MM-dd'),
    value: 180000,
    state: 'Closed',
    createdAt: format(subDays(now, 95), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(subDays(now, 85), 'yyyy-MM-dd'), completionDate: format(subDays(now, 86), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm4', name: 'Sign Off', targetDate: format(subDays(now, 10), 'yyyy-MM-dd'), completionDate: format(subDays(now, 5), 'yyyy-MM-dd'), status: 'Completed' },
    ],
    comments: [],
    risks: []
  }
];
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Sarah Jenkins', email: 'sarah.j@qore.com', role: 'PM', status: 'Active', avatar: 'SJ' },
  { id: 'u2', name: 'Michael Chen', email: 'm.chen@qore.com', role: 'PM', status: 'Active', avatar: 'MC' },
  { id: 'u3', name: 'David Okoro', email: 'd.okoro@qore.com', role: 'PM', status: 'Active', avatar: 'DO' },
  { id: 'u4', name: 'Admin User', email: 'admin@qore.com', role: 'Superadmin', status: 'Active', avatar: 'AU' },
  { id: 'u5', name: 'Finance Lead', email: 'finance@qore.com', role: 'Finance', status: 'Active', avatar: 'FL' },
  { id: 'u6', name: 'Exec Director', email: 'exec@qore.com', role: 'Executive', status: 'Active', avatar: 'ED' },
  { id: 'u7', name: 'James Wilson', email: 'j.wilson@qore.com', role: 'Manager', status: 'Active', avatar: 'JW' },
  { id: 'u8', name: 'Pending User', email: 'pending@qore.com', role: 'PM', status: 'Invited', avatar: 'PU', invitedAt: format(subDays(now, 1), 'yyyy-MM-dd HH:mm') },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'l1', action: 'Project Created', user: 'Sarah Jenkins', details: 'Created project for Global Trust Bank', timestamp: format(subDays(now, 50), 'yyyy-MM-dd HH:mm'), category: 'Project' },
  { id: 'l2', action: 'Weight Updated', user: 'Admin User', details: 'Updated Digital Transformation Program weight from 1.0 to 1.2', timestamp: format(subDays(now, 5), 'yyyy-MM-dd HH:mm'), category: 'Config' },
  { id: 'l3', action: 'State Change', user: 'Michael Chen', details: 'Apex Microfinance moved to Delayed', timestamp: format(subDays(now, 2), 'yyyy-MM-dd HH:mm'), category: 'Project' },
];

export const INITIAL_CONFIG: AppConfig = {
  atRiskThresholdDays: 7,
  currency: 'USD',
  defaultMilestones: ['PIM', 'Pre-requisites', 'Implementation', 'Sign Off'],
  allowPostIntakeRevenueEdit: true,
  brand: {
    themeColor: 'teal',
    companyName: 'Qore PD',
    logoUrl: undefined
  }
};

export const MOCK_WEIGHT_HISTORY: WeightHistory[] = [
  { id: 'wh1', packageName: 'Digital Transformation Program', oldWeight: 1.0, newWeight: 1.2, updatedBy: 'Admin User', timestamp: format(subDays(now, 5), 'yyyy-MM-dd HH:mm') }
];
