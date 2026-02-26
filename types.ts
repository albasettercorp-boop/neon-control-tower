export type SellerStatus =
    | 'NEW'
    | 'QUALIFIED'
    | 'CONTACTED'
    | 'HOOK_SENT'
    | 'REPLIED'
    | 'ZOOM_BOOKED'
    | 'CONVERTED'
    | 'REJECTED'
    | 'ARCHIVED';

export interface FeedItem {
    id: string;
    agent: string;
    action: string;
    target: string;
    time: string;
    status: 'success' | 'positive' | 'negative' | 'neutral';
}

export interface Client {
    id: string;
    name: string;
    initials: string;
    status: 'active' | 'paused';
    activeCampaigns: number;
    leadsToday: number;
    projectId?: string;
}

export interface Source {
    id: string;
    name: string;
    platform: string;
    processed: number;
    total: number;
    active: boolean;
}

export interface Hook {
    id: string;
    name?: string;
    title?: string;
    text?: string;
    content?: string;
    variant: 'A' | 'B';
    conversion?: number;
    conversion_rate?: number;
    active?: boolean;
    category?: string;
}

export interface ActiveChat {
    id: string;
    clientName: string;
    lastMessage: string;
    progress: number;
    unread?: number;
    sellerId?: string;
    painPoints?: string[];
}

export interface ZoomCall {
    id: string;
    clientName: string;
    date: string;
    time: string;
    status: 'confirmed' | 'pending';
}

export interface Seller {
    id: string;
    brand_name: string;
    inn?: string;
    source: string;
    revenue_monthly?: number;
    status: string;
    created_at: string;
    variant?: string;
    project_id?: string;
    telegram_username?: string;
}

export interface ParserJob {
    id: string;
    query: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_count?: number;
    created_at: string;
}

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';

export interface SystemLog {
    id: string;
    level: LogLevel;
    source: string;
    message: string;
    details?: any;
    project_id?: string | null;
    created_at: string;
}

export type CommandAction = 'parse' | 'outreach' | 'send_messages' | 'health_check' | 'kill_switch';
export type CommandStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface WorkerCommand {
    id: string;
    action: CommandAction;
    params?: Record<string, any>;
    status: CommandStatus;
    result?: any;
    error?: string;
    created_at: string;
}
