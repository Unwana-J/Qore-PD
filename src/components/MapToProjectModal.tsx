import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, AlertCircle, MapPin, Calendar, Package } from 'lucide-react';
import { ServiceExtension, Project } from '../types';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface MapToProjectModalProps {
  extension: ServiceExtension;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const MapToProjectModal: React.FC<MapToProjectModalProps> = ({
  extension, isOpen, onClose, onSuccess, onShowToast
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all projects on mount (only those in Planning or later, not Closed)
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.projects.getAll()
      .then(projects => {
        // Only map to projects that are at Planning or later — not Closed
        const eligible = projects.filter(p =>
          !['Closed', 'Billed'].includes(p.state) &&
          p.phases?.some(ph => ph.id === 'Planning' && ph.status === 'Completed')
        );
        setAllProjects(eligible);
        setResults(eligible.slice(0, 6));
      })
      .catch(err => onShowToast(err.message, 'error'))
      .finally(() => setLoading(false));
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Fuzzy search: filter by client name or package name
  useEffect(() => {
    if (!query.trim()) {
      setResults(allProjects.slice(0, 6));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allProjects.filter(p =>
      p.clientName?.toLowerCase().includes(q) ||
      p.packageName?.toLowerCase().includes(q) ||
      p.assignedPM?.toLowerCase().includes(q)
    );
    setResults(filtered.slice(0, 8));
  }, [query, allProjects]);

  const handleSubmit = async () => {
    if (!selected) {
      onShowToast('Please select a project to map to.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.serviceExtensions.requestMapping(extension.id, selected.id, notes);
      onShowToast('Mapping request submitted. Awaiting PM approval.');
      onSuccess();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900">Map to Project</h2>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Search for a project to link this implementation to.
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {/* Extension Summary */}
            <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100">
              <p className="text-[10px] font-black uppercase text-teal-500 tracking-widest mb-1">Implementation to Map</p>
              <p className="text-sm font-bold text-teal-900">{extension.clientName} — {extension.serviceName} ({extension.serviceVariant || 'Standard'})</p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by client name, package, or PM..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
              />
            </div>

            {/* Results */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold">No eligible projects found.</p>
                <p className="text-xs mt-1">Projects must be past Planning phase and not Closed.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all",
                      selected?.id === p.id
                        ? "border-teal-500 bg-teal-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-black text-slate-900 block truncate">{p.clientName}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Package className="w-3 h-3" /> {p.packageName}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Calendar className="w-3 h-3" /> {p.startDate}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 block mt-1">PM: {p.assignedPM}</span>
                      </div>
                      <span className={cn(
                        "flex-shrink-0 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md",
                        p.state === 'On-Track' ? 'bg-emerald-100 text-emerald-700' :
                        p.state === 'Delayed' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      )}>
                        {p.state}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Notes */}
            {selected && (
              <div className="space-y-2 animate-in fade-in">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Notes for PM (Optional)</label>
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all resize-none"
                  placeholder="Describe why this implementation relates to this project..."
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Mapping Request'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
