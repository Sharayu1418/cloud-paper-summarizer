// ============================================
// API Types - Research Paper RAG System
// ============================================

export interface Paper {
  document_id: string;
  user_id: string;
  title: string;
  authors: string;
  abstract?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  upload_date: string;
  s3_key?: string;
  source: 'upload' | 'arxiv' | 'semantic_scholar';
  chunk_count?: number;
  metadata_only?: boolean;
  external_id?: string;
  url?: string;
  year?: string | number;
  citation_count?: number;
}

export interface Session {
  session_id: string;
  user_id: string;
  name: string;
  paper_ids: string[];
  papers?: PaperSummary[];
  created_at: string;
  last_active: string;
}

export interface PaperSummary {
  document_id: string;
  title: string;
  authors: string;
  status: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sources?: SourceCitation[];
}

export interface SourceCitation {
  document_id: string;
  title: string;
  authors: string;
  relevance_score: number;
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  session_id: string;
  chunks_used: number;
}

export interface SearchResult {
  document_id?: string;
  external_id?: string;
  title: string;
  authors: string;
  abstract: string;
  year?: string | number;
  citations?: number;
  url?: string;
  pdf_url?: string;
  source: 'library' | 'semantic_scholar' | 'arxiv';
  relevance_score: number;
  status?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  sources_searched: string[];
  total: number;
}

export interface ApiError {
  error: string;
  message?: string;
}

// ============================================
// UI State Types
// ============================================

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  documentId?: string;
  error?: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => void;
}

export type ViewMode = 'grid' | 'list';

export interface FilterState {
  status: string[];
  source: string[];
  searchQuery: string;
}

// ============================================
// Paper Insights Types
// ============================================

export interface FlowchartNode {
  id: string;
  type: string;
  label: string;
  description: string;
}

export interface FlowchartEdge {
  source: string;
  target: string;
  label?: string;
}

export interface MethodologyFlowchart {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface NLPKeyPhrase {
  text: string;
  score: number;
}

export interface NLPSentiment {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  scores: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
}

export interface NLPAnalysis {
  key_phrases: NLPKeyPhrase[];
  entities: Record<string, Array<{ text: string; score: number }>>;
  sentiment: NLPSentiment;
}

export interface PaperInsights {
  document_id: string;
  methodology_flowchart: MethodologyFlowchart;
  key_contributions: string[];
  research_questions: string[];
  summary: string;
  nlp_analysis: NLPAnalysis;
  generated_at: string;
}

export interface PaperInsightsResponse {
  insights: PaperInsights;
  document_id: string;
}

// ============================================
// TTS Types
// ============================================

export interface TTSResponse {
  audio_base64: string;
  content_type: string;
  duration_estimate?: number;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
}

export interface TTSVoicesResponse {
  voices: TTSVoice[];
}

