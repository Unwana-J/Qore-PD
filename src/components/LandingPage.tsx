import React, { useState } from 'react';
import { 
  Briefcase, 
  Layers, 
  Award, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Mail, 
  Users, 
  TrendingUp, 
  Clock, 
  Sparkles,
  ChevronRight,
  Settings,
  Globe
} from 'lucide-react';

interface LandingPageProps {
  onExploreDemo: () => void;
  themeColor?: string;
  companyName?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onExploreDemo, 
  themeColor = 'teal',
  companyName = 'Syncra' 
}) => {
  // Contact Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    org: '',
    scope: 'Enterprise Implementation',
    budget: '$5,000 - $10,000',
    message: ''
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'exec' | 'pm' | 'finance' | 'client'>('exec');

  // --- INTERACTIVE MOCKUP SIMULATOR STATES ---
  const [mockView, setMockView] = useState<'dashboard' | 'projects' | 'risks' | 'settings'>('dashboard');
  const [mockRole, setMockRole] = useState<'Executive' | 'PM' | 'Finance'>('Executive');
  const [selectedMockProjectId, setSelectedMockProjectId] = useState<string | null>(null);
  
  // Custom Branding Simulator states
  const [mockCompanyName, setMockCompanyName] = useState(companyName);
  const [mockThemeColor, setMockThemeColor] = useState(themeColor);

  // Mock comments database state
  const [mockComments, setMockComments] = useState<Record<string, { author: string; text: string; timestamp: string }[]>>({
    '1': [
      { author: 'Sarah Jenkins', text: 'Client requested additional custom workflow nodes.', timestamp: 'Just now' }
    ],
    '2': [
      { author: 'Michael Chen', text: 'Server infrastructure migration ready, waiting on DNS cutover.', timestamp: '2 hours ago' }
    ],
    '3': [
      { author: 'Sarah Jenkins', text: 'Program completed. Client is thrilled with the new APIs.', timestamp: '3 days ago' }
    ]
  });
  const [newMockCommentText, setNewMockCommentText] = useState('');

  // Mock billing queue state
  const [mockBillingStatuses, setMockBillingStatuses] = useState<Record<string, 'Ready' | 'Billed'>>({
    '1': 'Ready',
    '3': 'Billed'
  });

  // Mock User Onboarding invites
  const [mockUsers, setMockUsers] = useState([
    { id: '1', name: 'Sarah Jenkins', email: 'sarah.j@syncra.io', role: 'PM', status: 'Active' },
    { id: '2', name: 'Michael Chen', email: 'm.chen@syncra.io', role: 'PM', status: 'Active' }
  ]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState('PM');

  // Mock Risks database state
  const [mockRisks, setMockRisks] = useState([
    { id: '1', description: 'Delayed API documentation from client', project: 'Nexus Enterprises', impact: 'Medium', status: 'Open' },
    { id: '2', description: 'Server infrastructure not ready', project: 'Vanguard Holdings', impact: 'High', status: 'Open' },
    { id: '3', description: 'Resource alignment bottleneck', project: 'Veridian Corp', impact: 'Low', status: 'Addressing' }
  ]);

  const mockProjectsData = [
    {
      id: '1',
      clientName: 'Nexus Enterprises',
      packageName: 'Global Tech Modernization',
      value: 250000,
      state: 'Active',
      pm: 'Sarah Jenkins',
      services: ['Database Engine', 'Processing Core', 'Mobile App'],
      milestones: [
        { name: 'PIM', status: 'Completed' },
        { name: 'Pre-requisites', status: 'Completed' },
        { name: 'Implementation', status: 'In Progress' },
        { name: 'Sign Off', status: 'Pending' }
      ]
    },
    {
      id: '2',
      clientName: 'Vanguard Holdings',
      packageName: 'Platform Migration',
      value: 85000,
      state: 'Delayed',
      pm: 'Michael Chen',
      services: ['Database Engine', 'Processing Core'],
      milestones: [
        { name: 'PIM', status: 'Completed' },
        { name: 'Pre-requisites', status: 'In Progress' },
        { name: 'Implementation', status: 'Pending' }
      ]
    },
    {
      id: '3',
      clientName: 'Lumina Group',
      packageName: 'API Integrations Program',
      value: 120000,
      state: 'Closed',
      pm: 'Sarah Jenkins',
      services: ['Web Portal', 'Public APIs', 'Messaging Gateway'],
      milestones: [
        { name: 'PIM', status: 'Completed' },
        { name: 'Pre-requisites', status: 'Completed' },
        { name: 'Implementation', status: 'Completed' },
        { name: 'Sign Off', status: 'Completed' }
      ]
    },
    {
      id: '4',
      clientName: 'Veridian Corp',
      packageName: 'Analytics Engine Rollout',
      value: 45000,
      state: 'Active',
      pm: 'David Okoro',
      services: ['BI Reports', 'Operations Dashboard'],
      milestones: [
        { name: 'PIM', status: 'In Progress' },
        { name: 'Pre-requisites', status: 'Pending' }
      ]
    }
  ];

  const selectedMockProject = mockProjectsData.find(p => p.id === selectedMockProjectId) || null;

  // Sync mock theme defaults when the landing page changes theme
  React.useEffect(() => {
    setMockThemeColor(themeColor);
  }, [themeColor]);

  React.useEffect(() => {
    setMockCompanyName(companyName);
  }, [companyName]);
  // -------------------------------------------

  // Dynamic style mappings based on the active themeColor
  const themeAccentMap: Record<string, {
    text: string;
    bg: string;
    border: string;
    borderHover: string;
    gradient: string;
    hoverBg: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    ring: string;
  }> = {
    teal: { 
      text: 'text-teal-400', 
      bg: 'bg-teal-500', 
      border: 'border-teal-500/20', 
      borderHover: 'hover:border-teal-500/40',
      gradient: 'from-teal-500/20 to-teal-500/5', 
      hoverBg: 'hover:bg-teal-600', 
      glow: 'shadow-teal-500/10',
      badgeBg: 'bg-teal-500/10',
      badgeText: 'text-teal-300',
      ring: 'focus:ring-teal-500/20'
    },
    indigo: { 
      text: 'text-indigo-400', 
      bg: 'bg-indigo-500', 
      border: 'border-indigo-500/20', 
      borderHover: 'hover:border-indigo-500/40',
      gradient: 'from-indigo-500/20 to-indigo-500/5', 
      hoverBg: 'hover:bg-indigo-600', 
      glow: 'shadow-indigo-500/10',
      badgeBg: 'bg-indigo-500/10',
      badgeText: 'text-indigo-300',
      ring: 'focus:ring-indigo-500/20'
    },
    emerald: { 
      text: 'text-emerald-400', 
      bg: 'bg-emerald-500', 
      border: 'border-emerald-500/20', 
      borderHover: 'hover:border-emerald-500/40',
      gradient: 'from-emerald-500/20 to-emerald-500/5', 
      hoverBg: 'hover:bg-emerald-600', 
      glow: 'shadow-emerald-500/10',
      badgeBg: 'bg-emerald-500/10',
      badgeText: 'text-emerald-300',
      ring: 'focus:ring-emerald-500/20'
    },
    rose: { 
      text: 'text-rose-400', 
      bg: 'bg-rose-500', 
      border: 'border-rose-500/20', 
      borderHover: 'hover:border-rose-500/40',
      gradient: 'from-rose-500/20 to-rose-500/5', 
      hoverBg: 'hover:bg-rose-600', 
      glow: 'shadow-rose-500/10',
      badgeBg: 'bg-rose-500/10',
      badgeText: 'text-rose-300',
      ring: 'focus:ring-rose-500/20'
    },
    amber: { 
      text: 'text-amber-400', 
      bg: 'bg-amber-500', 
      border: 'border-amber-500/20', 
      borderHover: 'hover:border-amber-500/40',
      gradient: 'from-amber-500/20 to-amber-500/5', 
      hoverBg: 'hover:bg-amber-600', 
      glow: 'shadow-amber-500/10',
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-300',
      ring: 'focus:ring-amber-500/20'
    },
    sky: { 
      text: 'text-sky-400', 
      bg: 'bg-sky-500', 
      border: 'border-sky-500/20', 
      borderHover: 'hover:border-sky-500/40',
      gradient: 'from-sky-500/20 to-sky-500/5', 
      hoverBg: 'hover:bg-sky-600', 
      glow: 'shadow-sky-500/10',
      badgeBg: 'bg-sky-500/10',
      badgeText: 'text-sky-300',
      ring: 'focus:ring-sky-500/20'
    },
    violet: { 
      text: 'text-violet-400', 
      bg: 'bg-violet-500', 
      border: 'border-violet-500/20', 
      borderHover: 'hover:border-violet-500/40',
      gradient: 'from-violet-500/20 to-violet-500/5', 
      hoverBg: 'hover:bg-violet-600', 
      glow: 'shadow-violet-500/10',
      badgeBg: 'bg-violet-500/10',
      badgeText: 'text-violet-300',
      ring: 'focus:ring-violet-500/20'
    },
    orange: { 
      text: 'text-orange-400', 
      bg: 'bg-orange-500', 
      border: 'border-orange-500/20', 
      borderHover: 'hover:border-orange-500/40',
      gradient: 'from-orange-500/20 to-orange-500/5', 
      hoverBg: 'hover:bg-orange-600', 
      glow: 'shadow-orange-500/10',
      badgeBg: 'bg-orange-500/10',
      badgeText: 'text-orange-300',
      ring: 'focus:ring-orange-500/20'
    },
    pink: { 
      text: 'text-pink-400', 
      bg: 'bg-pink-500', 
      border: 'border-pink-500/20', 
      borderHover: 'hover:border-pink-500/40',
      gradient: 'from-pink-500/20 to-pink-500/5', 
      hoverBg: 'hover:bg-pink-600', 
      glow: 'shadow-pink-500/10',
      badgeBg: 'bg-pink-500/10',
      badgeText: 'text-pink-300',
      ring: 'focus:ring-pink-500/20'
    },
    slate: { 
      text: 'text-slate-400', 
      bg: 'bg-slate-500', 
      border: 'border-slate-500/20', 
      borderHover: 'hover:border-slate-500/40',
      gradient: 'from-slate-500/20 to-slate-500/5', 
      hoverBg: 'hover:bg-slate-600', 
      glow: 'shadow-slate-500/10',
      badgeBg: 'bg-slate-500/10',
      badgeText: 'text-slate-300',
      ring: 'focus:ring-slate-500/20'
    },
  };

  const accent = themeAccentMap[themeColor] || themeAccentMap.teal;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      alert("Please fill out all required fields.");
      return;
    }
    setShowSuccessModal(true);
  };

  // Triggers native mail client with details
  const triggerEmail = () => {
    const subject = encodeURIComponent(`Inquiry: Custom ${companyName} Delivery Workspace Implementation`);
    const body = encodeURIComponent(
      `Hi,\n\nI am interested in building a custom ${companyName}-style project management and delivery tracking workspace for my organization. Here are my details:\n\n` +
      `- Name: ${formData.name}\n` +
      `- Organization: ${formData.org || 'Not specified'}\n` +
      `- Email: ${formData.email}\n` +
      `- Projected Scope: ${formData.scope}\n` +
      `- Budget Range: ${formData.budget}\n\n` +
      `Requirements / Message:\n${formData.message}\n\n` +
      `Please get back to me to coordinate a discovery session.\n\nBest regards,\n${formData.name}`
    );
    window.location.href = `mailto:letslokin@gmail.com?subject=${subject}&body=${body}`;
    setShowSuccessModal(false);
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-slate-800 selection:text-white relative overflow-hidden">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-blue-500/10 to-transparent rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className={`absolute top-20 right-1/4 w-[500px] h-[500px] bg-gradient-to-r ${accent.gradient} rounded-full blur-[120px] pointer-events-none -z-10`} />
      <div className="absolute bottom-20 left-1/3 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/5 to-transparent rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* Landing Nav Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${accent.bg} ${accent.glow}`}>
              <Briefcase className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{companyName}</span>
              <span className={`text-[10px] font-bold block uppercase tracking-widest leading-none ${accent.text}`}>Delivery Hub</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#story" className="hover:text-white transition-colors">The Pitch</a>
            <a href="#offerings" className="hover:text-white transition-colors">Features</a>
            <a href="#personas" className="hover:text-white transition-colors">Role Tour</a>
            <a href="#preview" className="hover:text-white transition-colors">Interactive Preview</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={onExploreDemo}
              className={`hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850`}
            >
              <span>Try Sandbox Demo</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <a 
              href="#contact"
              className={`flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-950 transition-all ${accent.bg} hover:opacity-90 shadow-md ${accent.glow}`}
            >
              <span>Get Custom Build</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/60 backdrop-blur-sm mb-8 animate-fade-in">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${accent.bg}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${accent.bg}`}></span>
            </span>
            <span className="text-xs font-bold tracking-wide text-slate-300">
              MIGRATING IN-HOUSE? GET A CUSTOM SOLUTION
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto mb-6 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            From Chaos to Clarity — One Platform for Every Delivery, Every Client, Every Phase.
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Built for delivery teams who manage multiple clients, complex phases, and finance alignment simultaneously — without the spreadsheet chaos.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a 
              href="#contact"
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-slate-950 transition-all text-base ${accent.bg} hover:opacity-95 shadow-xl ${accent.glow}`}
            >
              <Mail className="w-5 h-5" />
              <span>Get a Custom Build</span>
            </a>
            <button 
              onClick={onExploreDemo}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 transition-all text-base"
            >
              <span>See It in Action</span>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Product Mockup (Interactive Dashboard Preview Box) */}
          <div id="preview" className="relative group">
            <div className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${accent.gradient} opacity-30 blur-2xl group-hover:opacity-40 transition-opacity duration-1000 -z-10`} />
            
            {/* Mockup wrapper with dynamic border color based on mockup theme settings */}
            <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-3 md:p-5 shadow-2xl backdrop-blur-md">
              
              {/* Fake Window Header Controls & Role Switcher */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-850 gap-4 mb-4">
                {/* Simulated URL bar and dots */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono ml-2">sandbox-preview.syncra.io</span>
                </div>

                {/* Interactive Role Switcher in Header */}
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto justify-between sm:justify-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-2 pr-1 hidden xs:inline">Persona View:</span>
                  <div className="flex gap-1">
                    {(['Executive', 'PM', 'Finance'] as const).map(role => (
                      <button
                        key={role}
                        onClick={() => {
                          setMockRole(role);
                          // Reset project view if switching role to keep interface consistent
                          if (mockView === 'dashboard') setSelectedMockProjectId(null);
                        }}
                        className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-all ${mockRole === role ? `bg-slate-900 ${themeAccentMap[mockThemeColor]?.text || 'text-teal-400'} border border-slate-800` : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode status indicator */}
                <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Branding Engine Online</span>
                </div>
              </div>

              {/* Dynamic Theme accent references for mockup internal elements */}
              {(() => {
                const innerAccent = themeAccentMap[mockThemeColor] || themeAccentMap.teal;
                return (
                  /* Mock Dashboard Grid Layout */
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                    
                    {/* Left Mini Sidebar */}
                    <div className="flex flex-row md:flex-col justify-between md:justify-start gap-1 md:gap-2 p-2 bg-slate-950/60 rounded-xl border border-slate-850 overflow-x-auto md:overflow-visible">
                      <div className="hidden md:flex items-center gap-2 px-2 py-1 mb-3 text-[10px] font-bold text-white uppercase tracking-wider">
                        <Sparkles className={`w-3.5 h-3.5 ${innerAccent.text}`} />
                        <span>{mockCompanyName}</span>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          setMockView('dashboard');
                          setSelectedMockProjectId(null);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0 ${mockView === 'dashboard' ? `${innerAccent.badgeBg} ${innerAccent.text} border ${innerAccent.border}` : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Dashboard</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setMockView('projects')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0 ${mockView === 'projects' ? `${innerAccent.badgeBg} ${innerAccent.text} border ${innerAccent.border}` : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Projects</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setMockView('risks')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0 ${mockView === 'risks' ? `${innerAccent.badgeBg} ${innerAccent.text} border ${innerAccent.border}` : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Risks</span>
                        {mockRisks.filter(r => r.status === 'Open').length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-auto" />
                        )}
                      </button>

                      <button 
                        type="button"
                        onClick={() => setMockView('settings')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0 ${mockView === 'settings' ? `${innerAccent.badgeBg} ${innerAccent.text} border ${innerAccent.border}` : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </button>
                    </div>

                    {/* Main Mock Content Display */}
                    <div className="md:col-span-3 space-y-4">
                      
                      {/* Sub-View 1: Dashboard */}
                      {mockView === 'dashboard' && (
                        <div className="space-y-4 animate-fade-in">
                          {/* Executive Dashboard Metrics */}
                          {mockRole === 'Executive' && (
                            <>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Total Intake</span>
                                  <p className="text-sm md:text-base font-bold text-white">$500,000</p>
                                  <span className="text-[8px] text-emerald-400 flex items-center gap-0.5 mt-0.5 font-sans">
                                    <TrendingUp className="w-2 h-2" /> +14% QoQ
                                  </span>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Ready Billing</span>
                                  <p className="text-sm md:text-base font-bold text-amber-400">
                                    ${mockBillingStatuses['1'] === 'Ready' ? '250,000' : '0'}
                                  </p>
                                  <span className="text-[8px] text-slate-400 block mt-0.5 font-sans">
                                    {mockProjectsData.find(p => p.id === '1')?.packageName || 'Modernization Program'}
                                  </span>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">At Risk</span>
                                  <p className="text-sm md:text-base font-bold text-red-400 font-sans">
                                    {mockRisks.filter(r => r.status === 'Open').length} Blockers
                                  </p>
                                  <span className="text-[8px] text-amber-400 block mt-0.5">Action Required</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Product Lines CSS bar graph */}
                                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-2">
                                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900">
                                    <span className="text-[10px] font-bold text-white">Revenue by Product Line</span>
                                    <span className="text-[8px] text-slate-500">Live Weights</span>
                                  </div>
                                  <div className="space-y-2 pt-1 text-[9px]">
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-slate-400 text-[8px]">
                                        <span>Core Platform</span>
                                        <span className="font-semibold text-white">$250,000</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                        <div className={`h-full ${innerAccent.bg}`} style={{width: '50%'}} />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-slate-400 text-[8px]">
                                        <span>Digital Channels</span>
                                        <span className="font-semibold text-white">$120,000</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                        <div className={`h-full ${innerAccent.bg}`} style={{width: '24%'}} />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-slate-400 text-[8px]">
                                        <span>Analytics Engine</span>
                                        <span className="font-semibold text-white">$80,005</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                        <div className={`h-full ${innerAccent.bg}`} style={{width: '16%'}} />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* PM performance rankings */}
                                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-2">
                                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-900">
                                    <span className="text-[10px] font-bold text-white">PM Performance Rank</span>
                                    <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">Weighted</span>
                                  </div>
                                  <div className="space-y-1.5 pt-1 text-[9px]">
                                    <div className="flex justify-between items-center p-1 bg-slate-900/60 rounded">
                                      <span className="text-slate-300">1. Sarah Jenkins</span>
                                      <span className={`font-bold ${innerAccent.text}`}>5.5 Score</span>
                                    </div>
                                    <div className="flex justify-between items-center p-1 bg-slate-900/60 rounded">
                                      <span className="text-slate-300">2. Michael Chen</span>
                                      <span className="font-bold text-slate-400">1.0 Score</span>
                                    </div>
                                    <div className="flex justify-between items-center p-1 bg-slate-900/60 rounded">
                                      <span className="text-slate-300">3. David Okoro</span>
                                      <span className="font-bold text-slate-400">0.5 Score</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* PM Dashboard view */}
                          {mockRole === 'PM' && (
                            <>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">My Queue</span>
                                  <p className="text-sm md:text-base font-bold text-white">2 Clients</p>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Targets</span>
                                  <p className="text-sm md:text-base font-bold text-white">4 Milestones</p>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Blockers</span>
                                  <p className="text-sm md:text-base font-bold text-amber-400">1 Roadblock</p>
                                </div>
                              </div>

                              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                                  <span className="text-[10px] font-bold text-white">My Active Client Portfolio Milestones</span>
                                  <span className="text-[8px] text-slate-500 font-mono">Assigned to Sarah Jenkins</span>
                                </div>
                                <div className="space-y-3 pt-1">
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[9px]">
                                      <span className="font-semibold text-slate-300">Nexus Enterprises</span>
                                      <span className="text-slate-400">75% Completed</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                      <div className={`h-full ${innerAccent.bg}`} style={{width: '75%'}} />
                                    </div>
                                    <div className="flex gap-2 text-[7px] text-slate-500 font-sans">
                                      <span className="text-emerald-400">✓ PIM</span>
                                      <span className="text-emerald-400">✓ Pre-reqs</span>
                                      <span className={`font-semibold ${innerAccent.text}`}>➔ Implementation</span>
                                      <span>☐ Sign Off</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[9px]">
                                      <span className="font-semibold text-slate-300">Lumina Group</span>
                                      <span className="text-emerald-400">100% Completed</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500" style={{width: '100%'}} />
                                    </div>
                                    <div className="flex gap-2 text-[7px] text-slate-500 font-sans">
                                      <span className="text-emerald-400">✓ PIM</span>
                                      <span className="text-emerald-400">✓ Pre-reqs</span>
                                      <span className="text-emerald-400">✓ Implementation</span>
                                      <span className="text-emerald-400">✓ Sign Off</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Finance Dashboard View */}
                          {mockRole === 'Finance' && (
                            <>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Billing Queue</span>
                                  <p className="text-sm md:text-base font-bold text-white">
                                    {mockBillingStatuses['1'] === 'Ready' ? '1 Program' : '0 Programs'}
                                  </p>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Pending Revenue</span>
                                  <p className="text-sm md:text-base font-bold text-white">
                                    ${mockBillingStatuses['1'] === 'Ready' ? '250,000' : '0'}
                                  </p>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                                  <span className="text-[9px] uppercase text-slate-500 tracking-wider font-semibold">Realized Inflow</span>
                                  <p className="text-sm md:text-base font-bold text-emerald-400">
                                    ${mockBillingStatuses['1'] === 'Billed' ? '370,000' : '120,000'}
                                  </p>
                                </div>
                              </div>

                              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                                  <span className="text-[10px] font-bold text-white">Finance Invoice Trigger Handshake</span>
                                  <span className="text-[8px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-sans">Billing Sync</span>
                                </div>
                                
                                <div className="space-y-2.5 pt-1 text-[9px]">
                                  {/* Item 1 */}
                                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-850 flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-white">Nexus Enterprises</p>
                                      <p className="text-[8px] text-slate-500">Milestones: 3/4 Complete • Value: $250k</p>
                                    </div>
                                    {mockBillingStatuses['1'] === 'Ready' ? (
                                      <button 
                                        type="button"
                                        onClick={() => setMockBillingStatuses(prev => ({ ...prev, '1': 'Billed' }))}
                                        className={`px-3 py-1 rounded text-[8px] font-bold text-slate-950 bg-amber-400 hover:bg-amber-350 transition-colors shadow ${innerAccent.glow}`}
                                      >
                                        Trigger Invoice
                                      </button>
                                    ) : (
                                      <span className="text-[8px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold flex items-center gap-1 font-sans">
                                        ✓ Invoice Sent
                                      </span>
                                    )}
                                  </div>

                                  {/* Item 2 */}
                                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-850 flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-white">Lumina Group</p>
                                      <p className="text-[8px] text-slate-500">Milestones: 4/4 Complete • Value: $120k</p>
                                    </div>
                                    <span className="text-[8px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold flex items-center gap-1 font-sans">
                                      ✓ Invoice Realized
                                    </span>
                                  </div>

                                  {/* Item 3 */}
                                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-850 flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-slate-400">Vanguard Holdings</p>
                                      <p className="text-[8px] text-slate-500">Milestones: 1/3 Complete (Delayed) • Value: $85k</p>
                                    </div>
                                    <span className="text-[8px] text-slate-500 italic">Awaiting Milestone Target</span>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Sub-View 2: Projects List or Project Details */}
                      {mockView === 'projects' && (
                        <div className="animate-fade-in">
                          {selectedMockProjectId === null ? (
                            /* Project Queue List */
                            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-3">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                                <span className="text-[10px] font-bold text-white">Active Delivery Programs</span>
                                <span className="text-[8px] text-slate-500">Click any row to drill down</span>
                              </div>
                              <div className="divide-y divide-slate-900 text-[10px]">
                                {mockProjectsData.map(proj => (
                                  <div 
                                    key={proj.id}
                                    onClick={() => setSelectedMockProjectId(proj.id)}
                                    className="py-2.5 flex items-center justify-between hover:bg-slate-900/60 px-2 rounded-lg cursor-pointer transition-colors group"
                                  >
                                    <div>
                                      <p className="font-semibold text-white group-hover:text-teal-300 transition-colors">{proj.clientName}</p>
                                      <p className="text-[8px] text-slate-500">{proj.packageName}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-slate-300">${proj.value.toLocaleString()}</p>
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold ${
                                        proj.state === 'Active' ? `bg-teal-500/10 ${innerAccent.text}` :
                                        proj.state === 'Delayed' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-slate-500/10 text-slate-400'
                                      }`}>
                                        {proj.state}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            /* Project Milestone & Comments Detail View */
                            selectedMockProject && (
                              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-4 text-xs">
                                {/* Detail Header */}
                                <div className="flex justify-between items-start pb-2.5 border-b border-slate-900">
                                  <div>
                                    <button 
                                      type="button"
                                      onClick={() => setSelectedMockProjectId(null)}
                                      className={`text-[9px] font-bold uppercase ${innerAccent.text} hover:underline mb-1 block`}
                                    >
                                      ← Back to projects
                                    </button>
                                    <h4 className="font-bold text-white text-sm">{selectedMockProject.clientName}</h4>
                                    <p className="text-[9px] text-slate-500">{selectedMockProject.packageName}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-white">${selectedMockProject.value.toLocaleString()}</p>
                                    <p className="text-[8px] text-slate-400">PM: {selectedMockProject.pm}</p>
                                  </div>
                                </div>

                                {/* Split view: Milestones & Comments */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {/* Milestones checklist */}
                                  <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Milestone Checklist</p>
                                    <div className="space-y-1.5 text-[10px]">
                                      {selectedMockProject.milestones.map((m, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-1.5 bg-slate-900/40 rounded border border-slate-850/50">
                                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${
                                            m.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                            m.status === 'In Progress' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                            'bg-slate-900 text-slate-600 border border-slate-800'
                                          }`}>
                                            {m.status === 'Completed' ? '✓' : m.status === 'In Progress' ? '➔' : '○'}
                                          </span>
                                          <span className={m.status === 'Completed' ? 'text-slate-500 line-through font-sans' : 'text-slate-300'}>
                                            {m.name}
                                          </span>
                                          <span className={`text-[7px] ml-auto font-semibold ${
                                            m.status === 'Completed' ? 'text-emerald-400' :
                                            m.status === 'In Progress' ? 'text-amber-400' :
                                            'text-slate-500'
                                          }`}>{m.status}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Comments feed & Post simulation */}
                                  <div className="space-y-2 flex flex-col justify-between min-h-[140px]">
                                    <div className="space-y-2">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PM & Client Comment Feed</p>
                                      <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1">
                                        {(mockComments[selectedMockProject.id] || []).map((c, idx) => (
                                          <div key={idx} className="p-1.5 bg-slate-900/80 rounded border border-slate-850 text-[9px] leading-tight">
                                            <div className="flex justify-between text-slate-500 mb-0.5 font-bold">
                                              <span>{c.author}</span>
                                              <span>{c.timestamp}</span>
                                            </div>
                                            <p className="text-slate-300">{c.text}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Mock post comment form */}
                                    <form 
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!newMockCommentText.trim()) return;
                                        const newComment = {
                                          author: 'You (POC)',
                                          text: newMockCommentText,
                                          timestamp: 'Just now'
                                        };
                                        setMockComments(prev => ({
                                          ...prev,
                                          [selectedMockProject.id]: [...(prev[selectedMockProject.id] || []), newComment]
                                        }));
                                        setNewMockCommentText('');
                                      }}
                                      className="flex gap-1.5 mt-2"
                                    >
                                      <input 
                                        type="text" 
                                        required
                                        value={newMockCommentText}
                                        onChange={(e) => setNewMockCommentText(e.target.value)}
                                        placeholder="Type client update..." 
                                        className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 text-[9px] text-white outline-none focus:border-slate-800"
                                      />
                                      <button 
                                        type="submit"
                                        className={`px-3 py-1 rounded text-[9px] font-bold text-slate-950 ${innerAccent.bg} hover:opacity-90`}
                                      >
                                        Send
                                      </button>
                                    </form>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {/* Sub-View 3: Risks Table with toggle capability */}
                      {mockView === 'risks' && (
                        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-3 animate-fade-in">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                            <div>
                              <span className="text-[10px] font-bold text-white">Active Program Risks & Mitigations</span>
                              <p className="text-[8px] text-slate-500">Click a status label to toggle mitigation status</p>
                            </div>
                            <span className="text-[8px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold font-sans">Risk Matrix Log</span>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-[9px] text-left">
                              <thead>
                                <tr className="border-b border-slate-900 text-slate-500 font-bold">
                                  <th className="pb-1.5">Roadblock Description</th>
                                  <th className="pb-1.5">Project</th>
                                  <th className="pb-1.5">Impact</th>
                                  <th className="pb-1.5 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900">
                                {mockRisks.map((risk, idx) => (
                                  <tr key={risk.id} className="hover:bg-slate-900/30">
                                    <td className="py-2.5 font-medium text-slate-200">{risk.description}</td>
                                    <td className="py-2.5 text-slate-400">{risk.project}</td>
                                    <td className="py-2.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${
                                        risk.impact === 'High' ? 'bg-red-500/10 text-red-400' :
                                        risk.impact === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-slate-500/10 text-slate-400'
                                      }`}>{risk.impact}</span>
                                    </td>
                                    <td className="py-2.5 text-right">
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setMockRisks(prev => prev.map((r, rIdx) => 
                                            rIdx === idx ? { ...r, status: r.status === 'Open' ? 'Closed' : 'Open' } : r
                                          ));
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-colors ${
                                          risk.status === 'Open' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/25' :
                                          'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25'
                                        }`}
                                      >
                                        {risk.status}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sub-View 4: Branding Settings Simulator */}
                      {mockView === 'settings' && (
                        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 space-y-4 animate-fade-in text-[10px]">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                            <span className="font-bold text-white">Bespoke Brand & Team Customizer</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${innerAccent.badgeBg} ${innerAccent.text}`}>Branding Engine</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Color Selector & Naming */}
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Mock Workspace Name</label>
                                <input 
                                  type="text" 
                                  value={mockCompanyName}
                                  onChange={(e) => setMockCompanyName(e.target.value)}
                                  placeholder="E.g. Syncra Hub"
                                  className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none focus:border-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Selected Branding Color</label>
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                  {Object.keys(themeAccentMap).slice(0, 8).map(color => (
                                    <button 
                                      key={color}
                                      type="button"
                                      onClick={() => setMockThemeColor(color)}
                                      className={`w-4 h-4 rounded-full transition-transform ${themeAccentMap[color]?.bg} ${mockThemeColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                                      title={color}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* User invites */}
                            <div className="space-y-3">
                              <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Onboard Project Members</label>
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!newInviteEmail.trim()) return;
                                  const name = newInviteEmail.split('@')[0];
                                  const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
                                  const newUser = {
                                    id: Math.random().toString(),
                                    name: formattedName,
                                    email: newInviteEmail,
                                    role: newInviteRole,
                                    status: 'Active'
                                  };
                                  setMockUsers(prev => [...prev, newUser]);
                                  setNewInviteEmail('');
                                }}
                                className="space-y-1.5"
                              >
                                <div className="flex gap-1.5">
                                  <input 
                                    type="email" 
                                    required
                                    value={newInviteEmail}
                                    onChange={(e) => setNewInviteEmail(e.target.value)}
                                    placeholder="Enter colleague email..." 
                                    className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-[9px] text-white outline-none"
                                  />
                                  <select
                                    value={newInviteRole}
                                    onChange={(e) => setNewInviteRole(e.target.value)}
                                    className="bg-slate-950 border border-slate-850 rounded px-1 text-[9px] text-white outline-none"
                                  >
                                    <option value="PM">PM</option>
                                    <option value="Finance">Finance</option>
                                    <option value="Manager">Manager</option>
                                  </select>
                                </div>
                                <button 
                                  type="submit"
                                  className={`w-full py-1 rounded text-[9px] font-bold text-slate-950 ${innerAccent.bg} hover:opacity-90`}
                                >
                                  Invite User & Save
                                </button>
                              </form>
                            </div>
                          </div>

                          {/* Interactive User Table */}
                          <div className="space-y-1.5">
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Active Workspace Members ({mockUsers.length})</p>
                            <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 space-y-1.5 max-h-[85px] overflow-y-auto">
                              {mockUsers.map(user => (
                                <div key={user.id} className="flex justify-between items-center text-[9px] p-1 bg-slate-900/60 rounded">
                                  <div>
                                    <span className="font-semibold text-white">{user.name}</span>
                                    <span className="text-slate-500 text-[8px] ml-1.5">{user.email}</span>
                                  </div>
                                  <span className={`text-[7px] font-bold px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700`}>
                                    {user.role}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}

              {/* Bottom Interactive Trigger Area */}
              <div className="mt-5 pt-3 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[11px] text-slate-400 text-center sm:text-left">
                  This interactive mockup demonstrates the actual features of the workspace. Click sidebar tabs and change roles to test it.
                </p>
                <button 
                  onClick={onExploreDemo}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-slate-950 transition-all ${accent.bg} hover:opacity-90 shadow-md ${accent.glow}`}
                >
                  <span>Launch Live Demo Application</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* The Story / Pitch Section */}
      <section id="story" className="py-20 border-t border-slate-900 bg-slate-950 px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">BUILT FOR DELIVERY TEAMS</h2>
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
              Why Generic PM Tools Fall Short
            </p>
            <p className="text-slate-400 text-base leading-relaxed">
              Delivery teams don't just manage tasks — they manage clients, phases, billings, and escalations simultaneously.
              Generic tools weren't built for that reality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Column 1: The Problem */}
            <div className="bg-slate-900/30 border border-slate-850 p-8 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">The Status Quo: Spreadsheets & Chaos</h3>
                <ul className="space-y-4 text-sm text-slate-400">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    <span><strong>Scattered Invoicing</strong>: Finance doesn't know when a delivery milestone is completed, resulting in delayed billing or missed revenue intakes.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    <span><strong>Static Status Logs</strong>: Weekly PDF status decks are outdated the moment they are generated, hiding blocker risks until they escalate.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    <span><strong>Unfocused PM Metrics</strong>: Standard dashboards measure code tickets instead of project outcomes, customer satisfaction, and delivery velocities.</span>
                  </li>
                </ul>
              </div>
              <p className="text-xs text-red-400/80 font-semibold mt-8 italic">
                Resulting in missed billing deadlines, stressed PMs, and misaligned executives.
              </p>
            </div>

            {/* Column 2: The Solution */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors relative">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${accent.gradient} blur-xl opacity-20`} />
              <div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${accent.badgeBg} border ${accent.border}`}>
                  <CheckCircle2 className={`w-6 h-6 ${accent.text}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">The {companyName} Approach: Unified Delivery</h3>
                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${accent.bg}`} />
                    <span><strong>Milestone-Linked Revenue</strong>: Connect delivery states (e.g. Implementation, Sign-Off) directly to "Ready for Billing" markers.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${accent.bg}`} />
                    <span><strong>Dynamic Client Portals</strong>: Automatically adapts styling, client package definitions, and milestones for bespoke client setups.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${accent.bg}`} />
                    <span><strong>Role-Specific Visibility</strong>: Empower PMs with active queues, Finance with revenue triggers, and Executives with velocity stats.</span>
                  </li>
                </ul>
              </div>
              <div className={`flex items-center gap-2 mt-8 text-xs font-semibold ${accent.text}`}>
                <span>A single point of truth from Intake to Billing.</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Offerings Grid Section */}
      <section id="offerings" className="py-20 border-t border-slate-900 bg-slate-900/10 px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">WHAT IT ACTUALLY DOES</h2>
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
              Outcomes, Not Just Features
            </p>
            <p className="text-slate-400 text-base">
              Every capability is designed around one question: what does your team need to stop worrying about?
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Offering 1 */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl hover:border-slate-800 transition-all hover:-translate-y-1 group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${accent.badgeBg} border border-slate-800 group-hover:border-slate-700 transition-colors`}>
                <DollarSign className={`w-5 h-5 ${accent.text}`} />
              </div>
              <h3 className="font-bold text-white text-base mb-2">Know when a project is slipping — before the client does</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                SPI tracking flags schedule deviations in real time. No more end-of-week surprises — your team sees drift the moment it starts.
              </p>
            </div>

            {/* Offering 2 */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl hover:border-slate-800 transition-all hover:-translate-y-1 group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${accent.badgeBg} border border-slate-800 group-hover:border-slate-700 transition-colors`}>
                <Globe className={`w-5 h-5 ${accent.text}`} />
              </div>
              <h3 className="font-bold text-white text-base mb-2">Every phase gated. No shortcuts. Full accountability.</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Phase management enforces structured delivery: each stage must be completed and signed off before the next opens.
              </p>
            </div>

            {/* Offering 3 */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl hover:border-slate-800 transition-all hover:-translate-y-1 group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${accent.badgeBg} border border-slate-800 group-hover:border-slate-700 transition-colors`}>
                <AlertTriangle className={`w-5 h-5 ${accent.text}`} />
              </div>
              <h3 className="font-bold text-white text-base mb-2">Risks tracked, owned, and escalated — nothing falls through</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The risk registry assigns ownership and impact levels to every issue. Escalation loops ensure blockers surface before they become crises.
              </p>
            </div>

            {/* Offering 4 */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl hover:border-slate-800 transition-all hover:-translate-y-1 group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${accent.badgeBg} border border-slate-800 group-hover:border-slate-700 transition-colors`}>
                <Users className={`w-5 h-5 ${accent.text}`} />
              </div>
              <h3 className="font-bold text-white text-base mb-2">Onboard 50 projects in minutes, not weeks</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bulk import tools let you migrate existing programmes at scale. No manual data entry, no re-keying — just structured, validated imports.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Role-based Perspective Section (Interactive Tabs) */}
      <section id="personas" className="py-20 border-t border-slate-900 bg-slate-950 px-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">ROLE-BASED VALUE</h2>
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
              One Dashboard, Four Custom Workspaces
            </p>
            <p className="text-slate-400 text-base">
              {companyName} is designed to fit the specific needs of different team members. 
              Select a role below to see how they interact with the platform.
            </p>
          </div>

          {/* Persona Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-900 pb-4 mb-10">
            <button 
              onClick={() => setActiveTab('exec')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'exec' ? `${accent.badgeBg} ${accent.text} border ${accent.border}` : 'text-slate-500 hover:text-slate-300'}`}
            >
              For Executives & Leadership
            </button>
            <button 
              onClick={() => setActiveTab('pm')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'pm' ? `${accent.badgeBg} ${accent.text} border ${accent.border}` : 'text-slate-500 hover:text-slate-300'}`}
            >
              For Project Managers
            </button>
            <button 
              onClick={() => setActiveTab('finance')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'finance' ? `${accent.badgeBg} ${accent.text} border ${accent.border}` : 'text-slate-500 hover:text-slate-300'}`}
            >
              For Finance & Operations
            </button>
            <button 
              onClick={() => setActiveTab('client')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'client' ? `${accent.badgeBg} ${accent.text} border ${accent.border}` : 'text-slate-500 hover:text-slate-300'}`}
            >
              For Client Stakeholders
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 md:p-10">
            {activeTab === 'exec' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${accent.text}`}>EXECUTIVE DASHBOARD VIEW</span>
                  <h3 className="text-2xl font-bold text-white">Full Program Health at a Single Glance</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Executives don't need to read ticket descriptions. They need high-level charts. 
                    Get real-time distributions of product lines, total intake value metrics, and active risk alerts to drive board reviews.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Total Revenue Intake (achieved vs pending summary)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Product line allocations (Core Platform, Digital Channels, Analytics)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>PM Delivery velocity metrics and scorecard averages</span>
                    </li>
                  </ul>
                </div>
                {/* Visual Snapshot Card */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850">
                    <span className="text-xs font-bold text-white">Executive Revenue Scoreboard</span>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">$680k Intake</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Total Intake:</span>
                      <span className="font-bold text-white">$680,000</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Total Achieved (Billed):</span>
                      <span className="font-bold text-emerald-400">$300,000</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Total Pending (In Progress):</span>
                      <span className="font-bold text-amber-400">$380,000</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{width: '45%'}} />
                    <div className="h-full bg-amber-500" style={{width: '55%'}} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pm' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${accent.text}`}>PROJECT MANAGER WORKSPACE</span>
                  <h3 className="text-2xl font-bold text-white">Focus on Delivering Milestones, Not Tracking Logs</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Provide PMs with clear workspaces filtered directly to their client portfolios. 
                    Update completion dates, document roadblocks, log comments, and edit milestone weights on the fly.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Dedicated portfolio filtered views (e.g. Sarah Jenkins' assigned view)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Interactive client comment threads with team timestamps</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Milestone weight configuration based on delivery effort</span>
                    </li>
                  </ul>
                </div>
                {/* Visual Snapshot Card */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850">
                    <span className="text-xs font-bold text-white">Sarah Jenkins' Active PM Portfolio</span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full">2 Active</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-850 text-xs">
                      <p className="font-semibold text-white">Nexus Enterprises</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Next Up: Implementation (Target: Today)</p>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-850 text-xs">
                      <p className="font-semibold text-white">Lumina Group</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">Status: Closed & Fully Billed</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${accent.text}`}>FINANCE & BILLING TRIGGER QUEUE</span>
                  <h3 className="text-2xl font-bold text-white">Clear Billing Trigger Handshakes</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Eliminate invoice delays. When a delivery manager closes a milestone, the project transitions to "Ready for Billing". 
                    Finance can review weights, confirm achievements, and check off billing records.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>"Ready for Billing" intake dashboard filters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Post-intake weight history and audit logging logs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Historical billing state mapping (Ready, Billed, Closed)</span>
                    </li>
                  </ul>
                </div>
                {/* Visual Snapshot Card */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850">
                    <span className="text-xs font-bold text-white">Billing Queue Trigger</span>
                    <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">Billing Alert</span>
                  </div>
                  <div className="text-xs space-y-2">
                    <div className="p-2 bg-slate-900 border border-slate-850 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-white">Nexus Enterprises</p>
                        <p className="text-[9px] text-slate-500">Value: $250k • Weight: 1.2</p>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-semibold">Ready to Invoice</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'client' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${accent.text}`}>CLIENT BRAND PORTAL</span>
                  <h3 className="text-2xl font-bold text-white">Build Trust Through Visual Alignment</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Provide your enterprise clients with high-fidelity views of their programs. 
                    Synchronize the color theme and brand logo to match their corporate color guides directly in Settings.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Custom color layouts (rose, violet, emerald, amber, etc.)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Corporate brand logo upload and display support</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>High-level customer-facing status graphs (no dev ticket noise)</span>
                    </li>
                  </ul>
                </div>
                {/* Visual Snapshot Card */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded bg-teal-500`} />
                      <span className="text-xs font-bold text-white font-sans">Nexus Enterprises Portal</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-semibold border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded-full font-sans">Active</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400">Current Milestone Target: Implementation Phase</p>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500" style={{width: '75%'}} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Hire Me / Contact Form Section */}
      <section id="contact" className="py-20 border-t border-slate-900 bg-slate-900/10 px-6 relative">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-855 bg-slate-900 text-xs font-bold text-slate-400 mb-4">
              <Sparkles className={`w-3.5 h-3.5 ${accent.text}`} />
              <span>CUSTOM WORKSPACE IMPLEMENTATIONS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 font-sans">
              Let's Build Your Dedicated Delivery Workspace
            </h2>
            <p className="text-slate-400 text-base max-w-2xl mx-auto">
              Need to migrate this program tracker in-house? Looking for custom CRM, ERP integrations, or client portals? 
              Contact me below. I will customize and build a production-ready solution tailored for your team.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 md:p-10 backdrop-blur-md shadow-xl relative overflow-hidden">
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your name" 
                    className={`w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all ${accent.ring} focus:ring-4`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Contact Email <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address" 
                    className={`w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all ${accent.ring} focus:ring-4`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Organization / Company
                  </label>
                  <input 
                    type="text" 
                    name="org"
                    value={formData.org}
                    onChange={handleInputChange}
                    placeholder="Organization name" 
                    className={`w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all ${accent.ring} focus:ring-4`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Project Scope
                  </label>
                  <select 
                    name="scope"
                    value={formData.scope}
                    onChange={handleInputChange}
                    className={`w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all ${accent.ring} focus:ring-4`}
                  >
                    <option value="In-House Workspace Migration">In-House Workspace Migration</option>
                    <option value="Bespoke Client Portals">Bespoke Client Portals</option>
                    <option value="Custom CRM/ERP Integration">Custom CRM/ERP Integration</option>
                    <option value="Full Delivery Suite Build">Full Program Operations Suite</option>
                    <option value="Other / General Consultation">Other / General Consulting</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Estimated Project Budget
                </label>
                <select 
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  className={`w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all ${accent.ring} focus:ring-4`}
                >
                  <option value="Under $5,000">Under $5,000</option>
                  <option value="$5,000 - $10,000">$5,000 - $10,000</option>
                  <option value="$10,000 - $25,000">$10,000 - $25,000</option>
                  <option value="Over $25,000">Over $25,000</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Requirements & Details <span className="text-red-500">*</span>
                </label>
                <textarea 
                  name="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe your program, current bottlenecks, or custom requirements..." 
                  className={`w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-700 transition-all ${accent.ring} focus:ring-4`}
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className={`w-full flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-slate-950 transition-all text-base ${accent.bg} hover:opacity-95 shadow-xl ${accent.glow}`}
                >
                  <Mail className="w-5 h-5" />
                  <span>Submit Inquiry Spec</span>
                </button>
              </div>

            </form>

            {/* Developer Contact Card */}
            <div className="mt-10 pt-8 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-6 text-slate-400 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">Direct Email Channels</p>
                  <a href="mailto:letslokin@gmail.com" className={`underline hover:${accent.text}`}>letslokin@gmail.com</a>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-semibold text-white">Guaranteed Response Window</p>
                <p>Discovery call scheduled within 24 business hours</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-12 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent.bg}`}>
              <Briefcase className="w-4 h-4 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="font-bold text-white text-base font-sans">{companyName}</span>
              <span className="text-[10px] text-slate-500 block leading-none">In-House Delivery Systems</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} {companyName} Systems. Built for high-visibility program management.
          </p>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
            <a href="mailto:letslokin@gmail.com" className={`hover:${accent.text} transition-colors`}>Contact Developer</a>
          </div>
        </div>
      </footer>

      {/* Success Confirmation Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSuccessModal(false)} />
          
          {/* Modal Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative z-10 animate-scale-in">
            <div className="text-center space-y-4">
              
              <div className={`w-14 h-14 rounded-full ${accent.badgeBg} flex items-center justify-center mx-auto mb-4`}>
                <CheckCircle2 className={`w-8 h-8 ${accent.text}`} />
              </div>

              <h3 className="text-2xl font-bold text-white font-sans">Inquiry Spec Formed!</h3>
              
              <p className="text-sm text-slate-400 leading-relaxed">
                Thank you, <strong>{formData.name}</strong>. I've prepared a customized email draft containing your project scope, budget range, and message details.
              </p>

              <div className="p-4 bg-slate-950 rounded-xl text-left border border-slate-850 space-y-2 text-xs text-slate-300 font-mono">
                <p><strong>To:</strong> letslokin@gmail.com</p>
                <p><strong>Subject:</strong> Custom {companyName} Implementation</p>
                <p><strong>Scope:</strong> {formData.scope}</p>
                <p><strong>Budget:</strong> {formData.budget}</p>
              </div>

              <p className="text-xs text-slate-500 font-sans">
                Click below to launch your system's email client and send the inquiry immediately.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full sm:flex-1 py-3 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
                >
                  Edit Information
                </button>
                <button 
                  onClick={triggerEmail}
                  className={`w-full sm:flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 transition-all ${accent.bg} hover:opacity-90 shadow-lg ${accent.glow}`}
                >
                  Open Email Draft & Send
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
