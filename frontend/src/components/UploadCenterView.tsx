import React, { useState } from 'react';
import { ProcessedDocument, NavigationTab } from '../types';

interface UploadCenterViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const UploadCenterView: React.FC<UploadCenterViewProps> = ({ onNavigate }) => {
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [processedDocs, setProcessedDocs] = useState<ProcessedDocument[]>([
    {
      id: 'd1',
      uuid: '4a2f-91c2',
      name: 'audit_report_q3.pdf',
      type: 'pdf',
      confidence: 98,
      extractedObjectsCount: 14,
      entities: ['Compliance', 'FinCEN', 'Risk'],
      uploadDate: '2 hours ago',
      status: 'Compliant',
    },
    {
      id: 'd2',
      uuid: '8b11-5e34',
      name: 'board_meeting_04.mp3',
      type: 'audio',
      confidence: 92,
      extractedObjectsCount: 8,
      entities: ['Acquisition', 'Strategy'],
      uploadDate: '5 hours ago',
      status: 'Compliant',
    },
    {
      id: 'd3',
      uuid: '2c55-7d1a',
      name: 'legal_brief_final.docx',
      type: 'doc',
      confidence: 85,
      extractedObjectsCount: 5,
      entities: ['GDPR', 'EU_West'],
      uploadDate: '1 day ago',
      status: 'Risk Flagged',
    },
  ]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docName: file.name,
          docType: file.type || 'pdf',
        }),
      });

      const data = await res.json();

      const newDoc: ProcessedDocument = {
        id: `d-${Date.now()}`,
        uuid: `${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}`,
        name: file.name,
        type: file.name.endsWith('.mp3') ? 'audio' : file.name.endsWith('.docx') ? 'doc' : 'pdf',
        confidence: 96,
        extractedObjectsCount: 12,
        entities: data.entities || ['ISO_27001', 'PII_Record', 'User_Auth'],
        uploadDate: 'Just now',
        status: 'Compliant',
      };

      setProcessedDocs((prev) => [newDoc, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">Upload Center</h2>
          <p className="text-body-md text-on-surface-variant text-sm mt-1">
            Ingest multi-modal enterprise data into the compliance knowledge graph.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('documents')}
            className="px-4 py-2 border border-outline rounded-xl flex items-center gap-2 font-label-md text-xs font-semibold hover:bg-surface-container-highest transition-all cursor-pointer text-on-surface"
          >
            <span className="material-symbols-outlined text-sm">history</span> History
          </button>
          <button
            onClick={() => onNavigate('chat')}
            className="px-5 py-2 bg-primary text-on-primary rounded-xl flex items-center gap-2 font-label-md text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span> Quick Analysis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Section: Drag & Drop Zone + Pipeline */}
        <div className="lg:col-span-2 space-y-8">
          {/* Dropzone Card */}
          <div
            className={`glass-card rounded-2xl p-1 lg:p-1.5 transition-all ${
              dragOver ? 'ring-2 ring-primary bg-primary/5' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFileUpload(e.dataTransfer.files);
            }}
          >
            <div className="border-2 border-dashed border-outline-variant/50 rounded-xl bg-surface-container-lowest/50 p-10 lg:p-14 flex flex-col items-center justify-center transition-all hover:border-primary/50 group cursor-pointer relative overflow-hidden text-center">
              <div className="w-20 h-20 bg-surface-container rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-outline-variant/30 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl text-primary fill">upload_file</span>
              </div>

              <h3 className="font-headline-md text-xl font-bold text-on-surface mb-2">Drop enterprise assets here</h3>
              <p className="text-body-md text-xs text-on-surface-variant max-w-md">
                Drag and drop PDFs, Audio, Images, or Word Docs. Our AI engine will automatically parse and link entities.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-lg text-xs font-semibold border border-outline-variant/30 text-on-surface">
                  <span className="material-symbols-outlined text-sm text-error">picture_as_pdf</span> PDF
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-lg text-xs font-semibold border border-outline-variant/30 text-on-surface">
                  <span className="material-symbols-outlined text-sm text-tertiary">image</span> Images
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-lg text-xs font-semibold border border-outline-variant/30 text-on-surface">
                  <span className="material-symbols-outlined text-sm text-primary">mic</span> Audio
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-lg text-xs font-semibold border border-outline-variant/30 text-on-surface">
                  <span className="material-symbols-outlined text-sm text-secondary">description</span> Docs
                </div>
              </div>

              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Animated Processing Pipeline Status */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex justify-between items-center mb-8">
              <h4 className="font-label-md text-xs font-bold text-on-surface uppercase tracking-widest">
                Active Pipeline Status
              </h4>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse"></span>
                <span className="text-xs font-bold text-tertiary">Real-time processing active</span>
              </div>
            </div>

            <div className="relative flex justify-between px-2 sm:px-6">
              {/* Progress Line */}
              <div className="absolute top-4 left-8 right-8 h-[2px] bg-outline-variant/30 z-0">
                <div className="h-full bg-primary shadow-[0_0_8px_#adc6ff] transition-all duration-1000" style={{ width: '66%' }}></div>
              </div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary mb-2 shadow-md">
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface">Uploading</span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary mb-2 shadow-md">
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface">OCR</span>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary mb-2 shadow-md">
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface text-center">Entity Extraction</span>
              </div>

              {/* Step 4 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary-container border-2 border-primary flex items-center justify-center text-on-primary-container mb-2 relative">
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                </div>
                <span className="text-[11px] font-bold text-primary text-center">Relationship Extraction</span>
              </div>

              {/* Step 5 */}
              <div className="relative z-10 flex flex-col items-center opacity-40">
                <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-on-surface-variant mb-2">
                  <span className="material-symbols-outlined text-sm">hub</span>
                </div>
                <span className="text-[11px] text-on-surface-variant text-center">Graph Building</span>
              </div>

              {/* Step 6 */}
              <div className="relative z-10 flex flex-col items-center opacity-40">
                <div className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-on-surface-variant mb-2">
                  <span className="material-symbols-outlined text-sm">database</span>
                </div>
                <span className="text-[11px] text-on-surface-variant text-center">Vector Indexing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Recent Processed Panel */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl flex flex-col h-full">
            <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center">
              <h4 className="font-headline-md text-base font-bold text-on-surface">Recent Processed</h4>
              <span className="text-xs font-mono text-outline">{processedDocs.length} items</span>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[500px]">
              {processedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/30 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">
                          {doc.type === 'audio' ? 'mic' : doc.type === 'doc' ? 'description' : 'picture_as_pdf'}
                        </span>
                      </div>
                      <div>
                        <p className="font-label-md text-xs font-bold text-on-surface truncate w-32 sm:w-40">{doc.name}</p>
                        <p className="text-[10px] text-on-surface-variant/70 font-mono">UUID: {doc.uuid}</p>
                      </div>
                    </div>
                    <div className="bg-tertiary-container/20 text-tertiary px-2 py-0.5 rounded text-[10px] font-bold">
                      {doc.confidence}% CONF
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-on-surface-variant">Extracted Entities</span>
                      <span className="text-primary font-bold">{doc.extractedObjectsCount} Objects</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {doc.entities.map((ent, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-surface-container-highest rounded-full text-[10px] text-on-surface-variant border border-outline-variant/40"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 mt-auto border-t border-outline-variant/30 bg-surface-container-low/50 rounded-b-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Storage Utilization</span>
                <span className="text-xs font-mono font-bold text-on-surface">64.2 GB / 500 GB</span>
              </div>
              <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-secondary-container" style={{ width: '13%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
