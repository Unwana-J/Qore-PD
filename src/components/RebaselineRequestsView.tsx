import React, { useState } from 'react';
import { RebaselineRequest, Role } from '../types';
import { format } from 'date-fns';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  MessageSquare,
  User,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface RebaselineRequestsViewProps {
  requests: RebaselineRequest[];
  onApprove: (projectId: string, requestId: string, comment?: string) => Promise<void>;
  onDecline: (projectId: string, requestId: string, comment: string) => Promise<void>;
  userRole: Role;
  themeColor?: string;
}

export const RebaselineRequestsView: React.FC<RebaselineRequestsViewProps> = ({ 
  requests, onApprove, onDecline, userRole, themeColor = 'teal' 
}) => {
  const [selectedRequest, setSelectedRequest] = useState<RebaselineRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = getThemeClasses(themeColor);

  const pendingRequests = requests.filter(r => r.status === 'Pending').sort((a, b) => 
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  
  const processedRequests = requests.filter(r => r.status !== 'Pending').sort((a, b) => 
    new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime()
  );

  const handleReview = async (type: 'Approve' | 'Decline') => {
    if (!selectedRequest) return;
    if (type === 'Decline' && !reviewComment.trim()) {
      alert('Please provide a reason for declining.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (type === 'Approve') {
        await onApprove(selectedRequest.projectId, selectedRequest.id, reviewComment);
      } else {
        await onDecline(selectedRequest.projectId, selectedRequest.id, reviewComment);
      }
      setSelectedRequest(null);
      setReviewComment('');
    } catch (error) {
      console.error('Failed to process rebaseline request', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">Rebaseline Requests</h2>
          <p className="text-sm text-slate-500 mt-1">Review and approve project timeline extensions</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-700">{pendingRequests.length} Pending</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Pending Queue</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {pendingRequests.map(request => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={cn(
                    "w-full px-6 py-5 text-left transition-all hover:bg-slate-50 flex items-center gap-4 group",
                    selectedRequest?.id === request.id && "bg-slate-50 ring-2 ring-inset ring-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                    theme.lightBg, theme.text
                  )}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-900 truncate">{request.projectName}</h4>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {format(new Date(request.submittedAt), 'MMM d, p')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {request.submittedBy}
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <Calendar className="w-3 h-3" />
                        +{request.extensionDays} Days
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "w-5 h-5 text-slate-300 transition-transform group-hover:translate-x-1",
                    selectedRequest?.id === request.id && "text-slate-500"
                  )} />
                </button>
              ))}
              {pendingRequests.length === 0 && (
                <div className="py-20 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                  <p className="text-slate-400 italic">No pending rebaseline requests.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden opacity-80">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Recently Processed</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {processedRequests.map(request => (
                <div key={request.id} className="px-6 py-4 flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    request.status === 'Approved' ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500"
                  )}>
                    {request.status === 'Approved' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{request.projectName}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {request.status} by {request.reviewedBy} on {format(new Date(request.reviewedAt || 0), 'MMM d')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-600">+{request.extensionDays} Days</span>
                  </div>
                </div>
              ))}
              {processedRequests.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  History is empty.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cn(
            "bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden transition-all duration-300 h-fit sticky top-6",
            !selectedRequest && "opacity-50 grayscale pointer-events-none"
          )}>
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Request Details</h3>
            </div>
            {selectedRequest ? (
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">PM's Reason</p>
                    <div className="flex gap-3">
                      <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                      <p className="text-sm text-slate-600 italic leading-relaxed">
                        "{selectedRequest.pmComment}"
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current End</p>
                      <p className="text-sm font-bold text-slate-900">{selectedRequest.currentCompletionDate}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Proposed End</p>
                      <p className="text-sm font-bold text-amber-700">{selectedRequest.newCompletionDate}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reviewer Comment</label>
                  <textarea 
                    rows={3}
                    placeholder="Add a feedback for the PM..."
                    className={cn(
                      "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 outline-none text-sm transition-all resize-none",
                      theme.ring
                    )}
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview('Decline')}
                    disabled={isSubmitting || !reviewComment.trim()}
                    className="flex-1 px-4 py-3 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleReview('Approve')}
                    disabled={isSubmitting}
                    className={cn(
                      "flex-1 px-4 py-3 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50",
                      theme.bg, theme.hoverBg
                    )}
                  >
                    {isSubmitting ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                <ChevronRight className="w-12 h-12 mx-auto mb-2 rotate-90 opacity-10" />
                <p className="text-sm italic">Select a request to review</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
