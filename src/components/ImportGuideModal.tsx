import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Info, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';
import { AppConfig } from '../types';

interface ImportGuideModalProps {
  isOpen: boolean;
  config: AppConfig;
  onProceed: (hideFuture: boolean) => void;
  onShowToast: (message: string, type?: 'error' | 'success') => void;
}

export const ImportGuideModal: React.FC<ImportGuideModalProps> = ({ 
  isOpen, 
  config, 
  onProceed, 
  onShowToast 
}) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const [hideFuture, setHideFuture] = useState(false);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    try {
      // Create Workbook
      const wb = XLSX.utils.book_new();

      // --- Sheet 1: Import Template ---
      const headers = [
        "Institution Name", "Package / Service Type", "Project Manager", 
        "Intake Type", "Starting Phase", "Start Date", "Expected Completion Date", 
        "Cost / Value", "Currency", "Subscription Level", "USSD", "Transfers", 
        "Mobile / Internet Banking", "Branchless", "Cards", 
        "Bills Payment", "API Provisioning", "Project Closure Status", 
        "Key Updates / Notes"
      ];

      const sampleDataRow = [
        "Apex Microfinance Bank", "Digital Banking", "Sarah Jenkins",
        "Old", "Execution", "01/01/2025", "30/06/2025", "5000000",
        "NGN", "BIB L1", "Live", "Live",
        "Not Started", "Out of Scope", "Not Started",
        "Not Started", "Not Started", "Active",
        "Legacy project. All previous phases auto-completed."
      ];

      const guidanceRow = [
        "Required. Must be unique.", "Must match a configured service type exactly", "Must match an existing user in the system",
        "New or Old. Use 'Old' for legacy projects.", "Initiation, Planning, Execution, or Closure", "Required. Format: DD/MM/YYYY", "Required for 'Old' projects. Optional for 'New'.",
        "Required. Numbers only — no symbols or commas",
        "NGN, USD, GBP, EUR, KES, GHS, or ZAR", "Optional", "Live, Not Started, Out of Scope, or Not Ready", "Live, Not Started, Out of Scope, or Not Ready",
        "Live, Not Started, Out of Scope, or Not Ready", "Live, Not Started, Out of Scope, or Not Ready", "Live, Not Started, Out of Scope, or Not Ready",
        "Live, Not Started, Out of Scope, or Not Ready", "Live, Not Started, Out of Scope, or Not Ready", "Active, Closed, Suspended, Signed Off, Billed",
        "Optional. Free text."
      ];

      const templateWs = XLSX.utils.aoa_to_sheet([headers, sampleDataRow, guidanceRow]);
      XLSX.utils.book_append_sheet(wb, templateWs, "Import Template");

      // --- Sheet 2: Instructions ---
      const instructionsText = [
        ["Getting Started"],
        ["Fill in one project per row starting from Row 4 on the Import Template sheet. Rows 2 and 3 are examples — delete them before uploading or leave them, the system will flag them as errors and you can remove them in the review step."],
        [""],
        ["Required Fields"],
        ["The following fields must be filled in for every row or the entry will be flagged as an error: Institution Name, Package / Service Type, Project Manager, Start Date, Cost / Value, Currency."],
        [""],
        ["Valid Status Values"],
        ["Module statuses (USSD, Transfers, etc.) must be one of: Live, Not Started, Out of Scope, Not Ready. Any other value will be flagged as an error."],
        [""],
        ["Date Format"],
        ["Dates must be in DD/MM/YYYY format. Example: 01/03/2026 for 1 March 2026."],
        [""],
        ["Currency"],
        ["Use currency codes only: NGN, USD, GBP, EUR, KES, GHS, ZAR. Do not include symbols."],
        [""],
        ["Cost / Value"],
        ["Enter numbers only with no formatting — no currency symbols, no commas. Example: 5000000 not NGN 5,000,000."],
        [""],
        ["Duplicate Projects"],
        ["If an institution name already exists in the system, it will be flagged as a duplicate in the review step. You can choose to overwrite the existing record or skip that row."],
        [""],
        ["Legacy / Older Projects"],
        ["For projects that were already in progress before using this platform, set Intake Type to 'Old'. You MUST provide both a Start Date and an Expected Completion Date. The system will calculate the duration and auto-complete previous phases based on your current status."],
        [""],
        ["Need Help?"],
        ["Contact your Super Admin or refer to the platform documentation."]
      ];

      const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsText);
      XLSX.utils.book_append_sheet(wb, instructionsWs, "Instructions");

      // Generate File and trigger download
      XLSX.writeFile(wb, "Qore_PD_Import_Template.xlsx");
    } catch (e) {
      onShowToast("Template download failed. Please try again.", "error");
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 aria-hidden"
      role="dialog" 
      aria-modal="true"
      aria-labelledby="import-guide-title"
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-start justify-between">
           <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md", theme.bg)}>
                <Upload className="w-6 h-6" />
              </div>
              <div>
                 <h2 id="import-guide-title" className="text-2xl font-black text-slate-900 tracking-tight">Bulk Import Projects</h2>
                 <p className="text-sm font-medium text-slate-500 mt-1">Add multiple projects at once from a CSV or Excel file</p>
              </div>
           </div>
           <button onClick={() => onProceed(hideFuture)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors" aria-label="Close Guide">
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Body */}
        <div className="p-8 flex gap-8">
           {/* Left Column */}
           <div className="flex-1">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Info className="w-4 h-4 text-teal-600" /> What this does
             </h3>
             <ul className="space-y-3 text-sm text-slate-600 font-medium">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0"></span>
                  Bulk import lets you add multiple projects to the platform at once
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0"></span>
                  After uploading, you'll review every entry before anything is saved
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0"></span>
                  Incomplete or invalid rows are flagged — you can fix or remove them before confirming
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 shrink-0"></span>
                  Once confirmed, all projects are created and dashboards update immediately
                </li>
             </ul>
           </div>

           {/* Right Column */}
           <div className="flex-1 border-l border-slate-100 pl-8">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4 text-emerald-600" /> How to use it
             </h3>
             <ol className="space-y-3 text-sm text-slate-600 font-medium list-decimal pl-4">
               <li>Download the template below</li>
               <li>Fill in your project data — one project per row</li>
               <li>Upload the completed file</li>
               <li>Review flagged entries and fix or remove them</li>
               <li>Confirm to create all projects</li>
             </ol>
           </div>
        </div>

        {/* Template Download Section */}
        <div className="bg-slate-50 px-8 py-6 border-y border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">Start with our template for the best results</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Pre-formatted with the correct columns and sample data. Accepted formats: .csv and .xlsx</p>
            </div>
            <button 
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 flex flex-col gap-4">
           <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <input 
                   type="checkbox" 
                   checked={hideFuture}
                   onChange={(e) => setHideFuture(e.target.checked)}
                   className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer" 
                 />
                 <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
                   Don't show this again
                 </span>
              </label>
              
              <button 
                onClick={() => onProceed(hideFuture)} 
                className={cn("px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-transform hover:scale-105", theme.bg, theme.hoverBg)}
              >
                Got it — let's import
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
