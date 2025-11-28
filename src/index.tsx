import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

// --- V5 Rules Definition (Full Gift Rules) ---
const V5_RULES = {
  "version": 5,
  "created_at": "2025-09-19T21:45:00Z",
  "name": "Verum Gift Rules - Full Brain Coverage",
  "rules": [
    {
      "id": "contradiction-basic-1",
      "brain": "B1_Contradiction_Engine",
      "description": "Flag contradictions across statements with identical actors/timestamps.",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "actor", "op": "eq", "ref": "actor" },
          { "field": "timestamp", "op": "eq", "ref": "timestamp" },
          { "field": "statement", "op": "contradicts", "ref": "statement" }
        ]
      },
      "severity": "CRITICAL",
      "action": "FLAG_AND_FREEZE",
      "recovery": [
        { "step": "cross_check_external", "target": "witness_pool" },
        { "step": "escalate", "target": "human_review" }
      ]
    },
    {
      "id": "timestamp-drift-1",
      "brain": "B4_Linguistics",
      "description": "Detects inconsistent timestamps for the same actor within a small time window (impossible overlaps).",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "actor", "op": "eq", "ref": "actor" },
          { "field": "timestamp", "op": "overlaps", "ref": "timestamp" }
        ]
      },
      "severity": "HIGH",
      "action": "FLAG",
      "recovery": [
        { "step": "align_timestamps", "window": "5m" },
        { "step": "if_unresolved", "next": "WARN" }
      ]
    },
    {
      "id": "metadata-missing-1",
      "brain": "B3_Comms_Channel_Integrity",
      "description": "Flags documents or records missing critical metadata (actor, timestamp, or source).",
      "logic": {
        "type": "any",
        "conditions": [
          { "field": "actor", "op": "missing" },
          { "field": "timestamp", "op": "missing" },
          { "field": "source", "op": "missing" }
        ]
      },
      "severity": "MEDIUM",
      "action": "WARN",
      "recovery": [
        { "step": "request_metadata", "fields": ["actor", "timestamp", "source"] },
        { "step": "defer_processing", "until": "metadata_provided" }
      ]
    },
    {
      "id": "multi-actor-conflict-1",
      "brain": "B1_Contradiction_Engine+B4_Linguistics",
      "description": "Flags contradictory statements across different actors about the same timestamp/event.",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "timestamp", "op": "eq", "ref": "timestamp" },
          { "field": "statement", "op": "contradicts", "ref": "statement" },
          { "field": "actor", "op": "neq", "ref": "actor" }
        ]
      },
      "severity": "HIGH",
      "action": "FLAG",
      "recovery": [
        { "step": "rank_sources", "criteria": ["credibility", "chain_strength"] },
        { "step": "auto_select_strongest" },
        { "step": "if_conflict_persists", "next": "escalate" }
      ]
    },
    {
      "id": "chain-integrity-1",
      "brain": "B2_Doc_Image_Forensics",
      "description": "Checks if hash values of documents match expected hash chain (tamper detection).",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "document_hash", "op": "neq", "ref": "expected_hash" }
        ]
      },
      "severity": "CRITICAL",
      "action": "FLAG_AND_FREEZE",
      "recovery": [
        { "step": "rehash_document" },
        { "step": "verify_against_backup" },
        { "step": "escalate", "target": "blockchain_anchor" }
      ]
    },
    {
      "id": "financial-anomaly-1",
      "brain": "B6_Financial_Patterns",
      "description": "Flags transactions that deviate from expected financial behavior (outliers in value, timing, or counterpart).",
      "logic": {
        "type": "any",
        "conditions": [
          { "field": "amount", "op": "outlier", "ref": "historical_mean" },
          { "field": "counterparty", "op": "anomalous", "ref": "trusted_entities" }
        ]
      },
      "severity": "HIGH",
      "action": "FLAG",
      "recovery": [
        { "step": "cross_check_external", "target": "bank_records" },
        { "step": "escalate", "target": "financial_audit" }
      ]
    },
    {
      "id": "legal-precedent-mismatch-1",
      "brain": "B7_Legal",
      "description": "Flags citations or claims that contradict established legal precedent.",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "citation", "op": "contradicts", "ref": "legal_precedent" }
        ]
      },
      "severity": "HIGH",
      "action": "FLAG_AND_ESCALATE",
      "recovery": [
        { "step": "cross_reference", "target": "case_law_database" },
        { "step": "escalate", "target": "legal_review" }
      ]
    },
    {
      "id": "voice-auth-failure-1",
      "brain": "B8_Voice_Audio_Forensics",
      "description": "Detects mismatched or spoofed voiceprints in submitted audio evidence.",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "voiceprint", "op": "neq", "ref": "expected_voiceprint" }
        ]
      },
      "severity": "CRITICAL",
      "action": "FLAG_AND_FREEZE",
      "recovery": [
        { "step": "reverify_voice", "target": "alternate_sample" },
        { "step": "escalate", "target": "biometric_authority" }
      ]
    },
    {
      "id": "handwriting-inconsistency-1",
      "brain": "HandwritingEncoder+HandwritingDecoder",
      "description": "Flags handwriting that is inconsistent across signed documents for the same actor.",
      "logic": {
        "type": "all",
        "conditions": [
          { "field": "signature", "op": "neq", "ref": "expected_signature" }
        ]
      },
      "severity": "HIGH",
      "action": "FLAG",
      "recovery": [
        { "step": "cross_check_external", "target": "notary_database" },
        { "step": "escalate", "target": "handwriting_expert" }
      ]
    },
    {
      "id": "rnd-advisory-novelty-1",
      "brain": "B9_RnD_Advisory",
      "description": "Flags novel or unclassified anomalies that do not fit any existing category, for human advisory review.",
      "logic": {
        "type": "any",
        "conditions": [
          { "field": "anomaly_score", "op": "gt", "ref": "threshold" },
          { "field": "category", "op": "unknown" }
        ]
      },
      "severity": "MEDIUM",
      "action": "ESCALATE",
      "recovery": [
        { "step": "log_event", "target": "anomaly_register" },
        { "step": "escalate", "target": "human_review" }
      ]
    }
  ]
};

// --- IndexedDB Helper Functions (The "Binary Folder" System) ---
const DB_NAME = 'VerumOmnisDB';
const STORE_NAME = 'reports';

// Database Error Wrapper
const wrapDBError = (err: any, operation: string) => {
    return new Error(`Database failure during ${operation}: ${err.message || err}`);
};

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('caseId', 'caseId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(wrapDBError(event.target.error, 'OPEN'));
    });
};

const saveReportToDB = async (caseId: string, content: string, evidence: string[]) => {
    if (!caseId) return; 
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.add({ 
                caseId, 
                content, 
                evidence, 
                timestamp: new Date().toISOString() 
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(wrapDBError(tx.error, 'WRITE'));
        });
    } catch (e) {
        console.error("Failed to save to DB", e);
        // We don't throw here to avoid blocking the UI showing the result
    }
};

const getReportsByCase = async (caseId: string): Promise<any[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('caseId');
        const request = index.getAll(IDBKeyRange.only(caseId));
        request.onsuccess = () => {
            const results = request.result;
            results.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            resolve(results);
        };
        request.onerror = () => reject(wrapDBError(request.error, 'READ_BY_CASE'));
    });
};

const getAllCasesList = async (): Promise<string[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const reports = request.result;
            const cases = new Set(reports.map((r: any) => r.caseId).filter(Boolean));
            resolve(Array.from(cases) as string[]);
        };
        request.onerror = () => reject(wrapDBError(request.error, 'READ_ALL'));
    });
};

// --- Advanced Error Diagnostics ---
interface DiagnosticError {
    userMessage: string;
    technicalDetails: string;
    suggestedFix: string;
    code?: string;
}

const diagnoseError = (error: any): DiagnosticError => {
    const msg = error.message || String(error);
    
    // 1. API Key Issues
    if (msg.includes('403') || msg.includes('API key')) {
        return {
            userMessage: "Authorization Failed. The system cannot access the AI engine.",
            technicalDetails: msg,
            suggestedFix: "Check your 'VITE_API_KEY' in .env or GitHub Secrets. Ensure the key is active and has 'Generative Language API' enabled in Google Cloud Console.",
            code: 'AUTH_403'
        };
    }

    // 2. Quota/Rate Limits
    if (msg.includes('429') || msg.includes('quota')) {
        return {
            userMessage: "System is currently overloaded. Please wait a moment.",
            technicalDetails: msg,
            suggestedFix: "You have hit the Gemini API rate limit (RPM/TPM). Implement exponential backoff or upgrade to a paid tier if on production.",
            code: 'QUOTA_429'
        };
    }

    // 3. Safety Blocks
    if (msg.includes('SAFETY') || msg.includes('blocked')) {
        return {
            userMessage: "Analysis halted due to sensitive content flags.",
            technicalDetails: msg,
            suggestedFix: "The model's safety filters triggered. Legal/Forensic docs often trigger 'Violence' or 'Hate Speech' filters. Adjust 'safetySettings' in the API config to BLOCK_ONLY_HIGH.",
            code: 'SAFETY_BLOCK'
        };
    }

    // 4. Network/Offline
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        return {
            userMessage: "Connection lost. Cannot reach the AI engine.",
            technicalDetails: msg,
            suggestedFix: "Check internet connection. If connection is good, the API endpoint might be blocked by a firewall or CORS policy.",
            code: 'NET_ERR'
        };
    }

    // 5. File Processing
    if (msg.includes('FileReader') || msg.includes('read')) {
        return {
            userMessage: "Failed to read one of the evidence files.",
            technicalDetails: msg,
            suggestedFix: "The file might be corrupted or permissions are denied. Ensure files are standard formats (PDF, PNG, JPG, TXT).",
            code: 'FILE_IO'
        };
    }

    // Default Unknown
    return {
        userMessage: "An unexpected internal error occurred.",
        technicalDetails: msg + (error.stack ? `\n${error.stack}` : ''),
        suggestedFix: "Check the browser console for full stack trace. Review 'handleSubmit' logic in index.tsx.",
        code: 'UNKNOWN'
    };
};

// --- File Helpers & Local Forensics (B2/B3) ---
const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const fileToGenerativePart = async (file: File) => {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve({
                    inlineData: { 
                        data: reader.result.split(',')[1], 
                        mimeType: file.type 
                    },
                });
            } else {
                reject(new Error(`Failed to read file: ${file.name}`));
            }
        };
        reader.onerror = () => reject(new Error(`FileReader Error: ${reader.error?.message}`));
        reader.readAsDataURL(file);
    });
};

const Logo = () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 33C26.2843 33 33 26.2843 33 18C33 9.71573 26.2843 3 18 3C9.71573 3 3 9.71573 3 18C3 26.2843 9.71573 33 18 33Z" stroke="#58A6FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 24.75C21.7279 24.75 24.75 21.7279 24.75 18C24.75 14.2721 21.7279 11.25 18 11.25C14.2721 11.25 11.25 14.2721 11.25 18C11.25 21.7279 14.2721 24.75 18 24.75Z" stroke="#58A6FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const App = () => {
    const [currentView, setCurrentView] = useState('welcome');
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    
    // Enhanced Error State
    const [errorInfo, setErrorInfo] = useState<DiagnosticError | null>(null);
    const [showErrorDetails, setShowErrorDetails] = useState(false);

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [textBrightness, setTextBrightness] = useState(100);
    const [logoSrc, setLogoSrc] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Case Management State
    const [caseId, setCaseId] = useState('');
    const [savedCases, setSavedCases] = useState<string[]>([]);
    const [selectedCaseHistory, setSelectedCaseHistory] = useState<any[]>([]);

    // V5 Local Forensics State
    const [localForensics, setLocalForensics] = useState<any[]>([]);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        const savedLogo = localStorage.getItem('companyLogo');
        if (savedLogo) setLogoSrc(savedLogo);
        
        refreshCaseList().catch(err => console.error("Init DB Error", err));

        // API Key Check
        if (!process.env.API_KEY) {
             setErrorInfo({
                 userMessage: "System Configuration Error",
                 technicalDetails: "process.env.API_KEY is undefined",
                 suggestedFix: "Ensure VITE_API_KEY is set in your environment variables and vite.config.ts is configured to replace it.",
                 code: "CONFIG_MISSING"
             });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Run Local Forensics (B2/B3) whenever files change
    useEffect(() => {
        const runLocalForensics = async () => {
            if (files.length === 0) {
                setLocalForensics([]);
                return;
            }
            try {
                const analysis = await Promise.all(files.map(async (f) => ({
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    lastModified: new Date(f.lastModified).toISOString(),
                    // B2 Brain: Chain Integrity Hash
                    hash: await calculateSHA256(f)
                })));
                setLocalForensics(analysis);
            } catch (e) {
                console.error("Local forensics failed", e);
            }
        };
        runLocalForensics();
    }, [files]);

    const refreshCaseList = async () => {
        try {
            const cases = await getAllCasesList();
            setSavedCases(cases);
        } catch (e) {
            console.error("Failed to load cases", e);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(e.target.files!)]);
            setErrorInfo(null); // Clear errors on new input
        }
    };
    
    const removeFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(e.dataTransfer.files)]);
            e.dataTransfer.clearData();
            setErrorInfo(null);
        }
    }, []);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation();
    };

    // --- Main Analysis Logic ---
    const handleSubmit = async () => {
        if (files.length === 0) {
            setErrorInfo({
                userMessage: "No evidence provided.",
                technicalDetails: "File array is empty.",
                suggestedFix: "Upload at least one PDF, Image, or Text file.",
                code: "USER_ERR"
            });
            return;
        }

        if (isOffline) {
             // In V5, we allow viewing the Local Forensics even if offline, but can't generate full report.
             setErrorInfo({
                userMessage: "Offline Mode Active.",
                technicalDetails: "Full brain analysis requires cloud connectivity. Local forensics (B2/B3) are available below.",
                suggestedFix: "Connect to the internet for full V5 Engine analysis.",
                code: "OFFLINE_LIMITED"
            });
            return;
        }

        setLoading(true);
        setResult('');
        setErrorInfo(null);
        setShowErrorDetails(false);

        try {
            // 1. Get Geolocation Context (Fail-safe)
            const locationInfo = await new Promise<string>((resolve) => {
                if (!navigator.geolocation) {
                    resolve('Geolocation not supported by this browser.');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve(`User's current location: Latitude ${position.coords.latitude}, Longitude ${position.coords.longitude}.`),
                    (error) => resolve(`User's location could not be determined. Error: ${error.message}.`),
                    { timeout: 5000 }
                );
            });

            // 2. Get Historical Context from DB
            let historyContext = "";
            if (caseId.trim()) {
                try {
                    const history = await getReportsByCase(caseId.trim());
                    if (history.length > 0) {
                        historyContext = `\n--- PRIOR CASE HISTORY (CRITICAL CONTEXT) ---\nThe user has provided a Case Reference ID: "${caseId}". The following are previous forensic reports generated for this case. Use this context to maintain continuity, cross-reference findings, and identify evolving patterns or contradictions in the new evidence.\n\n`;
                        history.forEach((report, idx) => {
                            historyContext += `[HISTORICAL REPORT ${idx + 1} - ${new Date(report.timestamp).toLocaleDateString()}]\n${report.content.substring(0, 3000)}...\n[END REPORT ${idx + 1}]\n\n`;
                        });
                        historyContext += "--- END PRIOR HISTORY ---\n";
                    }
                } catch (dbErr) {
                    console.warn("Context retrieval failed, proceeding without history.", dbErr);
                }
            }

            // 3. Prepare V5 Local Forensics Context
            const localForensicContext = `
--- V5 LOCAL FORENSICS DATA (B2/B3) ---
The following metadata and cryptographic hashes were calculated locally by the Verum Engine. 
Use this to verify file integrity (Brain B2) and check for missing metadata (Brain B3).
${JSON.stringify(localForensics, null, 2)}
--- END LOCAL FORENSICS ---
`;

            const currentTime = new Date().toISOString();
            const contextText = `\n--- CONTEXTUAL DATA ---\n${locationInfo}\nCurrent Timestamp: ${currentTime}\n${historyContext}\n${localForensicContext}\n--- END CONTEXTUAL DATA ---\n`;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const hasPdfFile = files.some(file => file.type === 'application/pdf');
            const modelName = hasPdfFile ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
            
            // System Instruction - V5 FULL BRAIN COVERAGE
            const systemInstruction = `You are Verum Omnis V5, a world-class forensic analysis engine. Your tone is severe, objective, and unflinching. 

**V5 GIFT RULES - FULL BRAIN COVERAGE (ACTIVE):**
You must apply the following specific "Brains" and Logic Rules to the evidence. 
Refer to the "logic" for detection and "recovery" for strategic recommendations:
${JSON.stringify(V5_RULES, null, 2)}

**MISSION:**
Analyze the provided evidence (text, PDFs, images) and produce a detailed forensic and strategic report. 
You MUST explicitly utilize the V5 Brains (B1-B9) to categorize anomalies.

**REPORT STRUCTURE:**
The report MUST include the following sections in this exact order:
1.  **Executive Summary:** A brief, direct overview of the most critical findings.
2.  **Timeline of Events:** A chronological reconstruction of events based on the evidence.
3.  **Key People/Entities Involved:** Identification of all individuals or organizations and their roles.
4.  **V5 Forensic Analysis (Brain Outputs):**
    *   **Contradiction Analysis (B1):** Highlight conflicting statements.
    *   **Integrity & Metadata (B2/B3):** Comment on the provided hashes and metadata.
    *   **Financial & Legal (B6/B7):** Flag financial anomalies or legal inconsistencies.
    *   **Other Anomalies (B4/B8/B9):** Linguistics, Audio, or Novelty flags.
5.  **Evidence Breakdown:** A summary of what each piece of evidence contributes to the case.
6.  **Potential Criminal & Civil Liabilities:** A stark assessment of potential legal exposure. Identify specific statutes that may have been violated. Detail potential fines, sanctions, and estimated criminal jail time based on the severity of the findings. This section must be direct and serve as a clear warning.
7.  **Strategic Recommendations - Legal Avenues:**
    *   **Recovery Steps:** Incorporate the specific "recovery" steps defined in the V5 Rules for any active flags.
    *   **Criminal Strategy:** Outline concrete steps for engaging with law enforcement.
    *   **Civil Strategy:** Detail potential civil claims, parties to sue, and litigation objectives.
8.  **Strategic Recommendations - Communications:**
    *   **Draft Communications:** Provide pre-drafted emails or letters for key stakeholders. For each communication, you must specify the intended recipient, the strategic purpose, and the key message to convey.
9.  **Conclusion:** Your final, authoritative assessment of the situation.

**CRITICAL FORMATTING DIRECTIVES - FAILURE TO COMPLY WILL INVALIDATE THE REPORT:**
1.  **NO WORD CONCATENATION:** You MUST ensure a single space separates every word. This is a critical, non-negotiable rule.
    *   **INCORRECT:** \`CriminalLiability\`, \`ShareholderOppression&Breach\`, \`SupplementalEvidencetoSAPS\`
    *   **CORRECT:** \`Criminal Liability\`, \`Shareholder Oppression & Breach\`, \`Supplemental Evidence to SAPS\`
    *   This rule applies to ALL text: headings, sub-headings, list items, and paragraphs. Double-check your entire output for this error before finalizing.
2.  **PROPER HEADINGS:** All main section titles (e.g., "1. Executive Summary") MUST be Level 2 Headings (\`##\`). Sub-sections like 'Criminal Strategy' must be Level 3 (\`###\`). Do not use bolding as a substitute for a proper Markdown heading.
3.  **CLEAN LISTS:** Use standard Markdown for lists (\`*\` or \`1.\`). For nested items or sub-topics within a list item, use proper indentation and standard list markers. Do not run text together.

Analyze the provided evidence with extreme prejudice and generate the report according to these strict instructions.`;
            
            const userPrompt = "Analyze the provided evidence files and produce a forensic report based on your system instructions. Pay close attention to the V5 Brain rules.";
            
            // OPTIMIZATION: Process files in parallel using Promise.all
            const evidencePartsPromises = files.map(async (file) => {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    return await fileToGenerativePart(file);
                } else if (file.type.startsWith('text/')) {
                    const text = await file.text();
                    return { text: `\n--- Evidence File: ${file.name} ---\n${text}`};
                } else {
                    // Fallback for unsupported types
                     return { text: `\n--- Evidence File: ${file.name} (Unsupported Format) ---\n[File contents not analyzed directly]`};
                }
            });

            const evidenceParts = await Promise.all(evidencePartsPromises);
            const parts = [{ text: `${userPrompt}\n${contextText}` }, ...evidenceParts];
            
            const config: any = { 
                systemInstruction,
                // SAFETY OPTIMIZATION: Allow forensic content which may otherwise trigger "Violence" or "Hate Speech" filters false positives
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                ]
            };

            if (modelName === 'gemini-2.5-pro') {
                config.thinkingConfig = { thinkingBudget: 32768 };
            }

            const response = await ai.models.generateContent({
                model: modelName,
                contents: { parts },
                config,
            });

            const reportContent = response.text;
            
            if (!reportContent) {
                throw new Error("The AI returned an empty response. This usually indicates a safety block or model error.");
            }

            setResult(reportContent);
            
            // Save to DB if Case ID exists
            if (caseId.trim()) {
                await saveReportToDB(caseId.trim(), reportContent, files.map(f => f.name));
                await refreshCaseList();
            }

            setCurrentView('report');

        } catch (err) {
            const diagnosis = diagnoseError(err);
            console.error("Diagnostic Report:", diagnosis);
            setErrorInfo(diagnosis);
        } finally {
            setLoading(false);
        }
    };
    
    // --- PDF Generation (Single Report) ---
    const handleGeneratePdf = async () => {
        if (!result) return;
        generatePdfDocument(result, caseId || "Unassigned", "Forensic Analysis Report");
    };

    // --- PDF Generation (Full Case File) ---
    const handleGenerateMasterPdf = async (targetCaseId: string) => {
        const reports = await getReportsByCase(targetCaseId);
        if (reports.length === 0) return;

        let combinedMarkdown = "";
        
        // Generate Table of Contents Text
        combinedMarkdown += `# MASTER CASE FILE: ${targetCaseId.toUpperCase()}\n\n`;
        combinedMarkdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        combinedMarkdown += `## TABLE OF CONTENTS\n\n`;
        
        reports.forEach((report, index) => {
            combinedMarkdown += `*   **Report ${index + 1}:** ${new Date(report.timestamp).toLocaleDateString()} - Analysis of ${report.evidence.length} evidence files.\n`;
        });
        combinedMarkdown += `\n---\n\n`;

        // Append Reports
        reports.forEach((report, index) => {
            combinedMarkdown += `\n# REPORT ${index + 1} (${new Date(report.timestamp).toLocaleDateString()})\n\n`;
            combinedMarkdown += `**Evidence Analyzed:** ${report.evidence.join(', ')}\n\n`;
            combinedMarkdown += `\n---\n\n`;
            combinedMarkdown += report.content;
            combinedMarkdown += `\n\n<div style="page-break-after: always;"></div>\n\n`;
        });

        generatePdfDocument(combinedMarkdown, targetCaseId, "Master Case File");
    };

    const generatePdfDocument = async (markdownContent: string, caseName: string, title: string) => {
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        
        // Cover Page
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(20, 20, 20);
        doc.text(title.toUpperCase(), pageWidth / 2, 80, { align: 'center' });
        
        doc.setDrawColor(50, 50, 50);
        doc.setLineWidth(0.5);
        doc.line(margin * 2, 90, pageWidth - (margin * 2), 90);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(60, 60, 60);
        doc.text(`CASE REFERENCE: ${caseName}`, pageWidth / 2, 100, { align: 'center' });
        doc.text(`Generated by: Verum Omnis Engine`, pageWidth / 2, 110, { align: 'center' });
        doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, 115, { align: 'center' });

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const disclaimer = "This document contains automated forensic analysis based on provided evidence. It should be verified by legal counsel.";
        doc.text(disclaimer, pageWidth / 2, pageHeight - 30, { align: 'center', maxWidth: 140 });
        
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        const contentElement = document.createElement('div');
        contentElement.innerHTML = (window as any).marked.parse(markdownContent);
        contentElement.style.fontFamily = '"Helvetica", "Arial", sans-serif';
        contentElement.style.color = '#000000';
        contentElement.style.width = '100%';
        contentElement.style.fontSize = '10pt'; // Slightly smaller for master files
        contentElement.style.lineHeight = '1.4';
        
        const styles = document.createElement('style');
        styles.innerHTML = `
            h1 { font-size: 16pt; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 20px; color: #000; page-break-before: always; }
            h2 { font-size: 14pt; font-weight: bold; margin-top: 15px; color: #222; }
            h3 { font-size: 12pt; font-weight: bold; margin-top: 10px; color: #333; }
            p { margin-bottom: 10px; text-align: justify; color: #000; }
            ul, ol { margin-bottom: 10px; padding-left: 20px; }
            li { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 9pt; }
            th { background-color: #f0f0f0; font-weight: bold; padding: 6px; border: 1px solid #ccc; text-align: left; }
            td { padding: 6px; border: 1px solid #ccc; }
            strong { font-weight: bold; color: #000; }
            blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #555; font-style: italic; }
        `;
        contentElement.appendChild(styles);

        await doc.html(contentElement, {
            callback: async function (doc: any) {
                const content = doc.output('arraybuffer');
                const hashBuffer = await crypto.subtle.digest('SHA-256', content);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                const pageCount = doc.internal.getNumberOfPages();
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);

                for (let i = 2; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.text(`Case: ${caseName} | Page ${i - 1} of ${pageCount - 1}`, margin, pageHeight - 10);
                    if (i === pageCount) doc.text(`Cryptographic Seal: ${hashHex}`, margin, pageHeight - 15);
                }
                doc.save(`${caseName.replace(/\s+/g, '_')}_Master_Report.pdf`);
            },
            x: margin,
            y: margin,
            width: pageWidth - (margin * 2),
            windowWidth: 800,
            margin: [15, 15, 15, 15],
            autoPaging: 'text'
        });
    };
    
    const handleNewAnalysis = () => {
        setFiles([]); setResult(''); setErrorInfo(null);
        // Don't clear caseId automatically so they can continue the same case easily
        setCurrentView('analysis');
    };

    const handleViewCase = async (cId: string) => {
        try {
            const reports = await getReportsByCase(cId);
            setSelectedCaseHistory(reports);
            setCaseId(cId);
            setCurrentView('caseRepository');
        } catch (e) {
            const diag = diagnoseError(e);
            setErrorInfo(diag);
        }
    };

    const renderMarkdown = (text: string) => {
        if ((window as any).marked) {
            return { __html: (window as any).marked.parse(text, { breaks: true, gfm: true }) };
        }
        return { __html: text.replace(/\n/g, '<br />') };
    };

    return (
        <>
            <header style={styles.header}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer'}} onClick={() => setCurrentView('welcome')}>
                    {logoSrc ? <img src={logoSrc} style={styles.logoImage} alt="Company Logo" /> : <Logo />}
                    <span style={styles.headerTitle}>Verum Omnis V5</span>
                </div>
                {currentView !== 'welcome' && (
                     <button onClick={() => setCurrentView('welcome')} style={styles.navButton}>Home</button>
                )}
            </header>
            <main style={styles.mainContainer} aria-live="polite" aria-busy={loading}>
                {currentView === 'welcome' && (
                    <div style={styles.viewContainer}>
                        <h1 style={styles.welcomeTitle}>Forensic Intelligence V5</h1>
                        <p style={styles.welcomeText}>
                            Autonomous legal verification and forensic analysis engine (Version 5).
                            Full Brain Coverage: 9 Specialized Neural Modules Active.
                        </p>
                        <div style={styles.actionButtons}>
                            <button onClick={() => { setCaseId(''); setCurrentView('analysis'); }} style={styles.button}>Start New Analysis</button>
                            {savedCases.length > 0 && (
                                <button onClick={() => setCurrentView('caseList')} style={styles.secondaryButton}>Open Case Repository ({savedCases.length})</button>
                            )}
                        </div>
                        <div style={styles.welcomeFooter}>
                            <p><strong>Full V5 Brain Coverage:</strong> Contradiction, Linguistics, Metadata, Financial, Legal, Voice, Handwriting, & Novelty Detection.</p>
                        </div>
                    </div>
                )}

                {currentView === 'caseList' && (
                    <div style={styles.viewContainer}>
                        <h2 style={styles.analysisTitle}>Case Repository</h2>
                         <div style={styles.fileList}>
                            {savedCases.map(c => (
                                <div key={c} onClick={() => handleViewCase(c)} style={styles.caseCard}>
                                    <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{c}</div>
                                    <div style={{fontSize: '0.9rem', color: '#8b949e'}}>Open Case Files &rarr;</div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setCurrentView('welcome')} style={styles.secondaryButton}>Back</button>
                    </div>
                )}

                {currentView === 'caseRepository' && (
                    <div style={styles.viewContainer}>
                        <div style={styles.resultHeader}>
                            <h2 style={styles.resultTitle}>Case File: {caseId}</h2>
                            <button onClick={() => handleGenerateMasterPdf(caseId)} style={styles.pdfButton}>Generate Master PDF</button>
                        </div>
                        <div style={{textAlign: 'left', width: '100%', maxWidth: '800px'}}>
                            {selectedCaseHistory.map((report, idx) => (
                                <div key={idx} style={styles.historyCard}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                                        <strong style={{color: '#58a6ff'}}>Report #{idx + 1}</strong>
                                        <span style={{color: '#8b949e'}}>{new Date(report.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div style={{fontSize: '0.9rem', color: '#c9d1d9', marginBottom: '8px'}}>
                                        <strong>Evidence:</strong> {report.evidence.join(', ')}
                                    </div>
                                    <div style={{maxHeight: '100px', overflow: 'hidden', color: '#8b949e', fontSize: '0.8rem', borderTop: '1px solid #30363d', paddingTop: '8px'}}>
                                        {report.content.substring(0, 150)}...
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setCurrentView('analysis')} style={styles.button}>Add New Evidence to Case</button>
                    </div>
                )}

                {currentView === 'analysis' && (
                    <div style={{...styles.viewContainer, gap: '24px'}}>
                        <div style={{textAlign: 'center'}}>
                            <h1 style={styles.analysisTitle}>Evidence Analysis</h1>
                            <p style={styles.analysisText}>Provide evidence. V5 Brains (B1-B9) will engage automatically.</p>
                        </div>
                        
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Case Reference ID</label>
                            <input 
                                type="text" 
                                value={caseId} 
                                onChange={(e) => setCaseId(e.target.value)} 
                                placeholder="e.g., CASE-2024-001" 
                                list="case-history"
                                style={styles.input}
                            />
                            <datalist id="case-history">
                                {savedCases.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>

                        <div 
                            style={{...styles.dropzone, borderColor: isDragging ? '#58a6ff' : '#30363d'}}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onClick={() => document.getElementById('file-upload')?.click()}
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256" style={{color: '#8b949e'}}><path d="M208,88H176V48a16,16,0,0,0-16-16H96A16,16,0,0,0,80,48V88H48A16,16,0,0,0,32,104V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104A16,16,0,0,0,208,88ZM96,48h64V88H96ZM208,208H48V104H80v16a8,8,0,0,0,16,0V104h64v16a8,8,0,0,0,16,0V104h32Z"></path></svg>
                            <span style={{color: '#58a6ff', fontWeight: 500}}>Click to upload evidence</span> or drag and drop
                            <input id="file-upload" type="file" onChange={handleFileChange} style={{ display: 'none' }} disabled={loading} multiple />
                        </div>

                        {files.length > 0 && (
                            <div style={{width: '100%', maxWidth: '600px', textAlign: 'left'}}>
                                <h3 style={{fontSize: '0.9rem', color: '#58a6ff', borderBottom: '1px solid #30363d', paddingBottom: '8px'}}>B2: Local Forensics (Hash Chain Integrity)</h3>
                                <div style={styles.fileList}>
                                    {files.map((file, index) => (
                                        <div key={index} style={{...styles.fileChip, flexDirection: 'column', alignItems: 'flex-start', width: '100%'}}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                                <span>{file.name}</span>
                                                <button onClick={() => removeFile(index)} style={styles.removeFileButton} disabled={loading}>&times;</button>
                                            </div>
                                            {localForensics[index] && (
                                                <div style={{fontSize: '0.75rem', color: '#8b949e', marginTop: '4px', wordBreak: 'break-all'}}>
                                                    SHA-256: <span style={{fontFamily: 'monospace', color: '#a5d6ff'}}>{localForensics[index].hash}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <button onClick={handleSubmit} disabled={loading || isOffline} style={{...styles.button, minWidth: '200px', cursor: loading ? 'wait' : (isOffline ? 'not-allowed' : 'pointer')}}>
                            {loading ? <span style={styles.spinner} role="status" aria-label="Analyzing..."></span> : (isOffline ? 'Offline Mode' : 'Initiate V5 Analysis')}
                        </button>
                        
                        {/* Advanced Error Display */}
                        {errorInfo && (
                            <div style={styles.errorContainer} role="alert">
                                <div style={styles.errorHeader}>
                                    <span style={styles.errorIcon}>⚠️</span>
                                    <span style={styles.errorMessage}>{errorInfo.userMessage}</span>
                                </div>
                                <button 
                                    onClick={() => setShowErrorDetails(!showErrorDetails)} 
                                    style={styles.errorToggle}
                                >
                                    {showErrorDetails ? "Hide Diagnostics" : "View Technical Diagnostics"}
                                </button>
                                {showErrorDetails && (
                                    <div style={styles.errorDetails}>
                                        <div style={styles.errorSection}>
                                            <strong>Code:</strong> {errorInfo.code || 'N/A'}
                                        </div>
                                        <div style={styles.errorSection}>
                                            <strong>Suggested Fix:</strong>
                                            <p style={{margin: '4px 0 0 0', color: '#a5d6ff'}}>{errorInfo.suggestedFix}</p>
                                        </div>
                                        <div style={styles.errorSection}>
                                            <strong>Technical Trace:</strong>
                                            <pre style={styles.errorPre}>{errorInfo.technicalDetails}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                 {currentView === 'report' && (
                    <section style={styles.resultSection} aria-labelledby="result-title">
                        <div style={styles.resultHeader}>
                            <div>
                                <h2 id="result-title" style={styles.resultTitle}>Forensic Report (V5)</h2>
                                {caseId && <span style={{color: '#238636', fontSize: '0.8rem'}}>Saved to Case: {caseId}</span>}
                            </div>
                            <div style={styles.resultHeaderControls}>
                                <div style={styles.brightnessControl}>
                                    <label htmlFor="brightness-slider" style={styles.brightnessLabel}>Text Brightness</label>
                                    <input id="brightness-slider" type="range" min="40" max="100" value={textBrightness} onChange={(e) => setTextBrightness(parseInt(e.target.value, 10))} className="brightness-slider" aria-label="Adjust text brightness" />
                                </div>
                                <button onClick={handleGeneratePdf} style={styles.pdfButton}>Download PDF</button>
                                <button onClick={handleNewAnalysis} style={styles.newAnalysisButton}>New Analysis</button>
                            </div>
                        </div>
                        <div className="result-content" style={{ ...styles.resultContent, color: `hsl(0, 0%, ${textBrightness * 0.82}%)` }} dangerouslySetInnerHTML={renderMarkdown(result)} />
                    </section>
                )}
            </main>
        </>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    header: { width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'env(safe-area-inset-top) 0 24px 0', marginTop: 'env(safe-area-inset-top)' },
    logoImage: { maxHeight: '36px', maxWidth: '180px' },
    headerTitle: { fontSize: '1.25rem', fontWeight: 500, color: '#e6edf3', marginLeft: '12px' },
    navButton: { background: 'none', border: '1px solid #30363d', color: '#c9d1d9', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' },
    mainContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, justifyContent: 'center', paddingBottom: 'env(safe-area-inset-bottom)' },
    viewContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', animation: 'fadeIn 0.5s ease-in-out' },
    welcomeTitle: { fontSize: 'clamp(2rem, 5vw, 2.75rem)', margin: 0, color: '#e6edf3', fontWeight: 500 },
    welcomeText: { fontSize: '1.1rem', color: '#8b949e', maxWidth: '600px', lineHeight: 1.6, margin: '0 0 16px 0' },
    actionButtons: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' },
    analysisTitle: { fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', margin: 0, color: '#e6edf3', fontWeight: 500 },
    analysisText: { fontSize: '1rem', color: '#8b949e', maxWidth: '600px', lineHeight: 1.6 },
    welcomeFooter: { fontSize: '0.8rem', color: '#8b949e', maxWidth: '600px', lineHeight: 1.5, borderTop: '1px solid #21262d', paddingTop: '24px', marginTop: '16px' },
    button: { backgroundColor: '#238636', color: 'white', border: '1px solid rgba(240, 246, 252, 0.1)', padding: '12px 24px', borderRadius: '6px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', transition: 'all 0.2s', fontWeight: 500, cursor: 'pointer' },
    secondaryButton: { backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', padding: '12px 24px', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer' },
    dropzone: { width: '100%', boxSizing: 'border-box', border: '2px dashed #30363d', borderRadius: '12px', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', backgroundColor: '#0d1117', transition: 'border-color 0.2s, background-color 0.2s' },
    fileList: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', justifyContent: 'center', width: '100%' },
    fileChip: { backgroundColor: '#161b22', color: '#e6edf3', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', border: '1px solid #30363d' },
    removeFileButton: { background: '#30363d', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0, lineHeight: 1, fontSize: '14px' },
    spinner: { border: '3px solid rgba(255, 255, 255, 0.3)', borderTop: '3px solid #fff', borderRadius: '50%', width: '18px', height: '18px', animation: 'spin 1s linear infinite' },
    
    // Error Styles
    errorContainer: { backgroundColor: 'rgba(215, 58, 73, 0.05)', border: '1px solid rgba(215, 58, 73, 0.4)', borderRadius: '8px', padding: '16px', width: '100%', maxWidth: '600px', boxSizing: 'border-box', textAlign: 'left' },
    errorHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
    errorIcon: { fontSize: '1.5rem' },
    errorMessage: { color: '#ff7b72', fontWeight: 500, fontSize: '1rem' },
    errorToggle: { background: 'none', border: 'none', color: '#8b949e', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginBottom: '8px' },
    errorDetails: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '12px', marginTop: '8px', fontSize: '0.85rem' },
    errorSection: { marginBottom: '12px' },
    errorPre: { color: '#8b949e', overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.8rem', margin: '4px 0 0 0' },
    
    resultSection: { width: '100%', backgroundColor: '#0d1117', padding: '20px', borderRadius: '12px', border: '1px solid #21262d', marginTop: '8px' },
    resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '12px', width: '100%' },
    resultHeaderControls: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    brightnessControl: { display: 'flex', alignItems: 'center', gap: '10px' },
    brightnessLabel: { fontSize: '0.9rem', color: '#8b949e', whiteSpace: 'nowrap' },
    resultTitle: { margin: 0, color: '#e6edf3' },
    resultContent: { lineHeight: 1.6, wordWrap: 'break-word', color: '#d1d1d1' },
    pdfButton: { backgroundColor: '#238636', color: 'white', border: '1px solid rgba(240, 246, 252, 0.1)', padding: '8px 16px', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' },
    newAnalysisButton: { backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', padding: '8px 16px', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' },
    inputGroup: { display: 'flex', flexDirection: 'column', alignItems: 'start', width: '100%', maxWidth: '600px', gap: '8px' },
    label: { color: '#e6edf3', fontSize: '0.9rem', fontWeight: 500 },
    input: { width: '100%', padding: '12px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: 'white', fontSize: '1rem', boxSizing: 'border-box' },
    caseCard: { backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', width: '100%', maxWidth: '400px', cursor: 'pointer', transition: 'border-color 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    historyCard: { backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '12px', marginBottom: '12px' }
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}