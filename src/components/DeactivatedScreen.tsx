import React from 'react';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { BrandConfig } from '../types';
import { getThemeClasses } from '../lib/theme';
import { cn } from '../lib/utils';

interface DeactivatedScreenProps {
  brand: BrandConfig;
  userName?: string;
  onLogout: () => void;
}

export const DeactivatedScreen: React.FC<DeactivatedScreenProps> = ({ brand, userName, onLogout }) => {
  const theme = getThemeClasses(brand.themeColor);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl", theme.bg)}>
             <ShieldAlert className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none italic uppercase flex items-center gap-2 justify-center">
              {brand.companyName}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Project Information System</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              Access Restricted
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Hello, <strong className="text-slate-900">{userName || 'User'}</strong>. Your profile has been marked as <strong>Inactive</strong>. 
            </p>
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 text-left">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium leading-relaxed">
                This account has been deactivated by a System Administrator or has been flagged for inactivity. You no longer have access to the dashboard.
              </p>
            </div>
            
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest pt-2">
              Please contact your Manager or Superadmin to reactivate your credentials.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Sign Out
          </button>
          
          <a 
            href="mailto:support@qore.com" 
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 justify-center"
          >
            <Mail className="w-3.5 h-3.5" />
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};
