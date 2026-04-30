import React, { useState } from 'react';
import { X, UserPlus, Calendar, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { ServiceExtension, User } from '../types';
import { cn } from '../lib/utils';

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newIM: string) => void;
  extension: ServiceExtension;
  users: User[];
  loading?: boolean;
}

export const ReassignModal: React.FC<ReassignModalProps> = ({
  isOpen, onClose, onConfirm, extension, users, loading
}) => {
  const [selectedIM, setSelectedIM] = useState(extension.implementationManager);
  const ims = users.filter(u => u.role === 'IM' || u.role === 'IM Lead');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <UserPlus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Reassign Manager</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{extension.clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">New Implementation Manager</label>
            <div className="grid grid-cols-1 gap-2">
              {ims.map(im => (
                <button
                  key={im.id}
                  onClick={() => setSelectedIM(im.name)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    selectedIM === im.name 
                      ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-900">{im.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{im.role}</p>
                  </div>
                  {selectedIM === im.name && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              * This action will be logged in the assignment history. The new manager will inherit all milestones and mapping requests.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            disabled={loading || selectedIM === extension.implementationManager}
            onClick={() => onConfirm(selectedIM)}
            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all"
          >
            {loading ? 'Reassigning...' : 'Confirm Reassignment'}
          </button>
          <button onClick={onClose} className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface ExtensionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, reason: string) => void;
  extension: ServiceExtension;
  loading?: boolean;
}

export const ExtensionRequestModal: React.FC<ExtensionRequestModalProps> = ({
  isOpen, onClose, onConfirm, extension, loading
}) => {
  const [newDate, setNewDate] = useState(extension.targetClosureDate);
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Request Extension</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{extension.clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">New Target Date</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              min={extension.targetClosureDate}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Reason for Extension</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why more time is needed..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all resize-none"
            />
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest leading-relaxed">
              Requests must be approved by the IM Lead. You will be notified once a decision is made.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            disabled={loading || !reason.trim() || newDate === extension.targetClosureDate}
            onClick={() => onConfirm(newDate, reason)}
            className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-lg shadow-amber-600/20 transition-all"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
          <button onClick={onClose} className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
