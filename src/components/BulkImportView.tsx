import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileType, AlertTriangle, CheckCircle2, X, ChevronRight, Edit2, Archive, Check } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn, formatCurrency, calculateWorkingDays, getActiveDaysCount } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';
import { Project, Role, AppConfig, ImportRow, ImportRowStatus, User, ServiceBaseline, ProductLine } from '../types';
import { ImportGuideModal } from './ImportGuideModal';
import { PACKAGES, PRODUCT_LINES } from '../constants';

interface BulkImportViewProps {
  users: User[];
  projects: Project[];
  config: AppConfig;
  userRole: Role;
  onImportBulk: (add: Partial<Project>[], update: Partial<Project>[], skippedCount: number) => Promise<{ added: number, updated: number } | undefined>;
  onShowToast: (message: string, type?: 'error' | 'success' | 'info') => void;
  onUpdateConfig: (updates: Partial<AppConfig>) => void;
  onClose: () => void;
}

const REQUIRED_FIELDS = [
  { key: 'clientName', label: 'Institution Name' },
  { key: 'packageName', label: 'Package / Service Type' },
  { key: 'assignedPM', label: 'Project Manager' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'value', label: 'Cost / Value' },
  { key: 'currency', label: 'Currency' }
];

const OPTIONAL_FIELDS = [
  { key: 'implementationPerson', label: 'Project Implementation Person' },
  { key: 'subscriptionLevel', label: 'Subscription Level' },
  { key: 'closureStatus', label: 'Project Closure Status' },
  { key: 'notes', label: 'Key Updates / Notes' }
];

const EXPECTED_COLUMNS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

export const BulkImportView: React.FC<BulkImportViewProps> = ({ users, projects, config, userRole, onImportBulk, onShowToast, onUpdateConfig, onClose }) => {
  const theme = getThemeClasses(config.brand.themeColor);
  
  const [showGuide, setShowGuide] = useState(!config.hideImportGuide);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  
  const [processedRows, setProcessedRows] = useState<ImportRow[]>([]);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number, updated: number, skipped: number } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const moduleStatusOptions = ['Live', 'Not Started', 'Out of Scope', 'Not Ready'];
  
  // Ref to valid packages and PMs
  const validPackages = PACKAGES.map(p => p.name);
  const validPMs = users.filter(u => u.role === 'PM' && u.status === 'Active').map(u => u.name);
  
  // Validation function for a single row
  const validateRow = (row: ImportRow, rowIndex: number, allRows: ImportRow[]): ImportRow => {
    const errors: string[] = [];
    let status: ImportRowStatus = 'clean';

    // Required checks
    if (!row.clientName?.trim()) errors.push('Institution Name is blank');
    
    // Config validation
    if (row.packageName && !validPackages.includes(row.packageName.trim())) {
      errors.push(`Package '${row.packageName}' not found in configuration`);
    } else if (!row.packageName?.trim()) {
      errors.push('Package is blank');
    }

    if (row.assignedPM && !validPMs.includes(row.assignedPM.trim())) {
      errors.push(`PM '${row.assignedPM}' not found in system users`);
    } else if (!row.assignedPM?.trim()) {
      errors.push('Project Manager is blank');
    }

    // Date validation
    let normalizedStartDate = row.startDate;
    if (!row.startDate?.trim()) {
      errors.push('Start Date is missing');
    } else {
      try {
        const d = new Date(row.startDate);
        if (isNaN(d.getTime())) {
          errors.push('Start Date is invalid');
        } else {
          normalizedStartDate = d.toISOString().split('T')[0];
        }
      } catch {
        errors.push('Start Date is invalid');
      }
    }

    // Numeric validation
    let val = row.value;
    if (val === undefined || val === null || val === '') {
      errors.push('Cost is missing');
    } else {
      const numVal = typeof val === 'string' ? parseFloat(val.replace(/[^\d.-]/g, '')) : val;
      if (isNaN(numVal) || numVal < 0) {
        errors.push('Cost is invalid/negative');
      }
    }

    if (!row.currency?.trim()) errors.push('Currency is missing');
    
    // Duplicate calculation
    const currentName = row.clientName?.trim().toLowerCase();
    
    const isDuplicateInDb = projects.some(p => p.clientName.toLowerCase() === currentName);
    const duplicatesInFile = allRows.filter((r, idx) => idx !== rowIndex && r.clientName?.trim().toLowerCase() === currentName);

    if (errors.length > 0) {
      status = 'error';
    } else if (isDuplicateInDb || duplicatesInFile.length > 0) {
      status = 'duplicate';
    }

    return {
      ...row,
      startDate: normalizedStartDate || row.startDate,
      status,
      errors
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      onShowToast('Invalid file format. Please upload CSV or Excel.', 'error');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (file: File) => {
    setIsParsing(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let headers: string[] = [];
        let rows: any[] = [];
        
        if (file.name.endsWith('.csv')) {
          Papa.parse(e.target?.result as string, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              headers = results.meta.fields || [];
              rows = results.data;
              processParsedData(headers, rows);
            }
          });
        } else {
          // Excel parse
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          if (json.length > 0) {
            headers = json[0] as string[];
            for(let i=1; i<json.length; i++) {
              let obj: any = {};
              headers.forEach((h, idx) => {
                obj[h] = json[i][idx];
              });
              rows.push(obj);
            }
          }
          processParsedData(headers, rows);
        }
      } catch (err) {
        onShowToast('Failed to parse file. It might be corrupted.', 'error');
        setIsParsing(false);
      }
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const processParsedData = (headers: string[], rows: any[]) => {
    if (rows.length === 0) {
      onShowToast('File is empty. Please upload a file with data.', 'error');
      setIsParsing(false);
      return;
    }
    
    if (rows.length > config.maxImportRows) {
      onShowToast(`File exceeds maximum limit of ${config.maxImportRows} rows.`, 'error');
      setIsParsing(false);
      return;
    }

    // Attempt auto-mapping
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const match = EXPECTED_COLUMNS.find(c => c.label.toLowerCase() === h.toLowerCase());
      if (match) mapping[h] = match.key;
    });

    setRawHeaders(headers);
    setRawRows(rows);
    setColumnMapping(mapping);
    
    if (Object.keys(mapping).length >= REQUIRED_FIELDS.length) {
      // Good enough mapping, proceed to preview directly by extracting
      extractAndValidate(mapping, rows);
    } else {
      // Need manual mapping
      setIsParsing(false);
      setStep(1.5 as any); // Show mapping screen
    }
  };

  const handleMappingConfirm = () => {
    extractAndValidate(columnMapping, rawRows);
  };

  const extractAndValidate = (mapping: Record<string, string>, rows: any[]) => {
    setIsParsing(true);
    let extracted: ImportRow[] = rows.map((row, idx) => {
      const r: any = { index: idx, originalData: row, status: 'clean', errors: [], serviceStates: {} };
      
      // Modules mapping manually check
      const stateObj: Record<string, string> = {};
      Object.keys(row).forEach(header => {
        const mappedKey = mapping[header];
        if (mappedKey) {
          r[mappedKey] = row[header];
        } else {
          // Treat unmapped known module names as modules
          const val = row[header];
          if (val) {
             const mStatus = val.toString().trim();
             if (moduleStatusOptions.includes(mStatus)) {
               stateObj[header] = mStatus;
             }
          }
        }
      });
      // Deduce default services if package is present
      if (r.packageName) {
        const pkg = PACKAGES.find(p => p.name === r.packageName);
        if (pkg) {
           const autoServices = PRODUCT_LINES
             .filter(pl => pkg.productLines.includes(pl.name))
             .flatMap(pl => pl.services);
             
           // Exclude services that were explicitly marked 'Out of Scope' in Excel
           r.services = autoServices.filter(s => stateObj[s] !== 'Out of Scope');
        } else {
           r.services = [];
        }
      } else {
        r.services = [];
      }
      r.serviceStates = stateObj;

      return r as ImportRow;
    });

    // Run validation across all
    extracted = extracted.map((r, i) => validateRow(r, i, extracted));
    
    setProcessedRows(extracted);
    setCurrentPage(1);
    setIsParsing(false);
    setStep(2);
  };

  const updateRowField = (idx: number, field: keyof ImportRow, value: any) => {
    const newRows = [...processedRows];
    
    // Auto-update services if package changes
    if (field === 'packageName') {
      const pkg = PACKAGES.find(p => p.name === value);
      if (pkg) {
        const autoServices = PRODUCT_LINES
           .filter(pl => pkg.productLines.includes(pl.name))
           .flatMap(pl => pl.services)
           .filter(s => newRows[idx].serviceStates?.[s] !== 'Out of Scope');
        newRows[idx].services = autoServices;
      } else {
        newRows[idx].services = [];
      }
    }
    
    newRows[idx] = { ...newRows[idx], [field]: value };
    // Revalidate
    newRows[idx] = validateRow(newRows[idx], idx, newRows);
    setProcessedRows(newRows);
  };

  const deleteRow = (idx: number) => {
    const newRows = processedRows.filter((_, i) => i !== idx);
    // Revalidate all remaining for duplicate clearing
    setProcessedRows(newRows.map((r, i) => validateRow(r, i, newRows)));
  };

  const handleDuplicateAction = (idx: number, action: 'overwrite' | 'skip') => {
    updateRowField(idx, 'duplicateAction', action);
  };

  const stats = useMemo(() => {
    const errors = processedRows.filter(r => r.status === 'error').length;
    const duplicates = processedRows.filter(r => r.status === 'duplicate' && !r.duplicateAction).length;
    const clean = processedRows.length - errors - duplicates;
    const canConfirm = errors === 0 && duplicates === 0 && processedRows.length > 0;
    
    return { total: processedRows.length, errors, duplicates, clean, canConfirm };
  }, [processedRows]);

  const handleConfirmImport = async () => {
    setIsImporting(true);
    
    const toAdd: Partial<Project>[] = [];
    const toUpdate: Partial<Project>[] = [];
    let skipped = 0;

    processedRows.forEach(row => {
      if (row.duplicateAction === 'skip') {
        skipped++;
        return;
      }

      // Format numeric value
      const numVal = typeof row.value === 'string' ? parseFloat(row.value.replace(/[^\d.-]/g, '')) : row.value;
      
      // Calculate Auto Services and Baseline Days
      let baselineDays = 0;
      let mappedServices: string[] = row.services || [];
      let productLines: ProductLine[] = ['Bankone']; // Default

      if (row.packageName) {
        const pkg = PACKAGES.find(p => p.name === row.packageName);
        if (pkg) {
          productLines = pkg.productLines;
          baselineDays = mappedServices.reduce((acc, serviceName) => {
            const baseline = config.serviceBaselines.find(sb => sb.name === serviceName);
            return acc + (baseline ? baseline.baselineDays : 0);
          }, 0);
        }
      }
      
      const expectedCompletionDate = calculateWorkingDays(row.startDate, baselineDays);

      // Extract explicit service states set in the excel columns
      const finalServiceStates: Record<string, any> = { ...row.serviceStates };
      mappedServices.forEach(s => {
        if (!finalServiceStates[s]) finalServiceStates[s] = 'Not Started';
      });

      const mappedData: Partial<Project> = {
        clientName: row.clientName,
        packageName: row.packageName,
        assignedPM: row.assignedPM,
        startDate: row.startDate,
        expectedDuration: baselineDays,
        expectedCompletionDate,
        currentCompletionDate: expectedCompletionDate,
        value: Number(numVal) || 0,
        currency: row.currency,
        state: (row.closureStatus as any) || 'On-Track',
        priority: 'P2', 
        productLines,
        services: mappedServices,
        serviceStates: finalServiceStates,
      };

      if (row.status === 'duplicate' && row.duplicateAction === 'overwrite') {
        toUpdate.push(mappedData);
      } else {
        toAdd.push(mappedData);
      }
    });

    try {
      if (toAdd.length > 0 || toUpdate.length > 0) {
        const result = await onImportBulk(toAdd, toUpdate, skipped);
        setImportResult({ added: result?.added || 0, updated: result?.updated || 0, skipped });
        setStep(3);
      } else {
         onShowToast('No rows to import after skips.', 'info');
         onClose();
      }
    } catch (err: any) {
      onShowToast('Import failed. Please try again.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      <ImportGuideModal 
        isOpen={showGuide}
        config={config}
        onProceed={(hideFuture) => {
          setShowGuide(false);
          if (hideFuture) {
             onUpdateConfig({ hideImportGuide: true });
          }
        }}
        onShowToast={onShowToast as any}
      />

      <div className="flex justify-between items-center mb-6 px-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bulk Import Projects</h2>
          <p className="text-sm font-medium text-slate-500">Upload CSV or Excel files</p>
        </div>
        <button onClick={onClose} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors text-slate-400">
          <X className="w-5 h-5"/>
        </button>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl border-t border-x border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {step === 1 && (
            <div className="flex-1 p-8 flex flex-col items-center justify-center">
               <div 
                 className={cn(
                   "w-full max-w-2xl border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center transition-colors cursor-pointer",
                   file ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                 )}
                 onClick={() => fileInputRef.current?.click()}
               >
                 <Upload className={cn("w-12 h-12 mb-4", file ? "text-teal-500" : "text-slate-400")} />
                 <h3 className="text-lg font-bold text-slate-900 mb-2">{file ? file.name : "Click or drag file to upload"}</h3>
                 <p className="text-sm text-slate-500 font-medium">CSV or Excel (.xlsx) up to {config.maxImportRows} rows</p>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                   onChange={handleFileUpload} 
                 />
                 
                 {isParsing && (
                   <div className="mt-6 flex items-center gap-3 text-teal-600 font-bold">
                     <span className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></span>
                     Processing file...
                   </div>
                 )}
               </div>
            </div>
          )}

          {step === 1.5 && (
            <div className="flex-1 p-8 overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Map Columns</h3>
              <p className="text-sm text-slate-500 mb-6">We couldn't automatically match all your columns. Please map them below.</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-3xl">
                {EXPECTED_COLUMNS.map(col => (
                  <div key={col.key} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                       {col.label} {REQUIRED_FIELDS.some(r => r.key === col.key) && <span className="text-red-500">*</span>}
                    </label>
                    <select 
                      value={Object.keys(columnMapping).find(k => columnMapping[k] === col.key) || ''}
                      onChange={(e) => {
                        const newMap = { ...columnMapping };
                        // Remove old
                        Object.keys(newMap).forEach(k => { if(newMap[k] === col.key) delete newMap[k]; });
                        if (e.target.value) newMap[e.target.value] = col.key;
                        setColumnMapping(newMap);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium"
                    >
                      <option value="">-- Ignore --</option>
                      {rawHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 flex gap-4">
                <button onClick={() => setStep(1)} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Back</button>
                <button 
                  onClick={handleMappingConfirm} 
                  className={cn("px-6 py-3 font-bold rounded-xl transition-colors", theme.bg, theme.hoverBg, "text-white")}
                >
                  Confirm Mapping
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full bg-slate-50">
              {/* Summary Bar */}
              <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                <div className="flex gap-6 items-center">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rows</span>
                     <span className="text-lg font-black text-slate-900">{stats.total}</span>
                   </div>
                   <div className="h-8 w-px bg-slate-200"></div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Errors</span>
                     <span className="text-lg font-black text-red-600">{stats.errors}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Duplicates</span>
                     <span className="text-lg font-black text-amber-600">{stats.duplicates}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ready</span>
                     <span className="text-lg font-black text-emerald-600">{stats.clean}</span>
                   </div>
                </div>
                
                <button 
                  onClick={handleConfirmImport}
                  disabled={!stats.canConfirm || isImporting}
                  className={cn(
                    "px-8 py-3 font-black rounded-xl transition-all shadow-md flex items-center gap-2",
                    stats.canConfirm ? `${theme.bg} ${theme.hoverBg} text-white` : "bg-slate-200 text-slate-400"
                  )}
                >
                  {isImporting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <Upload className="w-5 h-5"/>}
                  {isImporting ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-3">
                  {processedRows.length === 0 ? (
                     <div className="py-20 text-center text-slate-500">No rows to preview</div>
                  ) : (
                    processedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((row) => {
                      const idx = row.index;
                      return (
                      <div key={idx} className={cn(
                        "bg-white border text-sm rounded-xl p-4 shadow-sm flex items-start gap-4 transition-colors relative overflow-hidden group",
                        row.status === 'clean' ? "border-emerald-200 border-l-4 border-l-emerald-500" :
                        row.status === 'error' ? "border-red-200 border-l-4 border-l-red-500" :
                        "border-amber-200 border-l-4 border-l-amber-500"
                      )}>
                        
                        <div className="flex-1 grid grid-cols-5 gap-4">
                          {/* Client */}
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Institution</span>
                            <input 
                               value={row.clientName || ''} 
                               onChange={(e) => updateRowField(idx, 'clientName', e.target.value)}
                               className={cn("w-full bg-transparent font-semibold border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                !row.clientName?.trim() ? 'bg-red-50 text-red-600' : 'text-slate-900')}
                            />
                          </div>

                          {/* Package & Services */}
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Package & Services</span>
                            <select 
                               value={row.packageName || ''} 
                               onChange={(e) => updateRowField(idx, 'packageName', e.target.value)}
                               className={cn("w-full bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors mb-2", 
                                 (!row.packageName || !validPackages.includes(row.packageName)) ? 'bg-red-50 text-red-600' : 'text-slate-700')}
                            >
                               <option value="">Select Package</option>
                               {validPackages.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            
                            {row.packageName && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                 {(() => {
                                   const pkg = PACKAGES.find(p => p.name === row.packageName);
                                   if (!pkg) return null;
                                   const allAvail = PRODUCT_LINES.filter(pl => pkg.productLines.includes(pl.name)).flatMap(pl => pl.services);
                                   const activeServices = row.services || [];
                                   
                                   return allAvail.map(s => {
                                     const isActive = activeServices.includes(s);
                                     return (
                                       <button 
                                         key={s}
                                         onClick={() => {
                                           const newSet = isActive ? activeServices.filter(x => x !== s) : [...activeServices, s];
                                           updateRowField(idx, 'services', newSet);
                                         }}
                                         className={cn(
                                           "text-[9px] font-bold px-1.5 py-0.5 rounded transition-all",
                                           isActive ? "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 hover:line-through" : "bg-white border border-slate-200 text-slate-400 opacity-50 hover:opacity-100"
                                         )}
                                         title={isActive ? "Click to remove service" : "Click to add service"}
                                       >
                                         {s}
                                       </button>
                                     )
                                   });
                                 })()}
                              </div>
                            )}
                          </div>

                          {/* PM */}
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">PM</span>
                            <select 
                               value={row.assignedPM || ''} 
                               onChange={(e) => updateRowField(idx, 'assignedPM', e.target.value)}
                               className={cn("w-full bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                 (!row.assignedPM || !validPMs.includes(row.assignedPM)) ? 'bg-red-50 text-red-600' : 'text-slate-700')}
                            >
                               <option value="">Select PM</option>
                               {validPMs.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>

                           {/* Cost */}
                           <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Cost ({row.currency || '??'})</span>
                            <div className="flex gap-2">
                               <input 
                                 value={row.currency || ''} 
                                 onChange={(e) => updateRowField(idx, 'currency', e.target.value)}
                                 className={cn("w-12 bg-transparent font-mono font-bold text-xs border-b border-transparent hover:border-slate-300 outline-none", !row.currency ? 'bg-red-50' : 'text-slate-500')}
                                 placeholder="CUR"
                               />
                               <input 
                                 value={row.value || ''} 
                                 onChange={(e) => updateRowField(idx, 'value', e.target.value)}
                                 className={cn("w-full bg-transparent font-mono font-bold border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                   (row.value === undefined || row.value === '') ? 'bg-red-50 text-red-600' : 'text-slate-900')}
                               />
                            </div>
                          </div>

                           {/* Date */}
                           <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Start Date</span>
                            <input 
                               type="date"
                               value={row.startDate || ''} 
                               onChange={(e) => updateRowField(idx, 'startDate', e.target.value)}
                               className={cn("w-full bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                !row.startDate ? 'bg-red-50 text-red-600' : 'text-slate-700')}
                            />
                          </div>
                        </div>

                        {/* Actions / Duplicate Handling */}
                        <div className="w-48 flex flex-col items-end gap-2 justify-center ml-4 border-l border-slate-100 pl-4">
                           {row.status === 'duplicate' && !row.duplicateAction && (
                              <div className="flex flex-col gap-1 w-full">
                                <span className="text-[10px] font-bold text-amber-600 uppercase w-full bg-amber-50 px-2 py-1 rounded-md mb-1 text-center border border-amber-200">Duplicate</span>
                                <div className="flex gap-1 w-full">
                                  <button onClick={() => handleDuplicateAction(idx, 'overwrite')} className="flex-1 text-[10px] font-bold py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded shadow-sm">Overrite</button>
                                  <button onClick={() => handleDuplicateAction(idx, 'skip')} className="flex-1 text-[10px] font-bold py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded shadow-sm">Skip</button>
                                </div>
                              </div>
                           )}

                           {row.status === 'duplicate' && row.duplicateAction && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded-md">Action: {row.duplicateAction}</span>
                                <button onClick={() => updateRowField(idx, 'duplicateAction', undefined)} className="text-slate-400 hover:text-slate-700">
                                   <X className="w-4 h-4"/>
                                </button>
                              </div>
                           )}

                           {row.status === 'error' && (
                              <div className="text-[10px] text-red-600 font-bold bg-red-50 p-1.5 rounded-lg border border-red-100 text-right w-full">
                                {row.errors.length} Errors Found
                                <ul className="text-[9px] font-medium text-red-400 mt-1 text-left list-disc pl-3">
                                  {row.errors.map((e,i) => <li key={i}>{e}</li>)}
                                </ul>
                              </div>
                           )}

                           <button onClick={() => deleteRow(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-auto">
                              <Archive className="w-4 h-4" />
                           </button>
                        </div>

                      </div>
                      );
                    })
                  )}
                </div>
                {processedRows.length > rowsPerPage && (
                  <div className="flex justify-between items-center mt-6">
                    <p className="text-sm font-medium text-slate-500">
                      Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, processedRows.length)} of {processedRows.length} rows
                    </p>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                         disabled={currentPage === 1}
                         className="px-4 py-2 bg-white border border-slate-200 text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-slate-50"
                       >
                         Previous
                       </button>
                       <button 
                         onClick={() => setCurrentPage(p => p + 1)}
                         disabled={currentPage * rowsPerPage >= processedRows.length}
                         className="px-4 py-2 bg-white border border-slate-200 text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-slate-50"
                       >
                         Next
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && importResult && (
             <div className="flex-1 p-8 flex flex-col items-center justify-center bg-emerald-50 text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl">
                  <Check className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-2">Import Complete!</h3>
                <p className="text-slate-600 font-medium mb-8">Your projects have been successfully synchronized to the database.</p>
                
                <div className="grid grid-cols-3 gap-6 mb-10 w-full max-w-lg">
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
                     <p className="text-xs font-bold text-slate-400 uppercase">Created</p>
                     <p className="text-2xl font-black text-emerald-600">{importResult.added}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                     <p className="text-xs font-bold text-slate-400 uppercase">Overwritten</p>
                     <p className="text-2xl font-black text-slate-700">{importResult.updated}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                     <p className="text-xs font-bold text-slate-400 uppercase">Skipped</p>
                     <p className="text-2xl font-black text-slate-400">{importResult.skipped}</p>
                   </div>
                </div>

                <button onClick={onClose} className={cn("px-8 py-4 font-black rounded-xl text-white shadow-xl transition-transform hover:scale-105", theme.bg)}>
                  Return to Dashboard
                </button>
             </div>
          )}
      </div>
    </div>
  );
};
