export type AgentType = 
  | 'code' 
  | 'papers' 
  | 'notes_add' 
  | 'notes_read' 
  | 'notes_clear' 
  | 'meeting' 
  | 'news'
  | 'translate'
  | 'unknown';

export interface PlannerInfo {
  topic?: string;
  content?: string;
  meetingAction?: 'start' | 'add' | 'stop';
  language?: string;
}

export interface PlannerOutput {
  agent: AgentType;
  info: PlannerInfo;
  reasoning?: string; // Optional debug info
}

export interface Paper {
  title: string;
  authors: string[];
  link: string;
  summary: string;
  published: string;
}

export interface NoteStore {
  [topic: string]: string[];
}

export interface MeetingSession {
  active: boolean;
  topic: string;
  log: string[];
  listening?: boolean; // New: is the app actively listening to the meeting?
}

export interface NewsResult {
  headline: string;
  script: string;
  audioData?: string; // base64 raw PCM
  sources?: { title: string; uri: string }[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  userQuery: string;
  plannerOutput: PlannerOutput;
  result: any; // Can be code string, list of papers, status message, meeting summary, NewsResult, or translation
  status: 'planning' | 'executing' | 'success' | 'error';
  errorMessage?: string;
}