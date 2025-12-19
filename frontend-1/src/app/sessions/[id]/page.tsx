'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button, Modal, EmptyState } from '@/components/ui';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import PaperFlowchart from '@/components/papers/PaperFlowchart';
import {
  getSession,
  sendChatMessage,
  listPapers,
  addPaperToSession,
  removePaperFromSession,
} from '@/lib/api';
import { Session, Paper, ChatMessage as ChatMessageType, PaperSummary } from '@/lib/types';
import clsx from 'clsx';

// Paper Accordion Component
function PaperAccordion({ 
  paper, 
  isExpanded, 
  onToggle, 
  onRemove 
}: { 
  paper: PaperSummary; 
  isExpanded: boolean; 
  onToggle: () => void; 
  onRemove: () => void;
}) {
  // Clean up paper title - remove placeholder patterns
  const cleanTitle = (title: string) => {
    if (!title || title === '-m...' || title.startsWith('-m')) {
      return 'Untitled Paper';
    }
    return title;
  };

  return (
    <div className="border border-[var(--color-parchment)] rounded-lg overflow-hidden bg-white">
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--color-ivory)] transition-colors"
        onClick={onToggle}
      >
        <div className="w-8 h-8 rounded bg-[var(--color-forest)]/10 flex items-center justify-center text-[var(--color-forest)] flex-shrink-0">
          <FileText size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)] line-clamp-1">
            {cleanTitle(paper.title)}
          </p>
          <p className="text-xs text-[var(--color-stone)] truncate">
            {paper.authors}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-[var(--color-stone)] hover:text-[var(--color-error)] transition-colors"
            title="Remove from session"
          >
            <X size={14} />
          </button>
          {isExpanded ? (
            <ChevronUp size={16} className="text-[var(--color-stone)]" />
          ) : (
            <ChevronDown size={16} className="text-[var(--color-stone)]" />
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-[var(--color-parchment)] p-3 bg-[var(--color-ivory)]">
          <PaperFlowchart 
            documentId={paper.document_id} 
            paperTitle={cleanTitle(paper.title)} 
          />
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPaperPanel, setShowPaperPanel] = useState(true);
  const [showAddPaperModal, setShowAddPaperModal] = useState(false);
  const [availablePapers, setAvailablePapers] = useState<Paper[]>([]);
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSession(sessionId);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleSendMessage = async (content: string) => {
    if (!session) return;

    // Add user message immediately
    const userMessage: ChatMessageType = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      setIsSending(true);
      const response = await sendChatMessage(sessionId, content);

      // Add assistant response
      const assistantMessage: ChatMessageType = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Add error message
      const errorMessage: ChatMessageType = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${
          err instanceof Error ? err.message : 'Unknown error'
        }. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const fetchAvailablePapers = async () => {
    try {
      const papers = await listPapers();
      // Filter out papers already in session
      const sessionPaperIds = session?.paper_ids || [];
      setAvailablePapers(
        papers.filter(
          (p) =>
            p.status === 'completed' && !sessionPaperIds.includes(p.document_id)
        )
      );
    } catch (err) {
      console.error('Failed to fetch papers:', err);
    }
  };

  const handleAddPaper = async (documentId: string) => {
    try {
      const updatedSession = await addPaperToSession(sessionId, documentId);
      setSession(updatedSession);
      setShowAddPaperModal(false);
      // Refresh available papers
      fetchAvailablePapers();
    } catch (err) {
      alert('Failed to add paper');
    }
  };

  const handleRemovePaper = async (documentId: string) => {
    try {
      const updatedSession = await removePaperFromSession(sessionId, documentId);
      setSession(updatedSession);
      if (expandedPaperId === documentId) {
        setExpandedPaperId(null);
      }
    } catch (err) {
      alert('Failed to remove paper');
    }
  };

  const togglePaperAccordion = (documentId: string) => {
    setExpandedPaperId(expandedPaperId === documentId ? null : documentId);
  };

  const paperCount = session?.paper_ids?.length || 0;
  const hasPapers = paperCount > 0;

  // Suggested questions
  const suggestedQuestions = [
    'What is the main contribution of these papers?',
    'What methodology do these papers use?',
    'What are the key findings?',
    'How do these papers relate to each other?',
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--color-parchment)] border-t-[var(--color-forest)] animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-stone)]">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <EmptyState
          icon={<AlertCircle size={32} />}
          title="Session not found"
          description={error || 'This session may have been deleted.'}
          action={{
            label: 'Back to Sessions',
            onClick: () => router.push('/sessions'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title={session.name}
        backHref="/sessions"
        backLabel="All Sessions"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-stone)]">
              {paperCount} paper{paperCount !== 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPaperPanel(!showPaperPanel)}
            >
              {showPaperPanel ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!hasPapers ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={<FileText size={32} />}
                  title="No papers in this session"
                  description="Add papers to start asking questions about them."
                  action={{
                    label: 'Add Papers',
                    onClick: () => {
                      fetchAvailablePapers();
                      setShowAddPaperModal(true);
                    },
                    icon: <Plus size={18} />,
                  }}
                />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-[var(--color-forest)]/10 flex items-center justify-center text-[var(--color-forest)] mb-6">
                  <Sparkles size={28} />
                </div>
                <h2 className="text-xl font-serif font-bold text-[var(--color-ink)] mb-2">
                  Ready to explore your papers
                </h2>
                <p className="text-[var(--color-stone)] mb-8">
                  Ask any question about your {paperCount} paper
                  {paperCount !== 1 ? 's' : ''}. I'll find relevant passages
                  and cite my sources.
                </p>

                {/* Suggested questions */}
                <div className="w-full space-y-2">
                  <p className="text-sm font-medium text-[var(--color-slate)]">
                    Try asking:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {suggestedQuestions.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(question)}
                        className="text-left px-4 py-3 rounded-lg border border-[var(--color-parchment)] bg-white hover:border-[var(--color-forest)] hover:bg-[var(--color-forest)]/5 transition-colors text-sm text-[var(--color-slate)]"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-[var(--color-parchment)] bg-[var(--color-ivory)]">
            <ChatInput
              onSend={handleSendMessage}
              isLoading={isSending}
              disabled={!hasPapers}
              placeholder={
                hasPapers
                  ? 'Ask a question about your papers...'
                  : 'Add papers to start chatting'
              }
            />
          </div>
        </div>

        {/* Paper panel with accordions */}
        {showPaperPanel && (
          <div className="w-[420px] border-l border-[var(--color-parchment)] bg-white flex flex-col">
            <div className="p-4 border-b border-[var(--color-parchment)] flex items-center justify-between">
              <h3 className="font-medium text-[var(--color-ink)]">
                Papers ({paperCount})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  fetchAvailablePapers();
                  setShowAddPaperModal(true);
                }}
              >
                <Plus size={16} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {session.papers?.map((paper) => (
                <PaperAccordion
                  key={paper.document_id}
                  paper={paper}
                  isExpanded={expandedPaperId === paper.document_id}
                  onToggle={() => togglePaperAccordion(paper.document_id)}
                  onRemove={() => handleRemovePaper(paper.document_id)}
                />
              ))}

              {!hasPapers && (
                <p className="text-sm text-[var(--color-stone)] text-center py-4 italic">
                  No papers yet
                </p>
              )}
            </div>

            {/* Hint */}
            <div className="p-4 border-t border-[var(--color-parchment)] bg-[var(--color-cream)]">
              <p className="text-xs text-[var(--color-stone)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-amber)] mr-1.5" />
                Click a paper to view its methodology flowchart.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Paper Modal */}
      <Modal
        isOpen={showAddPaperModal}
        onClose={() => setShowAddPaperModal(false)}
        title="Add Papers to Session"
        description="Select papers to include in this study session"
        size="lg"
      >
        {availablePapers.length === 0 ? (
          <div className="text-center py-8">
            <FileText
              size={32}
              className="mx-auto text-[var(--color-stone)] mb-3"
            />
            <p className="text-[var(--color-stone)]">
              No more papers available. Upload more papers to your library.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3">
            {availablePapers.map((paper) => (
              <div
                key={paper.document_id}
                onClick={() => handleAddPaper(paper.document_id)}
                className="p-4 rounded-lg border border-[var(--color-parchment)] hover:border-[var(--color-forest)] hover:bg-[var(--color-forest)]/5 cursor-pointer transition-colors"
              >
                <p className="font-medium text-[var(--color-ink)]">
                  {paper.title}
                </p>
                <p className="text-sm text-[var(--color-stone)] mt-1">
                  {paper.authors}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-[var(--color-parchment)] flex justify-end">
          <Button
            variant="secondary"
            onClick={() => setShowAddPaperModal(false)}
          >
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
