import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileType, AlertTriangle, CheckCircle2, X, ChevronRight, Edit2, Archive, Check, Info } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn, formatCurrency, calculateWorkingDays, getActiveDaysCount, getPhaseListFromState, getWorkingDaysInRange, resolveServiceIds } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';
import { Project, Role, AppConfig, ImportRow, ImportRowStatus, User, ServiceBaseline, ProductLine, ServiceState } from '../types';
import { ImportGuideModal } from './ImportGuideModal';

const REQUIRED_FIELDS_PROJECTS = [
  { key: 'clientName', label: 'Institution Name' },
  { key: 'packageName', label: 'Package / Service Type' },
  { key: 'assignedPM', label: 'Project Manager' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'value', label: 'Cost / Value' },
  { key: 'currency', label: 'Currency' }
];

const OPTIONAL_FIELDS_PROJECTS = [
  { key: 'implementationPerson', label: 'Project Implementation Person' },
  { key: 'subscriptionLevel', label: 'Subscription Level' },
  { key: 'intakeType', label: 'Intake Type' },
  { key: 'currentPhase', label: 'Starting Phase' },
  { key: 'productLine', label: 'Product Line' },
  { key: 'expectedCompletionDate', label: 'Expected Completion Date' },
  { key: 'actualCompletionDate', label: 'Actual Completion Date' },
  { key: 'closureStatus', label: 'Project Closure Status' },
  { key: 'notes', label: 'Key Updates / Notes' }
];

const REQUIRED_FIELDS_IMPLEMENTATIONS = [
  { key: 'clientName', label: 'Institution Name' },
  { key: 'serviceName', label: 'Service' },
  { key: 'implementationManager', label: 'Implementation Manager' },
  { key: 'targetClosureDate', label: 'Target Closure Date' }
];

const OPTIONAL_FIELDS_IMPLEMENTATIONS = [
  { key: 'serviceVariant', label: 'Gateway / Variant' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'closureStatus', label: 'Project Status' },
  { key: 'notes', label: 'Key Updates / Notes' }
];

export const BulkImportView: React.FC<BulkImportViewProps> = ({ 
  users, invites, projects, config, userRole, mode = 'projects',
  onImportBulk, onImportExtensions, onShowToast, onUpdateConfig, onClose 
}) => {
  const isProjects = mode === 'projects';
  const REQUIRED_FIELDS = isProjects ? REQUIRED_FIELDS_PROJECTS : REQUIRED_FIELDS_IMPLEMENTATIONS;
  const OPTIONAL_FIELDS = isProjects ? OPTIONAL_FIELDS_PROJECTS : OPTIONAL_FIELDS_IMPLEMENTATIONS;
  const EXPECTED_COLUMNS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

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
  const [implImportResult, setImplImportResult] = useState<{ added: number, skipped: number } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // ── Draft Persistence ───────────────────────────────────────────────────────
  useEffect(() => {
    const draft = localStorage.getItem(`import_draft_${mode}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.rows && parsed.rows.length > 0 && step === 1) {
          setProcessedRows(parsed.rows);
          setStep(2);
          onShowToast(`Resumed from saved ${mode} draft.`, 'info');
        }
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  }, [mode]);

  useEffect(() => {
    if (processedRows.length > 0 && step === 2) {
      localStorage.setItem(`import_draft_${mode}`, JSON.stringify({ rows: processedRows }));
    }
  }, [processedRows, step, mode]);

  const handleSaveDraftAndClose = () => {
    onShowToast(`${mode === 'projects' ? 'Project' : 'Implementation'} draft saved successfully.`, 'success');
    onClose();
  };

  const clearDraft = () => {
    localStorage.removeItem(`import_draft_${mode}`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const moduleStatusOptions = ['Live', 'Not Started', 'Out of Scope', 'Not Ready'];
  
  // Ref to valid packages and PMs
  const validPackages = config.packages.map((p: any) => p.name);
  
  // Combine system users with invited names (pending users)
  const invitedNames = (invites || []).filter((i: any) => i.role === 'PM' && i.status === 'Pending').map((i: any) => i.name);
  const activePMNames = users.filter((u: any) => u.role === 'PM').map((u: any) => u.name);
  
  // Unique list of all PMs (system + invited)
  const validPMs = Array.from(new Set([...activePMNames, ...invitedNames]));

  const invitedIMNames = (invites || []).filter((i: any) => (i.role === 'IM' || i.role === 'IM Lead') && i.status === 'Pending').map((i: any) => i.name);
  const activeIMNames = users.filter((u: any) => u.role === 'IM' || u.role === 'IM Lead').map((u: any) => u.name);
  const adminNames = users.filter((u: any) => u.role === 'Superadmin' || u.role === 'Manager').map((u: any) => u.name);

  const validIMs = Array.from(new Set([...activeIMNames, ...invitedIMNames, ...adminNames]));

  const validServices = config.serviceBaselines.map(s => s.name);
  
  // Helper to safely trim values that might not be strings
  const safeTrim = (val: any) => String(val ?? '').trim();

  // Validation function for a single row
  const validateRow = (row: ImportRow, rowIndex: number, allRows: ImportRow[]): ImportRow => {
    const errors: string[] = [];
    let status: ImportRowStatus = 'clean';

    // Required checks
    if (!safeTrim(row.clientName)) errors.push('Institution Name is blank');
    
    if (isProjects) {
      // ── Project Specific Validation ──
      const pName = safeTrim(row.packageName);
      if (!pName) {
        errors.push('Package is blank');
      } else {
        let match = validPackages.find(p => p === pName);
        if (!match) match = validPackages.find(p => p.toLowerCase() === pName.toLowerCase());
        if (!match) match = validPackages.find(p => p.toLowerCase().startsWith(pName.toLowerCase()));
        if (!match) match = validPackages.find(p => p.toLowerCase().includes(pName.toLowerCase()));

        if (match) row.packageName = match;
        else errors.push(`Package '${pName}' not found in configuration`);
      }

      const apm = safeTrim(row.assignedPM);
      if (!apm) {
        errors.push('Project Manager is blank');
      } else {
        const match = validPMs.find(pm => {
          const full = pm.toLowerCase();
          const input = apm.toLowerCase();
          return full === input || full.includes(input) || input.includes(full.split(' ')[0]);
        });
        if (match) row.assignedPM = match;
        else errors.push(`PM '${apm}' not found in system users`);
      }

      // Numeric validation
      let val = row.value;
      if (val === undefined || val === null || val === '') {
        errors.push('Cost is missing');
      } else {
        const numVal = typeof val === 'string' ? parseFloat(val.replace(/[^\d.-]/g, '')) : val;
        if (isNaN(numVal) || numVal < 0) errors.push('Cost is invalid/negative');
      }

      if (!safeTrim(row.currency)) errors.push('Currency is missing');
    } else {
      // ── Implementation Specific Validation ──
      const sName = safeTrim(row.serviceName);
      if (!sName) {
        errors.push('Service is blank');
      } else {
        let match = validServices.find(s => s === sName);
        if (!match) match = validServices.find(s => s.toLowerCase() === sName.toLowerCase());
        if (!match) match = validServices.find(s => s.toLowerCase().includes(sName.toLowerCase()));
        if (match) row.serviceName = match;
        else errors.push(`Service '${sName}' not found`);
      }

      const im = safeTrim(row.implementationManager);
      if (im) {
        const match = validIMs.find(v => v.toLowerCase().includes(im.toLowerCase()));
        if (match) row.implementationManager = match;
        else errors.push(`IM '${im}' not found`);
      } else {
        errors.push('Implementation Manager is blank');
      }

      // Target Date validation (Optional for APIs, Auto-calculated for others if baseline exists)
      const isAPI = row.serviceName === 'APIs' || row.serviceName === 'API Provisioning';
      
      if (!isAPI && !safeTrim(row.targetClosureDate)) {
        // Try to auto-calculate from baseline
        const baseline = config.serviceBaselines.find(b => b.name === row.serviceName);
        const sDateRaw = safeTrim(row.startDate);
        
        if (baseline && sDateRaw) {
          try {
            let sDate: Date;
            if ((row.startDate as any) instanceof Date) sDate = row.startDate as any;
            else {
              // Try to parse DD/MM/YYYY or standard ISO
              const parts = sDateRaw.split(/[\/\-]/);
              if (parts.length === 3 && parts[0].length <= 2) {
                sDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              } else {
                sDate = new Date(sDateRaw);
              }
            }

            if (!isNaN(sDate.getTime())) {
              const targetDate = new Date(sDate);
              targetDate.setDate(targetDate.getDate() + (baseline.baselineDays || 14));
              row.targetClosureDate = targetDate.toISOString().split('T')[0];
            } else {
              errors.push('Target Closure Date is missing (Start Date invalid for calculation)');
            }
          } catch (e) {
            errors.push('Target Closure Date is missing (Auto-calculation failed)');
          }
        } else {
          errors.push('Target Closure Date is missing');
        }
      } else if (safeTrim(row.targetClosureDate)) {
        try {
          let d: Date;
          const raw = safeTrim(row.targetClosureDate);
          if ((row.targetClosureDate as any) instanceof Date) d = row.targetClosureDate as any;
          else if (raw.includes('/')) {
            const parts = raw.split('/');
            if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            else d = new Date(raw);
          } else d = new Date(raw);
          
          if (isNaN(d.getTime())) errors.push('Target Date is invalid');
          else row.targetClosureDate = d.toISOString().split('T')[0];
        } catch {
          errors.push('Target Date is invalid');
        }
      }
    }

    // ── Common Date Validation (Start Date) ──
    let normalizedStartDate = row.startDate;
    const sDateRaw = safeTrim(row.startDate);
    if (!sDateRaw) {
      if (isProjects) errors.push('Start Date is missing');
    } else {
      try {
        let d: Date;
        if ((row.startDate as any) instanceof Date) d = row.startDate as any;
        else if (sDateRaw.includes('/')) {
          const parts = sDateRaw.split('/');
          if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          else d = new Date(sDateRaw);
        } else d = new Date(sDateRaw);

        if (isNaN(d.getTime())) errors.push('Start Date is invalid');
        else normalizedStartDate = d.toISOString().split('T')[0];
      } catch {
        errors.push('Start Date is invalid');
      }
    }

    // Duplicate calculation
    const currentName = safeTrim(row.clientName).toLowerCase();
    const isDuplicateInDb = isProjects 
      ? projects.some(p => p.clientName.toLowerCase() === currentName)
      : false; // For extensions, duplicates are handled by linked project logic usually, or just allow multiple
    
    const duplicatesInFile = allRows.filter((r, idx) => idx !== rowIndex && safeTrim(r.clientName).toLowerCase() === currentName);

    // Summary Row Detection
    const summaryKeywords = ['total', 'grand total', 'sub-total', 'subtotal', 'summary'];
    const lowerClientName = currentName;
    const isSummaryRow = summaryKeywords.some(k => lowerClientName.includes(k));

    if (errors.length > 0) {
      status = 'error';
    } else if (isSummaryRow) {
      status = 'error';
      errors.push('Skipping summary/total row');
    } else if (isDuplicateInDb || duplicatesInFile.length > 0) {
      status = 'duplicate';
    }

    // Normalize Expected Completion Date if present
    let normalizedExpectedDate = row.expectedCompletionDate;
    if (safeTrim(row.expectedCompletionDate)) {
      try {
        let d: Date;
        const raw = safeTrim(row.expectedCompletionDate);
        if ((row.expectedCompletionDate as any) instanceof Date) {
          d = row.expectedCompletionDate as any;
        } else if (raw.includes('/')) {
          const parts = raw.split('/');
          if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          else d = new Date(raw);
        } else d = new Date(raw);
        if (!isNaN(d.getTime())) normalizedExpectedDate = d.toISOString().split('T')[0];
      } catch {}
    }

    // Normalize Actual Completion Date if present
    let normalizedActualDate = row.actualCompletionDate;
    if (safeTrim(row.actualCompletionDate)) {
      try {
        let d: Date;
        const raw = safeTrim(row.actualCompletionDate);
        if ((row.actualCompletionDate as any) instanceof Date) {
          d = row.actualCompletionDate as any;
        } else if (raw.includes('/')) {
          const parts = raw.split('/');
          if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          else d = new Date(raw);
        } else d = new Date(raw);
        if (!isNaN(d.getTime())) normalizedActualDate = d.toISOString().split('T')[0];
      } catch {}
    }

    return {
      ...row,
      startDate: normalizedStartDate || row.startDate,
      expectedCompletionDate: normalizedExpectedDate || row.expectedCompletionDate,
      actualCompletionDate: normalizedActualDate || row.actualCompletionDate,
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
          // Excel parse: we try to find the sheet that actually contains our headers
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
          
          let targetSheet: XLSX.WorkSheet | null = null;
          let bestHeaders: string[] = [];
          
          // Look for the first sheet that has an "Institution Name" column or any match
          for (const sName of workbook.SheetNames) {
            const currentSheet = workbook.Sheets[sName];
            const json = XLSX.utils.sheet_to_json(currentSheet, { header: 1 }) as any[][];
            if (json.length > 1) {
              const currentHeaders = (json[0] as any[]).map(h => String(h || '').trim());
              const matchCount = REQUIRED_FIELDS.filter(rf => 
                currentHeaders.some(h => h.toLowerCase() === rf.label.toLowerCase())
              ).length;
              
              if (matchCount > 0) {
                targetSheet = currentSheet;
                bestHeaders = currentHeaders;
                break;
              }
            }
          }
          
          // Fallback to the first sheet if no mapping found
          if (!targetSheet) {
            targetSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(targetSheet, { header: 1 }) as any[][];
            bestHeaders = (json[0] as any[]).map(h => String(h || '').trim());
          }
          
          // Final parse of the target sheet with dates enabled
          const json = XLSX.utils.sheet_to_json(targetSheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as any[][];
          headers = bestHeaders;
          for(let i=1; i<json.length; i++) {
            let obj: any = {};
            headers.forEach((h, idx) => {
              if (h) obj[h] = json[i][idx];
            });
            if (Object.values(obj).some(v => v !== undefined && v !== '')) {
              rows.push(obj);
            }
          }
          
          processParsedData(headers, rows);
        }
      } catch (err) {
        console.error("[Excel Parse Error]", err);
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
             const mStatus = safeTrim(val);
             if (moduleStatusOptions.includes(mStatus)) {
               stateObj[header] = mStatus;
             }
          }
        }
      });
      // Deduce default services if package is present
      if (r.packageName) {
        const pkg = config.packages.find((p: any) => p.name === r.packageName);
        if (pkg) {
           const autoServices = pkg.services;
             
           // Exclude services that were explicitly marked 'Out of Scope' in Excel
           r.services = autoServices.filter((s: string) => stateObj[s] !== 'Out of Scope');
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
      const pkg = config.packages.find((p: any) => p.name === value);
      if (pkg) {
        const autoServices = pkg.services
           .filter((s: string) => newRows[idx].serviceStates?.[s] !== 'Out of Scope');
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
    let skipped = 0;

    if (isProjects) {
      const toAdd: Partial<Project>[] = [];
      const toUpdate: Partial<Project>[] = [];

      processedRows.forEach(row => {
        if (row.status === 'error') return;
        if (row.duplicateAction === 'skip') {
          skipped++;
          return;
        }

        // Format numeric value
        const numVal = typeof row.value === 'string' ? parseFloat(row.value.replace(/[^\d.-]/g, '')) : row.value;
        const isOld = (row.intakeType || 'New').toLowerCase() === 'old';
        
        // Calculate Auto Services and Baseline Days
        let baselineDays = 0;
        const mappedServiceIds = resolveServiceIds(row.services || [], config.serviceBaselines);
        
        let productLines: ProductLine[] = [];
        const plInput = safeTrim(row.productLine);
        if (plInput) {
          productLines = plInput.split(/[,|]/).map(s => s.trim() as ProductLine).filter(s => ['Bankone', 'Digital Banking', 'Agency Banking', 'Other'].includes(s));
        }
        if (productLines.length === 0) productLines = ['Bankone'];
        
        let expectedCompletionDate = '';

        if (isOld) {
          expectedCompletionDate = row.expectedCompletionDate || row.startDate;
          baselineDays = getWorkingDaysInRange(row.startDate, expectedCompletionDate, true);
        } else if (row.packageName) {
          const pkg = config.packages.find((p: any) => p.name === row.packageName);
          if (pkg) {
            baselineDays = mappedServiceIds.reduce((acc, sid) => {
              const baseline = config.serviceBaselines.find((sb: any) => sb.id === sid);
              return acc + (baseline ? baseline.baselineDays : 0);
            }, 0);
          }
          expectedCompletionDate = calculateWorkingDays(row.startDate, baselineDays);
        }
        
        const finalServiceStates: Record<string, any> = {};
        if (row.serviceStates) {
          Object.entries(row.serviceStates).forEach(([name, status]) => {
            const matchingService = config.serviceBaselines.find(sb => sb.name.toLowerCase() === name.toLowerCase());
            const key = matchingService ? matchingService.id : name;
            finalServiceStates[key] = status;
          });
        }

        mappedServiceIds.forEach(sid => {
          if (!finalServiceStates[sid]) finalServiceStates[sid] = 'Not Started';
        });

        const closureStatus = row.closureStatus || 'Active';
        const isClosed = closureStatus.toLowerCase() === 'closed' || closureStatus.toLowerCase() === 'billed';
        const actualCompDate = row.actualCompletionDate || (isClosed ? expectedCompletionDate : undefined);

        let defaultStartPhase = isOld ? 'Execution' : 'Initiation';
        if (row.packageName?.includes('Digital Banking') && !row.currentPhase) {
          defaultStartPhase = 'Planning';
        }

        const phases = getPhaseListFromState(
          row.currentPhase || defaultStartPhase, 
          isClosed,
          row.startDate,
          actualCompDate
        );

        const milestones = mappedServiceIds.map(sid => {
          const sb = config.serviceBaselines.find(b => b.id === sid);
          return {
            id: sid,
            name: sb ? sb.name : sid,
            status: (finalServiceStates[sid] as ServiceState) || 'Not Started'
          };
        });

        const isInternalInitiativeImport = row.packageName === 'Internal Initiative';
        const importedDeliveryTrack = isInternalInitiativeImport ? 'Internal Initiative' : 'Standard';

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
          state: isClosed ? 'Closed' : (row.closureStatus as any || 'On-Track'),
          priority: 'P2',
          productLines,
          services: isInternalInitiativeImport ? [] : mappedServiceIds,
          serviceStates: isInternalInitiativeImport ? {} : finalServiceStates,
          milestones,
          phases,
          intakeType: isOld ? 'Old' : 'New',
          actualCompletionDate: actualCompDate,
          deliveryTrack: importedDeliveryTrack,
          isInternalInitiative: isInternalInitiativeImport,
          phaseWeights: { initiation: 10, planning: 10, execution: 60, closure: 20 },
          comments: [],
          risks: [],
          activities: []
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
        onShowToast(err.message || 'Import failed.', 'error');
      } finally {
        setIsImporting(false);
        if (step === 3) clearDraft();
      }
    } else {
      // ── Implementation Import Logic ──
      const toAdd: Partial<ServiceExtension>[] = [];
      processedRows.forEach(row => {
        if (row.status === 'error') return;
        
        const sb = config.serviceBaselines.find(s => s.name === row.serviceName);
        const variant = row.serviceVariant || 'Standard';
        
        const ext: Partial<ServiceExtension> = {
          clientName: row.clientName,
          serviceId: sb?.id || 'unknown',
          serviceName: row.serviceName,
          serviceVariant: variant,
          implementationManager: row.implementationManager,
          startDate: row.startDate || new Date().toISOString().split('T')[0],
          targetClosureDate: row.targetClosureDate,
          status: (row.closureStatus as any) || 'Not Started',
          baselineDays: sb?.baselineDays || 14,
          milestones: sb?.milestones?.map(m => ({ name: m, completed: false, completedAt: null, completedBy: null })) || [],
          mappingStatus: 'None'
        };
        toAdd.push(ext);
      });

      try {
        if (toAdd.length > 0) {
          const result = await onImportExtensions?.(toAdd, skipped);
          setImplImportResult({ added: result?.added || 0, skipped });
          setStep(3);
        } else {
          onShowToast('No valid rows to import.', 'info');
          onClose();
        }
      } catch (err: any) {
        onShowToast(err.message || 'Import failed.', 'error');
      } finally {
        setIsImporting(false);
        if (step === 3) clearDraft();
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      <ImportGuideModal 
        isOpen={showGuide} 
        config={config} 
        mode={mode}
        onProceed={(hideFuture) => {
          if (hideFuture) onUpdateConfig({ hideImportGuide: true });
          setShowGuide(false);
        }}
        onShowToast={onShowToast}
      />

      <div className="flex justify-between items-center mb-6 px-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isProjects ? 'Bulk Import Projects' : 'Bulk Import Implementations'}
          </h2>
          <p className="text-sm font-medium text-slate-500">Upload CSV or Excel files</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-all text-sm"
          >
            <Info className="w-4 h-4"/>
            Show Guide & Template
          </button>
          <button onClick={onClose} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors text-slate-400">
            <X className="w-5 h-5"/>
          </button>
        </div>
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
                
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={handleSaveDraftAndClose}
                    className="px-6 py-3 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Save as Draft & Exit
                  </button>
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
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-3">
                  {processedRows.length === 0 ? (
                     <div className="py-20 text-center text-slate-500">No rows to preview</div>
                  ) : (
                    processedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((row, i) => {
                      const actualIdx = (currentPage - 1) * rowsPerPage + i;
                      return (
                      <div key={row.index} className={cn(
                        "bg-white border text-sm rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-colors relative overflow-hidden group",
                        row.status === 'clean' ? "border-emerald-200 border-l-4 border-l-emerald-500" :
                        row.status === 'error' ? "border-red-200 border-l-4 border-l-red-500" :
                        "border-amber-200 border-l-4 border-l-amber-500"
                      )}>
                        
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          {/* Client */}
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Institution</span>
                            <input 
                               value={row.clientName || ''} 
                               onChange={(e) => updateRowField(actualIdx, 'clientName', e.target.value)}
                               className={cn("w-full bg-transparent font-semibold border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                !row.clientName?.trim() ? 'bg-red-50 text-red-600' : 'text-slate-900')}
                            />
                          </div>

                          {/* Package & Services or Service */}
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{isProjects ? 'Package & Services' : 'Service & Variant'}</span>
                            {isProjects ? (
                              <>
                                <select 
                                  value={row.packageName || ''} 
                                  onChange={(e) => updateRowField(actualIdx, 'packageName', e.target.value)}
                                  className={cn("w-full bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors mb-2", 
                                    (!row.packageName || !validPackages.includes(row.packageName)) ? 'bg-red-50 text-red-600' : 'text-slate-700')}
                                >
                                  <option value="">Select Package</option>
                                  {validPackages.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                
                                {row.packageName && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                     {(() => {
                                       const pkg = config.packages.find((p: any) => p.name === row.packageName);
                                       if (!pkg) return null;
                                       const allAvail = pkg.services;
                                       const activeServices = row.services || [];
                                       
                                       return allAvail.map((sid: string) => {
                                         const isActive = activeServices.includes(sid);
                                         const sb = config.serviceBaselines.find(b => b.id === sid);
                                         const sName = sb ? sb.name : sid;
                                         
                                         return (
                                           <button 
                                             key={sid}
                                             onClick={() => {
                                               const newSet = isActive ? activeServices.filter(x => x !== sid) : [...activeServices, sid];
                                               updateRowField(actualIdx, 'services', newSet);
                                             }}
                                             className={cn(
                                               "text-[9px] font-bold px-1.5 py-0.5 rounded transition-all",
                                               isActive ? "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 hover:line-through" : "bg-white border border-slate-200 text-slate-400 opacity-50 hover:opacity-100"
                                             )}
                                             title={isActive ? `Click to remove ${sName}` : `Click to add ${sName}`}
                                           >
                                             {sName}
                                           </button>
                                         )
                                       });
                                     })()}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <select 
                                  value={row.serviceName || ''} 
                                  onChange={(e) => updateRowField(actualIdx, 'serviceName', e.target.value)}
                                  className={cn("w-full bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                    (!row.serviceName || !validServices.includes(row.serviceName)) ? 'bg-red-50 text-red-600' : 'text-slate-700')}
                                >
                                  <option value="">Select Service</option>
                                  {validServices.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input 
                                  value={row.serviceVariant || ''} 
                                  onChange={(e) => updateRowField(actualIdx, 'serviceVariant', e.target.value)}
                                  placeholder="Variant (e.g. ETZ)"
                                  className="w-full bg-slate-50 text-[10px] font-bold px-2 py-1 rounded border border-transparent hover:border-slate-200 outline-none"
                                />
                              </div>
                            )}
                          </div>

                          {/* PM or IM */}
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{isProjects ? 'Project Manager' : 'Implementation Manager'}</span>
                            <select 
                               value={isProjects ? (row.assignedPM || '') : (row.implementationManager || '')} 
                               onChange={(e) => updateRowField(actualIdx, isProjects ? 'assignedPM' : 'implementationManager', e.target.value)}
                               className={cn("w-full bg-transparent font-medium border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                 (isProjects ? (!row.assignedPM || !validPMs.includes(row.assignedPM)) : (!row.implementationManager || !validIMs.includes(row.implementationManager))) ? 'bg-red-50 text-red-600' : 'text-slate-700')}
                            >
                               <option value="">Select Manager</option>
                               {(isProjects ? validPMs : validIMs).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>

                           {/* Cost & Date (Dynamic) */}
                           {isProjects ? (
                              <>
                                <div>
                                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Cost / Value</span>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="text"
                                      value={row.value || ''} 
                                      onChange={(e) => updateRowField(actualIdx, 'value', e.target.value)}
                                      className={cn("w-20 bg-transparent font-bold border-b border-transparent hover:border-slate-300 focus:border-teal-500 outline-none transition-colors", 
                                        (!row.value || isNaN(parseFloat(String(row.value).replace(/[^\d.-]/g, '')))) ? 'bg-red-50 text-red-600' : 'text-slate-900')}
                                    />
                                    <span className="text-[10px] font-black text-slate-400">{row.currency}</span>
                                  </div>
                                </div>

                                <div>
                                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Exp. Completion</span>
                                  <input 
                                    type="date"
                                    value={row.expectedCompletionDate || ''} 
                                    onChange={(e) => updateRowField(actualIdx, 'expectedCompletionDate', e.target.value)}
                                    className={cn(
                                      "text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-none transition-all",
                                      !row.expectedCompletionDate ? "bg-red-50 border-red-200 text-red-600" : "text-slate-700"
                                    )}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Start Date</span>
                                  <input 
                                    type="date"
                                    value={row.startDate || ''} 
                                    onChange={(e) => updateRowField(actualIdx, 'startDate', e.target.value)}
                                    className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-none"
                                  />
                                </div>

                                <div>
                                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Target Closure</span>
                                  <input 
                                    type="date"
                                    value={row.targetClosureDate || ''} 
                                    onChange={(e) => updateRowField(actualIdx, 'targetClosureDate', e.target.value)}
                                    className={cn(
                                      "text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-none transition-all",
                                      !row.targetClosureDate ? "bg-red-50 border-red-200 text-red-600" : "text-slate-700"
                                    )}
                                  />
                                </div>
                              </>
                            )}
                        </div>

                        {/* Legacy Details Row (Conditional) */}
                        <div className="flex items-center gap-6 pt-3 mt-3 border-t border-slate-100">
                          {isProjects && (
                             <>
                              <div>
                                <span className="block text-[8px] uppercase font-black text-slate-400 tracking-tighter mb-1">Intake Type</span>
                                <select 
                                   value={row.intakeType || 'New'} 
                                   onChange={(e) => updateRowField(actualIdx, 'intakeType', e.target.value)}
                                   className={cn(
                                     "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg outline-none transition-all",
                                     row.intakeType === 'Old' ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"
                                   )}
                                >
                                   <option value="New">New Intake</option>
                                   <option value="Old">Older Project</option>
                                </select>
                              </div>

                              {row.intakeType === 'Old' && (
                                <>
                                  <div className="h-6 w-px bg-slate-100"></div>
                                  <div>
                                    <span className="block text-[8px] uppercase font-black text-slate-400 tracking-tighter mb-1">Starting Phase</span>
                                    <select 
                                      value={row.currentPhase || 'Execution'} 
                                      onChange={(e) => updateRowField(actualIdx, 'currentPhase', e.target.value)}
                                      className="text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"
                                    >
                                      <option value="Initiation">Initiation</option>
                                      <option value="Planning">Planning</option>
                                      <option value="Execution">Execution</option>
                                      <option value="Closure">Closure</option>
                                    </select>
                                  </div>
                                </>
                              )}
                             </>
                          )}

                          {row.errors && row.errors.length > 0 && (
                            <div className="ml-auto flex items-center gap-2 text-[10px] font-bold text-red-600 bg-red-50 rounded-lg px-3 py-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              {row.errors.length} {row.errors.length === 1 ? 'Error' : 'Errors'} Found
                            </div>
                          )}
                          
                          {row.status === 'clean' && (
                            <div className="ml-auto flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready for Import
                            </div>
                          )}
                        </div>

                        {/* Actions / Duplicate Handling */}
                        <div className="w-48 flex flex-col items-end gap-2 justify-center ml-4 border-l border-slate-100 pl-4">
                           {row.status === 'duplicate' && !row.duplicateAction && (
                              <div className="flex flex-col gap-1 w-full">
                                <span className="text-[10px] font-bold text-amber-600 uppercase w-full bg-amber-50 px-2 py-1 rounded-md mb-1 text-center border border-amber-200">Duplicate</span>
                                <div className="flex gap-1 w-full">
                                  <button onClick={() => handleDuplicateAction(actualIdx, 'overwrite')} className="flex-1 text-[10px] font-bold py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded shadow-sm">Overwrite</button>
                                  <button onClick={() => handleDuplicateAction(actualIdx, 'skip')} className="flex-1 text-[10px] font-bold py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded shadow-sm">Skip</button>
                                </div>
                              </div>
                           )}

                           {row.status === 'duplicate' && row.duplicateAction && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded-md">Action: {row.duplicateAction}</span>
                                <button onClick={() => updateRowField(actualIdx, 'duplicateAction', undefined)} className="text-slate-400 hover:text-slate-700">
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

                           <button onClick={() => deleteRow(actualIdx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-auto">
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

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Import Complete!</h3>
              <p className="text-slate-500 font-medium mt-1">
                {isProjects 
                  ? `Successfully imported ${importResult?.added} new projects and updated ${importResult?.updated}.`
                  : `Successfully imported ${implImportResult?.added} ancillary implementations.`
                }
              </p>
              {(isProjects ? (importResult?.skipped || 0) : (implImportResult?.skipped || 0)) > 0 && (
                <p className="text-sm font-bold text-amber-600 mt-2">
                   ({isProjects ? importResult?.skipped : implImportResult?.skipped} duplicates were skipped)
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={cn("px-8 py-3 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105", theme.bg)}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
