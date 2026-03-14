import { Project, User, AuditLog, AppConfig, WeightHistory, RevenueTrend } from './types';
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
    currency: 'NGN',
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
    ],
    priority: 'P1',
    updatedAt: format(subDays(now, 2), 'yyyy-MM-dd'),
    activities: [
      { id: 'a1', type: 'System', user: 'System', description: 'Project created from intake form', timestamp: format(subDays(now, 50), 'yyyy-MM-dd HH:mm') },
      { id: 'a2', type: 'Milestone', user: 'Sarah Jenkins', description: 'Milestone "PIM" completed', timestamp: format(subDays(now, 42), 'yyyy-MM-dd HH:mm') },
      { id: 'a3', type: 'Risk', user: 'Sarah Jenkins', description: 'New risk identified: Delayed API documentation from client', timestamp: format(subDays(now, 10), 'yyyy-MM-dd HH:mm') },
      { id: 'a4', type: 'Comment', user: 'Sarah Jenkins', description: 'Added comment: Client requested additional USSD flows.', timestamp: format(subDays(now, 5), 'yyyy-MM-dd HH:mm') },
    ]
  },
  {
    id: '2',
    clientName: 'Apex Microfinance',
    packageName: 'CBA Program',
    services: ['Core Banking Application (CBA)'],
    productLines: ['Bankone'],
    assignedPM: 'Michael Chen',
    startDate: format(subDays(now, 40), 'yyyy-MM-dd'),
    value: 85000,
    currency: 'USD',
    state: 'Delayed',
    createdAt: format(subDays(now, 45), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'Sign Off', targetDate: format(subDays(now, 32), 'yyyy-MM-dd'), status: 'Pending' },
    ],
    comments: [],
    risks: [
      { id: 'r2', description: 'Server infrastructure not ready', impact: 'High', status: 'Open', createdAt: format(subDays(now, 2), 'yyyy-MM-dd') }
    ],
    priority: 'P2',
    updatedAt: format(subDays(now, 20), 'yyyy-MM-dd'), // Stale
    activities: []
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
    currency: 'USD',
    state: 'Billed',
    createdAt: format(subDays(now, 65), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(subDays(now, 55), 'yyyy-MM-dd'), completionDate: format(subDays(now, 56), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm2', name: 'Pre-requisites', targetDate: format(subDays(now, 45), 'yyyy-MM-dd'), completionDate: format(subDays(now, 44), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm3', name: 'Implementation', targetDate: format(subDays(now, 15), 'yyyy-MM-dd'), completionDate: format(subDays(now, 10), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm4', name: 'Sign Off', targetDate: format(subDays(now, 5), 'yyyy-MM-dd'), completionDate: format(subDays(now, 2), 'yyyy-MM-dd'), status: 'Completed' },
    ],
    comments: [],
    risks: [],
    priority: 'P2',
    updatedAt: format(subDays(now, 5), 'yyyy-MM-dd'),
    activities: []
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
    currency: 'USD',
    state: 'Active',
    createdAt: format(subDays(now, 10), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(now, 'yyyy-MM-dd'), status: 'In Progress' },
    ],
    comments: [],
    risks: [],
    priority: 'P3',
    updatedAt: format(subDays(now, 1), 'yyyy-MM-dd'),
    activities: []
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
    currency: 'USD',
    state: 'Closed',
    createdAt: format(subDays(now, 95), 'yyyy-MM-dd'),
    milestones: [
      { id: 'm1', name: 'PIM', targetDate: format(subDays(now, 85), 'yyyy-MM-dd'), completionDate: format(subDays(now, 86), 'yyyy-MM-dd'), status: 'Completed' },
      { id: 'm4', name: 'Sign Off', targetDate: format(subDays(now, 10), 'yyyy-MM-dd'), completionDate: format(subDays(now, 5), 'yyyy-MM-dd'), status: 'Completed' },
    ],
    comments: [],
    risks: [],
    priority: 'P1',
    updatedAt: format(subDays(now, 10), 'yyyy-MM-dd'),
    activities: []
  },
  {
    id: '6',
    clientName: 'Asset Management Ltd',
    packageName: 'Wealth Management Suite',
    services: ['APIs', 'CAS'],
    productLines: ['Cluster'],
    assignedPM: 'Sarah Jenkins',
    startDate: format(subDays(now, 100), 'yyyy-MM-dd'),
    value: 150000,
    currency: 'NGN',
    state: 'Ready for Billing',
    createdAt: format(subDays(now, 105), 'yyyy-MM-dd'),
    readyForBillingAt: format(subDays(now, 8), 'yyyy-MM-dd'), // > 7 days
    milestones: [],
    comments: [],
    risks: [],
    priority: 'P1',
    updatedAt: format(subDays(now, 8), 'yyyy-MM-dd'),
    activities: []
  },
  {
    id: '7',
    clientName: 'Eagle Insurance',
    packageName: 'Policy Admin System',
    services: ['Core Banking Application (CBA)'],
    productLines: ['Bankone'],
    assignedPM: 'Michael Chen',
    startDate: format(subDays(now, 30), 'yyyy-MM-dd'),
    value: 75000,
    currency: 'USD',
    state: 'Ready for Billing',
    createdAt: format(subDays(now, 35), 'yyyy-MM-dd'),
    readyForBillingAt: format(subDays(now, 3), 'yyyy-MM-dd'),
    milestones: [],
    comments: [],
    risks: [],
    priority: 'P2',
    updatedAt: format(subDays(now, 3), 'yyyy-MM-dd'),
    activities: []
  },
  {
    id: '8',
    clientName: 'Swift Pay',
    packageName: 'Remittance Engine',
    services: ['USSD', 'Mobile Banking'],
    productLines: ['Channels'],
    assignedPM: 'David Okoro',
    startDate: format(subDays(now, 15), 'yyyy-MM-dd'),
    value: 20000,
    currency: 'USD',
    state: 'Ready for Billing',
    createdAt: format(subDays(now, 20), 'yyyy-MM-dd'),
    readyForBillingAt: format(subDays(now, 1), 'yyyy-MM-dd'),
    milestones: [],
    comments: [],
    risks: [],
    priority: 'P3',
    updatedAt: format(subDays(now, 1), 'yyyy-MM-dd'),
    activities: []
  },
  {
    id: '9',
    clientName: 'Legacy Corp',
    packageName: 'Legacy Migration',
    services: ['CBA'],
    productLines: ['Bankone'],
    assignedPM: 'Abisoye Adeyemi',
    startDate: format(subDays(now, 120), 'yyyy-MM-dd'),
    value: 50000,
    currency: 'NGN',
    state: 'Active',
    createdAt: format(subDays(now, 125), 'yyyy-MM-dd'),
    milestones: [],
    comments: [],
    risks: [],
    priority: 'P2',
    updatedAt: format(subDays(now, 50), 'yyyy-MM-dd'),
    activities: []
  },
  {
    id: '10',
    clientName: 'Old School Fin',
    packageName: 'Digital Onboarding',
    services: ['Mobile'],
    productLines: ['Channels'],
    assignedPM: 'Abisoye Adeyemi',
    startDate: format(subDays(now, 150), 'yyyy-MM-dd'),
    value: 30000,
    currency: 'USD',
    state: 'Delayed',
    createdAt: format(subDays(now, 155), 'yyyy-MM-dd'),
    milestones: [
        { id: 'm1', name: 'Sign Off', targetDate: format(subDays(now, 20), 'yyyy-MM-dd'), status: 'Pending' }
    ],
    comments: [],
    risks: [],
    priority: 'P1',
    updatedAt: format(subDays(now, 60), 'yyyy-MM-dd'),
    activities: []
  },
  {
    id: '11',
    clientName: 'Future Bank',
    packageName: 'Cloud Core Migration',
    services: ['Cloud', 'API'],
    productLines: ['Bankone'],
    assignedPM: 'Sarah Jenkins',
    startDate: format(subDays(now, 20), 'yyyy-MM-dd'),
    value: 45000000,
    currency: 'NGN',
    state: 'Delayed',
    createdAt: format(subDays(now, 25), 'yyyy-MM-dd'),
    updatedAt: format(subDays(now, 10), 'yyyy-MM-dd'),
    priority: 'P1',
    milestones: [
      { id: 'm1', name: 'Sign Off', targetDate: format(subDays(now, 16), 'yyyy-MM-dd'), status: 'Pending' }
    ],
    comments: [], risks: [], activities: []
  },
  {
    id: '12',
    clientName: 'Eco Save',
    packageName: 'Green Wallet',
    services: ['Mobile'],
    productLines: ['Channels'],
    assignedPM: 'Michael Chen',
    startDate: format(subDays(now, 15), 'yyyy-MM-dd'),
    value: 12000,
    currency: 'USD',
    state: 'Delayed',
    createdAt: format(subDays(now, 20), 'yyyy-MM-dd'),
    updatedAt: format(subDays(now, 5), 'yyyy-MM-dd'),
    priority: 'P2',
    milestones: [
      { id: 'm1', name: 'Sign Off', targetDate: '2026-03-30', status: 'Pending' }
    ],
    comments: [], risks: [], activities: []
  },
  {
    id: '13',
    clientName: 'Fast Collect',
    packageName: 'Collections Pro',
    services: ['USSD'],
    productLines: ['Recova'],
    assignedPM: 'David Okoro',
    startDate: format(subDays(now, 10), 'yyyy-MM-dd'),
    value: 25000000,
    currency: 'NGN',
    state: 'Active',
    createdAt: format(subDays(now, 12), 'yyyy-MM-dd'),
    updatedAt: format(subDays(now, 1), 'yyyy-MM-dd'),
    priority: 'P3',
    milestones: [],
    comments: [], risks: [], activities: []
  },
  {
    id: '14',
    clientName: 'Silver Lining',
    packageName: 'Lending Suite',
    services: ['Web'],
    productLines: ['Cluster'],
    assignedPM: 'Sarah Jenkins',
    startDate: format(subDays(now, 100), 'yyyy-MM-dd'),
    value: 55000,
    currency: 'USD',
    state: 'Suspended',
    createdAt: format(subDays(now, 110), 'yyyy-MM-dd'),
    updatedAt: format(subDays(now, 20), 'yyyy-MM-dd'),
    priority: 'P1',
    milestones: [],
    comments: [], risks: [], activities: []
  },
  {
    id: '15',
    clientName: 'Naira Flow',
    packageName: 'Payment Gateway',
    services: ['APIs'],
    productLines: ['Bankone'],
    assignedPM: 'Michael Chen',
    startDate: format(subDays(now, 200), 'yyyy-MM-dd'),
    value: 75000000,
    currency: 'NGN',
    state: 'Billed',
    createdAt: format(subDays(now, 210), 'yyyy-MM-dd'),
    updatedAt: format(subDays(now, 150), 'yyyy-MM-dd'),
    priority: 'P2',
    milestones: [],
    comments: [], risks: [], activities: []
  }
];

export const MOCK_REVENUE_TREND: RevenueTrend[] = [
  { month: 'Apr 2025', intakeNGN: 25000000, achievedNGN: 15000000, intakeUSD: 12000, achievedUSD: 8000 },
  { month: 'May 2025', intakeNGN: 35000000, achievedNGN: 20000000, intakeUSD: 15000, achievedUSD: 10000 },
  { month: 'Jun 2025', intakeNGN: 45000000, achievedNGN: 25000000, intakeUSD: 18000, achievedUSD: 12000 },
  { month: 'Jul 2025', intakeNGN: 30000000, achievedNGN: 30000000, intakeUSD: 20000, achievedUSD: 15000 },
  { month: 'Aug 2025', intakeNGN: 55000000, achievedNGN: 35000000, intakeUSD: 25000, achievedUSD: 20000 },
  { month: 'Sep 2025', intakeNGN: 40000000, achievedNGN: 40000000, intakeUSD: 22000, achievedUSD: 18000 },
  { month: 'Oct 2025', intakeNGN: 65000000, achievedNGN: 45000000, intakeUSD: 30000, achievedUSD: 25000 },
  { month: 'Nov 2025', intakeNGN: 50000000, achievedNGN: 50000000, intakeUSD: 28000, achievedUSD: 22000 },
  { month: 'Dec 2025', intakeNGN: 80000000, achievedNGN: 55000000, intakeUSD: 35000, achievedUSD: 30000 },
  { month: 'Jan 2026', intakeNGN: 45000000, achievedNGN: 60000000, intakeUSD: 20000, achievedUSD: 28000 },
  { month: 'Feb 2026', intakeNGN: 60000000, achievedNGN: 60000000, intakeUSD: 25000, achievedUSD: 25000 },
  { month: 'Mar 2026', intakeNGN: 70000000, achievedNGN: 50000000, intakeUSD: 30000, achievedUSD: 20000 },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Sarah Jenkins', email: 'sarah.j@qore.com', role: 'PM', status: 'Active', avatar: 'SJ' },
  { id: 'u2', name: 'Michael Chen', email: 'm.chen@qore.com', role: 'PM', status: 'Active', avatar: 'MC' },
  { id: 'u3', name: 'David Okoro', email: 'd.okoro@qore.com', role: 'PM', status: 'Active', avatar: 'DO' },
  { id: 'u4', name: 'Admin User', email: 'admin@qore.com', role: 'Superadmin', status: 'Active', avatar: 'AU' },
  { id: 'u5', name: 'Finance Lead', email: 'finance@qore.com', role: 'Finance', status: 'Active', avatar: 'FL' },
  { id: 'u6', name: 'Exec Director', email: 'exec@qore.com', role: 'Executive', status: 'Active', avatar: 'ED' },
  { id: 'u7', name: 'James Wilson', email: 'j.wilson@qore.com', role: 'Manager', status: 'Active', avatar: 'JW' },
  { id: 'u8', name: 'Abisoye Adeyemi', email: 'a.adeyemi@qore.com', role: 'PM', status: 'Inactive', avatar: 'AA', invitedAt: format(subDays(now, 100), 'yyyy-MM-dd HH:mm') },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'l1', action: 'Project Created', user: 'Sarah Jenkins', details: 'Created project for Global Trust Bank', timestamp: format(subDays(now, 50), 'yyyy-MM-dd HH:mm'), category: 'Project' },
  { id: 'l2', action: 'Weight Updated', user: 'Admin User', details: 'Updated Digital Transformation Program weight from 1.0 to 1.2', timestamp: format(subDays(now, 5), 'yyyy-MM-dd HH:mm'), category: 'Config' },
  { id: 'l3', action: 'State Change', user: 'Michael Chen', details: 'Apex Microfinance moved to Delayed', timestamp: format(subDays(now, 2), 'yyyy-MM-dd HH:mm'), category: 'Project' },
];

export const INITIAL_CONFIG: AppConfig = [
  {
    atRiskThresholdDays: 7,
    staleThresholdDays: 14,
    currencies: [
      { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', isActive: true },
      { code: 'USD', symbol: '$', name: 'US Dollar', isActive: true },
    ],
    defaultMilestones: ['PIM', 'Pre-requisites', 'Implementation', 'Sign Off'],
    allowPostIntakeRevenueEdit: true,
    workloadThresholds: {
      P1: 3,
      P2: 10,
      P3: 50
    },
    brand: {
      themeColor: 'teal',
      companyName: 'SD Project Dashboard',
      logoUrl: undefined
    }
  }
][0];

export const MOCK_WEIGHT_HISTORY: WeightHistory[] = [
  { id: 'wh1', packageName: 'Digital Transformation Program', oldWeight: 1.0, newWeight: 1.2, updatedBy: 'Admin User', timestamp: format(subDays(now, 5), 'yyyy-MM-dd HH:mm') }
];
