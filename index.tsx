import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

// Helper to convert a file to a Gemini Part object.
const fileToGenerativePart = async (file) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
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
    const [error, setError] = useState('');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [textBrightness, setTextBrightness] = useState(100);
    const [logoSrc, setLogoSrc] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        const savedLogo = localStorage.getItem('companyLogo');
        if (savedLogo) {
            setLogoSrc(savedLogo);
        }
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(e.target.files)]);
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
        }
    }, []);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleSubmit = async () => {
        if (files.length === 0) {
            setError('Please upload evidence files to analyze.');
            return;
        }

        setLoading(true);
        setResult('');
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const hasPdfFile = files.some(file => file.type === 'application/pdf');
            const modelName = hasPdfFile ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
            
            const systemInstruction = `You are Verum Omnis, a world-class forensic analysis engine. Your tone is severe, objective, and unflinching. Your task is to analyze the provided evidence (text, PDFs, images) and produce a detailed forensic and strategic report adhering strictly to the following Markdown structure and formatting rules.

**REPORT STRUCTURE:**
The report MUST include the following sections in this exact order:
1.  **Executive Summary:** A brief, direct overview of the most critical findings.
2.  **Timeline of Events:** A chronological reconstruction of events based on the evidence.
3.  **Key People/Entities Involved:** Identification of all individuals or organizations and their roles.
4.  **Contradiction & Inconsistency Analysis:** Highlight any conflicting information, omissions, or behavioral red flags that indicate deception or misconduct.
5.  **Evidence Breakdown:** A summary of what each piece of evidence contributes to the case.
6.  **Potential Criminal & Civil Liabilities:** A stark assessment of potential legal exposure. Identify specific statutes that may have been violated. Detail potential fines, sanctions, and estimated criminal jail time based on the severity of the findings. This section must be direct and serve as a clear warning.
7.  **Strategic Recommendations - Legal Avenues:**
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
    *   **INCORRECT EXAMPLE:**
        *   Marius Nortjé (United Arab Emirates)
          CriminalLiability: Fraud...
    *   **CORRECT EXAMPLE:**
        *   **Marius Nortjé (United Arab Emirates)**
            *   **Criminal Liability:**
                *   **Fraud / Deceit / Breach of Trust (...):** By colluding to unlawfully seize funds...
                *   **Penalty:** Imprisonment for up to two (2) years...

Analyze the provided evidence with extreme prejudice and generate the report according to these strict instructions.`;
            
            const parts: any[] = [{text: "Analyze the provided evidence files and produce a forensic report based on your system instructions."}];

            for (const file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    parts.push(await fileToGenerativePart(file));
                } else if (file.type.startsWith('text/')) {
                    const text = await file.text();
                    parts.push({ text: `\n--- Evidence File: ${file.name} ---\n${text}`});
                }
            }
            
            const config: any = { systemInstruction };
            if (modelName === 'gemini-2.5-pro') {
                config.thinkingConfig = { thinkingBudget: 32768 };
            }

            const response = await ai.models.generateContent({
                model: modelName,
                contents: { parts },
                config,
            });

            setResult(response.text);
            setCurrentView('report');

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An error occurred while processing your request.');
        } finally {
            setLoading(false);
        }
    };
    
    const handleGeneratePdf = async () => {
        if (!result) return;
        
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        const contentElement = document.createElement('div');
        contentElement.innerHTML = (window as any).marked.parse(result);
        
        const pdfTextColor = `hsl(0, 0%, ${textBrightness * 0.82}%)`;
        contentElement.style.color = pdfTextColor;
        contentElement.style.maxWidth = '180mm';


        doc.setFontSize(18);
        doc.text('Verum Omnis - Forensic Report', 15, 22);
        
        await doc.html(contentElement, {
            callback: async function (doc) {
                const content = doc.output('arraybuffer');
                const hashBuffer = await crypto.subtle.digest('SHA-256', content);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                const pageCount = doc.internal.getNumberOfPages();
                doc.setPage(pageCount);
                doc.setFontSize(8);
                doc.setTextColor(100);
                const sealText = `Cryptographic Seal (SHA-256): ${hashHex}\nGenerated: ${new Date().toISOString()}`;
                doc.text(sealText, 15, doc.internal.pageSize.height - 10);
                
                doc.save(`Verum-Omnis-Report-${Date.now()}.pdf`);
            },
            x: 15,
            y: 35,
            width: 180,
            windowWidth: 800,
            autoPaging: 'text'
        });
    };
    
    const handleNewAnalysis = () => {
        setFiles([]);
        setResult('');
        setError('');
        setCurrentView('welcome');
    };

    const renderMarkdown = (text) => {
        if ((window as any).marked) {
            return { __html: (window as any).marked.parse(text, { breaks: true, gfm: true }) };
        }
        return { __html: text.replace(/\n/g, '<br />') };
    };

    return (
        <>
            <header style={styles.header}>
                {logoSrc ? <img src={logoSrc} style={styles.logoImage} alt="Company Logo" /> : <Logo />}
                <span style={styles.headerTitle}>Verum Omnis</span>
            </header>
            <main style={styles.mainContainer} aria-live="polite" aria-busy={loading}>
                {currentView === 'welcome' && (
                    <div style={styles.viewContainer}>
                        <h1 style={styles.welcomeTitle}>Welcome to Verum Omnis</h1>
                        <p style={styles.welcomeText}>
                            I am an autonomous legal-verification engine. My purpose is to serve as an advanced forensic AI analyst. Provide any document, and I will perform a deep forensic analysis based on legal, behavioral, and financial intelligence to identify patterns of criminal or dishonest behavior.
                        </p>
                        <button onClick={() => setCurrentView('analysis')} style={styles.button}>Initiate Analysis</button>
                        <div style={styles.welcomeFooter}>
                            <p><strong>Objective & Evidence-Based:</strong> All findings are derived directly from the provided evidence, ensuring an unbiased and factual report.</p>
                            <p><strong>Secure & Private:</strong> Your documents are processed entirely on-device. No data is ever uploaded or stored on external servers.</p>
                        </div>
                    </div>
                )}
                {currentView === 'analysis' && (
                    <div style={{...styles.viewContainer, gap: '24px'}}>
                        <div style={{textAlign: 'center'}}>
                            <h1 style={styles.analysisTitle}>Ready for Analysis</h1>
                            <p style={styles.analysisText}>Please provide the document or evidence file you wish to analyze. Your data is processed securely in your browser and is never uploaded to a server.</p>
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
                            <p style={{fontSize: '0.8rem', color: '#8b949e', margin: '4px 0 0 0'}}>Supports PDF, DOCX, TXT, PNG, JPG, and other common document formats.</p>
                            <input id="file-upload" type="file" onChange={handleFileChange} style={{ display: 'none' }} disabled={loading} multiple />
                        </div>

                        {files.length > 0 && (
                            <div style={styles.fileList}>
                                {files.map((file, index) => (
                                    <div key={index} style={styles.fileChip}>
                                        <span>{file.name}</span>
                                        <button onClick={() => removeFile(index)} style={styles.removeFileButton} disabled={loading}>&times;</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <button onClick={handleSubmit} disabled={loading || isOffline} style={{...styles.button, minWidth: '200px', cursor: loading ? 'wait' : (isOffline ? 'not-allowed' : 'pointer')}}>
                            {loading ? <span style={styles.spinner} role="status" aria-label="Analyzing..."></span> : (isOffline ? 'Offline' : 'Analyze Evidence')}
                        </button>
                        {error && <div style={styles.error} role="alert">{error}</div>}

                        <div style={styles.welcomeFooter}>
                            <p><strong>100% Stateless & On-Device:</strong> No server, no storage, no central authority. Your data is processed in your browser.</p>
                            <p><strong>A New Category of Legal Tech:</strong> Gain clarity, protection, and justice without needing an institution to interpret the facts.</p>
                        </div>

                    </div>
                )}
                 {currentView === 'report' && (
                    <section style={styles.resultSection} aria-labelledby="result-title">
                        <div style={styles.resultHeader}>
                            <h2 id="result-title" style={styles.resultTitle}>Forensic Report</h2>
                            <div style={styles.resultHeaderControls}>
                                <div style={styles.brightnessControl}>
                                    <label htmlFor="brightness-slider" style={styles.brightnessLabel}>Text Brightness</label>
                                    <input id="brightness-slider" type="range" min="40" max="100" value={textBrightness} onChange={(e) => setTextBrightness(parseInt(e.target.value, 10))} className="brightness-slider" aria-label="Adjust text brightness" />
                                </div>
                                <button onClick={handleGeneratePdf} style={styles.pdfButton}>Download Sealed PDF</button>
                                <button onClick={handleNewAnalysis} style={styles.newAnalysisButton}>Start New Analysis</button>
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
    header: { width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0 24px 0' },
    logoImage: { maxHeight: '36px', maxWidth: '180px' },
    headerTitle: { fontSize: '1.25rem', fontWeight: 500, color: '#e6edf3' },
    mainContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
    viewContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', animation: 'fadeIn 0.5s ease-in-out' },
    welcomeTitle: { fontSize: 'clamp(2rem, 5vw, 2.75rem)', margin: 0, color: '#e6edf3', fontWeight: 500 },
    welcomeText: { fontSize: '1.1rem', color: '#8b949e', maxWidth: '600px', lineHeight: 1.6, margin: '0 0 16px 0' },
    analysisTitle: { fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', margin: 0, color: '#e6edf3', fontWeight: 500 },
    analysisText: { fontSize: '1rem', color: '#8b949e', maxWidth: '600px', lineHeight: 1.6 },
    welcomeFooter: { fontSize: '0.8rem', color: '#8b949e', maxWidth: '600px', lineHeight: 1.5, borderTop: '1px solid #21262d', paddingTop: '24px', marginTop: '16px' },
    button: { backgroundColor: '#238636', color: 'white', border: '1px solid rgba(240, 246, 252, 0.1)', padding: '12px 24px', borderRadius: '6px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', transition: 'all 0.2s', fontWeight: 500, cursor: 'pointer' },
    dropzone: { width: '100%', boxSizing: 'border-box', border: '2px dashed #30363d', borderRadius: '12px', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', backgroundColor: '#0d1117', transition: 'border-color 0.2s, background-color 0.2s' },
    fileList: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', justifyContent: 'center' },
    fileChip: { backgroundColor: '#161b22', color: '#e6edf3', padding: '5px 12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', border: '1px solid #30363d' },
    removeFileButton: { background: '#30363d', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0, lineHeight: 1, fontSize: '14px' },
    spinner: { border: '3px solid rgba(255, 255, 255, 0.3)', borderTop: '3px solid #fff', borderRadius: '50%', width: '18px', height: '18px', animation: 'spin 1s linear infinite' },
    error: { backgroundColor: 'rgba(215, 58, 73, 0.1)', color: '#f85149', padding: '12px', borderRadius: '6px', border: '1px solid #f85149' },
    resultSection: { width: '100%', backgroundColor: '#0d1117', padding: '20px', borderRadius: '12px', border: '1px solid #21262d', marginTop: '8px' },
    resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '12px' },
    resultHeaderControls: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    brightnessControl: { display: 'flex', alignItems: 'center', gap: '10px' },
    brightnessLabel: { fontSize: '0.9rem', color: '#8b949e', whiteSpace: 'nowrap' },
    resultTitle: { margin: 0, color: '#e6edf3' },
    resultContent: { lineHeight: 1.6, wordWrap: 'break-word', color: '#d1d1d1' },
    pdfButton: { backgroundColor: '#238636', color: 'white', border: '1px solid rgba(240, 246, 252, 0.1)', padding: '8px 16px', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' },
    newAnalysisButton: { backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', padding: '8px 16px', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer', transition: 'background-color 0.2s' },
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
