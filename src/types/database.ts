export type FunnelStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export type Client = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  cnpj: string | null;
  company_name: string | null;
  website: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  funnel_stage: FunnelStage | null;
  lead_source: string | null;
  notes: string | null;
  estimated_value: number | null;
  next_follow_up: string | null;
  tags: string[] | null;
  created_at: string;
};

export type Service = {
  id: string;
  name: string;
  base_price: number;
  vision_template: string | null;
  engine_template: string | null;
  scope_template: string | null;
  investment_template: string | null;
  phases_template: any | null;
  created_at: string;
};

export type ProposalStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected';

export type ProposalPhase = {
  name: string;
  duration_days: number;
};

export type Proposal = {
  id: string;
  client_id: string;
  service_id: string | null;
  service_type: string;
  value: number;
  status: ProposalStatus;
  vision_text: string | null;
  engine_text: string | null;
  scope_text: string | null;
  investment_text: string | null;
  project_phases: ProposalPhase[] | null;
  start_date: string | null;
  content_json: any | null;
  created_at: string;
};

export type CashFlowType = 'Income' | 'Expense';
export type CashFlowCategory = string; // Dynamic, from cash_flow_categories table
export type CashFlowStatus = 'Paid' | 'Pending';

export type CashFlow = {
  id: string;
  type: CashFlowType;
  category: string;
  value: number;
  date: string;
  description: string | null;
  status: CashFlowStatus;
  created_at: string;
};

export type CashFlowCategoryRecord = {
  id: string;
  name: string;
  type: 'Income' | 'Expense';
  color: string;
  created_at: string;
};

export type Task = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  project: string;
  priority: string;
};

export interface Database {
  public: {
    Tables: {
      services: {
        Row: Service;
        Insert: { id?: string; name: string; base_price?: number; vision_template?: string | null; engine_template?: string | null; scope_template?: string | null; investment_template?: string | null; phases_template?: any | null; created_at?: string; };
        Update: { id?: string; name?: string; base_price?: number; vision_template?: string | null; engine_template?: string | null; scope_template?: string | null; investment_template?: string | null; phases_template?: any | null; created_at?: string; };
      };
      clients: {
        Row: Client;
        Insert: { id?: string; name: string; email?: string | null; whatsapp?: string | null; company_name?: string | null; created_at?: string; };
        Update: { id?: string; name?: string; email?: string | null; whatsapp?: string | null; company_name?: string | null; created_at?: string; };
      };
      proposals: {
        Row: Proposal;
        Insert: { id?: string; client_id: string; service_id?: string | null; service_type?: string; value: number; status?: ProposalStatus; vision_text?: string | null; engine_text?: string | null; scope_text?: string | null; investment_text?: string | null; project_phases?: any | null; start_date?: string | null; content_json?: any | null; created_at?: string; };
        Update: { id?: string; client_id?: string; service_id?: string | null; service_type?: string; value?: number; status?: ProposalStatus; vision_text?: string | null; engine_text?: string | null; scope_text?: string | null; investment_text?: string | null; project_phases?: any | null; start_date?: string | null; content_json?: any | null; created_at?: string; };
      };
      cash_flow: {
        Row: CashFlow;
        Insert: { id?: string; type: CashFlowType; category: string; value: number; date: string; description?: string | null; status?: CashFlowStatus; created_at?: string; };
        Update: { id?: string; type?: CashFlowType; category?: string; value?: number; date?: string; description?: string | null; status?: CashFlowStatus; created_at?: string; };
      };
      cash_flow_categories: {
        Row: CashFlowCategoryRecord;
        Insert: { id?: string; name: string; type: 'Income' | 'Expense'; color?: string; created_at?: string; };
        Update: { id?: string; name?: string; type?: 'Income' | 'Expense'; color?: string; created_at?: string; };
      };
      tasks: {
        Row: Task;
        Insert: { id?: string; created_at?: string; title: string; description?: string | null; due_date?: string | null; completed?: boolean; project?: string; priority?: string; };
        Update: { id?: string; created_at?: string; title?: string; description?: string | null; due_date?: string | null; completed?: boolean; project?: string; priority?: string; };
      };
    };
  };
}
