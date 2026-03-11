import { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  DollarSign,
  LayoutDashboard,
  Plus,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Trash2,
  Edit2,
  LogOut,
  Briefcase,
  Printer,
  Users,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Settings,
  ListTodo
} from 'lucide-react';
import './App.css';
import { useSupabase } from './hooks/useSupabase';
import { supabase } from './lib/supabase';
import { SettingsView } from './components/SettingsView';
import { TasksView } from './components/TasksView';
import { DefaultEditor as Editor } from 'react-simple-wysiwyg';
import type { Client, Proposal, CashFlow, ProposalStatus, CashFlowType, CashFlowCategory, CashFlowStatus, Service, ProposalPhase, CashFlowCategoryRecord } from './types/database';
import type { User } from '@supabase/supabase-js';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'proposals' | 'cashflow' | 'cashflow-all' | 'cashflow-categories' | 'proposal-form' | 'services' | 'service-form' | 'cashflow-form' | 'clients' | 'client-form' | 'settings' | 'tasks'>('dashboard');
  const [selectedProposal, setSelectedProposal] = useState<{ proposal: Proposal; client: Client | null } | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCashFlow, setSelectedCashFlow] = useState<CashFlow | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<{ proposal: Proposal; client: Client | null } | null>(null);
  const [printProposal, setPrintProposal] = useState<{ proposal: Proposal; client: Client | null } | null>(null);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { proposals, cashFlows, clients, services, cashFlowCategories, tasks, loading, refetch, silentRefetch } = useSupabase();

  useEffect(() => {
    if (user?.id) {
      refetch();
    }
  }, [refetch, user?.id]);

  // Modal States - removing as we are using page forms

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F9F8F6]">
        <Loader2 className="animate-spin text-[#C13584]" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen w-full text-gray-800 font-sans relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-pink-50 print:h-auto print:overflow-visible print:bg-white print:bg-none">
      {/* Decorative Background Blobs for Glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-pink-400/20 to-purple-400/20 blur-[100px] pointer-events-none print:hidden" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-blue-300/20 to-pink-300/20 blur-[120px] pointer-events-none print:hidden" />

      {/* Content wrapper */}
      <div className="flex w-full h-full relative z-10 print:hidden">
        {/* Sidebar - Glassmorphism style */}
        <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-white/60 p-6 flex flex-col gap-8 flex-shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C13584] to-purple-600 shadow-md flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#4a1131]">OctaOS <span className="font-light">CRM</span></h1>
          </div>

          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer ${activeTab === 'dashboard' ? 'bg-white/60 shadow-sm border border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}`}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('proposals')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer ${activeTab === 'proposals' ? 'bg-white/60 shadow-sm border border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}`}
            >
              <FileText size={20} />
              Propostas
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer ${activeTab === 'tasks' ? 'bg-white/60 shadow-sm border border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}`}
            >
              <ListTodo size={20} />
              Tarefas
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer ${activeTab === 'cashflow' || activeTab === 'cashflow-categories' || activeTab === 'cashflow-all'
                ? 'bg-white/60 shadow-sm border border-white/50 text-[#C13584] backdrop-blur-md'
                : 'text-gray-600 hover:bg-white/40'
                }`}
            >
              <DollarSign size={20} />
              Fluxo de Caixa
            </button>
            {/* Cashflow submenu */}
            {(activeTab === 'cashflow' || activeTab === 'cashflow-categories' || activeTab === 'cashflow-all' || activeTab === 'cashflow-form') && (
              <div className="ml-4 flex flex-col gap-1 border-l-2 border-[#C13584]/20 pl-3">
                <button
                  onClick={() => setActiveTab('cashflow')}
                  className={`text-sm px-3 py-2 rounded-lg font-medium transition-all cursor-pointer ${activeTab === 'cashflow' || activeTab === 'cashflow-form'
                    ? 'text-[#C13584] bg-pink-50/60'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'
                    }`}
                >
                  Por Mês
                </button>
                <button
                  onClick={() => setActiveTab('cashflow-all')}
                  className={`text-sm px-3 py-2 rounded-lg font-medium transition-all cursor-pointer ${activeTab === 'cashflow-all'
                    ? 'text-[#C13584] bg-pink-50/60'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'
                    }`}
                >
                  Todos os Lançamentos
                </button>
                <button
                  onClick={() => setActiveTab('cashflow-categories')}
                  className={`text-sm px-3 py-2 rounded-lg font-medium transition-all cursor-pointer ${activeTab === 'cashflow-categories'
                    ? 'text-[#C13584] bg-pink-50/60'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'
                    }`}
                >
                  Categorias
                </button>
              </div>
            )}
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer border border-transparent ${activeTab === 'services' ? 'bg-white/60 shadow-sm border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}`}
            >
              <Briefcase size={20} />
              Serviços Base
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer border border-transparent ${activeTab === 'clients' || activeTab === 'client-form' ? 'bg-white/60 shadow-sm border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}`}
            >
              <Users size={20} />
              Clientes
            </button>
          </nav>

          <div className="mt-auto border-t border-white/50 pt-6 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-white/60 shadow-inner flex items-center justify-center flex-shrink-0 text-[#C13584] border border-white/50">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-gray-800 truncate">{user?.email}</p>
                <p className="text-xs text-gray-500">Administrador</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-4 py-3 mt-2 rounded-xl font-medium transition-all cursor-pointer w-full text-left ${activeTab === 'settings' ? 'bg-white/60 shadow-sm border border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}`}
            >
              <Settings size={18} />
              Configurações
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-3 px-4 py-3 mt-1 rounded-xl font-medium text-red-500 hover:bg-red-50/50 backdrop-blur-sm transition-all cursor-pointer w-full text-left"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto flex flex-col h-full print:overflow-visible">
          <header className="h-20 flex-shrink-0 border-b border-white/40 bg-white/30 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.02)] print:hidden">
            <h2 className="text-2xl font-semibold capitalize text-gray-800">
              {activeTab === 'dashboard' ? 'Visão Geral' :
                activeTab === 'tasks' ? 'Tarefas' :
                  activeTab === 'proposals' ? 'Gestão de Propostas' :
                    activeTab === 'proposal-form' ? (selectedProposal ? 'Editar Proposta' : 'Nova Proposta') :
                      activeTab === 'services' ? 'Serviços Base' :
                        activeTab === 'service-form' ? (selectedService ? 'Editar Serviço' : 'Novo Serviço') :
                          activeTab === 'cashflow' ? 'Fluxo de Caixa — Por Mês' :
                            activeTab === 'cashflow-all' ? 'Todos os Lançamentos' :
                              activeTab === 'cashflow-categories' ? 'Categorias do Fluxo de Caixa' :
                                activeTab === 'cashflow-form' ? (selectedCashFlow ? 'Editar Lançamento' : 'Novo Lançamento') :
                                  activeTab === 'clients' ? 'Clientes' :
                                    activeTab === 'client-form' ? (selectedClient ? 'Editar Cliente' : 'Novo Cliente') :
                                      activeTab === 'settings' ? 'Configurações' : ''}
            </h2>
            <div className="flex items-center gap-4">
              {activeTab === 'proposals' && (
                <button onClick={() => { setSelectedProposal(null); setActiveTab('proposal-form'); }} className="bg-[#C13584] hover:bg-[#A42D70] cursor-pointer text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm">
                  <Plus size={18} />
                  Nova Proposta
                </button>
              )}
              {(activeTab === 'cashflow' || activeTab === 'cashflow-all') && (
                <button onClick={() => { setSelectedCashFlow(null); setActiveTab('cashflow-form'); }} className="bg-[#C13584] hover:bg-[#A42D70] cursor-pointer text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm">
                  <Plus size={18} />
                  Novo Registro
                </button>
              )}
              {activeTab === 'cashflow-categories' && (
                <span className="text-sm text-gray-500 italic">Gerencie as categorias abaixo</span>
              )}
              {activeTab === 'dashboard' && (
                <button onClick={() => { setSelectedProposal(null); setActiveTab('proposal-form'); }} className="bg-[#C13584] hover:bg-[#A42D70] cursor-pointer text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm">
                  <Plus size={18} />
                  Criar Rápido
                </button>
              )}
              {activeTab === 'services' && (
                <button id="btn-new-service" onClick={() => { setSelectedService(null); setActiveTab('service-form'); }} className="bg-[#C13584] hover:bg-[#A42D70] cursor-pointer text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm">
                  <Plus size={18} />
                  Novo Serviço
                </button>
              )}
              {activeTab === 'clients' && (
                <button onClick={() => { setSelectedClient(null); setActiveTab('client-form'); }} className="bg-[#C13584] hover:bg-[#A42D70] cursor-pointer text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm">
                  <Plus size={18} />
                  Novo Cliente
                </button>
              )}

            </div>
          </header>

          <div className="p-8 pb-12 flex-1 relative z-0 print:p-0">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-[#C13584] drop-shadow-lg">
                <Loader2 className="animate-spin" size={48} />
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
                {activeTab === 'dashboard' && <DashboardView proposals={proposals} cashFlows={cashFlows} />}
                {activeTab === 'tasks' && <TasksView tasks={tasks} refetch={refetch} />}
                {activeTab === 'proposals' && (
                  <ProposalsView
                    proposals={proposals}
                    refetch={refetch}
                    onEditProposal={(p) => { setSelectedProposal(p); setActiveTab('proposal-form'); }}
                    onApproveProposal={(p) => setApprovalTarget(p)}
                    onPrintProposal={(p) => { setPrintProposal(p); setTimeout(() => window.print(), 100); }}
                  />
                )}
                {activeTab === 'proposal-form' && (
                  <ProposalFormView
                    proposalData={selectedProposal}
                    services={services}
                    clients={clients}
                    onSave={() => { setActiveTab('proposals'); refetch(); }}
                    onCancel={() => setActiveTab('proposals')}
                    onApprove={(p) => setApprovalTarget(p)}
                    onPrint={(p, c) => { setPrintProposal({ proposal: p, client: c }); setTimeout(() => window.print(), 150); }}
                  />
                )}
                {activeTab === 'cashflow' && <CashFlowView cashFlows={cashFlows} cashFlowCategories={cashFlowCategories} onEditCashFlow={(c) => { setSelectedCashFlow(c); setActiveTab('cashflow-form'); }} refetch={silentRefetch} />}
                {activeTab === 'cashflow-all' && <CashFlowAllView cashFlows={cashFlows} cashFlowCategories={cashFlowCategories} onEditCashFlow={(c) => { setSelectedCashFlow(c); setActiveTab('cashflow-form'); }} refetch={silentRefetch} />}
                {activeTab === 'cashflow-categories' && <CashFlowCategoriesView categories={cashFlowCategories} refetch={refetch} />}
                {activeTab === 'cashflow-form' && (
                  <CashFlowFormView
                    cashFlowData={selectedCashFlow}
                    cashFlowCategories={cashFlowCategories}
                    onSave={() => { setActiveTab('cashflow'); refetch(); }}
                    onCancel={() => setActiveTab('cashflow')}
                  />
                )}
                {activeTab === 'services' && <ServicesView services={services} refetch={refetch} openNewModal={() => { setSelectedService(null); setActiveTab('service-form'); }} onEditService={(s) => { setSelectedService(s); setActiveTab('service-form'); }} />}
                {activeTab === 'service-form' && (
                  <ServiceFormView
                    serviceData={selectedService}
                    onSave={() => { setActiveTab('services'); refetch(); }}
                    onCancel={() => setActiveTab('services')}
                  />
                )}
                {activeTab === 'clients' && (
                  <ClientsView
                    clients={clients}
                    refetch={refetch}
                    onEditClient={(c) => { setSelectedClient(c); setActiveTab('client-form'); }}
                  />
                )}
                {activeTab === 'client-form' && (
                  <ClientFormView
                    clientData={selectedClient}
                    onSave={() => { setActiveTab('clients'); refetch(); }}
                    onCancel={() => setActiveTab('clients')}
                  />
                )}
                {activeTab === 'settings' && <SettingsView />}
              </div>
            )}
          </div>
        </main>
      </div>
      {approvalTarget && (
        <ApprovalModal
          target={approvalTarget}
          onClose={() => setApprovalTarget(null)}
          onDone={() => { setApprovalTarget(null); refetch(); }}
        />
      )}

      {/* Global print document — always in DOM, only shown at print time */}
      {printProposal && <ProposalPrintDocument proposal={printProposal.proposal} client={printProposal.client} />}
    </div>
  );
}

// -------------------------------------------------------------
// CURRENCY INPUT (BRL formatted)
// -------------------------------------------------------------
function CurrencyInput({
  value,
  onChange,
  required = false,
  placeholder = '0,00',
  className = ''
}: {
  value: string;
  onChange: (raw: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const baseClass = 'w-full border border-white/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner';
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  const numericValue = parseFloat(String(value).replace(',', '.')) || 0;
  const formatted = numericValue === 0 ? '' : numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleFocus = () => {
    setEditing(true);
    setEditVal(numericValue === 0 ? '' : String(numericValue).replace('.', ','));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // allow digits, comma, dot
    const raw = e.target.value.replace(/[^0-9,.]/g, '');
    setEditVal(raw);
    const num = parseFloat(raw.replace(',', '.')) || 0;
    onChange(String(num));
  };

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(editVal.replace(/\./g, '').replace(',', '.')) || 0;
    onChange(String(num));
  };

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 select-none pointer-events-none z-10">R$</span>
      <input
        type="text"
        inputMode="decimal"
        required={required}
        value={editing ? editVal : formatted}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`${baseClass} pl-10 pr-4 py-3 ${className}`}
      />
    </div>
  );
}

// -------------------------------------------------------------
// TEMPLATE VARIABLE ENGINE
// -------------------------------------------------------------
const TEMPLATE_VARS = [
  { key: 'NOME_CLIENTE', label: 'Nome do Cliente' },
  { key: 'EMPRESA_CLIENTE', label: 'Empresa' },
  { key: 'SERVICO', label: 'Serviço' },
  { key: 'VALOR_BRUTO', label: 'Valor Bruto' },
  { key: 'VALOR_LIQUIDO', label: 'Valor Líquido' },
  { key: 'DATA_INICIO', label: 'Data Início' },
  { key: 'NUM_PARCELAS', label: 'Nº Parcelas' },
  { key: 'DATA_HOJE', label: 'Data Hoje' },
];

function resolveVars(html: string, vars: Record<string, string>): string {
  if (!html) return html;
  return Object.entries(vars).reduce(
    (text, [key, val]) => text.split(`{{${key}}}`).join(val),
    html
  );
}

function TemplateVarChips() {
  const [copied, setCopied] = useState<string | null>(null);
  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className="text-xs text-gray-400 self-center mr-1">Variáveis:</span>
      {TEMPLATE_VARS.map(v => (
        <button
          key={v.key}
          type="button"
          onClick={() => handleCopy(v.key)}
          title={`Clique para copiar {{${v.key}}}`}
          className="px-2 py-0.5 text-xs rounded-md bg-[#C13584]/10 text-[#C13584] border border-[#C13584]/20 hover:bg-[#C13584]/20 transition-colors cursor-pointer font-mono"
        >
          {copied === v.key ? '✓ Copiado!' : `{{${v.key}}}`}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------
function DashboardView({ proposals, cashFlows }: { proposals: any[], cashFlows: CashFlow[] }) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filter to current month (using local timezone parse)
  const currentMonthFlows = cashFlows.filter(c => {
    const d = new Date(c.date + 'T00:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // All income of the month (Paid + Pending = total billed)
  const totalIncomeMes = currentMonthFlows.filter(c => c.type === 'Income').reduce((acc, c) => acc + Number(c.value), 0);
  // Only what was actually received (Paid)
  const totalRecebido = currentMonthFlows.filter(c => c.type === 'Income' && c.status === 'Paid').reduce((acc, c) => acc + Number(c.value), 0);
  // Only what is pending
  const totalAReceber = currentMonthFlows.filter(c => c.type === 'Income' && c.status === 'Pending').reduce((acc, c) => acc + Number(c.value), 0);

  const totalExpenseMes = currentMonthFlows.filter(c => c.type === 'Expense').reduce((acc, c) => acc + Number(c.value), 0);
  const saldoMes = totalIncomeMes - totalExpenseMes;

  // Active proposals irrespective of month
  const activeProposalsCount = proposals.filter(p => p.proposal.status === 'Sent' || p.proposal.status === 'Approved').length;
  const approvedProposalsCount = proposals.filter(p => p.proposal.status === 'Approved').length;

  // Most recent 3 cash flow entries (ordered by date desc from hook)
  const recentCashFlows = cashFlows.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Faturamento do Mês"
          value={`R$ ${fmtBRL(saldoMes)}`}
          icon={<DollarSign className="text-[#C13584]" />}
          trend={saldoMes >= 0 ? "Receitas acima das despesas" : "Despesas acima das receitas"}
          trendUp={saldoMes >= 0}
        />
        <SummaryCard
          title="Recebido (Pago)"
          value={`R$ ${fmtBRL(totalRecebido)}`}
          icon={<ArrowUpRight className="text-green-500" />}
          trend="Receitas confirmadas"
          trendUp={true}
        />
        <SummaryCard
          title="A Receber (Pendente)"
          value={`R$ ${fmtBRL(totalAReceber)}`}
          icon={<BarChart3 className="text-[#C13584]" />}
          trend="Aguardando pagamento"
          trendUp={true}
        />
        <SummaryCard
          title="Propostas Ativas"
          value={activeProposalsCount}
          icon={<FileText className="text-[#C13584]" />}
          trend={`${approvedProposalsCount} aprovadas`}
          trendUp={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Desempenho Financeiro (MVP)</h3>
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-gray-300/50 rounded-xl bg-white/30 text-gray-400 gap-4 backdrop-blur-sm">
            <BarChart3 size={48} className="text-gray-300" />
            <p className="text-sm">Os gráficos de série temporal estarão disponíveis nas próximas etapas.</p>
          </div>
        </div>
        <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Últimos Lançamentos</h3>
          <div className="flex flex-col gap-6">
            {recentCashFlows.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Nenhum lançamento.</p>
            ) : (
              recentCashFlows.map(c => (
                <div key={c.id} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.type === 'Income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {c.type === 'Income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium text-sm text-gray-800 truncate">{c.description || 'Sem descrição'}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {c.status === 'Paid' ? 'Pago' : 'Pendente'}</p>
                  </div>
                  <p className={`font-semibold text-sm whitespace-nowrap ${c.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {c.type === 'Income' ? '+' : '-'} R$ {fmtBRL(Number(c.value))}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, trend, trendUp }: any) {
  return (
    <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col gap-4 transition-all hover:-translate-y-1 hover:shadow-[0_12px_48px_rgba(0,0,0,0.08)] duration-300">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="p-2 bg-white/60 backdrop-blur-md shadow-inner border border-white/50 rounded-xl">
          {icon}
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-[#1c1c1e]">{value}</h3>
        <p className={`text-sm mt-2 flex items-center gap-1 font-medium ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          {trendUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {trend}
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// APPROVAL MODAL
// -------------------------------------------------------------
type ProposalData = { proposal: Proposal; client: Client | null };

function ApprovalModal({ target, onClose, onDone }: {
  target: ProposalData;
  onClose: () => void;
  onDone: () => void;
}) {
  const savedContent = target.proposal.content_json as Record<string, unknown> | null;
  const originalInstallments = (savedContent?.installments as { date: string; value: number }[]) || [];
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [installments, setInstallments] = useState(
    originalInstallments.length > 0
      ? originalInstallments
      : [{ date: new Date().toISOString().split('T')[0], value: target.proposal.value }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = target.client?.company_name || target.client?.name || 'Cliente';
  const serviceType = target.proposal.service_type || 'Serviço';
  const netValue = (savedContent?.netValue as number) || target.proposal.value;

  const updateDate = (i: number, d: string) => {
    const u = [...installments]; u[i] = { ...u[i], date: d }; setInstallments(u);
  };
  const updateValue = (i: number, v: number) => {
    const u = [...installments]; u[i] = { ...u[i], value: v }; setInstallments(u);
  };

  const totalInstallments = installments.reduce((a, b) => a + b.value, 0);
  const isBalanced = Math.abs(totalInstallments - netValue) < 0.10;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Update proposal status to Approved
      const { error: propErr } = await supabase
        .from('proposals')
        .update({ status: 'Approved' })
        .eq('id', target.proposal.id);
      if (propErr) throw propErr;

      // 2. Insert cash_flow rows for each installment
      const rows = installments.map((inst, i) => ({
        type: 'Income' as CashFlowType,
        category: 'Project_Spot' as CashFlowCategory,
        description: `Parcela ${i + 1}/${installments.length} – ${clientName} – ${serviceType}`,
        value: inst.value,
        date: inst.date,
        status: 'Pending' as CashFlowStatus,
      }));
      const { error: cfErr } = await supabase.from('cash_flow').insert(rows);
      if (cfErr) throw cfErr;

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <CheckCircle size={28} />
            <div>
              <h2 className="text-xl font-bold">Aprovar Proposta</h2>
              <p className="text-green-100 text-sm mt-0.5">As parcelas abaixo serão lançadas no Fluxo de Caixa como Receitas Pendentes</p>
            </div>
          </div>
        </div>

        {/* Client + service summary */}
        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex justify-between items-center text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-gray-800 text-base">{clientName}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Serviço</p>
              <p className="font-medium text-gray-700">{serviceType}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Valor Líquido</p>
              <p className="font-bold text-green-600 text-lg">R$ {fmtBRL(netValue)}</p>
            </div>
          </div>
        </div>

        {/* Installments table */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Parcelas a lançar ({installments.length}x)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-100">
                <th className="pb-2 text-left font-medium w-8">#</th>
                <th className="pb-2 text-left font-medium">Data de Vencimento</th>
                <th className="pb-2 text-left font-medium">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {installments.map((inst, i) => (
                <tr key={i}>
                  <td className="py-2 font-bold text-green-600">{i + 1}</td>
                  <td className="py-2 pr-4">
                    <input type="date" value={inst.date} onChange={e => updateDate(i, e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-full" />
                  </td>
                  <td className="py-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">R$</span>
                      <input type="number" step="0.01" value={inst.value}
                        onChange={e => updateValue(i, parseFloat(e.target.value) || 0)}
                        className="border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-36" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={2} className="pt-3 font-semibold text-gray-600 text-sm">Total das Parcelas</td>
                <td className="pt-3">
                  <span className={`font-bold text-sm ${isBalanced ? 'text-green-600' : 'text-orange-500'}`}>
                    R$ {fmtBRL(totalInstallments)}
                  </span>
                  {!isBalanced && <p className="text-orange-500 text-xs mt-0.5">Difere do valor líquido em R$ {fmtBRL(Math.abs(totalInstallments - netValue))}</p>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg shadow-green-200">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {loading ? 'Aprovando...' : 'Confirmar e Lançar no Fluxo de Caixa'}
          </button>
        </div>
      </div>
    </div>
  );
}

const calculateBusinessEndDate = (startStr: string, businessDays: number) => {
  if (!startStr) return null;
  let d = new Date(startStr + 'T00:00:00Z');
  let added = 0;
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return d;
};

// -------------------------------------------------------------
// GANTT CHART COMPONENT
// -------------------------------------------------------------
const GANTT_COLORS = ['#C13584', '#9b5de5', '#0077b6', '#00b4d8', '#06d6a0', '#f77f00', '#e63946', '#457b9d'];

function GanttChart({ phases, startDate }: { phases: { name: string; duration_days: number }[]; startDate: string | null }) {
  const totalDays = phases.reduce((acc, ph) => acc + (ph.duration_days || 0), 0);
  if (phases.length === 0 || totalDays === 0) return null;

  let cum = 0;
  const rows = phases.map((ph, idx) => {
    const start = cum;
    cum += ph.duration_days || 0;
    const leftPct = (start / totalDays) * 100;
    const widthPct = ((ph.duration_days || 0) / totalDays) * 100;
    let endLabel = '';
    if (startDate && ph.duration_days > 0) {
      const d = calculateBusinessEndDate(startDate, cum);
      if (d) endLabel = d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' });
    }
    return { name: ph.name || `Fase ${idx + 1}`, days: ph.duration_days || 0, leftPct, widthPct, color: GANTT_COLORS[idx % GANTT_COLORS.length], endLabel };
  });

  const STEP = totalDays <= 10 ? 2 : totalDays <= 30 ? 5 : totalDays <= 60 ? 10 : 15;
  const markers: { pct: number; label: string }[] = [];
  for (let d = 0; d <= totalDays; d += STEP) {
    const pos = Math.min(d, totalDays);
    const pct = (pos / totalDays) * 100;
    let label = '';
    if (startDate) {
      const dt = pos === 0 ? new Date(startDate + 'T00:00:00Z') : calculateBusinessEndDate(startDate, pos);
      if (dt) label = dt.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' });
    } else {
      label = pos === 0 ? 'Início' : `${pos}d`;
    }
    markers.push({ pct, label });
  }
  if (markers[markers.length - 1]?.pct < 99) {
    let label = '';
    if (startDate) {
      const dt = calculateBusinessEndDate(startDate, totalDays);
      if (dt) label = dt.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' });
    } else label = `${totalDays}d`;
    markers.push({ pct: 100, label });
  }

  return (
    <div className="mt-2 bg-white/30 rounded-2xl border border-white/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={15} className="text-[#C13584]" />
        <span className="text-sm font-semibold text-gray-700">Gráfico de Gantt</span>
        <span className="ml-auto text-xs text-gray-400">{totalDays} dias úteis</span>
      </div>

      {/* Date markers */}
      <div className="relative h-5 ml-28 mr-16 mb-1 select-none">
        {markers.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 text-[9px] text-gray-400 whitespace-nowrap"
            style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-24 flex-shrink-0 text-right">
              <span className="text-[11px] font-medium text-gray-600 block truncate" title={row.name}>{row.name}</span>
            </div>
            <div className="relative flex-1 h-6 bg-gray-100/80 rounded-full overflow-hidden">
              {markers.map((m, i) => i > 0 && (
                <div key={i} className="absolute top-0 h-full w-px bg-gray-200/70" style={{ left: `${m.pct}%` }} />
              ))}
              <div
                className="absolute top-0 h-full rounded-full flex items-center justify-center"
                style={{ left: `${row.leftPct}%`, width: `max(${row.widthPct}%, 1.5rem)`, backgroundColor: row.color }}
              >
                {row.widthPct > 7 && (
                  <span className="text-[10px] text-white font-bold px-1.5 truncate">{row.days}d</span>
                )}
              </div>
            </div>
            <div className="w-14 flex-shrink-0 text-right">
              {row.endLabel && <span className="text-[10px] text-gray-400">até {row.endLabel}</span>}
            </div>
          </div>
        ))}
      </div>

      {startDate && (
        <div className="mt-3 pt-3 border-t border-white/40 text-xs text-gray-500 flex gap-4">
          <span>Início: <strong className="text-gray-700">{new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
          <span>Entrega: <strong className="text-gray-700">{calculateBusinessEndDate(startDate, totalDays)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// PROPOSALS VIEW (LISTING & CRUD)
// -------------------------------------------------------------

function ProposalPrintDocument({ proposal, client }: { proposal: Proposal; client: Client | null }) {
  const resolveVars = (text: string, vars: Record<string, string>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');

  const savedContent = proposal.content_json as Record<string, unknown> | null;
  const installments = (savedContent?.installments as { date: string; value: number }[]) || [];
  const discountAmt = (savedContent?.discountAmt as number) || 0;
  const discountType = (savedContent?.discountType as string) || 'fixed';
  const discountRaw = (savedContent?.discountValue as string) || '0';
  const upfrontPrice = (savedContent?.upfrontPrice as string) || '';
  const netValue = (savedContent?.netValue as number) ?? Number(proposal.value);
  const phases: { name: string; duration_days: number }[] = (proposal.project_phases as any) || [];

  const totalBusinessDays = phases.reduce((acc, ph) => acc + (ph.duration_days || 0), 0);
  const endDateStr = proposal.start_date && totalBusinessDays > 0
    ? calculateBusinessEndDate(proposal.start_date, totalBusinessDays)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) || ''
    : '';

  const templateVarMap: Record<string, string> = {
    NOME_CLIENTE: client?.name || '',
    EMPRESA_CLIENTE: client?.company_name || '',
    SERVICO: proposal.service_type || '',
    VALOR_BRUTO: `R$ ${Number(proposal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    VALOR_LIQUIDO: `R$ ${netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    DATA_INICIO: proposal.start_date ? new Date(proposal.start_date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
    NUM_PARCELAS: String(installments.length || 1),
    DATA_HOJE: new Date().toLocaleDateString('pt-BR'),
  };
  const rv = (text: string) => resolveVars(text, templateVarMap);
  const propId = proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase();

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans leading-relaxed">
      <style media="print">
        {`@page { size: A4 portrait; margin: 2cm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
      </style>

      {/* Header */}
      <div className="flex items-center gap-4 border-b-2 border-[#C13584]/30 pb-6 mb-8 mt-4">
        <h1 className="text-4xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
          agência<br />OCTO.
        </h1>
        <div className="h-12 w-px bg-gray-300 mx-2"></div>
        <div>
          <p className="text-xs font-bold tracking-widest text-gray-500 uppercase">Proposta de</p>
          <p className="text-2xl font-black tracking-tight text-[#C13584] uppercase mt-1">{proposal.service_type || 'Serviço'}</p>
        </div>
        <div className="ml-auto text-right text-xs text-gray-400">
          <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
          <p className="font-mono font-bold text-gray-600 mt-1">#{propId}</p>
        </div>
      </div>

      {/* Client info */}
      {client && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Preparado para</p>
          <p className="text-xl font-bold text-gray-900">{client.company_name || client.name}</p>
          {client.company_name && <p className="text-sm text-gray-600">{client.name}</p>}
        </div>
      )}

      <div className="space-y-10 text-gray-800 text-sm">
        {proposal.vision_text && (
          <section>
            <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">1. Visão Geral do Projeto</h3>
            <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(proposal.vision_text) }} />
          </section>
        )}
        {proposal.engine_text && (
          <section>
            <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">2. Especificações Técnicas (Engine)</h3>
            <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(proposal.engine_text) }} />
          </section>
        )}
        {proposal.scope_text && (
          <section>
            <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">3. Escopo de Entregas</h3>
            <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(proposal.scope_text) }} />
          </section>
        )}
        {phases.length > 0 && (
          <section>
            <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">4. Cronograma Estimado</h3>
            <p className="mb-4 text-gray-600">
              O projeto será executado em <strong>{phases.length} fases</strong>, totalizando <strong>{totalBusinessDays} dias úteis</strong>
              {proposal.start_date ? `, com início previsto para ${new Date(proposal.start_date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} e entrega prevista para ${endDateStr}` : ''}.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '2px solid #C13584' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#C13584', fontWeight: 700 }}>Fase</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Descrição</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((ph, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 12px', color: '#C13584', fontWeight: 700 }}>0{idx + 1}</td>
                    <td style={{ padding: '8px 12px' }}>{ph.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{ph.duration_days} dias úteis</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Print Gantt chart */}
            {(() => {
              const totalD = phases.reduce((a, p) => a + (p.duration_days || 0), 0);
              if (totalD === 0) return null;
              const colors = ['#C13584', '#9b5de5', '#0077b6', '#00b4d8', '#06d6a0', '#f77f00', '#e63946', '#457b9d'];
              let c = 0;
              const rows = phases.map((ph, idx) => {
                const s = c; c += ph.duration_days || 0;
                return { name: ph.name || `Fase ${idx + 1}`, days: ph.duration_days || 0, leftPct: (s / totalD) * 100, widthPct: ((ph.duration_days || 0) / totalD) * 100, color: colors[idx % colors.length] };
              });
              return (
                <div style={{ marginTop: '16px' }}>
                  {rows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '100px', flexShrink: 0, textAlign: 'right', fontSize: '11px', color: '#4b5563', paddingRight: '6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={row.name}>
                        {row.name}
                      </div>
                      <div style={{ flex: 1, height: '20px', backgroundColor: '#f3f4f6', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, height: '100%', left: `${row.leftPct}%`, width: `${row.widthPct}%`, backgroundColor: row.color, borderRadius: '4px', minWidth: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'white', fontWeight: 700, padding: '0 4px' }}>{row.days}d</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {proposal.start_date && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', display: 'flex', gap: '16px' }}>
                      <span>Início: <strong style={{ color: '#374151' }}>{new Date(proposal.start_date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
                      <span>Entrega: <strong style={{ color: '#374151' }}>{calculateBusinessEndDate(proposal.start_date, totalD)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}
        <section>
          <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">5. Investimento e Condições de Pagamento</h3>
          {proposal.investment_text && (
            <div className="mb-6 leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: rv(proposal.investment_text) }} />
          )}

          {upfrontPrice && (
            <div style={{ backgroundColor: '#ffe8cc', padding: '12px 16px', borderLeft: '4px solid #f97316', marginBottom: '1.5rem', color: '#1f2937', fontSize: '14px' }}>
              <strong>Condição Especial:</strong> Para pagamento à vista do valor total na entrada do projeto, será aplicado um <strong>desconto especial</strong>, com o valor total de investimento de <strong>R$ {Number(upfrontPrice.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '14px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>Valor Bruto</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>R$ {Number(proposal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
              {discountAmt > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>Desconto ({discountType === 'percent' ? `${discountRaw}%` : 'fixo'})</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>- R$ {discountAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#fdf2f8' }}>
                <td style={{ padding: '12px 12px', fontWeight: 800, fontSize: '15px' }}>Valor Total (Líquido)</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#C13584' }}>R$ {netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          {installments.length > 0 && (
            <>
              <p className="font-semibold text-gray-700 mb-3">Condições de Pagamento — {installments.length}x parcela(s):</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '2px solid #C13584' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#C13584', fontWeight: 700 }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Vencimento</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 12px', color: '#C13584', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px' }}>{new Date(inst.date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #C13584', backgroundColor: '#fdf2f8', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '10px 12px' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#C13584' }}>R$ {installments.reduce((a, b) => a + b.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
          <p className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400">
            Este documento é uma proposta comercial com validade de 15 dias a partir da data de emissão.
            Estamos prontos para iniciar o projeto imediatamente após a sua aprovação.
          </p>
        </section>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PROPOSALS VIEW
// -------------------------------------------------------------
function ProposalsView({ proposals, refetch, onEditProposal, onApproveProposal, onPrintProposal }: {
  proposals: { proposal: Proposal; client: Client | null }[];
  refetch: () => void;
  onEditProposal: (p: ProposalData) => void;
  onApproveProposal: (p: ProposalData) => void;
  onPrintProposal: (p: { proposal: Proposal; client: Client | null }) => void;
}) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const getStatusBadge = (status: ProposalStatus) => {
    switch (status) {
      case 'Draft': return <span className="px-2.5 py-1 bg-yellow-100/80 backdrop-blur-sm text-yellow-700 rounded-lg text-xs font-semibold">Rascunho</span>;
      case 'Sent': return <span className="px-2.5 py-1 bg-blue-100/80 backdrop-blur-sm text-blue-700 rounded-lg text-xs font-semibold">Enviado</span>;
      case 'Approved': return <span className="px-2.5 py-1 bg-green-100/80 backdrop-blur-sm text-green-700 rounded-lg text-xs font-semibold">Aprovado</span>;
      case 'Rejected': return <span className="px-2.5 py-1 bg-red-100/80 backdrop-blur-sm text-red-700 rounded-lg text-xs font-semibold">Rejeitado</span>;
      default: return null;
    }
  };

  const proposalNumber = (id: string) => id.replace(/-/g, '').substring(0, 6).toUpperCase();

  const filtered = proposals.filter(p => {
    const q = search.toLowerCase();
    return (
      proposalNumber(p.proposal.id).toLowerCase().includes(q) ||
      (p.client?.name || '').toLowerCase().includes(q) ||
      (p.proposal.service_type || '').toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id: string, clientName: string) => {
    if (confirm(`Tem certeza que deseja apagar a proposta do cliente ${clientName}?`)) {
      setIsDeleting(id);
      await supabase.from('proposals').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 border-b border-white/40 flex justify-between items-center bg-white/20 backdrop-blur-md">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente ou serviço..."
            className="pl-4 pr-10 py-2 border border-white/60 bg-white/40 backdrop-blur-sm rounded-xl text-sm w-80 focus:outline-none focus:ring-2 focus:ring-[#C13584] focus:bg-white/80 transition-all shadow-inner"
          />
        </div>
        <button className="flex items-center gap-2 text-sm text-gray-600 border border-white/60 bg-white/40 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors font-medium shadow-sm">
          <Filter size={16} />
          Filtrar
        </button>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/30 backdrop-blur-md border-b border-white/40 text-sm text-gray-500">
            <th className="p-4 pl-6 font-medium w-24">Nº</th>
            <th className="p-4 font-medium">Cliente</th>
            <th className="p-4 font-medium">Serviço</th>
            <th className="p-4 font-medium">Valor</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-500">
                {search ? `Nenhuma proposta encontrada para "${search}".` : 'Nenhuma proposta cadastrada ainda.'}
              </td>
            </tr>
          ) : (
            filtered.map((p) => (
              <tr key={p.proposal.id} className="border-b border-white/30 hover:bg-white/40 transition-colors">
                <td className="p-4 pl-6">
                  <span className="inline-block font-mono font-bold text-xs text-[#C13584] bg-pink-50 border border-pink-100 px-2 py-1 rounded-lg tracking-widest">
                    #{proposalNumber(p.proposal.id)}
                  </span>
                </td>
                <td className="p-4 font-medium text-gray-800">
                  {p.client?.name || 'Cliente Removido'}
                  <div className="text-xs text-gray-500 font-normal mt-1">{new Date(p.proposal.created_at).toLocaleDateString('pt-BR')}</div>
                </td>
                <td className="p-4 text-gray-600 font-medium">
                  {p.proposal.service_type}
                </td>
                <td className="p-4 font-medium text-gray-700">
                  <span className="whitespace-nowrap">R$ {Number(p.proposal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </td>
                <td className="p-4">
                  {getStatusBadge(p.proposal.status)}
                </td>
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-3 text-gray-400">
                    {p.proposal.status !== 'Approved' && (
                      <button onClick={() => onApproveProposal(p)} className="hover:text-green-600 transition-colors cursor-pointer" title="Aprovar Proposta">
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button onClick={() => onPrintProposal(p)} className="hover:text-blue-500 transition-colors cursor-pointer" title="Imprimir / Gerar PDF">
                      <Printer size={16} />
                    </button>
                    <button onClick={() => onEditProposal(p)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button disabled={isDeleting === p.proposal.id} onClick={() => handleDelete(p.proposal.id, p.client?.name || 'Cliente')} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                      {isDeleting === p.proposal.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------
// CASHFLOW CATEGORIES VIEW
// -------------------------------------------------------------
function CashFlowCategoriesView({ categories, refetch }: { categories: CashFlowCategoryRecord[], refetch: () => void }) {
  const [tab, setTab] = useState<'Income' | 'Expense'>('Income');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = categories.filter(c => c.type === tab);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from('cash_flow_categories').insert({ name: newName.trim(), type: tab, color: newColor });
    setNewName('');
    setNewColor('#6B7280');
    refetch();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    setDeleting(id);
    await supabase.from('cash_flow_categories').delete().eq('id', id);
    refetch();
    setDeleting(null);
  };

  const PRESET_COLORS = ['#C13584', '#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#F97316', '#64748B', '#6B7280'];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-2 bg-white/50 backdrop-blur-md rounded-2xl p-1.5 border border-white/60 shadow-sm w-fit">
        {(['Income', 'Expense'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${tab === t
              ? t === 'Income' ? 'bg-green-500 text-white shadow-md' : 'bg-red-500 text-white shadow-md'
              : 'text-gray-500 hover:bg-white/60'
              }`}>
            {t === 'Income' ? '➕ Receitas' : '➖ Despesas'}
          </button>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 p-6 shadow-sm">
        <h4 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wider">
          Nova categoria de {tab === 'Income' ? 'Receita' : 'Despesa'}
        </h4>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required
              placeholder={tab === 'Income' ? 'Ex: Mensalidade, Consultoria...' : 'Ex: Aluguel, Fornecedor...'}
              className="w-full border border-white/60 rounded-xl px-4 py-2.5 text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#C13584]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cor</label>
            <div className="flex gap-1.5 flex-wrap w-48">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-all cursor-pointer ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'
                    }`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-[#C13584] to-[#a42b6f] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-md flex-shrink-0">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Adicionar
          </button>
        </form>
      </div>

      {/* Category list */}
      <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20">
          <p className="text-sm font-semibold text-gray-600">{filtered.length} categoria{filtered.length !== 1 ? 's' : ''} de {tab === 'Income' ? 'Receita' : 'Despesa'}</p>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhuma categoria cadastrada ainda.</div>
        ) : (
          <ul className="divide-y divide-white/30">
            {filtered.map(cat => (
              <li key={cat.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                </div>
                <button onClick={() => handleDelete(cat.id)} disabled={deleting === cat.id}
                  className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-1">
                  {deleting === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CASHFLOW ALL VIEW (all records with multi-select + bulk actions)
// -------------------------------------------------------------
function CashFlowAllView({ cashFlows, cashFlowCategories, onEditCashFlow, refetch }: {
  cashFlows: CashFlow[];
  cashFlowCategories: CashFlowCategoryRecord[];
  onEditCashFlow: (c: CashFlow) => void;
  refetch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Income' | 'Expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Paid' | 'Pending'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filtered = cashFlows.filter(c => {
    const matchSearch = !search || (c.description || '').toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.type === filterType;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchCategory = filterCategory === 'all' || c.category === filterCategory;
    return matchSearch && matchType && matchStatus && matchCategory;
  });

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSingleDelete = async (c: CashFlow) => {
    if (!confirm(`Excluir "${c.description || 'sem descrição'}"?`)) return;
    setIsDeleting(c.id);
    await supabase.from('cash_flow').delete().eq('id', c.id);
    setSelected(prev => { const n = new Set(prev); n.delete(c.id); return n; });
    refetch();
    setIsDeleting(null);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selected.size} lançamento(s) selecionado(s)?`)) return;
    setIsBulkDeleting(true);
    const ids = Array.from(selected);
    await supabase.from('cash_flow').delete().in('id', ids);
    setSelected(new Set());
    refetch();
    setIsBulkDeleting(false);
  };

  const handleBulkStatus = async (status: 'Paid' | 'Pending') => {
    setIsBulkUpdating(true);
    const ids = Array.from(selected);
    await supabase.from('cash_flow').update({ status }).in('id', ids);
    setSelected(new Set());
    refetch();
    setIsBulkUpdating(false);
  };

  const uniqueCategories = [...new Set(cashFlows.map(c => c.category))].sort();

  return (
    <div className="flex flex-col gap-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por descrição ou categoria..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/60 border border-white/60 rounded-xl backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#C13584]" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          className="text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C13584] backdrop-blur-sm cursor-pointer">
          <option value="all">Todos os tipos</option>
          <option value="Income">Receitas</option>
          <option value="Expense">Despesas</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C13584] backdrop-blur-sm cursor-pointer">
          <option value="all">Todos os status</option>
          <option value="Paid">Pago</option>
          <option value="Pending">Pendente</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C13584] backdrop-blur-sm cursor-pointer">
          <option value="all">Todas as categorias</option>
          {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#C13584]/10 to-purple-500/10 border border-[#C13584]/20 rounded-xl backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold text-[#C13584]">{selected.size} selecionado(s)</span>
          <div className="flex-1" />
          <button onClick={() => handleBulkStatus('Paid')} disabled={isBulkUpdating}
            className="px-4 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
            {isBulkUpdating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            Marcar como Pago
          </button>
          <button onClick={() => handleBulkStatus('Pending')} disabled={isBulkUpdating}
            className="px-4 py-1.5 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
            {isBulkUpdating ? <Loader2 size={13} className="animate-spin" /> : <AlertCircle size={13} />}
            Marcar como Pendente
          </button>
          <button onClick={handleBulkDelete} disabled={isBulkDeleting}
            className="px-4 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
            {isBulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Excluir Selecionados
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-600 cursor-pointer text-sm">Cancelar</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-white/40 bg-white/20 flex items-center gap-2">
          <p className="text-xs text-gray-500 font-medium">{filtered.length} lançamento(s) encontrado(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="p-3 pl-4 text-left w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="w-4 h-4 rounded accent-[#C13584] cursor-pointer" />
                </th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Descrição</th>
                <th className="p-3 text-left">Categoria</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 pr-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/60">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-gray-400 text-sm">Nenhum lançamento encontrado.</td></tr>
              ) : (
                filtered.map(c => {
                  const catRecord = cashFlowCategories.find(cat => cat.name === c.category);
                  const color = catRecord?.color || '#6B7280';
                  const isSelected = selected.has(c.id);
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/80 transition-colors ${isSelected ? 'bg-pink-50/40' : ''}`}>
                      <td className="p-3 pl-4">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(c.id)}
                          className="w-4 h-4 rounded accent-[#C13584] cursor-pointer" />
                      </td>
                      <td className="p-3 text-gray-500 whitespace-nowrap font-medium">{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-gray-800 max-w-[200px] truncate">{c.description || <span className="text-gray-400 italic">Sem descrição</span>}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                          style={{ backgroundColor: color + '1A', color, border: `1px solid ${color}40` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {c.category}
                        </span>
                      </td>
                      <td className="p-3">
                        {c.type === 'Income'
                          ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">Receita</span>
                          : <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Despesa</span>}
                      </td>
                      <td className={`p-3 text-right font-semibold whitespace-nowrap ${c.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                        {c.type === 'Income' ? '+' : '-'} R$ {fmtBRL(Number(c.value))}
                      </td>
                      <td className="p-3 text-center">
                        {c.status === 'Paid'
                          ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">Pago</span>
                          : <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold">Pendente</span>}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-3 text-gray-400">
                          <button onClick={() => onEditCashFlow(c)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleSingleDelete(c)} disabled={isDeleting === c.id} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                            {isDeleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CASHFLOW VIEW
// -------------------------------------------------------------
function CashFlowView({ cashFlows, cashFlowCategories, onEditCashFlow, refetch }: {
  cashFlows: CashFlow[];
  cashFlowCategories: CashFlowCategoryRecord[];
  onEditCashFlow: (c: CashFlow) => void;
  refetch: () => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (c: CashFlow) => {
    if (!confirm(`Excluir o lançamento "${c.description || 'sem descrição'}"?`)) return;
    setIsDeleting(c.id);
    await supabase.from('cash_flow').delete().eq('id', c.id);
    refetch();
    setIsDeleting(null);
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const filteredCashFlows = cashFlows.filter(c => {
    const d = new Date(c.date + 'T00:00:00'); // Parse as local timezone to avoid UTC shift
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthName = monthNames[currentMonth];

  // Calculate totals for the viewed month
  const totalIncome = filteredCashFlows.filter(c => c.type === 'Income').reduce((acc, curr) => acc + curr.value, 0);
  const totalExpense = filteredCashFlows.filter(c => c.type === 'Expense').reduce((acc, curr) => acc + curr.value, 0);
  const balance = totalIncome - totalExpense;

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Navigation Header */}
      <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-4 flex justify-between items-center">
        <h3 className="font-semibold text-lg text-gray-800">Fluxo de Caixa</h3>
        <div className="flex items-center gap-4">
          <button onClick={handleCurrentMonth} className="px-4 py-1.5 text-xs font-medium bg-white/60 border border-white/80 rounded-lg hover:bg-white text-gray-600 transition-colors shadow-sm">
            Mês Atual
          </button>
          <div className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-xl p-1 shadow-sm">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-500 cursor-pointer">
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-sm w-32 text-center text-gray-700">
              {monthName} {currentYear}
            </span>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-500 cursor-pointer">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Receitas do Mês</p>
          <p className="text-2xl font-bold text-green-600">R$ {fmtBRL(totalIncome)}</p>
        </div>
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Despesas do Mês</p>
          <p className="text-2xl font-bold text-red-500">R$ {fmtBRL(totalExpense)}</p>
        </div>
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Saldo do Mês</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-[#C13584]' : 'text-red-600'}`}>R$ {fmtBRL(balance)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/30 backdrop-blur-md border-b border-white/40 text-sm text-gray-500">
              <th className="p-4 pl-6 font-medium">Data</th>
              <th className="p-4 font-medium">Descrição</th>
              <th className="p-4 font-medium">Categoria</th>
              <th className="p-4 font-medium">Valor</th>
              <th className="p-4 font-medium text-right">Status</th>
              <th className="p-4 pr-6 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredCashFlows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">Nenhum lançamento no fluxo de caixa para este mês.</td>
              </tr>
            ) : (
              filteredCashFlows.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                  <td className="p-4 pl-6 text-gray-500 font-medium whitespace-nowrap">{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 font-medium text-gray-800">{c.description || '-'}</td>
                  <td className="p-4">
                    {(() => {
                      const catRecord = cashFlowCategories.find(cat => cat.name === c.category);
                      const color = catRecord?.color || '#6B7280';
                      return (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
                          style={{ backgroundColor: color + '1A', color, border: `1px solid ${color}40` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {c.category}
                        </span>
                      );
                    })()}
                  </td>
                  <td className={`p-4 font-semibold whitespace-nowrap ${c.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                    {c.type === 'Income' ? '+' : '-'} R$ {fmtBRL(Number(c.value))}
                  </td>
                  <td className="p-4 text-right">
                    {c.status === 'Paid' ? (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold inline-block">Pago</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold inline-block">Pendente</span>
                    )}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      <button onClick={() => onEditCashFlow(c)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={isDeleting === c.id} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                        {isDeleting === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PROPOSAL FORM VIEW (Create/Edit full page form)
// -------------------------------------------------------------
function ProposalFormView({ proposalData, services, clients, onSave, onCancel, onApprove, onPrint }: {
  proposalData: { proposal: Proposal; client: Client | null } | null;
  services: Service[];
  clients: Client[];
  onSave: () => void;
  onCancel: () => void;
  onApprove: (p: ProposalData) => void;
  onPrint?: (proposal: Proposal, client: Client | null) => void;
}) {
  const [loading, setLoading] = useState(false);

  const isEditing = !!proposalData;

  // Client selection: 'existing' or 'new'
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(proposalData?.client ? 'existing' : 'new');
  const [selectedClientId, setSelectedClientId] = useState<string>(proposalData?.client?.id || '');
  const [clientName, setClientName] = useState(proposalData?.client?.name || '');

  const [serviceId, setServiceId] = useState<string>(proposalData?.proposal.service_id || '');
  const [serviceTypeStr, setServiceTypeStr] = useState<string>(proposalData?.proposal.service_type || 'Custom');
  const [value, setValue] = useState(proposalData?.proposal.value.toString() || '');
  const [status, setStatus] = useState<ProposalStatus>(proposalData?.proposal.status || 'Draft');

  const [visionText, setVisionText] = useState(proposalData?.proposal.vision_text || '');
  const [engineText, setEngineText] = useState(proposalData?.proposal.engine_text || '');
  const [scopeText, setScopeText] = useState(proposalData?.proposal.scope_text || '');
  const [investmentText, setInvestmentText] = useState(proposalData?.proposal.investment_text || '');
  const [startDate, setStartDate] = useState(proposalData?.proposal.start_date || '');
  const [phases, setPhases] = useState<ProposalPhase[]>(proposalData?.proposal.project_phases || []);

  // Discount
  const savedContent = proposalData?.proposal.content_json as Record<string, unknown> | null;
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>((savedContent?.discountType as 'fixed' | 'percent') || 'fixed');
  const [discountRaw, setDiscountRaw] = useState<string>((savedContent?.discountValue as string) || '0');
  const [upfrontPrice, setUpfrontPrice] = useState<string>((savedContent?.upfrontPrice as string) || '');

  // Installments
  const [numInstallments, setNumInstallments] = useState<number>((savedContent?.numInstallments as number) || 1);
  const [installments, setInstallments] = useState<{ date: string; value: number }[]>(
    (savedContent?.installments as { date: string; value: number }[]) || []
  );

  const handleApplyService = (id: string) => {
    setServiceId(id);
    const s = services.find(x => x.id === id);
    if (s) {
      setServiceTypeStr(s.name);
      setValue(s.base_price.toString());
      setVisionText(s.vision_template || '');
      setEngineText(s.engine_template || '');
      setScopeText(s.scope_template || '');
      setInvestmentText(s.investment_template || '');
      setPhases(s.phases_template || []);
    }
  };

  const addPhase = () => setPhases([...phases, { name: '', duration_days: 0 }]);
  const updatePhase = (index: number, field: keyof ProposalPhase, val: string | number) => {
    const newPhases = [...phases];
    newPhases[index] = { ...newPhases[index], [field]: val };
    setPhases(newPhases);
  };
  const removePhase = (index: number) => setPhases(phases.filter((_, i) => i !== index));

  // --- Computed discount / net value ---
  const grossValue = parseFloat(value) || 0;
  const discountAmt = discountType === 'percent'
    ? grossValue * (parseFloat(discountRaw) || 0) / 100
    : (parseFloat(discountRaw) || 0);
  const netValue = Math.max(0, grossValue - discountAmt);
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalBusinessDays = phases.reduce((acc, ph) => acc + (ph.duration_days || 0), 0);
  const endDateStr = startDate && totalBusinessDays > 0
    ? calculateBusinessEndDate(startDate, totalBusinessDays)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) || ''
    : '';

  const addBusinessDays = (startDate: Date, calendarDays: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + calendarDays);
    return d.toISOString().split('T')[0];
  };

  const generateInstallments = (net: number, n: number) => {
    const today = new Date();
    const base = parseFloat((net / n).toFixed(2));
    const last = parseFloat((net - base * (n - 1)).toFixed(2));
    return Array.from({ length: n }, (_, i) => ({
      date: addBusinessDays(today, i * 30),
      value: i === n - 1 ? last : base
    }));
  };

  const handleGenerateInstallments = () => {
    setInstallments(generateInstallments(netValue, numInstallments));
  };

  const handleInstallmentValueChange = (index: number, newVal: number) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], value: newVal };
    const sumFixed = updated.slice(0, index + 1).reduce((a, b) => a + b.value, 0);
    const remaining = parseFloat((netValue - sumFixed).toFixed(2));
    const remainingCount = updated.length - index - 1;
    if (remainingCount > 0) {
      const base = parseFloat((remaining / remainingCount).toFixed(2));
      const lastAdj = parseFloat((remaining - base * (remainingCount - 1)).toFixed(2));
      for (let j = index + 1; j < updated.length; j++) {
        updated[j] = { ...updated[j], value: j === updated.length - 1 ? lastAdj : base };
      }
    }
    setInstallments(updated);
  };

  const handleInstallmentDateChange = (index: number, newDate: string) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], date: newDate };
    setInstallments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const numericValue = parseFloat(value.replace(',', '.'));

      const payload = {
        service_id: serviceId || null,
        service_type: serviceTypeStr,
        value: numericValue,
        status: status,
        vision_text: visionText,
        engine_text: engineText,
        scope_text: scopeText,
        investment_text: investmentText,
        start_date: startDate ? startDate : null,
        project_phases: phases,
        content_json: { discountType, discountValue: discountRaw, discountAmt, netValue, numInstallments, installments, upfrontPrice }
      };

      let clientId = selectedClientId;

      if (isEditing && proposalData.proposal) {
        // In edit mode, if client mode is 'existing' just use the selected client
        if (clientMode === 'new' && clientName) {
          const { data: nc, error: ce } = await supabase.from('clients').insert({ name: clientName }).select().single();
          if (ce) throw ce;
          clientId = nc.id;
        }
        const { error: proposalError } = await supabase.from('proposals').update({ ...payload, client_id: clientId || proposalData.proposal.client_id }).eq('id', proposalData.proposal.id);
        if (proposalError) throw proposalError;
      } else {
        if (clientMode === 'new') {
          const { data: newClient, error: clientError } = await supabase.from('clients').insert({ name: clientName }).select().single();
          if (clientError) throw clientError;
          clientId = newClient.id;
        }
        if (!clientId) throw new Error('Selecione ou crie um cliente.');
        const { error: proposalError } = await supabase.from('proposals').insert({ ...payload, client_id: clientId });
        if (proposalError) throw proposalError;
      }

      onSave();
    } catch (err) {
      console.error('Error with proposal:', err);
      alert(`Erro ao salvar proposta: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!onPrint) { window.print(); return; }
    const syntheticProposal: Proposal = {
      id: proposalData?.proposal.id || 'draft-preview',
      client_id: proposalData?.proposal.client_id || '',
      service_id: serviceId || null,
      service_type: serviceTypeStr,
      value: parseFloat(value) || 0,
      status,
      vision_text: visionText,
      engine_text: engineText,
      scope_text: scopeText,
      investment_text: investmentText,
      project_phases: phases,
      start_date: startDate || null,
      content_json: { discountType, discountValue: discountRaw, discountAmt, netValue, numInstallments, installments, upfrontPrice },
      created_at: proposalData?.proposal.created_at || new Date().toISOString(),
    };
    const syntheticClient: Client | null = clientMode === 'existing'
      ? (clients.find(c => c.id === selectedClientId) || null)
      : (clientName ? { id: '', name: clientName, email: null, whatsapp: null, phone: null, cnpj: null, company_name: null, website: null, segment: null, city: null, state: null, funnel_stage: null, lead_source: null, notes: null, estimated_value: null, next_follow_up: null, tags: null, created_at: new Date().toISOString() } : null);
    onPrint(syntheticProposal, syntheticClient);
  };

  return (
    <>
      <div className="bg-white/50 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden max-w-4xl mx-auto print:hidden">
        <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
          <h3 className="font-semibold text-xl text-gray-800">
            {isEditing ? 'Editar Proposta' : 'Criar Nova Proposta'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">Defina o escopo, projeto e valores.</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* CLIENT SECTION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setClientMode('existing')} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${clientMode === 'existing' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-gray-600 border-white/60 hover:bg-white/60'}`}>
                  Selecionar Existente
                </button>
                <button type="button" onClick={() => setClientMode('new')} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${clientMode === 'new' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-gray-600 border-white/60 hover:bg-white/60'}`}>
                  + Novo Cliente
                </button>
              </div>
              {clientMode === 'existing' ? (
                <select
                  required
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner text-gray-800"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` — ${c.company_name}` : ''}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type="text"
                  placeholder="Nome do novo cliente..."
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serviço Base (Carrega o Modelo)</label>
                <select
                  value={serviceId}
                  onChange={e => handleApplyService(e.target.value)}
                  className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner text-gray-800"
                >
                  <option value="">Selecione para carregar informações...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.base_price}</option>)}
                </select>
              </div>
            </div>

            {/* INVESTMENT & PAYMENT */}
            <div className="flex flex-col gap-5 p-6 bg-white/30 rounded-2xl border border-white/50">
              <h4 className="font-semibold text-gray-800 text-lg">Investimento e Condições de Pagamento</h4>

              {/* Gross value + status + start date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Bruto (R$)</label>
                  <CurrencyInput required value={value} onChange={setValue} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as ProposalStatus)}
                    className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner text-gray-800">
                    <option value="Draft">Rascunho</option>
                    <option value="Sent">Enviado</option>
                    <option value="Approved">Aprovado</option>
                    <option value="Rejected">Rejeitado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial (Cronograma)</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner" />
                </div>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Desconto</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDiscountType('fixed')}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${discountType === 'fixed' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-gray-600 border-white/60'}`}>
                      R$ Fixo
                    </button>
                    <button type="button" onClick={() => setDiscountType('percent')}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${discountType === 'percent' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-gray-600 border-white/60'}`}>
                      % Percentual
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
                  </label>
                  {discountType === 'percent' ? (
                    <div className="relative">
                      <input type="number" step="0.01" min="0" max="100" value={discountRaw} onChange={e => setDiscountRaw(e.target.value)}
                        className="w-full border border-white/60 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">%</span>
                    </div>
                  ) : (
                    <CurrencyInput value={discountRaw} onChange={setDiscountRaw} />
                  )}
                </div>
                <div className="bg-gradient-to-r from-[#C13584]/10 to-[#a42b6f]/10 rounded-xl p-4 border border-[#C13584]/20">
                  <p className="text-xs text-gray-500 mb-1">Valor Líquido Final</p>
                  <p className="text-2xl font-bold text-[#C13584]">R$ {fmtBRL(netValue)}</p>
                  {discountAmt > 0 && <p className="text-xs text-gray-500 mt-1">Desconto: R$ {fmtBRL(discountAmt)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Especial à Vista (Opcional)</label>
                  <CurrencyInput
                    value={upfrontPrice}
                    onChange={setUpfrontPrice}
                    className="w-full !border-orange-300 focus:!ring-orange-500 shadow-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Gera um quadro de destaque na proposta impressa.</p>
                </div>
              </div>

              {/* Installments */}
              <div>
                <div className="flex items-end gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número de Parcelas</label>
                    <select value={numInstallments} onChange={e => setNumInstallments(parseInt(e.target.value))}
                      className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner text-gray-800">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <option key={n} value={n}>{n}x de R$ {fmtBRL(netValue / n)}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={handleGenerateInstallments}
                    className="px-5 py-3 bg-[#C13584] text-white rounded-xl text-sm font-semibold hover:bg-[#a42b6f] transition-colors cursor-pointer shadow-sm whitespace-nowrap">
                    Gerar Parcelas
                  </button>
                </div>

                {installments.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-white/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/40 border-b border-white/40 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 text-left w-12">#</th>
                          <th className="px-4 py-3 text-left">Data de Vencimento</th>
                          <th className="px-4 py-3 text-left">Valor (R$)</th>
                          <th className="px-4 py-3 text-right">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst, i) => (
                          <tr key={i} className={`border-b border-white/30 ${i % 2 === 0 ? 'bg-white/20' : 'bg-white/10'}`}>
                            <td className="px-4 py-3 font-bold text-[#C13584]">{i + 1}</td>
                            <td className="px-4 py-2">
                              <input type="date" value={inst.date} onChange={e => handleInstallmentDateChange(i, e.target.value)}
                                className="border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60 focus:outline-none focus:ring-1 focus:ring-[#C13584]" />
                            </td>
                            <td className="px-4 py-2">
                              <CurrencyInput
                                value={inst.value.toString()}
                                onChange={v => handleInstallmentValueChange(i, parseFloat(v) || 0)}
                                className="!w-36 !rounded-lg"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {netValue > 0 ? ((inst.value / netValue) * 100).toFixed(1) : '0'}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white/40 border-t border-white/50 font-semibold">
                          <td colSpan={2} className="px-4 py-3 text-gray-700">Total</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${Math.abs(installments.reduce((a, b) => a + b.value, 0) - netValue) > 0.05
                              ? 'text-red-500' : 'text-green-600'
                              }`}>
                              R$ {fmtBRL(installments.reduce((a, b) => a + b.value, 0))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-white/50" />
            <h4 className="font-semibold text-lg text-gray-800">Modelo de Orçamento</h4>

            <div className="flex flex-col gap-6 relative z-0">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visão do Projeto</label>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                  <Editor value={visionText} onChange={(e) => setVisionText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Especificações Técnicas (Engine)</label>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                  <Editor value={engineText} onChange={(e) => setEngineText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Escopo de Entregas</label>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                  <Editor value={scopeText} onChange={(e) => setScopeText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Definições de Investimento</label>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                  <Editor value={investmentText} onChange={(e) => setInvestmentText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
            </div>

            <hr className="border-white/50" />
            <div className="flex justify-between items-center mb-0">
              <h4 className="font-semibold text-lg text-gray-800">Cronograma e Fases</h4>
              <button type="button" onClick={addPhase} className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer">Adicionar Fase</button>
            </div>

            <div className="flex flex-col gap-3">
              {phases.length === 0 ? <p className="text-sm text-gray-500 italic">Sem fases definidas.</p> : phases.map((ph, i) => (
                <div key={i} className="flex gap-4 items-center bg-white/30 p-3 rounded-xl border border-white/40">
                  <input type="text" placeholder="Nome da fase..." value={ph.name} onChange={e => updatePhase(i, 'name', e.target.value)} className="flex-1 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="Dias" value={ph.duration_days} onChange={e => updatePhase(i, 'duration_days', parseInt(e.target.value) || 0)} className="w-20 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                    <span className="text-xs text-gray-500">Dias Úteis</span>
                  </div>
                  <button type="button" onClick={() => removePhase(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            {phases.length > 0 && <GanttChart phases={phases} startDate={startDate} />}

            <div className="mt-4 flex justify-between items-center gap-3 pt-6 border-t border-white/40">
              <div className="flex items-center gap-3">
                {isEditing && (
                  <button type="button" onClick={handlePrint} className="px-6 py-3 border border-[#C13584]/30 text-[#C13584] bg-white text-sm font-semibold hover:bg-pink-50 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 rounded-xl">
                    <Printer size={18} /> Imprimir PDF
                  </button>
                )}
                {isEditing && proposalData?.proposal.status !== 'Approved' && (
                  <button type="button" onClick={() => onApprove(proposalData!)}
                    className="px-6 py-3 border border-green-500/40 text-green-600 bg-white text-sm font-semibold hover:bg-green-50 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 rounded-xl">
                    <CheckCircle size={18} /> Aprovar Proposta
                  </button>
                )}
              </div>
              <div className="flex gap-3 items-center">
                <button type="button" onClick={onCancel} className="px-6 py-3 border border-white/60 bg-white/40 text-gray-700 rounded-xl text-sm font-medium hover:bg-white/60 transition-colors shadow-sm cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#C13584] to-[#a42b6f] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {isEditing ? 'Atualizar Proposta' : 'Salvar Proposta'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* PRINT LAYOUT (Hidden on screen, visible on print) */}
      {/* Build template variable map for resolution */}
      {(() => {
        const clientDisplayName = clientMode === 'existing'
          ? (proposalData?.client?.company_name || proposalData?.client?.name || clientName)
          : clientName;
        const templateVarMap: Record<string, string> = {
          NOME_CLIENTE: clientName || proposalData?.client?.name || '',
          EMPRESA_CLIENTE: proposalData?.client?.company_name || '',
          SERVICO: serviceTypeStr || '',
          VALOR_BRUTO: `R$ ${(parseFloat(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          VALOR_LIQUIDO: `R$ ${netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          DATA_INICIO: startDate ? new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
          NUM_PARCELAS: String(installments.length || numInstallments),
          DATA_HOJE: new Date().toLocaleDateString('pt-BR'),
        };
        const rv = (text: string) => resolveVars(text, templateVarMap);
        return (
          <div className="hidden print:block w-full bg-white text-black font-sans leading-relaxed">
            <style media="print">
              {`@page { size: A4 portrait; margin: 2cm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
            </style>

            {/* Header */}
            <div className="flex items-center gap-4 border-b-2 border-[#C13584]/30 pb-6 mb-8 mt-4">
              <h1 className="text-4xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
                agência<br />OCTO.
              </h1>
              <div className="h-12 w-px bg-gray-300 mx-2"></div>
              <div>
                <p className="text-xs font-bold tracking-widest text-gray-500 uppercase">Proposta de</p>
                <p className="text-2xl font-black tracking-tight text-[#C13584] uppercase mt-1">{serviceTypeStr || 'Serviço'}</p>
              </div>
              <div className="ml-auto text-right text-xs text-gray-400">
                <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                {isEditing && proposalData?.proposal && (
                  <p className="font-mono font-bold text-gray-600 mt-1">
                    #{proposalData.proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            {/* Client info */}
            {isEditing && proposalData?.proposal && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Preparado para</p>
                <p className="text-xl font-bold text-gray-900">{clientDisplayName}</p>
                {proposalData.client?.company_name && (
                  <p className="text-sm text-gray-600">{proposalData.client.name}</p>
                )}
              </div>
            )}

            <div className="space-y-10 text-gray-800 text-sm">

              {/* 1 - Vision */}
              {visionText && (
                <section>
                  <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">1. Visão Geral do Projeto</h3>
                  <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(visionText) }}></div>
                </section>
              )}

              {/* 2 - Engine */}
              {engineText && (
                <section>
                  <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">2. Especificações Técnicas (Engine)</h3>
                  <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(engineText) }}></div>
                </section>
              )}

              {/* 3 - Scope */}
              {scopeText && (
                <section>
                  <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">3. Escopo de Entregas</h3>
                  <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(scopeText) }}></div>
                </section>
              )}

              {/* 4 - Schedule */}
              {phases.length > 0 && (
                <section>
                  <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">4. Cronograma Estimado</h3>
                  <p className="mb-4 text-gray-600">
                    O projeto será executado em <strong>{phases.length} fases</strong>, totalizando <strong>{totalBusinessDays} dias úteis</strong>
                    {startDate ? `, com início previsto para ${new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} e entrega prevista para ${endDateStr}` : ''}.
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '2px solid #C13584' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#C13584', fontWeight: 700 }}>Fase</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Descrição</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Prazo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phases.map((ph, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '8px 12px', color: '#C13584', fontWeight: 700 }}>0{idx + 1}</td>
                          <td style={{ padding: '8px 12px' }}>{ph.name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{ph.duration_days} dias úteis</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Print Gantt chart */}
                  {(() => {
                    const totalD = phases.reduce((a, p) => a + (p.duration_days || 0), 0);
                    if (totalD === 0) return null;
                    const colors = ['#C13584', '#9b5de5', '#0077b6', '#00b4d8', '#06d6a0', '#f77f00', '#e63946', '#457b9d'];
                    let c = 0;
                    const rows = phases.map((ph, idx) => {
                      const s = c; c += ph.duration_days || 0;
                      return { name: ph.name || `Fase ${idx + 1}`, days: ph.duration_days || 0, leftPct: (s / totalD) * 100, widthPct: ((ph.duration_days || 0) / totalD) * 100, color: colors[idx % colors.length] };
                    });
                    return (
                      <div style={{ marginTop: '16px' }}>
                        {rows.map((row, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ width: '100px', flexShrink: 0, textAlign: 'right', fontSize: '11px', color: '#4b5563', paddingRight: '6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={row.name}>
                              {row.name}
                            </div>
                            <div style={{ flex: 1, height: '20px', backgroundColor: '#f3f4f6', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', top: 0, height: '100%', left: `${row.leftPct}%`, width: `${row.widthPct}%`, backgroundColor: row.color, borderRadius: '4px', minWidth: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '9px', color: 'white', fontWeight: 700, padding: '0 4px' }}>{row.days}d</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {startDate && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', display: 'flex', gap: '16px' }}>
                            <span>Início: <strong style={{ color: '#374151' }}>{new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
                            <span>Entrega: <strong style={{ color: '#374151' }}>{calculateBusinessEndDate(startDate, totalD)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </section>
              )}

              {/* 5 - Investment */}
              <section>
                <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">5. Investimento e Condições de Pagamento</h3>

                {/* Optional investment text */}
                {investmentText && (
                  <div className="mb-6 leading-relaxed text-gray-700" dangerouslySetInnerHTML={{
                    __html: resolveVars(investmentText, {
                      NOME_CLIENTE: clientName || proposalData?.client?.name || '',
                      EMPRESA_CLIENTE: proposalData?.client?.company_name || '',
                      SERVICO: serviceTypeStr || '',
                      VALOR_BRUTO: `R$ ${(parseFloat(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      VALOR_LIQUIDO: `R$ ${netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      DATA_INICIO: startDate ? new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
                      NUM_PARCELAS: String(installments.length || numInstallments),
                      DATA_HOJE: new Date().toLocaleDateString('pt-BR'),
                    })
                  }}></div>
                )}

                {upfrontPrice && (
                  <div style={{ backgroundColor: '#ffe8cc', padding: '12px 16px', borderLeft: '4px solid #f97316', marginBottom: '1.5rem', color: '#1f2937', fontSize: '14px' }}>
                    <strong>Condição Especial:</strong> Para pagamento à vista do valor total na entrada do projeto, será aplicado um <strong>desconto especial</strong>, com o valor total de investimento de <strong>R$ {Number(upfrontPrice.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                  </div>
                )}

                {/* Value summary table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '14px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>Valor Bruto</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                        R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {discountAmt > 0 && (
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                          Desconto ({discountType === 'percent' ? `${discountRaw}%` : 'fixo'})
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                          - R$ {discountAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#fdf2f8' }}>
                      <td style={{ padding: '12px 12px', fontWeight: 800, fontSize: '15px' }}>Valor Total (Líquido)</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#C13584' }}>
                        R$ {netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Installments table */}
                {installments.length > 0 && (
                  <>
                    <p className="font-semibold text-gray-700 mb-3">Condições de Pagamento — {installments.length}x parcela(s):</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '2px solid #C13584' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: '#C13584', fontWeight: 700 }}>#</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Vencimento</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '8px 12px', color: '#C13584', fontWeight: 700 }}>{i + 1}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {new Date(inst.date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                              R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #C13584', backgroundColor: '#fdf2f8', fontWeight: 700 }}>
                          <td colSpan={2} style={{ padding: '10px 12px' }}>Total</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#C13584' }}>
                            R$ {installments.reduce((a, b) => a + b.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}

                <p className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400">
                  Este documento é uma proposta comercial com validade de 15 dias a partir da data de emissão.
                  Estamos prontos para iniciar o projeto imediatamente após a sua aprovação.
                </p>
              </section>

            </div>
          </div>

        );
      })()}
    </>
  );
}

// -------------------------------------------------------------
// CASHFLOW FORM VIEW
// -------------------------------------------------------------
function CashFlowFormView({ cashFlowData, cashFlowCategories, onSave, onCancel }: {
  cashFlowData: CashFlow | null;
  cashFlowCategories: CashFlowCategoryRecord[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const isEditing = !!cashFlowData;
  const [type, setType] = useState<CashFlowType>(cashFlowData?.type || 'Income');

  // Default category: existing value, or first matching category from DB, or empty string
  const getDefaultCategory = (t: CashFlowType) => {
    if (cashFlowData?.category) return cashFlowData.category;
    return cashFlowCategories.find(c => c.type === t)?.name || '';
  };
  const [category, setCategory] = useState<string>(getDefaultCategory(cashFlowData?.type || 'Income'));
  const [description, setDescription] = useState(cashFlowData?.description || '');
  const [value, setValue] = useState(cashFlowData?.value?.toString() || '');
  const [date, setDate] = useState(cashFlowData?.date ? new Date(cashFlowData.date + 'T12:00:00').toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<CashFlowStatus>(cashFlowData?.status || 'Pending');

  // When type changes, reset category to first of new type
  const handleTypeChange = (newType: CashFlowType) => {
    setType(newType);
    const first = cashFlowCategories.find(c => c.type === newType);
    if (first) setCategory(first.name);
  };

  const filteredCategories = cashFlowCategories.filter(c => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const numericValue = parseFloat(value.replace(',', '.'));

      const payload = {
        type, category, description, value: numericValue, date, status
      };

      if (isEditing && cashFlowData) {
        const { error } = await supabase.from('cash_flow').update(payload).eq('id', cashFlowData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cash_flow').insert(payload);
        if (error) throw error;
      }

      onSave();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar fluxo de caixa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-gray-800">
          {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
        </h3>
        <p className="text-sm text-gray-600 mt-1">Gerencie suas receitas e despesas.</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <select
                value={type}
                onChange={e => handleTypeChange(e.target.value as CashFlowType)}
                className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
              >
                <option value="Income">Receita (+)</option>
                <option value="Expense">Despesa (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
              >
                {filteredCategories.length === 0 ? (
                  <option value="">Nenhuma categoria cadastrada</option>
                ) : (
                  filteredCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
            <input
              required
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
              placeholder="Ex: Mensalidade Cliente X"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
                placeholder="Ex: 1500.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as CashFlowStatus)}
                className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
              >
                <option value="Paid">Pago</option>
                <option value="Pending">Pendente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="px-6 py-3 border border-white/60 bg-white/40 text-gray-700 rounded-xl text-sm font-medium hover:bg-white/60 transition-colors shadow-sm cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#C13584] to-[#a42b6f] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEditing ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SERVICES VIEW
// -------------------------------------------------------------
function ServicesView({ services, refetch, openNewModal, onEditService }: { services: Service[], refetch: () => void, openNewModal: () => void, onEditService: (s: Service) => void }) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja apagar o serviço base ${name}?`)) {
      setIsDeleting(id);
      await supabase.from('services').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 border-b border-white/40 flex justify-between items-center bg-white/20 backdrop-blur-md">
        <h3 className="font-semibold text-lg text-gray-800">Serviços Base</h3>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/30 backdrop-blur-md border-b border-white/40 text-sm text-gray-500">
            <th className="p-4 pl-6 font-medium">Nome</th>
            <th className="p-4 font-medium">Preço Base</th>
            <th className="p-4 font-medium">Cronograma Padrão</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {services.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-gray-500">
                Nenhum serviço base cadastrado ainda.
                <button onClick={openNewModal} className="ml-2 text-[#C13584] hover:underline cursor-pointer">Crie o seu primeiro serviço.</button>
              </td>
            </tr>
          ) : (
            services.map(s => (
              <tr key={s.id} className="border-b border-white/30 hover:bg-white/40 transition-colors">
                <td className="p-4 pl-6 text-gray-800 font-medium whitespace-nowrap">{s.name}</td>
                <td className="p-4 font-semibold text-gray-700">R$ {Number(s.base_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4 text-gray-600">
                  {s.phases_template ? `${(s.phases_template as any).length} Fases` : '-'}
                </td>
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-3 text-gray-400">
                    <button onClick={() => onEditService(s)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button disabled={isDeleting === s.id} onClick={() => handleDelete(s.id, s.name)} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                      {isDeleting === s.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------
// SERVICE FORM VIEW
// -------------------------------------------------------------
function ServiceFormView({ serviceData, onSave, onCancel }: { serviceData: Service | null, onSave: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!serviceData;
  const [name, setName] = useState(serviceData?.name || '');
  const [basePrice, setBasePrice] = useState(serviceData?.base_price?.toString() || '0');

  const [visionTemplate, setVisionTemplate] = useState(serviceData?.vision_template || 'Visão Padrão');
  const [engineTemplate, setEngineTemplate] = useState(serviceData?.engine_template || 'Engine Padrão');
  const [scopeTemplate, setScopeTemplate] = useState(serviceData?.scope_template || 'Escopo Padrão');
  const [investmentTemplate, setInvestmentTemplate] = useState(serviceData?.investment_template || 'Investimentos');
  const [phasesTemplate, setPhasesTemplate] = useState<ProposalPhase[]>(serviceData?.phases_template || [{ name: 'Setup', duration_days: 5 }]);

  const addPhase = () => setPhasesTemplate([...phasesTemplate, { name: '', duration_days: 0 }]);
  const updatePhase = (index: number, field: keyof ProposalPhase, val: any) => {
    const newPhases = [...phasesTemplate];
    newPhases[index] = { ...newPhases[index], [field]: val };
    setPhasesTemplate(newPhases);
  };
  const removePhase = (index: number) => setPhasesTemplate(phasesTemplate.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const numericPrice = parseFloat(basePrice.replace(',', '.'));

      const payload = {
        name,
        base_price: numericPrice,
        vision_template: visionTemplate,
        engine_template: engineTemplate,
        scope_template: scopeTemplate,
        investment_template: investmentTemplate,
        phases_template: phasesTemplate
      };

      if (isEditing && serviceData) {
        const { error } = await supabase.from('services').update(payload).eq('id', serviceData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
      }

      onSave();
    } catch (err) {
      console.error(err);
      alert(`Erro ao salvar serviço base: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-gray-800">
          {isEditing ? 'Editar Serviço Base' : 'Novo Serviço Base'}
        </h3>
        <p className="text-sm text-gray-600 mt-1">Configure o modelo padrão para as propostas deste tipo de serviço.</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Serviço</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner" placeholder="Ex: Criação de Site" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preço Base (R$)</label>
              <CurrencyInput required value={basePrice} onChange={setBasePrice} />
            </div>
          </div>

          <hr className="border-white/50" />
          <h4 className="font-semibold text-lg text-gray-800">Modelos de Textos</h4>

          <div className="flex flex-col gap-6 relative z-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visão do Projeto</label>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                <Editor value={visionTemplate} onChange={(e) => setVisionTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
              </div>
              <TemplateVarChips />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Especificações Técnicas (Engine)</label>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                <Editor value={engineTemplate} onChange={(e) => setEngineTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
              </div>
              <TemplateVarChips />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Escopo de Entregas</label>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
                <Editor value={scopeTemplate} onChange={(e) => setScopeTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
              </div>
              <TemplateVarChips />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Definições de Investimento</label>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden border border-white/60">
              <Editor value={investmentTemplate} onChange={(e) => setInvestmentTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
            </div>
            <TemplateVarChips />
          </div>

          <hr className="border-white/50" />
          <div className="flex justify-between items-center mb-0">
            <h4 className="font-semibold text-lg text-gray-800">Cronograma Padrão</h4>
            <button type="button" onClick={addPhase} className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer">Adicionar Fase Padrão</button>
          </div>

          <div className="flex flex-col gap-3">
            {phasesTemplate.length === 0 ? <p className="text-sm text-gray-500 italic">Sem fases padrão definidas.</p> : phasesTemplate.map((ph, i) => (
              <div key={i} className="flex gap-4 items-center bg-white/30 p-3 rounded-xl border border-white/40">
                <input type="text" placeholder="Nome da fase..." value={ph.name} onChange={e => updatePhase(i, 'name', e.target.value)} className="flex-1 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Dias" value={ph.duration_days} onChange={e => updatePhase(i, 'duration_days', parseInt(e.target.value) || 0)} className="w-20 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                  <span className="text-xs text-gray-500">Dias Úteis</span>
                </div>
                <button type="button" onClick={() => removePhase(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="px-6 py-3 border border-white/60 bg-white/40 text-gray-700 rounded-xl text-sm font-medium hover:bg-white/60 transition-colors shadow-sm cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#C13584] to-[#a42b6f] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md">
              {loading && <Loader2 size={16} className="animate-spin" />} {isEditing ? 'Atualizar Serviço' : 'Salvar Serviço'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LOGIN VIEW
// -------------------------------------------------------------
function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('Email not confirmed')) {
        setError('O E-mail ainda não foi confirmado. Acesse o Supabase para desativar a confirmação de E-mail provisória.');
      } else {
        setError('E-mail ou senha incorretos.');
      }
    }
    setLoggingIn(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans relative overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="absolute top-[-20%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-pink-400/30 to-purple-400/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50rem] h-[50rem] rounded-full bg-gradient-to-tr from-blue-300/30 to-pink-300/30 blur-[140px] pointer-events-none" />

      <div className="bg-white/50 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/80 w-full max-w-md flex flex-col items-center z-10 relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C13584] to-purple-600 shadow-lg flex items-center justify-center mb-6 border border-white/40">
          <span className="text-white font-bold text-3xl">O</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">OctaOS CRM</h2>
        <p className="text-sm text-gray-600 mb-8 font-medium">Faça login para gerenciar sua agência.</p>

        {error && (
          <div className="w-full p-3 mb-6 bg-red-500/10 backdrop-blur-md text-red-600 text-sm rounded-xl border border-red-500/20 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm text-gray-800 shadow-inner"
              placeholder="admin@octaos.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm text-gray-800 shadow-inner"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full mt-4 bg-gradient-to-r from-[#C13584] to-[#a42b6f] text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md border border-[#C13584]/20"
          >
            {loggingIn ? <Loader2 size={18} className="animate-spin text-white" /> : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CLIENTS VIEW
// -------------------------------------------------------------
function ClientsView({ clients, refetch, onEditClient }: { clients: Client[], refetch: () => void, onEditClient: (c: Client) => void }) {
  const [search, setSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const funnelLabel: Record<string, { label: string; color: string }> = {
    lead: { label: 'Lead', color: 'bg-gray-100 text-gray-600' },
    qualified: { label: 'Qualificado', color: 'bg-blue-100 text-blue-700' },
    proposal: { label: 'Proposta', color: 'bg-yellow-100 text-yellow-700' },
    negotiation: { label: 'Negociação', color: 'bg-orange-100 text-orange-700' },
    closed_won: { label: 'Fechado ✓', color: 'bg-green-100 text-green-700' },
    closed_lost: { label: 'Perdido', color: 'bg-red-100 text-red-600' },
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.cnpj || '').toLowerCase().includes(q);
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Excluir o cliente "${name}"? Esta ação não pode ser desfeita.`)) {
      setIsDeleting(id);
      await supabase.from('clients').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 border-b border-white/40 flex justify-between items-center bg-white/20 backdrop-blur-md">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, e-mail ou CNPJ..."
          className="pl-4 pr-4 py-2 border border-white/60 bg-white/40 backdrop-blur-sm rounded-xl text-sm w-96 focus:outline-none focus:ring-2 focus:ring-[#C13584] focus:bg-white/80 transition-all shadow-inner"
        />
        <span className="text-sm text-gray-500 font-medium">{filtered.length} cliente(s)</span>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/30 backdrop-blur-md border-b border-white/40 text-sm text-gray-500">
            <th className="p-4 pl-6 font-medium">Nome / Empresa</th>
            <th className="p-4 font-medium">Contato</th>
            <th className="p-4 font-medium">CNPJ</th>
            <th className="p-4 font-medium">Funil</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.length === 0 ? (
            <tr><td colSpan={5} className="p-8 text-center text-gray-500">{search ? `Nenhum cliente encontrado para "${search}".` : 'Nenhum cliente cadastrado ainda.'}</td></tr>
          ) : (
            filtered.map(c => {
              const stage = funnelLabel[c.funnel_stage || 'lead'];
              return (
                <tr key={c.id} className="border-b border-white/30 hover:bg-white/40 transition-colors">
                  <td className="p-4 pl-6">
                    <p className="font-semibold text-gray-800">{c.name}</p>
                    {c.company_name && <p className="text-xs text-gray-500 mt-0.5">{c.company_name}</p>}
                  </td>
                  <td className="p-4">
                    {c.email && <p className="text-gray-600">{c.email}</p>}
                    {c.phone && <p className="text-xs text-gray-500 mt-0.5">{c.phone}</p>}
                  </td>
                  <td className="p-4 text-gray-500 font-mono text-xs">{c.cnpj || '—'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      <button onClick={() => onEditClient(c)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar"><Edit2 size={16} /></button>
                      <button disabled={isDeleting === c.id} onClick={() => handleDelete(c.id, c.name)} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                        {isDeleting === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------
// CLIENT FORM VIEW
// -------------------------------------------------------------
function ClientFormView({ clientData, onSave, onCancel }: { clientData: Client | null, onSave: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!clientData;

  const [name, setName] = useState(clientData?.name || '');
  const [companyName, setCompanyName] = useState(clientData?.company_name || '');
  const [cnpj, setCnpj] = useState(clientData?.cnpj || '');
  const [email, setEmail] = useState(clientData?.email || '');
  const [phone, setPhone] = useState(clientData?.phone || clientData?.whatsapp || '');
  const [website, setWebsite] = useState(clientData?.website || '');
  const [segment, setSegment] = useState(clientData?.segment || '');
  const [city, setCity] = useState(clientData?.city || '');
  const [state, setState] = useState(clientData?.state || '');
  const [funnelStage, setFunnelStage] = useState<string>(clientData?.funnel_stage || 'lead');
  const [leadSource, setLeadSource] = useState(clientData?.lead_source || '');
  const [estimatedValue, setEstimatedValue] = useState(clientData?.estimated_value?.toString() || '');
  const [nextFollowUp, setNextFollowUp] = useState(clientData?.next_follow_up || '');
  const [notes, setNotes] = useState(clientData?.notes || '');

  const fieldClass = "w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name, company_name: companyName || null, cnpj: cnpj || null,
        email: email || null, phone: phone || null, whatsapp: phone || null,
        website: website || null, segment: segment || null,
        city: city || null, state: state || null,
        funnel_stage: funnelStage, lead_source: leadSource || null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        next_follow_up: nextFollowUp || null, notes: notes || null,
      };

      if (isEditing && clientData) {
        const { error } = await supabase.from('clients').update(payload).eq('id', clientData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(payload);
        if (error) throw error;
      }
      onSave();
    } catch (err) {
      alert(`Erro ao salvar cliente: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-gray-800">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
        <p className="text-sm text-gray-600 mt-1">Dados de contato e posição no funil de vendas.</p>
      </div>
      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">

          <div>
            <h4 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wider">Identificação</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato *</label><input required value={name} onChange={e => setName(e.target.value)} className={fieldClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Empresa / Razão Social</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className={fieldClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label><input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className={fieldClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Segmento / Nicho</label><input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex: E-commerce, Restaurante..." className={fieldClass} /></div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wider">Contato</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 90000-0000" className={fieldClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Website</label><input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className={fieldClass} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label><input value={city} onChange={e => setCity(e.target.value)} className={fieldClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Estado</label><input value={state} onChange={e => setState(e.target.value)} maxLength={2} placeholder="SP" className={fieldClass} /></div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wider">Funil de Vendas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estágio no Funil</label>
                <select value={funnelStage} onChange={e => setFunnelStage(e.target.value)} className={fieldClass + ' text-gray-800'}>
                  <option value="lead">Lead (Contato Inicial)</option>
                  <option value="qualified">Qualificado</option>
                  <option value="proposal">Proposta Enviada</option>
                  <option value="negotiation">Em Negociação</option>
                  <option value="closed_won">Fechado ✓</option>
                  <option value="closed_lost">Perdido</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Lead</label>
                <select value={leadSource} onChange={e => setLeadSource(e.target.value)} className={fieldClass + ' text-gray-800'}>
                  <option value="">Selecione...</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Site">Site / Formulário</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Cold Outreach">Cold Outreach</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Evento">Evento / Feira</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor Estimado do Contrato (R$)</label><input type="number" step="0.01" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} className={fieldClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Próximo Follow-up</label><input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} className={fieldClass} /></div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações Internas</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexto, histórico, decisores..." className={fieldClass + ' resize-y'} />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="px-6 py-3 border border-white/60 bg-white/40 text-gray-700 rounded-xl text-sm font-medium hover:bg-white/60 transition-colors shadow-sm cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#C13584] to-[#a42b6f] text-white rounded-xl text-sm font-medium hover:opacity-90 flex items-center gap-2 cursor-pointer shadow-md">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEditing ? 'Atualizar Cliente' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
