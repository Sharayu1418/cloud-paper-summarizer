// ============================================
// API Client - Research Paper RAG System
// ============================================

import type {
  Paper,
  Session,
  ChatResponse,
  SearchResponse,
  ApiError,
  PaperInsightsResponse,
  TTSResponse,
} from './types';
import { getAccessToken, getIdToken, getStoredUser, isAuthenticated } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Default user ID for development (when not authenticated)
const DEFAULT_USER_ID = 'dev-user-001';

// ============================================
// Helper Functions
// ============================================

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  // Get auth token if available
  const idToken = getIdToken();
  const authHeaders: Record<string, string> = {};
  
  if (idToken) {
    authHeaders['Authorization'] = `Bearer ${idToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'API request failed');
  }

  return data as T;
}

function getUserId(): string {
  // Get user ID from Cognito session if authenticated
  if (isAuthenticated()) {
    const user = getStoredUser();
    if (user?.id) {
      return user.id;
    }
  }
  
  // Fallback to localStorage for development
  if (typeof window !== 'undefined') {
    return localStorage.getItem('userId') || DEFAULT_USER_ID;
  }
  return DEFAULT_USER_ID;
}

// ============================================
// Papers API
// ============================================

export async function listPapers(): Promise<Paper[]> {
  const userId = getUserId();
  const response = await fetchApi<{ papers: Paper[] }>(
    `/papers?user_id=${userId}`
  );
  return response.papers || [];
}

export async function getPaper(documentId: string): Promise<Paper> {
  const userId = getUserId();
  const response = await fetchApi<{ paper: Paper }>(
    `/papers/${documentId}?user_id=${userId}`
  );
  return response.paper;
}

export async function uploadPaper(
  file: File,
  title?: string,
  authors?: string,
  onProgress?: (progress: number) => void
): Promise<{ document_id: string; status: string }> {
  const userId = getUserId();
  
  // Step 1: Get presigned URL
  if (onProgress) onProgress(10);
  
  const presignedResponse = await fetchApi<{ upload_url: string; document_id: string; s3_key: string; message: string }>(
    '/papers?presigned=true',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        file_name: file.name,
        title: title || file.name.replace('.pdf', ''),
        authors: authors || 'Unknown',
      }),
    }
  );

  if (onProgress) onProgress(30);

  // Step 2: Upload file directly to S3
  const uploadResponse = await fetch(presignedResponse.upload_url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': 'application/pdf',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed: ${uploadResponse.statusText}`);
  }

  if (onProgress) onProgress(100);
  
  // Processing will start automatically after upload

  return {
    document_id: presignedResponse.document_id,
    status: 'pending'
  };
}

export async function deletePaper(documentId: string): Promise<void> {
  const userId = getUserId();
  await fetchApi(`/papers/${documentId}?user_id=${userId}`, {
    method: 'DELETE',
  });
}

export interface ImportPaperParams {
  url?: string;
  pdf_url?: string;
  title: string;
  authors: string;
  abstract?: string;
  source: 'semantic_scholar' | 'arxiv';
  external_id?: string;
  year?: string | number;
  citations?: number;
  confirm_metadata_only?: boolean;
}

export interface ImportPaperResponse {
  document_id?: string;
  status?: string;
  metadata_only?: boolean;
  pdf_available?: boolean;
  requires_confirmation?: boolean;
  message: string;
  title: string;
  authors?: string;
  abstract?: string;
  source?: string;
  external_id?: string;
  url?: string;
  pdf_url?: string;
  year?: string | number;
  citations?: number;
}

export async function importPaper(
  params: ImportPaperParams
): Promise<ImportPaperResponse> {
  const userId = getUserId();
  const response = await fetchApi<ImportPaperResponse>('/papers/import', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      ...params,
    }),
  });

  return response;
}

// ============================================
// Sessions API
// ============================================

export async function listSessions(): Promise<Session[]> {
  const userId = getUserId();
  const response = await fetchApi<{ sessions: Session[]; count: number }>(
    `/sessions?user_id=${userId}`
  );
  return response.sessions || [];
}

export async function getSession(sessionId: string): Promise<Session> {
  const userId = getUserId();
  const response = await fetchApi<{ session: Session }>(
    `/sessions/${sessionId}?user_id=${userId}`
  );
  return response.session;
}

export async function createSession(
  name: string,
  paperIds: string[] = []
): Promise<Session> {
  const userId = getUserId();
  const response = await fetchApi<{ session: Session; message: string }>(
    '/sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        name: name,
        paper_ids: paperIds,
      }),
    }
  );
  return response.session;
}

export async function updateSession(
  sessionId: string,
  updates: { name?: string; paper_ids?: string[] }
): Promise<Session> {
  const userId = getUserId();
  const response = await fetchApi<{ session: Session }>(
    `/sessions/${sessionId}?user_id=${userId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        user_id: userId,
        ...updates,
      }),
    }
  );
  return response.session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const userId = getUserId();
  await fetchApi(`/sessions/${sessionId}?user_id=${userId}`, {
    method: 'DELETE',
  });
}

export async function addPaperToSession(
  sessionId: string,
  documentId: string
): Promise<Session> {
  const userId = getUserId();
  const response = await fetchApi<{ session: Session; message: string }>(
    `/sessions/${sessionId}/papers`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        document_id: documentId,
      }),
    }
  );
  return response.session;
}

export async function removePaperFromSession(
  sessionId: string,
  documentId: string
): Promise<Session> {
  const userId = getUserId();
  const response = await fetchApi<{ session: Session }>(
    `/sessions/${sessionId}/papers/${documentId}?user_id=${userId}`,
    {
      method: 'DELETE',
    }
  );
  return response.session;
}

// ============================================
// Chat API
// ============================================

export async function sendChatMessage(
  sessionId: string,
  question: string,
  includeHistory: boolean = true
): Promise<ChatResponse> {
  const userId = getUserId();
  const response = await fetchApi<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      question,
      include_history: includeHistory,
    }),
  });
  return response;
}

// ============================================
// Search API
// ============================================

export async function searchPapers(
  query: string,
  sources: 'all' | 'library' | 'semantic_scholar' | 'arxiv' = 'all',
  limit: number = 10
): Promise<SearchResponse> {
  const userId = getUserId();
  const params = new URLSearchParams({
    q: query,
    sources,
    limit: limit.toString(),
    user_id: userId,
  });
  
  const response = await fetchApi<SearchResponse>(`/search?${params}`);
  return response;
}

// ============================================
// Utility Functions
// ============================================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// User Management (Simple localStorage-based)
// ============================================

export function setUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', userId);
  }
}

export function getCurrentUserId(): string {
  return getUserId();
}

// ============================================
// Paper Insights API
// ============================================

export async function getPaperInsights(documentId: string): Promise<PaperInsightsResponse> {
  const userId = getUserId();
  const response = await fetchApi<PaperInsightsResponse>(
    `/papers/${documentId}/insights?user_id=${userId}`
  );
  return response;
}

// ============================================
// Text-to-Speech API
// ============================================

export async function synthesizeText(
  text: string,
  voiceId: string = 'Joanna'
): Promise<TTSResponse> {
  const response = await fetchApi<TTSResponse>('/tts/text', {
    method: 'POST',
    body: JSON.stringify({
      text,
      voice_id: voiceId,
    }),
  });
  return response;
}

export async function synthesizePaperSummary(
  documentId: string,
  voiceId: string = 'Joanna'
): Promise<TTSResponse> {
  const userId = getUserId();
  const response = await fetchApi<TTSResponse>(`/tts/paper/${documentId}`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      voice_id: voiceId,
    }),
  });
  return response;
}

