import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSession, NavigationTab } from '../types';

interface AIChatViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const AIChatView: React.FC<AIChatViewProps> = ({ onNavigate }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 's1',
      title: 'HIPAA Security Audit',
      preview: 'Analysis of Section 164.308...',
      timestamp: 'Just now',
      active: true,
    },
    {
      id: 's2',
      title: 'GDPR Data Mapping',
      preview: 'Mapping user records in EU-West-1',
      timestamp: 'Yesterday',
    },
    {
      id: 's3',
      title: 'SOC2 Type II Prep',
      preview: 'Drafting control evidence list',
      timestamp: '3 days ago',
    },
    {
      id: 's4',
      title: 'ISO 27001 Gap Analysis',
      preview: 'Clause 4.2 compliance gap review',
      timestamp: 'Last 7 Days',
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState('s1');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'user',
      text: 'Analyze the latest document upload for HIPAA compliance risks regarding patient identifiers.',
      timestamp: '10:42 AM',
    },
    {
      id: 'm2',
      sender: 'ai',
      text: `I've analyzed the Q3_Patient_Records.pdf file across your knowledge graph. I found 3 critical risks related to Section 164.314(a) regarding Business Associate Agreements (BAAs):\n\n• Risk H1: Unencrypted Social Security Numbers found in metadata fields.\n• Risk H2: Third-party vendor 'CloudFlow' accessing data without a logged BAA.\n• Risk H3: Excessive administrative access for non-clinical staff.`,
      timestamp: '10:42 AM',
      confidence: 98,
      sources: ['Q3_Patient_Records.pdf', 'HIPAA_SubPart_C.pdf'],
      nodes: ['Patient_PHI', 'AWS_S3_Bucket', 'Admin_Access'],
      citations: ['HIPAA §164.308', 'Internal_Audit_v2'],
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.map((m) => ({ role: m.sender, content: m.text })),
        }),
      });

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.text || 'Analysis completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: data.confidence || 98,
        sources: data.sourceContext || ['Compliance_Master.pdf'],
        nodes: data.nodes || ['Patient_PHI_Cluster', 'Admin_Policy'],
        citations: data.citations || ['HIPAA §164.308', 'GDPR Art. 12'],
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'I encountered an issue querying the compliance engine server. Please ensure your connection and API keys are active.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confidence: 85,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const promptSuggestions = [
    { icon: 'security', label: 'Check HIPAA compliance in latest upload' },
    { icon: 'history_edu', label: 'Summarize legal gaps for GDPR' },
    { icon: 'account_tree', label: 'Visualize entity relationships' },
  ];

  return (
    <div className="h-[calc(100vh-64px)] -m-8 flex relative overflow-hidden select-none animate-in fade-in duration-300">
      {/* Left History Sidebar */}
      <section className="w-72 bg-surface-container-low/50 border-r border-outline-variant/20 flex flex-col overflow-hidden hidden md:flex">
        <div className="p-4 flex items-center justify-between border-b border-outline-variant/10">
          <span className="font-label-md font-bold uppercase tracking-widest text-xs text-on-surface-variant">
            Recent History
          </span>
          <button
            onClick={() => {
              const newS: ChatSession = {
                id: `s-${Date.now()}`,
                title: 'New Compliance Session',
                preview: 'Ready for analysis query...',
                timestamp: 'Just now',
                active: true,
              };
              setSessions((prev) => [newS, ...prev.map((s) => ({ ...s, active: false }))]);
              setActiveSessionId(newS.id);
              setMessages([]);
            }}
            className="p-1 hover:bg-surface-container-highest rounded transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
            title="Start New Audit Session"
          >
            <span className="material-symbols-outlined text-sm">edit_note</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              onClick={() => {
                setActiveSessionId(sess.id);
                setSessions((prev) => prev.map((s) => ({ ...s, active: s.id === sess.id })));
              }}
              className={`p-3 rounded-xl cursor-pointer transition-colors ${
                sess.active ? 'bg-surface-container-highest border border-outline-variant/30' : 'hover:bg-surface-container-high'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-sm ${sess.active ? 'text-primary' : 'text-on-surface-variant'}`}>
                  chat_bubble
                </span>
                <span className={`font-label-md text-xs font-bold truncate ${sess.active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {sess.title}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant truncate">{sess.preview}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Chat Workspace */}
      <section className="flex-1 flex flex-col relative h-full bg-surface/30">
        {/* Messages Scroll Display */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-4">
              {msg.sender === 'user' ? (
                <div className="flex justify-end items-start gap-3">
                  <div className="max-w-[80%] bg-primary-container/20 border border-primary/30 p-4 rounded-2xl rounded-tr-none shadow-md">
                    <p className="font-body-md text-sm text-on-surface">{msg.text}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-secondary-container text-sm">person</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary">
                    <span className="material-symbols-outlined text-sm fill">auto_awesome</span>
                  </div>
                  <div className="flex-1 max-w-[88%] space-y-4">
                    <div className="glass-card p-6 rounded-2xl rounded-tl-none border border-outline-variant/30 shadow-xl">
                      <div className="text-sm text-on-surface leading-relaxed whitespace-pre-line mb-4 font-body-md">
                        {msg.text}
                      </div>

                      {/* Interactive Answer Cards */}
                      {msg.confidence && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-outline-variant/20">
                          {/* Confidence Card */}
                          <div className="bg-surface-container-high/50 p-3 rounded-xl border border-outline-variant/20">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="material-symbols-outlined text-tertiary text-base">verified</span>
                              <span className="font-label-sm text-[11px] text-on-surface-variant">Confidence Score</span>
                            </div>
                            <div className="flex items-end gap-2">
                              <span className="text-2xl font-bold text-tertiary">{msg.confidence}%</span>
                              <span className="text-[10px] text-on-surface-variant mb-1">High Accuracy</span>
                            </div>
                            <div className="mt-2 w-full h-1 bg-outline-variant/30 rounded-full overflow-hidden">
                              <div className="h-full bg-tertiary" style={{ width: `${msg.confidence}%` }}></div>
                            </div>
                          </div>

                          {/* Source Context Card */}
                          <div className="bg-surface-container-high/50 p-3 rounded-xl border border-outline-variant/20">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="material-symbols-outlined text-primary text-base">description</span>
                              <span className="font-label-sm text-[11px] text-on-surface-variant">Source Context</span>
                            </div>
                            <div className="flex -space-x-1.5 items-center">
                              <div className="w-7 h-7 rounded border border-outline-variant bg-surface flex items-center justify-center">
                                <span className="material-symbols-outlined text-xs text-primary">picture_as_pdf</span>
                              </div>
                              <div className="w-7 h-7 rounded border border-outline-variant bg-surface flex items-center justify-center">
                                <span className="material-symbols-outlined text-xs text-secondary">description</span>
                              </div>
                              <div className="w-7 h-7 rounded-full border border-outline-variant bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-on-surface">
                                +{msg.sources?.length || 2}
                              </div>
                            </div>
                            <p className="mt-2 text-[10px] text-on-surface-variant font-mono truncate">
                              Ref: {msg.sources?.[0] || 'HIPAA_SubPart_C.pdf'}
                            </p>
                          </div>

                          {/* Knowledge Nodes Card */}
                          <div className="bg-surface-container-high/50 p-3 rounded-xl border border-outline-variant/20">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="material-symbols-outlined text-secondary text-base">hub</span>
                              <span className="font-label-sm text-[11px] text-on-surface-variant">Knowledge Nodes</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {msg.nodes?.map((node, i) => (
                                <span
                                  key={i}
                                  className="bg-secondary/10 text-secondary text-[9px] px-1.5 py-0.5 rounded border border-secondary/20 font-bold"
                                >
                                  {node}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Citations */}
                      {msg.citations && (
                        <div className="mt-4 pt-3 border-t border-outline-variant/10">
                          <span className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2 block">
                            Interactive Citations
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.citations.map((cite, i) => (
                              <button
                                key={i}
                                className="group flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container-highest border border-outline-variant/20 px-3 py-1 rounded-full transition-all text-xs text-on-surface-variant hover:text-primary cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs text-primary">bookmark</span>
                                <span>{cite}</span>
                                <span className="material-symbols-outlined text-xs text-outline group-hover:text-primary">
                                  open_in_new
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start items-start gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-sm fill">auto_awesome</span>
              </div>
              <div className="p-4 border-l-2 border-primary/40 bg-primary/5 rounded-r-xl max-w-lg">
                <p className="font-body-md text-xs text-on-surface flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  Querying Gemini Compliance Engine & graph relationship index...
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock */}
        <div className="p-6 pt-0 space-y-3">
          {/* Suggested Prompts */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {promptSuggestions.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt.label)}
                className="flex-shrink-0 bg-surface-container-low hover:bg-surface-container-highest border border-outline-variant/20 px-3.5 py-1.5 rounded-xl text-xs text-on-surface-variant hover:text-primary transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">{prompt.icon}</span>
                <span>{prompt.label}</span>
              </button>
            ))}
          </div>

          {/* Textarea Box */}
          <div className="relative glass-card p-2 rounded-2xl border-outline-variant/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-2xl">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask anything about your compliance posture..."
              className="w-full bg-transparent border-none focus:outline-none text-on-surface font-body-md text-sm placeholder:text-outline p-3 resize-none"
            />
            <div className="flex items-center justify-between px-3 pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('upload')}
                  className="p-1.5 text-outline hover:text-primary transition-colors cursor-pointer"
                  title="Upload Asset"
                >
                  <span className="material-symbols-outlined text-lg">attach_file</span>
                </button>
                <button
                  className="p-1.5 text-outline hover:text-primary transition-colors cursor-pointer"
                  title="Voice Input"
                >
                  <span className="material-symbols-outlined text-lg">mic</span>
                </button>
                <div className="h-4 w-px bg-outline-variant/30 mx-1"></div>
                <span className="text-[10px] text-outline font-mono">Press ⌘ + Enter to send</span>
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isSending}
                className="bg-primary text-on-primary p-2 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg font-bold">arrow_upward</span>
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-outline">
            GraphAI can make mistakes. Verify critical information against original policy documents.
          </p>
        </div>
      </section>

      {/* Right Context Inspector Sidebar */}
      <aside className="w-80 bg-surface-container/30 border-l border-outline-variant/20 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-outline-variant/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">analytics</span>
          <span className="font-label-md text-xs font-bold text-on-surface">Live Graph Inspector</span>
        </div>

        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-widest mb-3 block">
              Detected Entities
            </span>
            <div className="space-y-2.5">
              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-primary">Patient_PHI_Cluster</span>
                  <span className="material-symbols-outlined text-xs text-on-surface-variant">info</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-outline-variant rounded-full overflow-hidden">
                    <div className="h-full bg-error w-3/4"></div>
                  </div>
                  <span className="text-[10px] text-error font-bold">Critical</span>
                </div>
              </div>

              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-secondary">Internal_S3_Bucket</span>
                  <span className="material-symbols-outlined text-xs text-on-surface-variant">info</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-outline-variant rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary w-1/2"></div>
                  </div>
                  <span className="text-[10px] text-tertiary font-bold">Safe</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-outline uppercase tracking-widest mb-3 block">
              Graph Visualization
            </span>
            <div className="aspect-video glass-card rounded-xl overflow-hidden relative group cursor-pointer border border-outline-variant/20 canvas-grid flex items-center justify-center">
              <div className="text-center p-3">
                <span className="material-symbols-outlined text-primary text-3xl mb-1">hub</span>
                <p className="text-[11px] text-on-surface font-bold">Interactive Graph Active</p>
                <p className="text-[9px] text-on-surface-variant">5 Connected Nodes</p>
              </div>
              <div className="absolute inset-0 bg-surface/60 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onNavigate('explorer')}
                  className="bg-primary/90 text-on-primary px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">fullscreen</span>
                  Expand Graph
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-tertiary/10 border border-tertiary/20 rounded-2xl">
            <h4 className="text-xs font-bold text-tertiary flex items-center gap-1.5 mb-1.5">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Compliance Status: OK
            </h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Your overall compliance score has improved by 4% after the last automated remediation.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
};
