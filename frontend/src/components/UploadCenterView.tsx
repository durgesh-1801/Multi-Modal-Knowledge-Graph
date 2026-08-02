import React, { useState } from 'react';
import { ProcessedDocument, NavigationTab } from '../types';
import { useUploadPDF } from '../hooks/useUpload';

interface UploadCenterViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const UploadCenterView: React.FC<UploadCenterViewProps> = ({ onNavigate }) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<'idle' | 'uploading' | 'ocr' | 'entities' | 'relationships' | 'graph' | 'vector' | 'completed'>('idle');

  const { mutateAsync: uploadPDF, isPending: analyzing } = useUploadPDF({
    onProgress: (evt) => {
      setUploadProgress(evt.percent);
      if (evt.percent < 30) setPipelineStage('uploading');
      else if (evt.percent < 60) setPipelineStage('ocr');
      else if (evt.percent < 90) setPipelineStage('entities');
      else setPipelineStage('relationships');
    },
  });

  const [processedDocs, setProcessedDocs] = useState<ProcessedDocument[]>([]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadProgress(0);
    setPipelineStage('uploading');

    const fileArray = Array.from(files);

    try {
      const result = await uploadPDF(fileArray);
      const results = Array.isArray(result) ? result : [result];

      const newDocs: ProcessedDocument[] = results.map((r) => ({
        id: `d-${Date.now()}-${Math.random()}`,
        uuid: r.saved_filename?.substring(0, 9) || `${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}`,
        name: r.file_name,
        type: r.file_name.endsWith('.mp3') || r.file_name.endsWith('.wav') ? 'audio' :
              r.file_name.endsWith('.docx') || r.file_name.endsWith('.doc') ? 'doc' : 'pdf',
        confidence: 96,
        extractedObjectsCount: Array.isArray(r.pages) ? r.pages.length : 1,
        entities: r.metadata?.title ? [r.metadata.title] : ['Document'],
        uploadDate: 'Just now',
        status: 'Compliant',
      }));

      setProcessedDocs((prev) => [...newDocs, ...prev]);
      setUploadProgress(100);

      // Execute remaining pipeline stage progression
      setPipelineStage('graph');
      await new Promise((res) => setTimeout(res, 250));
      setPipelineStage('vector');
      await new Promise((res) => setTimeout(res, 250));
      setPipelineStage('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      setUploadProgress(0);
      setPipelineStage('idle');
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
                multiple
                accept=".pdf,.docx,.doc,.mp3,.wav,.png,.jpg,.jpeg"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Upload Progress Bar */}
          {analyzing && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-on-surface">Uploading & Processing…</span>
                <span className="text-xs font-mono text-primary font-bold">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1.5">Backend is running OCR → Entity Extraction → Graph Building…</p>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && !analyzing && (
            <div className="glass-card rounded-2xl p-4 border border-error/30 bg-error/5">
              <div className="flex items-center gap-2 text-error text-xs font-bold">
                <span className="material-symbols-outlined text-base">error_outline</span>
                Upload Failed: {uploadError}
              </div>
            </div>
          )}

          {/* Animated Processing Pipeline Status */}
          {(() => {
            const stagesOrder = ['idle', 'uploading', 'ocr', 'entities', 'relationships', 'graph', 'vector', 'completed'];
            const currentIndex = stagesOrder.indexOf(pipelineStage);
            const progressPercent = pipelineStage === 'completed' ? 100 : currentIndex === 0 ? 0 : Math.min(Math.round(((currentIndex) / 6) * 100), 100);

            const steps = [
              { key: 'uploading', label: 'Uploading', icon: 'cloud_upload', index: 1 },
              { key: 'ocr', label: 'OCR', icon: 'document_scanner', index: 2 },
              { key: 'entities', label: 'Entity Extraction', icon: 'category', index: 3 },
              { key: 'relationships', label: 'Relationship Extraction', icon: 'hub', index: 4 },
              { key: 'graph', label: 'Graph Building', icon: 'account_tree', index: 5 },
              { key: 'vector', label: 'Vector Indexing', icon: 'database', index: 6 },
            ];

            return (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="font-label-md text-xs font-bold text-on-surface uppercase tracking-widest">
                    Active Pipeline Status
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${pipelineStage === 'completed' ? 'bg-tertiary' : pipelineStage === 'idle' ? 'bg-outline' : 'bg-primary animate-pulse'}`}></span>
                    <span className="text-xs font-bold text-on-surface">
                      {pipelineStage === 'completed' ? 'Pipeline Processing Completed' : pipelineStage === 'idle' ? 'Ready for Document Ingestion' : `Active Step: ${pipelineStage.toUpperCase()}`}
                    </span>
                  </div>
                </div>

                <div className="relative flex justify-between px-2 sm:px-6">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-8 right-8 h-[2px] bg-outline-variant/30 z-0">
                    <div
                      className="h-full bg-primary shadow-[0_0_8px_#adc6ff] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>

                  {steps.map((st) => {
                    const isDone = pipelineStage === 'completed' || currentIndex > st.index;
                    const isActive = currentIndex === st.index;

                    return (
                      <div
                        key={st.key}
                        className={`relative z-10 flex flex-col items-center transition-all ${
                          isDone || isActive ? 'opacity-100' : 'opacity-40'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 shadow-md transition-all ${
                            isDone
                              ? 'bg-primary text-on-primary'
                              : isActive
                              ? 'bg-primary-container border-2 border-primary text-on-primary-container animate-pulse'
                              : 'bg-surface-container border border-outline-variant text-on-surface-variant'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-sm ${isActive ? 'animate-spin' : ''}`}>
                            {isDone ? 'check' : isActive ? 'sync' : st.icon}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] text-center font-bold ${
                            isActive ? 'text-primary' : isDone ? 'text-on-surface' : 'text-on-surface-variant'
                          }`}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
