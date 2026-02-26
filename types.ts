export type AgentName = 'Artem' | 'Sasha';

export interface FeedItem {
  id: string;
  agent: AgentName;
  action: 'Scraped' | 'Hook Sent' | 'Reply' | 'Zoom Booked' | 'Parsing Started' | 'Parsing Completed';
  target: string;
  time: string;
  status: 'neutral' | 'positive' | 'negative' | 'success';
}

export interface Client {
  id: string;
  name: string;
  initials: string;
  activeCampaigns: number;
  leadsToday: number;
  status: 'active' | 'paused';
  goal: number;
  achieved: number;
}

export interface Source {
  id: string;
  platform: 'WB_API' | 'TG_CHAT' | 'VK' | 'INSTAGRAM';
  name: string;
  total: number;
  processed: number;
  active: boolean;
}

export interface Hook {
  id: string;
  title?: string;
  /** @deprecated use title */
  name?: string;
  content?: string;
  /** @deprecated use content */
  text?: string;
  category?: string;
  conversion_rate?: number;
  /** @deprecated use conversion_rate */
  conversion?: number;
  created_at?: string;
  variant?: 'A' | 'B';
  active?: boolean;
  status?: string;
}


export interface ActiveChat {
  id: string;
  clientName: string;
  progress: number;
  status: 'hot' | 'warm' | 'cold';
  painPoints?: string[];
}

export interface ZoomCall {
  id: string;
  clientName: string;
  time: string;
  date: string;
  status: 'confirmed' | 'pending';
}

// --- Parser Integration Types ---

export type SellerStatus = 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'HOOK_SENT' | 'REPLIED' | 'ZOOM_BOOKED' | 'CONVERTED' | 'REJECTED';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Seller {
  id: string;
  brand_name: string;
  inn?: string;
  revenue_monthly?: number;
  top_product_name?: string;
  status: SellerStatus;
  project_id?: string;
  variant?: 'A' | 'B';
  created_at?: string;
  source?: 'WB_API' | 'TG_CHAT' | 'VK' | 'INSTAGRAM';
  pain_points?: string[];
}

export interface ParserJob {
  id: string;
  query: string;
  status: JobStatus;
  result_count: number;
  created_at: string;
}

// --- System Logs & Worker Commands ---

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';
export type CommandAction = 'parse' | 'outreach' | 'send_messages' | 'health_check' | 'kill_switch';
export type CommandStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SystemLog {
  id: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: Record<string, any>;
  project_id?: string;
  created_at: string;
}

export interface WorkerCommand {
  id: string;
  action: CommandAction;
  params: Record<string, any>;
  status: CommandStatus;
  result?: Record<string, any>;
  error?: string;
  created_at: string;
  updated_at: string;
}
