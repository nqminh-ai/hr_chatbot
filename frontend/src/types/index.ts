export interface Persona {
  userId: string;
  name: string;
  company: string;
  department: string;
  team?: string | null;
  role: string;
  contractType: string;
  description: string;
  scopePath?: string[];
}

export interface Citation {
  doc_id: string;
  version: string;
  clause: string;
  title: string;
  text_source?: string;
  valid_from?: string;
  scope_level?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'persona' | 'policy' | 'clause' | 'org' | 'action';
  details?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  status?: 'ok' | 'insufficient_evidence' | 'out_of_scope' | 'conflict' | 'error' | 'refused' | 'needs_clarification';
  queryDate?: string;
  citations?: Citation[];
  graph?: KnowledgeGraphData;
  trace?: Record<string, unknown>;
  createdAt: string;
  provider?: 'gemini' | 'rules';
}

export interface Conversation {
  id: string;
  title: string;
  personaId: string;
  date: string;
  messages: ChatMessage[];
  updatedAt: string;
}
