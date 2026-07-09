export type FunnelStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export type Client = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  asaas_customer_id: string | null;
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

// Reusable additional section model (e.g. "GARANTIA E SUPORTE").
// service_ids: empty/null = available for every service.
export type SectionTemplate = {
  id: string;
  title: string;
  content: string | null;
  service_ids: string[] | null;
  created_at: string;
  updated_at: string;
};

// A section attached to a proposal. Either a live link to a template
// (auto-updates everywhere when the template changes) or a one-off custom copy.
export type AdditionalSection =
  | { kind: 'template'; template_id: string }
  | { kind: 'custom'; title: string; content: string };

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
  additional_sections: AdditionalSection[] | null;
  start_date: string | null;
  content_json: any | null;
  created_at: string;
};

// --- Contracts (online signing) ---

export type SignerFieldType = 'text' | 'cpf' | 'email' | 'date' | 'textarea';

// A field the client must fill on the public signing page.
// `key` doubles as the template variable name, e.g. key "CPF" -> {{CPF}}.
export type SignerField = {
  key: string;
  label: string;
  type: SignerFieldType;
  required: boolean;
};

export type ContractTemplate = {
  id: string;
  title: string;
  body: string | null;
  signer_fields: SignerField[] | null;
  created_at: string;
  updated_at: string;
};

export type ContractStatus = 'pending' | 'signed' | 'cancelled';

export type Contract = {
  id: string;
  proposal_id: string | null;
  template_id: string | null;
  public_token: string;
  status: ContractStatus;
  title: string;
  body: string | null;
  merge_vars: Record<string, string> | null;
  signer_fields: SignerField[] | null;
  brand: string;
  signer_name: string | null;
  signer_email: string | null;
  signer_values: Record<string, string> | null;
  signature_data: string | null;
  agency_signature: string | null;
  signed_body: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  valid_until: string | null;
  created_at: string;
};

export type AgencySettings = {
  id: string;
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  pix_key: string | null;
  pix_beneficiario: string | null;
  signature_data: string | null;
  updated_at: string;
};

export type AsaasEnvironment = 'sandbox' | 'production';

export type IntegrationSettings = {
  id: string;
  asaas_environment: AsaasEnvironment;
  asaas_enabled: boolean;
  updated_at: string;
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
  client_id: string | null;
  proposal_id: string | null;
  installment_number: number | null;
  asaas_payment_id: string | null;
  boleto_url: string | null;
  boleto_status: string | null;
  payment_method: string | null;
  account_id: string | null;
  supplier_id: string | null;
  recurring_expense_id: string | null;
  competence: string | null; // 'YYYY-MM' quando gerado por recorrência
  import_fingerprint: string | null; // antiduplicata da importação de extrato
  source: string | null; // 'extrato' quando veio de importação de extrato
  created_at: string;
};

export type CashFlowCategoryRecord = {
  id: string;
  name: string;
  type: 'Income' | 'Expense';
  color: string;
  created_at: string;
};

// --- Financeiro (contas bancárias, transferências, recorrentes, fornecedores) ---

export type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  // 'asaas' = conta especial onde boletos caem automaticamente; null nas demais.
  system_key: string | null;
  initial_balance: number;
  color: string;
  is_default: boolean;
  active: boolean;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type RecurringExpense = {
  id: string;
  description: string;
  value: number;
  category: string;
  type: CashFlowType; // receita ou despesa recorrente
  account_id: string | null;
  supplier_id: string | null;
  due_day: number;
  active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
};

export type AccountTransfer = {
  id: string;
  from_account_id: string;
  to_account_id: string;
  value: number;
  date: string;
  description: string | null;
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

// --- Leads (CRM) — inbound do formulário do site ---

export type LeadStatus = 'novo' | 'respondido' | 'proposta' | 'concluido';

export type Lead = {
  id: string;
  name: string;
  phone: string | null;
  services: string[] | null;
  message: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
        Insert: { id?: string; name: string; email?: string | null; whatsapp?: string | null; cpf?: string | null; cnpj?: string | null; asaas_customer_id?: string | null; company_name?: string | null; created_at?: string; };
        Update: { id?: string; name?: string; email?: string | null; whatsapp?: string | null; cpf?: string | null; cnpj?: string | null; asaas_customer_id?: string | null; company_name?: string | null; created_at?: string; };
      };
      proposals: {
        Row: Proposal;
        Insert: { id?: string; client_id: string; service_id?: string | null; service_type?: string; value: number; status?: ProposalStatus; vision_text?: string | null; engine_text?: string | null; scope_text?: string | null; investment_text?: string | null; project_phases?: any | null; additional_sections?: any | null; start_date?: string | null; content_json?: any | null; created_at?: string; };
        Update: { id?: string; client_id?: string; service_id?: string | null; service_type?: string; value?: number; status?: ProposalStatus; vision_text?: string | null; engine_text?: string | null; scope_text?: string | null; investment_text?: string | null; project_phases?: any | null; additional_sections?: any | null; start_date?: string | null; content_json?: any | null; created_at?: string; };
      };
      proposal_section_templates: {
        Row: SectionTemplate;
        Insert: { id?: string; title: string; content?: string | null; service_ids?: string[] | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; title?: string; content?: string | null; service_ids?: string[] | null; created_at?: string; updated_at?: string; };
      };
      contract_templates: {
        Row: ContractTemplate;
        Insert: { id?: string; title: string; body?: string | null; signer_fields?: any | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; title?: string; body?: string | null; signer_fields?: any | null; created_at?: string; updated_at?: string; };
      };
      agency_settings: {
        Row: AgencySettings;
        Insert: { id?: string; razao_social?: string | null; cnpj?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; email?: string | null; telefone?: string | null; pix_key?: string | null; pix_beneficiario?: string | null; signature_data?: string | null; updated_at?: string; };
        Update: { id?: string; razao_social?: string | null; cnpj?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; email?: string | null; telefone?: string | null; pix_key?: string | null; pix_beneficiario?: string | null; signature_data?: string | null; updated_at?: string; };
      };
      contracts: {
        Row: Contract;
        Insert: { id?: string; proposal_id?: string | null; template_id?: string | null; public_token: string; status?: ContractStatus; title: string; body?: string | null; merge_vars?: any | null; signer_fields?: any | null; brand?: string; signer_name?: string | null; signer_email?: string | null; signer_values?: any | null; signature_data?: string | null; signed_body?: string | null; signed_at?: string | null; signer_ip?: string | null; signer_user_agent?: string | null; valid_until?: string | null; created_at?: string; };
        Update: { id?: string; proposal_id?: string | null; template_id?: string | null; public_token?: string; status?: ContractStatus; title?: string; body?: string | null; merge_vars?: any | null; signer_fields?: any | null; brand?: string; signer_name?: string | null; signer_email?: string | null; signer_values?: any | null; signature_data?: string | null; signed_body?: string | null; signed_at?: string | null; signer_ip?: string | null; signer_user_agent?: string | null; valid_until?: string | null; created_at?: string; };
      };
      cash_flow: {
        Row: CashFlow;
        Insert: { id?: string; type: CashFlowType; category: string; value: number; date: string; description?: string | null; status?: CashFlowStatus; client_id?: string | null; proposal_id?: string | null; installment_number?: number | null; asaas_payment_id?: string | null; boleto_url?: string | null; boleto_status?: string | null; payment_method?: string | null; account_id?: string | null; supplier_id?: string | null; recurring_expense_id?: string | null; competence?: string | null; import_fingerprint?: string | null; source?: string | null; created_at?: string; };
        Update: { id?: string; type?: CashFlowType; category?: string; value?: number; date?: string; description?: string | null; status?: CashFlowStatus; client_id?: string | null; proposal_id?: string | null; installment_number?: number | null; asaas_payment_id?: string | null; boleto_url?: string | null; boleto_status?: string | null; payment_method?: string | null; account_id?: string | null; supplier_id?: string | null; recurring_expense_id?: string | null; competence?: string | null; import_fingerprint?: string | null; source?: string | null; created_at?: string; };
      };
      bank_accounts: {
        Row: BankAccount;
        Insert: { id?: string; name: string; bank_name?: string | null; system_key?: string | null; initial_balance?: number; color?: string; is_default?: boolean; active?: boolean; created_at?: string; };
        Update: { id?: string; name?: string; bank_name?: string | null; system_key?: string | null; initial_balance?: number; color?: string; is_default?: boolean; active?: boolean; created_at?: string; };
      };
      suppliers: {
        Row: Supplier;
        Insert: { id?: string; name: string; document?: string | null; email?: string | null; phone?: string | null; notes?: string | null; created_at?: string; };
        Update: { id?: string; name?: string; document?: string | null; email?: string | null; phone?: string | null; notes?: string | null; created_at?: string; };
      };
      recurring_expenses: {
        Row: RecurringExpense;
        Insert: { id?: string; description: string; value: number; category: string; type?: CashFlowType; account_id?: string | null; supplier_id?: string | null; due_day: number; active?: boolean; start_date?: string; end_date?: string | null; created_at?: string; };
        Update: { id?: string; description?: string; value?: number; category?: string; type?: CashFlowType; account_id?: string | null; supplier_id?: string | null; due_day?: number; active?: boolean; start_date?: string; end_date?: string | null; created_at?: string; };
      };
      account_transfers: {
        Row: AccountTransfer;
        Insert: { id?: string; from_account_id: string; to_account_id: string; value: number; date: string; description?: string | null; created_at?: string; };
        Update: { id?: string; from_account_id?: string; to_account_id?: string; value?: number; date?: string; description?: string | null; created_at?: string; };
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
      leads: {
        Row: Lead;
        Insert: { id?: string; name: string; phone?: string | null; services?: string[] | null; message?: string | null; source?: string | null; status?: LeadStatus; notes?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; name?: string; phone?: string | null; services?: string[] | null; message?: string | null; source?: string | null; status?: LeadStatus; notes?: string | null; created_at?: string; updated_at?: string; };
      };
      integration_settings: {
        Row: IntegrationSettings;
        Insert: { id?: string; asaas_environment?: AsaasEnvironment; asaas_enabled?: boolean; updated_at?: string; };
        Update: { id?: string; asaas_environment?: AsaasEnvironment; asaas_enabled?: boolean; updated_at?: string; };
      };
    };
  };
}
