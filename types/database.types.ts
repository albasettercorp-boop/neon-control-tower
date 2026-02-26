export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          owner_id: string | null;
          health_score: number | null;
          target_zooms: number | null;
          current_zooms: number | null;
          created_at: string;
          is_active: boolean | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id?: string | null;
          health_score?: number | null;
          target_zooms?: number | null;
          current_zooms?: number | null;
          created_at?: string;
          is_active?: boolean | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string | null;
          health_score?: number | null;
          target_zooms?: number | null;
          current_zooms?: number | null;
          created_at?: string;
          is_active?: boolean | null;
        };
      };
      sellers: {
        Row: {
          id: string;
          brand_name: string;
          inn: string | null;
          source: string;
          revenue_monthly: number | null;
          top_product_name: string | null;
          telegram_username: string | null;
          phone: string | null;
          email: string | null;
          wb_api_key: string | null;
          contacts_json: any | null;
          status: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'HOOK_SENT' | 'REPLIED' | 'ZOOM_BOOKED' | 'CONVERTED' | 'REJECTED' | 'ARCHIVED';
          dialog_status: 'Green' | 'Yellow' | 'Red' | null;
          variant: string | null;
          pain_points: string[] | null;
          created_at: string;
          project_id: string | null;
        };
        Insert: {
          id?: string;
          brand_name: string;
          inn?: string | null;
          source: string;
          revenue_monthly?: number | null;
          top_product_name?: string | null;
          telegram_username?: string | null;
          phone?: string | null;
          email?: string | null;
          wb_api_key?: string | null;
          contacts_json?: any | null;
          status?: string;
          dialog_status?: string | null;
          variant?: string | null;
          pain_points?: string[] | null;
          created_at?: string;
          project_id?: string | null;
        };
        Update: {
          id?: string;
          brand_name?: string;
          inn?: string | null;
          source?: string;
          revenue_monthly?: number | null;
          top_product_name?: string | null;
          telegram_username?: string | null;
          phone?: string | null;
          email?: string | null;
          wb_api_key?: string | null;
          contacts_json?: any | null;
          status?: string;
          dialog_status?: string | null;
          variant?: string | null;
          pain_points?: string[] | null;
          created_at?: string;
          project_id?: string | null;
        };
      };
      account_health: {
        Row: {
          id: string;
          service_name: string;
          status: 'healthy' | 'degraded' | 'down';
          last_check: string;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          service_name: string;
          status?: string;
          last_check?: string;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          service_name?: string;
          status?: string;
          last_check?: string;
          error_message?: string | null;
        };
      };
      interactions: {
        Row: {
          id: string;
          seller_id: string;
          channel: string;
          direction: string;
          content: string | null;
          status: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          channel: string;
          direction: string;
          content?: string | null;
          status?: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          channel?: string;
          direction?: string;
          content?: string | null;
          status?: string;
          sent_at?: string;
        };
      };
      parser_jobs: {
        Row: {
          id: string;
          query: string;
          min_revenue: number | null;
          category: string | null;
          max_results: number | null;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          result_count: number | null;
          created_at: string;
          project_id: string | null;
        };
        Insert: {
          id?: string;
          query: string;
          min_revenue?: number | null;
          category?: string | null;
          max_results?: number | null;
          status?: string;
          result_count?: number | null;
          created_at?: string;
          project_id?: string | null;
        };
        Update: {
          id?: string;
          query?: string;
          min_revenue?: number | null;
          category?: string | null;
          max_results?: number | null;
          status?: string;
          result_count?: number | null;
          created_at?: string;
          project_id?: string | null;
        };
      };
      leads: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          source: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      scripts: {
        Row: {
          id: string;
          title: string;
          content: string;
          conversion_rate: number | null;
          status: 'Leader' | 'Outsider' | 'Testing' | null;
          project_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          conversion_rate?: number | null;
          status?: string | null;
          project_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          conversion_rate?: number | null;
          status?: string | null;
          project_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
