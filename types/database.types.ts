
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            projects: {
                Row: {
                    id: string
                    name: string
                    initials: string
                    status: 'active' | 'paused'
                    health_score: number
                    goal: number
                    achieved: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    initials: string
                    status?: 'active' | 'paused'
                    health_score?: number
                    goal?: number
                    achieved?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    initials?: string
                    status?: 'active' | 'paused'
                    health_score?: number
                    goal?: number
                    achieved?: number
                    created_at?: string
                }
            }
            sellers: {
                Row: {
                    id: string
                    inn: string | null
                    wb_brand_id: string | null
                    wb_product_id: string | null
                    brand_name: string
                    revenue_monthly: number | null
                    top_product_name: string | null
                    contact_name: string | null
                    phone: string | null
                    email: string | null
                    source: 'WB_API' | 'TG_CHAT' | 'VK' | 'INSTAGRAM' | null
                    pain_points: Json | null
                    status: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'REPLIED' | 'CONVERTED' | 'REJECTED' | null
                    project_id: string | null
                    variant: 'A' | 'B' | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    inn?: string | null
                    wb_brand_id?: string | null
                    wb_product_id?: string | null
                    brand_name: string
                    revenue_monthly?: number | null
                    top_product_name?: string | null
                    contact_name?: string | null
                    phone?: string | null
                    email?: string | null
                    source?: 'WB_API' | 'TG_CHAT' | 'VK' | 'INSTAGRAM' | null
                    pain_points?: Json | null
                    status?: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'REPLIED' | 'CONVERTED' | 'REJECTED' | null
                    project_id?: string | null
                    variant?: 'A' | 'B' | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    inn?: string | null
                    wb_brand_id?: string | null
                    wb_product_id?: string | null
                    brand_name?: string
                    revenue_monthly?: number | null
                    top_product_name?: string | null
                    contact_name?: string | null
                    phone?: string | null
                    email?: string | null
                    source?: 'WB_API' | 'TG_CHAT' | 'VK' | 'INSTAGRAM' | null
                    pain_points?: Json | null
                    status?: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'REPLIED' | 'CONVERTED' | 'REJECTED' | null
                    project_id?: string | null
                    variant?: 'A' | 'B' | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            account_health: {
                Row: {
                    id: string
                    service_name: string
                    status: 'healthy' | 'degraded' | 'down'
                    last_check: string
                    error_message: string | null
                    metadata: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    service_name: string
                    status?: 'healthy' | 'degraded' | 'down'
                    last_check?: string
                    error_message?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    service_name?: string
                    status?: 'healthy' | 'degraded' | 'down'
                    last_check?: string
                    error_message?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
            }
            interactions: {
                Row: {
                    id: string
                    seller_id: string | null
                    channel: 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | null
                    direction: 'OUTBOUND' | 'INBOUND' | null
                    content: string | null
                    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null
                    sent_at: string | null
                }
                Insert: {
                    id?: string
                    seller_id?: string | null
                    channel?: 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | null
                    direction?: 'OUTBOUND' | 'INBOUND' | null
                    content?: string | null
                    status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null
                    sent_at?: string | null
                }
                Update: {
                    id?: string
                    seller_id?: string | null
                    channel?: 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | null
                    direction?: 'OUTBOUND' | 'INBOUND' | null
                    content?: string | null
                    status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null
                    sent_at?: string | null
                }
            }
            parser_jobs: {
                Row: {
                    id: string
                    query: string
                    status: 'pending' | 'processing' | 'completed' | 'failed' | null
                    result_count: number | null
                    error_log: string | null
                    project_id: string | null
                    min_revenue: number | null
                    category: string | null
                    max_results: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    query: string
                    status?: 'pending' | 'processing' | 'completed' | 'failed' | null
                    result_count?: number | null
                    error_log?: string | null
                    project_id?: string | null
                    min_revenue?: number | null
                    category?: string | null
                    max_results?: number | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    query?: string
                    status?: 'pending' | 'processing' | 'completed' | 'failed' | null
                    result_count?: number | null
                    error_log?: string | null
                    project_id?: string | null
                    min_revenue?: number | null
                    category?: string | null
                    max_results?: number | null
                    created_at?: string
                }
            }
            leads: {
                Row: {
                    id: string
                    project_id: string
                    name: string
                    status: 'new' | 'hook_sent' | 'dialog' | 'zoom_booked' | 'closed'
                    platform: 'telegram' | 'linkedin' | 'vk'
                    agent_name: 'Artem' | 'Sasha'
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    name: string
                    status?: 'new' | 'hook_sent' | 'dialog' | 'zoom_booked' | 'closed'
                    platform: 'telegram' | 'linkedin' | 'vk'
                    agent_name: 'Artem' | 'Sasha'
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    name?: string
                    status?: 'new' | 'hook_sent' | 'dialog' | 'zoom_booked' | 'closed'
                    platform?: 'telegram' | 'linkedin' | 'vk'
                    agent_name?: 'Artem' | 'Sasha'
                    created_at?: string
                }
            }
            scripts: {
                Row: {
                    id: string
                    project_id: string
                    variant: 'A' | 'B'
                    name: string
                    text: string
                    sent_count: number
                    conversion_count: number
                    active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    variant: 'A' | 'B'
                    name: string
                    text: string
                    sent_count?: number
                    conversion_count?: number
                    active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    variant?: 'A' | 'B'
                    name?: string
                    text?: string
                    sent_count?: number
                    conversion_count?: number
                    active?: boolean
                    created_at?: string
                }
            }
        }
    }
}
