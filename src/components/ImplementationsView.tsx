import React, { useState, useEffect } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { cn, isRole } from '../lib/utils';
import { ServiceExtension, Role, AppConfig } from '../types';
import { api } from '../lib/api';
import { NewImplementationModal } from './NewImplementationModal';
import { ManageImplementationModal } from './ManageImplementationModal';
import { IMInsightsView } from './IMInsightsView';
import { Project, User } from '../types';

interface ImplementationsViewProps {
  userRole: Role;
  userName: string;
  config: AppConfig;
  projects: Project[];
  users: User[];
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ImplementationsView: React.FC<ImplementationsViewProps> = ({ 
  userRole, userName, config, projects, users, onShowToast 
}) => {
  const [extensions, setExtensions] = useState<ServiceExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [managingExtension, setManagingExtension] = useState<ServiceExtension | null>(null);
  
  const isLead = isRole(userRole, 'IM Lead') || isRole(userRole, 'Superadmin');
  const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'insights'>(isLead ? 'insights' : 'mine');

  const loadExtensions = async () => {
    try {
      setLoading(true);
      let data;
      if (activeTab === 'all' && isLead) {
        data = await api.serviceExtensions.getAll();
      } else {
        data = await api.serviceExtensions.getByIM(userName);
      }
      setExtensions(data);
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();
  }, [activeTab, userName]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Wrench className="w-8 h-8 text-teal-600" />
            Service Implementations
          </h2>
          <p className="text-slate-500 font-medium mt-1">Manage standalone and project-linked service extensions.</p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 hover:shadow-teal-700/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Implementation
        </button>
      </div>

      {isLead && (
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('insights')}
            className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'insights' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            Team Insights
          </button>
          <button 
            onClick={() => setActiveTab('all')}
            className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            Team Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('mine')}
            className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'mine' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            My Implementations
          </button>
        </div>
      )}

      <div className={cn("bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]", activeTab === 'insights' && "bg-transparent border-none shadow-none min-h-0")}>
        {activeTab === 'insights' ? (
          <IMInsightsView 
            extensions={extensions}
            users={users}
            config={config}
          />
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
             <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Wrench className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-bold">No implementations found.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client & Service</th>
                {isLead && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Progress</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapping</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extensions.map(ext => {
                const completedMilestones = ext.milestones.filter(m => m.completed).length;
                const totalMilestones = ext.milestones.length;
                const progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
                
                return (
                  <tr key={ext.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900">{ext.clientName}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                        {ext.serviceName} ({ext.serviceVariant || 'Standard'})
                      </div>
                    </td>
                    {isLead && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">{ext.implementationManager}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md",
                        ext.status === 'Completed' ? "bg-emerald-100 text-emerald-700" :
                        ext.status === 'In Progress' ? "bg-blue-100 text-blue-700" :
                        ext.status === 'Frozen' ? "bg-slate-200 text-slate-600" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {ext.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {totalMilestones > 0 ? (
                        <div className="flex flex-col items-center gap-1.5">
                           <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                           </div>
                           <span className="text-[10px] font-bold text-slate-400">{completedMilestones} of {totalMilestones}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">No milestones</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">{ext.targetClosureDate}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md",
                        ext.mappingStatus === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                        ext.mappingStatus === 'Pending' ? "bg-amber-100 text-amber-700" :
                        ext.mappingStatus === 'Rejected' ? "bg-red-100 text-red-600" :
                        "bg-slate-100 text-slate-400"
                      )}>
                        {ext.mappingStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setManagingExtension(ext)}
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-teal-600/20"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isNewModalOpen && (
        <NewImplementationModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            loadExtensions();
          }}
          config={config}
          userName={userName}
        />
      )}

      {managingExtension && (
        <ManageImplementationModal
          extension={managingExtension}
          isOpen={!!managingExtension}
          onClose={() => setManagingExtension(null)}
          onUpdated={(updated) => {
            setExtensions(prev => prev.map(e => e.id === updated.id ? updated : e));
            setManagingExtension(updated);
          }}
          userRole={userRole}
          userName={userName}
          config={config}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
