import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSession, NavigationTab } from '../types';
import { useSendMessage } from '../hooks/useChat';

interface AIChatViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const AIChatView: React.FC<AIChatViewProps> = ({ onNavigate }) => {
  const { mutateAsync: sendMessage } = useSendMessage();
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
  const [activeSessionConversationId, setActiveSessionConversationId] = useState<string>('default');
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
      // Call real backend: POST /api/v1/chat
      const data = await sendMessage({
        query,
        conversation_id: activeSessionConversationId,
        top_k: 5,
      });

      // Keep conversation ID for thread continuity
      if (data.conversation_id) setActiveSessionConversationId(data.conversation_id);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        // Backend field: answer
        text: data.answer || 'Analysis completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        // Backend returns confidence as 0-1 float, convert to percentage
        confidence: data.confidence != null ? Math.round(data.confidence * 100) : undefined,
        // Backend citations are objects — extract the document name as the source string
        sources: data.citations?.map((c) => c.document).filter(Boolean) ?? [],
        // Backend field: related_entities (not graph_nodes)
        nodes: data.related_entities ?? [],
        // Format citation label as "Document (p.N)" for display
        citations: data.citations?.map((c) => `${c.document}${c.page > 1 ? ` (p.${c.page})` : ''}`) ?? [],
        // Backend returns processing_time in seconds — convert to ms
        processingTime: data.processing_time != null ? Math.round(data.processing_time * 1000) : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'I encountered an issue querying the compliance engine. Please ensure the backend is running and your Gemini API key is configured.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confidence: 0,
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
      <section className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden hidden md:flex">
        <div className="p-4 flex items-center justify-between border-b border-slate-200">
          <span className="font-label-md font-bold uppercase tracking-widest text-xs text-slate-500">
            Recent History
          </span>
          <button
            onClick={() => {
              const newId = `session-${Date.now()}`;
              const newS: ChatSession = {
                id: newId,
                title: 'New Compliance Session',
                preview: 'Ready for analysis query...',
                timestamp: 'Just now',
                active: true,
              };
              setSessions((prev) => [newS, ...prev.map((s) => ({ ...s, active: false }))]);
              setActiveSessionId(newId);
              setActiveSessionConversationId(newId);
              setMessages([]);
            }}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-blue-600 cursor-pointer"
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
                sess.active ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-sm ${sess.active ? 'text-blue-600' : 'text-slate-400'}`}>
                  chat_bubble
                </span>
                <span className={`font-label-md text-xs font-bold truncate ${sess.active ? 'text-blue-900' : 'text-slate-700'}`}>
                  {sess.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">{sess.preview}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Chat Workspace */}
      <section className="flex-1 flex flex-col relative h-full bg-slate-50">
        {/* Messages Scroll Display */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-4">
              {msg.sender === 'user' ? (
                <div className="flex justify-end items-start gap-3">
                  <div className="max-w-[80%] bg-blue-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm">
                    <p className="font-body-md text-sm">{msg.text}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-700 text-sm">person</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white shadow-sm">
                    <span className="material-symbols-outlined text-sm fill">auto_awesome</span>
                  </div>
                  <div className="flex-1 max-w-[88%] space-y-4">
                    <div className="bg-white p-6 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line mb-4 font-body-md">
                        {msg.text}
                      </div>

                      {/* Interactive Answer Cards */}
                      {msg.confidence && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200">
                          {/* Confidence Card */}
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0 flex flex-col justify-between overflow-hidden">
                            <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                              <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">verified</span>
                              <span className="font-bold text-xs text-slate-700 truncate">Confidence Score</span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 mt-1">
                              <span className="text-xl font-extrabold text-emerald-600 leading-none">{msg.confidence}%</span>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">High Accuracy</span>
                            </div>
                            <div className="mt-2.5 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${msg.confidence}%` }}></div>
                            </div>
                          </div>

                          {/* Source Context Card */}
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0 flex flex-col justify-between overflow-hidden">
                            <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                              <span className="material-symbols-outlined text-blue-600 text-base shrink-0">description</span>
                              <span className="font-bold text-xs text-slate-700 truncate">Source Context</span>
                            </div>
                            <div className="flex -space-x-1.5 items-center my-1">
                              <div className="w-6 h-6 rounded border border-slate-200 bg-white flex items-center justify-center shadow-2xs">
                                <span className="material-symbols-outlined text-[13px] text-blue-600">picture_as_pdf</span>
                              </div>
                              <div className="w-6 h-6 rounded border border-slate-200 bg-white flex items-center justify-center shadow-2xs">
                                <span className="material-symbols-outlined text-[13px] text-purple-600">description</span>
                              </div>
                              <div className="w-6 h-6 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-700">
                                +{msg.sources?.length || 2}
                              </div>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500 font-mono truncate w-full" title={msg.sources?.[0] || 'HIPAA_SubPart_C.pdf'}>
                              Ref: {msg.sources?.[0] || 'HIPAA_SubPart_C.pdf'}
                            </p>
                          </div>

                          {/* Knowledge Nodes Card */}
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0 flex flex-col justify-between overflow-hidden">
                            <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                              <span className="material-symbols-outlined text-purple-600 text-base shrink-0">hub</span>
                              <span className="font-bold text-xs text-slate-700 truncate">Knowledge Nodes</span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                              {(msg.nodes || []).map((node, i) => (
                                <span
                                  key={i}
                                  className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 rounded font-semibold font-mono truncate max-w-full"
                                  title={node}
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
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                            Interactive Citations
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {(msg.citations || []).map((cite, i) => (
                              <button
                                key={i}
                                className="group flex items-center gap-1.5 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-3 py-1 rounded-full transition-all text-xs text-slate-700 hover:text-blue-700 font-medium cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs text-blue-600">bookmark</span>
                                <span className="truncate max-w-[180px]">{cite}</span>
                                <span className="material-symbols-outlined text-xs text-slate-400 group-hover:text-blue-600">
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
              <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm fill">auto_awesome</span>
              </div>
              <div className="p-4 border-l-3 border-blue-600 bg-blue-50/70 rounded-r-xl max-w-lg">
                <p className="font-body-md text-xs text-blue-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                  Querying Groq Compliance Engine & graph relationship index...
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
                className="flex-shrink-0 bg-white hover:bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs text-slate-700 hover:text-blue-600 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
              >
                <span className="material-symbols-outlined text-sm text-blue-600">{prompt.icon}</span>
                <span>{prompt.label}</span>
              </button>
            ))}
          </div>

          {/* Textarea Box */}
          <div className="relative bg-white p-2 rounded-2xl border border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-sm">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask anything about your compliance posture..."
              className="w-full bg-transparent border-none focus:outline-none text-slate-900 font-body-md text-sm placeholder:text-slate-400 p-3 resize-none"
            />
            <div className="flex items-center justify-between px-3 pb-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('upload')}
                  className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                  title="Upload Asset"
                >
                  <span className="material-symbols-outlined text-lg">attach_file</span>
                </button>
                <button
                  className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                  title="Voice Input"
                >
                  <span className="material-symbols-outlined text-lg">mic</span>
                </button>
                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                <span className="text-[10px] text-slate-400 font-mono">Press ⌘ + Enter to send</span>
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isSending}
                className="bg-blue-600 text-white p-2 rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg font-bold">arrow_upward</span>
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400">
            GraphAI can make mistakes. Verify critical information against original policy documents.
          </p>
        </div>
      </section>

      {/* Right Context Inspector Sidebar */}
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-600">analytics</span>
          <span className="font-label-md text-xs font-bold text-slate-900">Live Graph Inspector</span>
        </div>

        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">
              Detected Entities
            </span>
            <div className="space-y-2.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-600">Patient_PHI_Cluster</span>
                  <span className="material-symbols-outlined text-xs text-slate-400">info</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-3/4"></div>
                  </div>
                  <span className="text-[10px] text-red-600 font-bold">Critical</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-purple-600">Internal_S3_Bucket</span>
                  <span className="material-symbols-outlined text-xs text-slate-400">info</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-1/2"></div>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">Safe</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">
              Graph Visualization
            </span>
            <div className="aspect-video bg-slate-50 rounded-xl overflow-hidden relative group cursor-pointer border border-slate-200 canvas-grid flex items-center justify-center shadow-2xs">
              <div className="text-center p-3">
                <span className="material-symbols-outlined text-blue-600 text-3xl mb-1">hub</span>
                <p className="text-[11px] text-slate-900 font-bold">Interactive Graph Active</p>
                <p className="text-[9px] text-slate-500">5 Connected Nodes</p>
              </div>
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onNavigate('explorer')}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">fullscreen</span>
                  Expand Graph
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mb-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
              Compliance Status: OK
            </h4>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Your overall compliance score has improved by 4% after the last automated remediation.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
};
