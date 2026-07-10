import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  BarChart3,
  FileText,
  DollarSign,
  LayoutDashboard,
  Plus,
  Filter,
  Loader2,
  Trash2,
  Edit2,
  Copy,
  LogOut,
  Briefcase,
  Printer,
  Users,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Settings,
  GripVertical,
  Layers,
  Link2,
  Unlink,
  FileSignature,
  Download,
  ScrollText,
  ExternalLink,
  Barcode,
  Inbox,
  Menu,
  X,
  Clock,
  CreditCard,
  QrCode,
  Banknote,
  Landmark,
  RefreshCw
} from 'lucide-react';
import './App.css';
import { useSupabase, clearDataCache } from './hooks/useSupabase';
import { supabase, getStoredUser } from './lib/supabase';
import { SettingsView } from './components/SettingsView';
import { LeadsView } from './components/LeadsView';
import { ContractSigningView } from './components/ContractSigningView';
import { AgencySettingsView } from './components/AgencySettingsView';
import { AsaasSettingsView } from './components/AsaasSettingsView';
import { FinanceOverviewView } from './components/FinanceOverviewView';
import { FinanceAccountsView } from './components/FinanceAccountsView';
import { TransfersView } from './components/TransfersView';
import { RecurringExpensesView } from './components/RecurringExpensesView';
import { StatementImportView } from './components/StatementImportView';
import { SuppliersView } from './components/SuppliersView';
import { FinanceReportsView } from './components/FinanceReportsView';
import { DefaultEditor as Editor } from 'react-simple-wysiwyg';
import type { Client, Proposal, CashFlow, ProposalStatus, CashFlowType, CashFlowCategory, CashFlowStatus, Service, ProposalPhase, CashFlowCategoryRecord, SectionTemplate, AdditionalSection, Contract, ContractTemplate, SignerField, AgencySettings, BankAccount, Supplier } from './types/database';
import type { User } from '@supabase/supabase-js';

// Abas agrupadas sob o item "Financeiro" da sidebar.
const FINANCE_TABS: string[] = ['cashflow', 'cashflow-all', 'cashflow-categories', 'cashflow-form', 'finance-accounts', 'finance-transfers', 'finance-recurring', 'finance-import', 'finance-suppliers', 'finance-reports'];

// Ícone de status do lançamento nas listagens: recebido/pago, pendente ou em atraso.
function CashStatusIcon({ c }: { c: CashFlow }) {
  const overdue = c.status === 'Pending' && c.date < new Date().toISOString().split('T')[0];
  if (c.status === 'Paid') {
    return <span title={c.type === 'Income' ? 'Recebido' : 'Pago'} className="flex flex-shrink-0 text-emerald-500"><CheckCircle size={17} /></span>;
  }
  if (overdue) {
    return <span title="Em atraso" className="flex flex-shrink-0 text-rose-500"><AlertCircle size={17} /></span>;
  }
  return <span title="Pendente" className="flex flex-shrink-0 text-amber-500"><Clock size={17} /></span>;
}

// Forma de recebimento/pagamento como ícone (abaixo do valor nas listagens).
// Boleto emitido é link; parcela destinada a boleto sem emissão mostra "Gerar"
// quando a tela oferece essa ação.
function PaymentSlot({ c, genBusy, onGenerate }: { c: CashFlow; genBusy?: boolean; onGenerate?: (c: CashFlow) => void }) {
  if (c.boleto_url) {
    return (
      <a href={c.boleto_url} target="_blank" rel="noopener noreferrer" title="Ver boleto"
        className="flex text-sky-600 hover:text-sky-700 transition-colors">
        <Barcode size={15} />
      </a>
    );
  }
  if (onGenerate && c.type === 'Income' && c.proposal_id && (c.payment_method === 'Boleto' || !c.payment_method)) {
    return (
      <button onClick={() => onGenerate(c)} disabled={genBusy} title="Gerar boleto no Asaas"
        className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-3)] underline decoration-dotted underline-offset-2 hover:text-sky-600 transition-colors cursor-pointer disabled:opacity-50">
        {genBusy ? <Loader2 size={12} className="animate-spin" /> : <Barcode size={13} />} Gerar
      </button>
    );
  }
  if (c.payment_method) {
    const icons: Record<string, ReactNode> = {
      Pix: <QrCode size={15} />,
      'Cartão': <CreditCard size={15} />,
      'Depósito': <Landmark size={15} />,
      Dinheiro: <Banknote size={15} />,
      Boleto: <Barcode size={15} />,
    };
    return (
      <span title={c.payment_method} className="flex text-[var(--color-ink-3)]">
        {icons[c.payment_method] ?? <span className="text-[11px]">{c.payment_method}</span>}
      </span>
    );
  }
  return null;
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'proposals' | 'cashflow' | 'cashflow-all' | 'cashflow-categories' | 'finance-accounts' | 'finance-transfers' | 'finance-recurring' | 'finance-import' | 'finance-suppliers' | 'finance-reports' | 'proposal-form' | 'services' | 'service-form' | 'section-templates' | 'section-template-form' | 'contracts' | 'contract-form' | 'contract-templates' | 'contract-template-form' | 'cashflow-form' | 'clients' | 'client-form' | 'settings' | 'leads'>('dashboard');
  // Tipo pré-selecionado ao abrir "Novo Lançamento" pelos atalhos Nova receita/Nova despesa.
  const [newCashFlowType, setNewCashFlowType] = useState<CashFlowType>('Income');
  const [selectedProposal, setSelectedProposal] = useState<{ proposal: Proposal; client: Client | null } | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSectionTemplate, setSelectedSectionTemplate] = useState<SectionTemplate | null>(null);
  const [selectedContractTemplate, setSelectedContractTemplate] = useState<ContractTemplate | null>(null);
  const [contractProposalTarget, setContractProposalTarget] = useState<{ proposal: Proposal; client: Client | null } | null>(null);
  const [printContract, setPrintContract] = useState<Contract | null>(null);
  const [selectedCashFlow, setSelectedCashFlow] = useState<CashFlow | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<{ proposal: Proposal; client: Client | null } | null>(null);
  const [printProposal, setPrintProposal] = useState<{ proposal: Proposal; client: Client | null } | null>(null);

  // Gaveta de navegação no mobile. Fecha sozinha ao trocar de aba.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { setSidebarOpen(false); }, [activeTab]);

  // Botão de atualizar dados ao lado do logo: recarrega tudo em silêncio,
  // sem spinner de tela cheia e sem sair da tela atual.
  const [refreshing, setRefreshing] = useState(false);

  // Auth State — hydrated synchronously from the stored session so a refresh
  // renders the admin immediately; getSession/onAuthStateChange then confirm
  // (or revoke) it in the background.
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [authLoading, setAuthLoading] = useState(user === null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) clearDataCache();
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Abre direto na aba de Leads quando o app é iniciado a partir de uma
  // notificação push (URL ?tab=leads) ou quando o service worker avisa que a
  // notificação foi clicada numa aba já aberta.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'leads') setActiveTab('leads');

    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && e.data.tab === 'leads') setActiveTab('leads');
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onSwMessage);
  }, []);

  const { proposals, cashFlows, clients, services, cashFlowCategories, leads, sectionTemplates, contracts, contractTemplates, agencySettings, bankAccounts, suppliers, recurringExpenses, accountTransfers, loading, refetch, silentRefetch } = useSupabase();

  // Loads once per signed-in user. The ref guards against duplicated effect
  // runs (React StrictMode) re-triggering the full load and re-showing the spinner.
  const loadedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (user?.id && loadedForUser.current !== user.id) {
      loadedForUser.current = user.id;
      refetch();
      // Gera as despesas recorrentes do mês (idempotente no banco: rodar de
      // novo não duplica). Silencioso: se a RPC ainda não existir, ignora.
      supabase.rpc('generate_recurring_expenses')
        .then(({ data }) => { if (Number(data) > 0) silentRefetch(); });
    }
  }, [refetch, silentRefetch, user?.id]);

  // Public contract signing page: /assinar/<token> — bypasses admin auth.
  const signMatch = window.location.pathname.match(/^\/assinar\/([^/?#]+)/);
  if (signMatch) {
    return <ContractSigningView token={decodeURIComponent(signMatch[1])} />;
  }

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
    <div className="flex h-screen w-full text-[var(--color-ink-2)] font-sans relative overflow-hidden bg-[#f6f4f8] print:h-auto print:overflow-visible print:bg-white print:bg-none">
      {/* Ambient brand field — calmer chroma so glass surfaces keep contrast. */}
      <div className="absolute top-[-15%] left-[-8%] w-[42%] h-[55%] rounded-full bg-gradient-to-br from-[#C13584]/12 to-violet-400/10 blur-[130px] pointer-events-none print:hidden" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[48%] h-[60%] rounded-full bg-gradient-to-tr from-indigo-300/10 to-[#C13584]/8 blur-[150px] pointer-events-none print:hidden" />

      {/* Content wrapper */}
      <div className="flex w-full h-full relative z-10 print:hidden">
        {/* Backdrop da gaveta — só no mobile, quando aberta */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-[45] bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        {/* Sidebar — refined glass, grouped navigation. Gaveta off-canvas no mobile, fixa no desktop (lg+). */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-[50] w-64 max-w-[82vw] bg-white/85 lg:bg-white/55 backdrop-blur-2xl border-r border-white/70 px-4 pt-[calc(1.5rem+30px+var(--safe-top))] lg:pt-[calc(1.5rem+var(--safe-top))] pb-[calc(1.5rem+var(--safe-bottom))] flex flex-col gap-7 flex-shrink-0 shadow-[1px_0_30px_-12px_rgba(27,20,32,0.10)] print:hidden transition-transform duration-300 ease-out lg:transition-none lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C13584] to-violet-600 shadow-[0_4px_12px_-2px_rgba(193,53,132,0.5)] flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">O</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">OctaOS <span className="font-normal text-[var(--color-ink-3)]">CRM</span></h1>
            <button
              onClick={async () => {
                if (refreshing) return;
                setRefreshing(true);
                try { await silentRefetch(); } finally { setRefreshing(false); }
              }}
              disabled={refreshing}
              className="ml-auto icon-action disabled:opacity-60"
              title="Atualizar dados"
              aria-label="Atualizar dados"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden icon-action"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex flex-col gap-5 flex-1 overflow-y-auto -mr-2 pr-2">
            <div className="flex flex-col gap-1">
              <NavButton icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavButton icon={<Inbox size={18} />} label="Leads" active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} badge={leads.filter(l => l.status === 'novo').length} />
              <NavButton icon={<FileText size={18} />} label="Propostas" active={activeTab === 'proposals'} onClick={() => setActiveTab('proposals')} />
              <NavButton icon={<FileSignature size={18} />} label="Contratos" active={['contracts', 'contract-form', 'contract-templates', 'contract-template-form'].includes(activeTab)} onClick={() => setActiveTab('contracts')} />
              <NavButton icon={<Users size={18} />} label="Clientes" active={activeTab === 'clients' || activeTab === 'client-form'} onClick={() => setActiveTab('clients')} />
              <NavButton icon={<DollarSign size={18} />} label="Financeiro" active={FINANCE_TABS.includes(activeTab)} onClick={() => setActiveTab('cashflow')} />
              {FINANCE_TABS.includes(activeTab) && (
                <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-[var(--color-primary)]/20 pl-3">
                  {([
                    ['cashflow', 'Por Mês'],
                    ['cashflow-all', 'Todos os Lançamentos'],
                    ['finance-accounts', 'Contas'],
                    ['finance-transfers', 'Transferências'],
                    ['finance-recurring', 'Recorrentes'],
                    ['finance-import', 'Importar Extrato'],
                    ['finance-suppliers', 'Fornecedores'],
                    ['finance-reports', 'Relatórios'],
                    ['cashflow-categories', 'Categorias'],
                  ] as const).map(([tab, label]) => {
                    const on = activeTab === tab || (tab === 'cashflow' && activeTab === 'cashflow-form');
                    return (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`text-left text-[13px] px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${on ? 'text-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:bg-white/50'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]/70">Catálogo</p>
              <NavButton icon={<Briefcase size={18} />} label="Serviços Base" active={activeTab === 'services' || activeTab === 'service-form'} onClick={() => setActiveTab('services')} />
              <NavButton icon={<Layers size={18} />} label="Modelos de Seção" active={activeTab === 'section-templates' || activeTab === 'section-template-form'} onClick={() => setActiveTab('section-templates')} />
            </div>
          </nav>

          <div className="border-t border-white/60 pt-4 flex flex-col gap-1">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary-50)] to-white shadow-[inset_0_0_0_1px_rgba(193,53,132,0.15)] flex items-center justify-center flex-shrink-0 text-[var(--color-primary)] font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{user?.email}</p>
                <p className="text-xs text-[var(--color-ink-3)]">Administrador</p>
              </div>
            </div>
            <NavButton icon={<Settings size={18} />} label="Configurações" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50/70 transition-all cursor-pointer w-full text-left"
            >
              <LogOut size={18} className="text-rose-500" />
              Sair
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto flex flex-col h-full print:overflow-visible">
          {/* Mobile: +30px fixos no topo (pedido: independe de ser iPhone) somados à safe area; desktop (lg+) sem o extra */}
          <header className="h-[calc(98px+var(--safe-top))] pt-[calc(30px+var(--safe-top))] lg:h-[calc(68px+var(--safe-top))] lg:pt-[var(--safe-top)] flex-shrink-0 border-b glass-raised flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 sticky top-0 z-[20] print:hidden">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden icon-action flex-shrink-0"
                aria-label="Abrir menu"
              >
                <Menu size={22} />
              </button>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-ink)] truncate">
              {activeTab === 'dashboard' ? 'Visão Geral' :
                activeTab === 'leads' ? 'CRM — Recepção de Leads' :
                  activeTab === 'proposals' ? 'Gestão de Propostas' :
                    activeTab === 'proposal-form' ? (selectedProposal ? 'Editar Proposta' : 'Nova Proposta') :
                      activeTab === 'services' ? 'Serviços Base' :
                        activeTab === 'service-form' ? (selectedService ? 'Editar Serviço' : 'Novo Serviço') :
                          activeTab === 'cashflow' ? 'Financeiro — Por Mês' :
                            activeTab === 'cashflow-all' ? 'Todos os Lançamentos' :
                              activeTab === 'cashflow-categories' ? 'Categorias Financeiras' :
                                activeTab === 'finance-accounts' ? 'Contas Bancárias' :
                                activeTab === 'finance-transfers' ? 'Transferências entre Contas' :
                                activeTab === 'finance-recurring' ? 'Recorrências (Receitas e Despesas)' :
                                activeTab === 'finance-import' ? 'Importar Extrato Bancário' :
                                activeTab === 'finance-suppliers' ? 'Fornecedores' :
                                activeTab === 'finance-reports' ? 'Relatórios (DRE)' :
                                activeTab === 'cashflow-form' ? (selectedCashFlow ? 'Editar Lançamento' : 'Novo Lançamento') :
                                  activeTab === 'clients' ? 'Clientes' :
                                    activeTab === 'client-form' ? (selectedClient ? 'Editar Cliente' : 'Novo Cliente') :
                                      activeTab === 'section-templates' ? 'Modelos de Seção' :
                                        activeTab === 'section-template-form' ? (selectedSectionTemplate ? 'Editar Modelo de Seção' : 'Novo Modelo de Seção') :
                                          activeTab === 'contracts' ? 'Contratos' :
                                            activeTab === 'contract-form' ? 'Gerar Contrato' :
                                              activeTab === 'contract-templates' ? 'Modelos de Contrato' :
                                                activeTab === 'contract-template-form' ? (selectedContractTemplate ? 'Editar Modelo de Contrato' : 'Novo Modelo de Contrato') :
                                                  activeTab === 'settings' ? 'Configurações' : ''}
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {activeTab === 'proposals' && (
                <button onClick={() => { setSelectedProposal(null); setActiveTab('proposal-form'); }} className="btn-primary">
                  <Plus size={18} />
                  Nova Proposta
                </button>
              )}
              {activeTab === 'dashboard' && (
                <>
                  <button onClick={() => { setSelectedCashFlow(null); setNewCashFlowType('Income'); setActiveTab('cashflow-form'); }}
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer">
                    <Plus size={16} /> Nova receita
                  </button>
                  <button onClick={() => { setSelectedCashFlow(null); setNewCashFlowType('Expense'); setActiveTab('cashflow-form'); }}
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer">
                    <Plus size={16} /> Nova despesa
                  </button>
                  <button onClick={() => { setSelectedCashFlow(null); setNewCashFlowType('Income'); setActiveTab('cashflow-form'); }} className="btn-primary sm:hidden">
                    <Plus size={18} /> Novo
                  </button>
                </>
              )}
              {(activeTab === 'cashflow' || activeTab === 'cashflow-all') && (
                <button onClick={() => { setSelectedCashFlow(null); setNewCashFlowType('Income'); setActiveTab('cashflow-form'); }} className="btn-primary">
                  <Plus size={18} />
                  Novo Registro
                </button>
              )}
              {activeTab === 'cashflow-categories' && (
                <span className="text-sm text-[var(--color-ink-3)] italic">Gerencie as categorias abaixo</span>
              )}
              {activeTab === 'services' && (
                <button id="btn-new-service" onClick={() => { setSelectedService(null); setActiveTab('service-form'); }} className="btn-primary">
                  <Plus size={18} />
                  Novo Serviço
                </button>
              )}
              {activeTab === 'section-templates' && (
                <button onClick={() => { setSelectedSectionTemplate(null); setActiveTab('section-template-form'); }} className="btn-primary">
                  <Plus size={18} />
                  Novo Modelo
                </button>
              )}
              {activeTab === 'contracts' && (
                <button onClick={() => setActiveTab('contract-templates')} className="btn-outline-brand">
                  <ScrollText size={18} />
                  Modelos de Contrato
                </button>
              )}
              {activeTab === 'contract-templates' && (
                <button onClick={() => { setSelectedContractTemplate(null); setActiveTab('contract-template-form'); }} className="btn-primary">
                  <Plus size={18} />
                  Novo Modelo
                </button>
              )}
              {activeTab === 'clients' && (
                <button onClick={() => { setSelectedClient(null); setActiveTab('client-form'); }} className="btn-primary">
                  <Plus size={18} />
                  Novo Cliente
                </button>
              )}

            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8 pb-12 flex-1 relative z-0 print:p-0">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-[#C13584] drop-shadow-lg">
                <Loader2 className="animate-spin" size={48} />
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
                {activeTab === 'dashboard' && <FinanceOverviewView cashFlows={cashFlows} accounts={bankAccounts} transfers={accountTransfers} categories={cashFlowCategories} onEditCashFlow={(c) => { setSelectedCashFlow(c); setActiveTab('cashflow-form'); }} refetch={silentRefetch} />}
                {activeTab === 'leads' && <LeadsView leads={leads} refetch={silentRefetch} />}
                {activeTab === 'proposals' && (
                  <ProposalsView
                    proposals={proposals}
                    refetch={refetch}
                    onEditProposal={(p) => { setSelectedProposal(p); setActiveTab('proposal-form'); }}
                    onApproveProposal={(p) => setApprovalTarget(p)}
                    onPrintProposal={(p) => {
                      setPrintProposal(p);
                      const num = p.proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase();
                      setTimeout(() => {
                        const prev = document.title;
                        document.title = `Proposta_${num}`;
                        window.print();
                        document.title = prev;
                      }, 100);
                    }}
                    onGenerateContract={(p) => { setContractProposalTarget(p); setActiveTab('contract-form'); }}
                  />
                )}
                {activeTab === 'proposal-form' && (
                  <ProposalFormView
                    proposalData={selectedProposal}
                    services={services}
                    clients={clients}
                    sectionTemplates={sectionTemplates}
                    onSave={() => { setActiveTab('proposals'); refetch(); }}
                    onCancel={() => setActiveTab('proposals')}
                    onApprove={(p) => setApprovalTarget(p)}
                    onPrint={(p, c) => {
                      setPrintProposal({ proposal: p, client: c });
                      const num = p.id.replace(/-/g, '').substring(0, 6).toUpperCase();
                      setTimeout(() => {
                        const prev = document.title;
                        document.title = `Proposta_${num}`;
                        window.print();
                        document.title = prev;
                      }, 150);
                    }}
                  />
                )}
                {activeTab === 'cashflow' && <CashFlowView cashFlows={cashFlows} bankAccounts={bankAccounts} onEditCashFlow={(c) => { setSelectedCashFlow(c); setActiveTab('cashflow-form'); }} refetch={silentRefetch} />}
                {activeTab === 'cashflow-all' && <CashFlowAllView cashFlows={cashFlows} bankAccounts={bankAccounts} onEditCashFlow={(c) => { setSelectedCashFlow(c); setActiveTab('cashflow-form'); }} refetch={silentRefetch} />}
                {activeTab === 'cashflow-categories' && <CashFlowCategoriesView categories={cashFlowCategories} refetch={refetch} />}
                {activeTab === 'finance-accounts' &&<FinanceAccountsView accounts={bankAccounts} cashFlows={cashFlows} transfers={accountTransfers} refetch={silentRefetch} />}
                {activeTab === 'finance-transfers' && <TransfersView accounts={bankAccounts} transfers={accountTransfers} refetch={silentRefetch} />}
                {activeTab === 'finance-recurring' && <RecurringExpensesView recurring={recurringExpenses} accounts={bankAccounts} suppliers={suppliers} categories={cashFlowCategories} refetch={silentRefetch} />}
                {activeTab === 'finance-import' && <StatementImportView accounts={bankAccounts} categories={cashFlowCategories} refetch={silentRefetch} />}
                {activeTab === 'finance-suppliers' && <SuppliersView suppliers={suppliers} cashFlows={cashFlows} refetch={silentRefetch} />}
                {activeTab === 'finance-reports' && <FinanceReportsView cashFlows={cashFlows} categories={cashFlowCategories} accounts={bankAccounts} transfers={accountTransfers} />}
                {activeTab === 'cashflow-form' && (
                  <CashFlowFormView
                    cashFlowData={selectedCashFlow}
                    cashFlowCategories={cashFlowCategories}
                    bankAccounts={bankAccounts}
                    suppliers={suppliers}
                    defaultType={newCashFlowType}
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
                {activeTab === 'section-templates' && (
                  <SectionTemplatesView
                    sectionTemplates={sectionTemplates}
                    proposals={proposals}
                    services={services}
                    refetch={refetch}
                    openNewModal={() => { setSelectedSectionTemplate(null); setActiveTab('section-template-form'); }}
                    onEditTemplate={(t) => { setSelectedSectionTemplate(t); setActiveTab('section-template-form'); }}
                  />
                )}
                {activeTab === 'section-template-form' && (
                  <SectionTemplateFormView
                    templateData={selectedSectionTemplate}
                    proposals={proposals}
                    services={services}
                    onSave={() => { setActiveTab('section-templates'); refetch(); }}
                    onCancel={() => setActiveTab('section-templates')}
                  />
                )}
                {activeTab === 'contracts' && (
                  <ContractsView
                    contracts={contracts}
                    proposals={proposals}
                    refetch={refetch}
                    onDownloadPdf={(c) => {
                      setPrintContract(c);
                      const num = c.id.replace(/-/g, '').substring(0, 6).toUpperCase();
                      setTimeout(() => {
                        const prev = document.title;
                        document.title = `Contrato_${num}`;
                        window.print();
                        document.title = prev;
                      }, 120);
                    }}
                  />
                )}
                {activeTab === 'contract-form' && (
                  <ContractFormView
                    proposalData={contractProposalTarget}
                    proposals={proposals}
                    contractTemplates={contractTemplates}
                    agencySettings={agencySettings}
                    onSave={() => { setActiveTab('contracts'); refetch(); }}
                    onCancel={() => setActiveTab('contracts')}
                  />
                )}
                {activeTab === 'contract-templates' && (
                  <ContractTemplatesView
                    contractTemplates={contractTemplates}
                    contracts={contracts}
                    refetch={refetch}
                    openNewModal={() => { setSelectedContractTemplate(null); setActiveTab('contract-template-form'); }}
                    onEditTemplate={(t) => { setSelectedContractTemplate(t); setActiveTab('contract-template-form'); }}
                    onBack={() => setActiveTab('contracts')}
                  />
                )}
                {activeTab === 'contract-template-form' && (
                  <ContractTemplateFormView
                    templateData={selectedContractTemplate}
                    contracts={contracts}
                    onSave={() => { setActiveTab('contract-templates'); refetch(); }}
                    onCancel={() => setActiveTab('contract-templates')}
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
                {activeTab === 'settings' && (
                  <div className="max-w-xl mx-auto flex flex-col gap-6">
                    <AgencySettingsView onSaved={refetch} />
                    <AsaasSettingsView />
                    <SettingsView />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
      {approvalTarget && (
        <ApprovalModal
          target={approvalTarget}
          bankAccounts={bankAccounts}
          onClose={() => setApprovalTarget(null)}
          onDone={() => { setApprovalTarget(null); refetch(); }}
        />
      )}

      {/* Global print document — always in DOM, only shown at print time */}
      {printProposal && <ProposalPrintDocument proposal={printProposal.proposal} client={printProposal.client} sectionTemplates={sectionTemplates} />}
      {printContract && <ContractPrintDocument contract={printContract} agencySettings={agencySettings} />}
    </div>
  );
}

// -------------------------------------------------------------
// CURRENCY INPUT (BRL formatted)
// -------------------------------------------------------------
function NavButton({ icon, label, active, onClick, badge }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border ${active
        ? 'bg-white/80 shadow-[0_1px_3px_rgba(27,20,32,0.07)] border-white/80 text-[var(--color-primary)]'
        : 'border-transparent text-[var(--color-ink-2)] hover:bg-white/50 hover:text-[var(--color-ink)]'}`}
    >
      <span className={active ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-3)] group-hover:text-[var(--color-ink-2)] transition-colors'}>{icon}</span>
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-semibold leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

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
  const baseClass = 'field-input';
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-ink-3)] select-none pointer-events-none z-10">R$</span>
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

// Variables available in contract templates (proposal-derived). Signer fields
// add their own variables (the field key) on top of these.
const CONTRACT_TEMPLATE_VARS = [
  { key: 'NOME_CLIENTE', label: 'Nome do Cliente' },
  { key: 'EMPRESA_CLIENTE', label: 'Empresa' },
  { key: 'EMAIL_CLIENTE', label: 'E-mail' },
  { key: 'CNPJ_CLIENTE', label: 'CNPJ do Cliente' },
  { key: 'TELEFONE_CLIENTE', label: 'Telefone do Cliente' },
  { key: 'CIDADE_CLIENTE', label: 'Cidade do Cliente' },
  { key: 'ESTADO_CLIENTE', label: 'Estado/UF do Cliente' },
  { key: 'NUMERO_PROPOSTA', label: 'Nº da Proposta' },
  { key: 'DATA_PROPOSTA', label: 'Data da Proposta' },
  { key: 'SERVICO', label: 'Serviço' },
  { key: 'VALOR_BRUTO', label: 'Valor Bruto' },
  { key: 'VALOR_LIQUIDO', label: 'Valor Líquido' },
  { key: 'VALOR_AVISTA', label: 'Valor à Vista (Especial)' },
  { key: 'CONDICAO_PAGAMENTO', label: 'Condição de Pagamento' },
  { key: 'FORMA_PAGAMENTO', label: 'Forma de Pagamento' },
  { key: 'PARCELAS', label: 'Tabela de Parcelas' },
  { key: 'PAGAMENTO_PIX', label: 'Parágrafo PIX' },
  { key: 'DATA_INICIO', label: 'Data Início' },
  { key: 'NUM_PARCELAS', label: 'Nº Parcelas' },
  { key: 'DATA_HOJE', label: 'Data Hoje' },
];

// Agency (CONTRATADA) variables — defined once in Settings, injected into contracts.
const AGENCY_TEMPLATE_VARS = [
  { key: 'AGENCIA_RAZAO_SOCIAL', label: 'Razão Social' },
  { key: 'AGENCIA_CNPJ', label: 'CNPJ' },
  { key: 'AGENCIA_ENDERECO', label: 'Endereço' },
  { key: 'AGENCIA_CIDADE', label: 'Cidade' },
  { key: 'AGENCIA_UF', label: 'UF' },
  { key: 'AGENCIA_EMAIL', label: 'E-mail Agência' },
  { key: 'AGENCIA_TELEFONE', label: 'Telefone' },
  { key: 'CHAVE_PIX', label: 'Chave PIX' },
  { key: 'BENEFICIARIO_PIX', label: 'Beneficiário PIX' },
];

function buildAgencyVarMap(agency: AgencySettings | null): Record<string, string> {
  return {
    AGENCIA_RAZAO_SOCIAL: agency?.razao_social || '',
    AGENCIA_CNPJ: agency?.cnpj || '',
    AGENCIA_ENDERECO: agency?.endereco || '',
    AGENCIA_CIDADE: agency?.cidade || '',
    AGENCIA_UF: agency?.uf || '',
    AGENCIA_EMAIL: agency?.email || '',
    AGENCIA_TELEFONE: agency?.telefone || '',
    CHAVE_PIX: agency?.pix_key || '',
    BENEFICIARIO_PIX: agency?.pix_beneficiario || '',
  };
}

// Build an HTML table of the proposal's installments (date + value) for contracts.
function buildInstallmentsHtml(installments: { date: string; value: number }[] | undefined): string {
  if (!installments || installments.length === 0) return '';
  const fmt = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const cell = 'padding:6px 10px;border:1px solid #ddd;';
  const rows = installments.map((p, i) =>
    `<tr><td style="${cell}">${i + 1}ª</td><td style="${cell}">${new Date(p.date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td><td style="${cell}text-align:right;">${fmt(p.value)}</td></tr>`
  ).join('');
  const total = installments.reduce((a, b) => a + (Number(b.value) || 0), 0);
  return `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:8px 0;">`
    + `<thead><tr>`
    + `<th style="${cell}text-align:left;">Parcela</th>`
    + `<th style="${cell}text-align:left;">Vencimento</th>`
    + `<th style="${cell}text-align:right;">Valor</th>`
    + `</tr></thead><tbody>${rows}</tbody>`
    + `<tfoot><tr><td colspan="2" style="${cell}font-weight:bold;">Total</td><td style="${cell}text-align:right;font-weight:bold;">${fmt(total)}</td></tr></tfoot>`
    + `</table>`;
}

// Build the proposal-derived merge variables for a contract.
function buildProposalVarMap(proposal: Proposal, client: Client | null): Record<string, string> {
  const content = proposal.content_json as Record<string, unknown> | null;
  const netValue = (content?.netValue as number) ?? Number(proposal.value);
  const installments = (content?.installments as unknown[]) || [];
  // Special upfront ("à vista") price from the proposal; falls back to net value.
  const upfrontNum = parseFloat(String((content?.upfrontPrice as string) || '').replace(',', '.')) || 0;
  const avistaValue = upfrontNum > 0 ? upfrontNum : netValue;
  return {
    NOME_CLIENTE: client?.name || '',
    EMPRESA_CLIENTE: client?.company_name || '',
    EMAIL_CLIENTE: client?.email || '',
    CNPJ_CLIENTE: client?.cnpj || '',
    TELEFONE_CLIENTE: client?.phone || client?.whatsapp || '',
    CIDADE_CLIENTE: client?.city || '',
    ESTADO_CLIENTE: client?.state || '',
    NUMERO_PROPOSTA: proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase(),
    DATA_PROPOSTA: new Date(proposal.created_at).toLocaleDateString('pt-BR'),
    SERVICO: proposal.service_type || '',
    VALOR_BRUTO: `R$ ${Number(proposal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    VALOR_LIQUIDO: `R$ ${Number(netValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    VALOR_AVISTA: `R$ ${Number(avistaValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    DATA_INICIO: proposal.start_date ? new Date(proposal.start_date + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
    NUM_PARCELAS: String(installments.length || 1),
    DATA_HOJE: new Date().toLocaleDateString('pt-BR'),
  };
}

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
      <span className="text-xs text-[var(--color-ink-3)] self-center mr-1">Variáveis:</span>
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

// Resolve an additional section to its effective title/content.
// Template-linked sections read live from the current template (so edits
// propagate to every proposal); custom sections carry their own copy.
function resolveSection(section: AdditionalSection, templates: SectionTemplate[]): { title: string; content: string } | null {
  if (section.kind === 'template') {
    const t = templates.find(x => x.id === section.template_id);
    if (!t) return null; // template was deleted -> skip rendering
    return { title: t.title || '', content: t.content || '' };
  }
  return { title: section.title || '', content: section.content || '' };
}

// Renders the proposal's additional sections (used in both the print document
// and the in-form print preview). Placed before the Investment section.
function AdditionalSectionsRender({ sections, templates, rv }: {
  sections: AdditionalSection[] | null | undefined;
  templates: SectionTemplate[];
  rv: (text: string) => string;
}) {
  if (!sections || sections.length === 0) return null;
  return (
    <>
      {sections.map((section, idx) => {
        const resolved = resolveSection(section, templates);
        if (!resolved || (!resolved.title && !resolved.content)) return null;
        return (
          <section key={idx}>
            <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">{rv(resolved.title)}</h3>
            <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rv(resolved.content) }} />
          </section>
        );
      })}
    </>
  );
}

// -------------------------------------------------------------
// APPROVAL MODAL
// -------------------------------------------------------------
type ProposalData = { proposal: Proposal; client: Client | null };

// Parcela na tela de aprovação. boleto=true gera cobrança no Asaas; caso
// contrário usa `method` (forma de pagamento manual).
type InstallmentRow = { date: string; value: number; boleto: boolean; method: string };

function ApprovalModal({ target, bankAccounts, onClose, onDone }: {
  target: ProposalData;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const savedContent = target.proposal.content_json as Record<string, unknown> | null;
  const originalInstallments = (savedContent?.installments as { date: string; value: number }[]) || [];
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Formas de pagamento manuais (parcela que NÃO gera boleto no Asaas).
  const PAYMENT_METHODS = ['Pix', 'Cartão', 'Depósito', 'Dinheiro'];

  const [installments, setInstallments] = useState<InstallmentRow[]>(
    (originalInstallments.length > 0
      ? originalInstallments
      : [{ date: new Date().toISOString().split('T')[0], value: target.proposal.value }]
    ).map(x => ({ date: x.date, value: x.value, boleto: true, method: 'Pix' }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingDoc = target.client?.cnpj || target.client?.cpf || '';
  const [docNumber, setDocNumber] = useState(existingDoc);
  const [genBoletos, setGenBoletos] = useState(true);
  // Contas: boletos caem na conta Asaas (o trigger do banco garante mesmo se
  // esta lista estiver vazia); parcelas manuais vão para a conta escolhida.
  const activeAccounts = bankAccounts.filter(a => a.active && a.system_key !== 'asaas');
  const asaasAccountId = bankAccounts.find(a => a.system_key === 'asaas')?.id ?? null;
  const [manualAccountId, setManualAccountId] = useState<string>(
    activeAccounts.find(a => a.is_default)?.id || activeAccounts[0]?.id || ''
  );
  // Aprovação concluída mas boletos falharam: rows já foram lançadas, então o
  // fechamento precisa atualizar a lista (onDone), não descartar (onClose).
  const [approvedPartial, setApprovedPartial] = useState(false);
  // Guarda síncrona contra duplo-clique (o estado `loading` só desabilita o
  // botão no próximo render; o ref bloqueia na hora).
  const submitting = useRef(false);

  const clientName = target.client?.company_name || target.client?.name || 'Cliente';
  const serviceType = target.proposal.service_type || 'Serviço';
  const netValue = (savedContent?.netValue as number) || target.proposal.value;

  const updateDate = (i: number, d: string) => {
    const u = [...installments]; u[i] = { ...u[i], date: d }; setInstallments(u);
  };
  const updateValue = (i: number, v: number) => {
    const u = [...installments]; u[i] = { ...u[i], value: v }; setInstallments(u);
  };
  const updateBoleto = (i: number, b: boolean) => {
    const u = [...installments]; u[i] = { ...u[i], boleto: b }; setInstallments(u);
  };
  const updateMethod = (i: number, m: string) => {
    const u = [...installments]; u[i] = { ...u[i], method: m }; setInstallments(u);
  };

  const totalInstallments = installments.reduce((a, b) => a + b.value, 0);
  const isBalanced = Math.abs(totalInstallments - netValue) < 0.10;
  // Uma parcela vira boleto quando a integração está ligada E o check da linha
  // está marcado. As demais usam a forma de pagamento manual escolhida.
  const isBoletoRow = (inst: InstallmentRow) => genBoletos && inst.boleto;
  const anyBoleto = installments.some(isBoletoRow);

  const handleConfirm = async () => {
    // Trava anti-duplicação (camada 1): duplo-clique síncrono.
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      // Trava anti-duplicação (camada 2): se a proposta já teve parcelas
      // lançadas, não lança de novo (evita cobrar o cliente 2x).
      const { data: existing, error: existErr } = await supabase
        .from('cash_flow')
        .select('id')
        .eq('proposal_id', target.proposal.id)
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        setError('Esta proposta já teve as parcelas lançadas no Fluxo de Caixa. Para relançar, exclua as parcelas atuais antes.');
        setLoading(false);
        submitting.current = false;
        return;
      }

      // 1. Update proposal status to Approved
      const { error: propErr } = await supabase
        .from('proposals')
        .update({ status: 'Approved' })
        .eq('id', target.proposal.id);
      if (propErr) throw propErr;

      // 2. Persist the payer document (CPF/CNPJ) on the client, if informed.
      //    Boleto exige cpfCnpj; 11 dígitos = CPF, 14 = CNPJ.
      const docDigits = docNumber.replace(/\D/g, '');
      if (docDigits && target.proposal.client_id && docDigits !== existingDoc.replace(/\D/g, '')) {
        const col = docDigits.length > 11 ? 'cnpj' : 'cpf';
        await supabase.from('clients').update({ [col]: docNumber }).eq('id', target.proposal.client_id);
      }

      // 3. Insert cash_flow rows for each installment (linked to proposal/client).
      //    payment_method: 'Boleto' para as que vão ao Asaas; senão a forma manual.
      const rows = installments.map((inst, i) => ({
        type: 'Income' as CashFlowType,
        category: 'Projeto Fechado / Site' as CashFlowCategory,
        description: `Parcela ${i + 1}/${installments.length} – ${clientName} – ${serviceType}`,
        value: inst.value,
        date: inst.date,
        status: 'Pending' as CashFlowStatus,
        client_id: target.proposal.client_id,
        proposal_id: target.proposal.id,
        installment_number: i + 1,
        payment_method: isBoletoRow(inst) ? 'Boleto' : inst.method,
        account_id: isBoletoRow(inst) ? asaasAccountId : (manualAccountId || null),
      }));
      const { error: cfErr } = await supabase.from('cash_flow').insert(rows);
      if (cfErr) throw cfErr;

      // 4. Gera boleto só para as parcelas marcadas (a função filtra por
      //    payment_method = 'Boleto'). Pula se nenhuma parcela é boleto.
      if (anyBoleto) {
        const { data: gen, error: genErr } = await supabase.functions.invoke('asaas', {
          body: { action: 'generate', proposal_id: target.proposal.id },
        });
        if (genErr || gen?.error) {
          // Parcelas já foram lançadas; não bloqueia a aprovação. Avisa e deixa
          // o usuário gerar depois pelo botão no Fluxo de Caixa.
          setError(
            `Parcelas lançadas, mas os boletos não foram gerados: ${gen?.error || genErr?.message}. ` +
            `Você pode gerar depois no Fluxo de Caixa.`,
          );
          setApprovedPartial(true);
          setLoading(false);
          return;
        }
      }

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar. Tente novamente.');
    } finally {
      setLoading(false);
      submitting.current = false;
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
              <p className="text-[var(--color-ink-3)] text-xs uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-[var(--color-ink)] text-base">{clientName}</p>
            </div>
            <div className="text-right">
              <p className="text-[var(--color-ink-3)] text-xs uppercase tracking-wider">Serviço</p>
              <p className="font-medium text-[var(--color-ink-2)]">{serviceType}</p>
            </div>
            <div className="text-right">
              <p className="text-[var(--color-ink-3)] text-xs uppercase tracking-wider">Valor Líquido</p>
              <p className="font-bold text-green-600 text-lg">R$ {fmtBRL(netValue)}</p>
            </div>
          </div>
        </div>

        {/* Payer document + boleto toggle */}
        <div className="px-6 pt-4 pb-1">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">CPF / CNPJ do pagador</label>
              <input
                type="text"
                value={docNumber}
                onChange={e => setDocNumber(e.target.value)}
                placeholder="Obrigatório para gerar boleto"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] pb-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={genBoletos} onChange={e => setGenBoletos(e.target.checked)} className="w-4 h-4 accent-green-600 cursor-pointer" />
              Gerar boletos no Asaas
            </label>
          </div>
          {anyBoleto && !docNumber.trim() && (
            <p className="text-xs text-orange-500 mt-1">Informe o CPF/CNPJ do pagador para o boleto ser aceito pelo Asaas.</p>
          )}
          {installments.some(inst => !isBoletoRow(inst)) && activeAccounts.length > 0 && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Conta de recebimento (parcelas sem boleto)</label>
              <select value={manualAccountId} onChange={e => setManualAccountId(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="text-[11px] text-[var(--color-ink-3)] mt-1">Parcelas com boleto entram automaticamente na conta Asaas.</p>
            </div>
          )}
        </div>

        {/* Installments table */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          <p className="text-xs font-semibold text-[var(--color-ink-3)] uppercase tracking-wider mb-3">Parcelas a lançar ({installments.length}x)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--color-ink-3)] text-xs border-b border-gray-100">
                <th className="pb-2 text-left font-medium w-8">#</th>
                <th className="pb-2 text-left font-medium">Data de Vencimento</th>
                <th className="pb-2 text-left font-medium">Valor (R$)</th>
                <th className="pb-2 text-left font-medium">Pagamento</th>
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
                  <td className="py-2 pr-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-ink-3)] font-medium">R$</span>
                      <input type="number" step="0.01" value={inst.value}
                        onChange={e => updateValue(i, parseFloat(e.target.value) || 0)}
                        className="border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-36" />
                    </div>
                  </td>
                  <td className="py-2">
                    {genBoletos ? (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-2)] cursor-pointer whitespace-nowrap">
                          <input type="checkbox" checked={inst.boleto} onChange={e => updateBoleto(i, e.target.checked)}
                            className="w-4 h-4 accent-green-600 cursor-pointer" />
                          Boleto
                        </label>
                        {!inst.boleto && (
                          <select value={inst.method} onChange={e => updateMethod(i, e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        )}
                      </div>
                    ) : (
                      <select value={inst.method} onChange={e => updateMethod(i, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={2} className="pt-3 font-semibold text-[var(--color-ink-2)] text-sm">Total das Parcelas</td>
                <td className="pt-3">
                  <span className={`font-bold text-sm ${isBalanced ? 'text-green-600' : 'text-orange-500'}`}>
                    R$ {fmtBRL(totalInstallments)}
                  </span>
                  {!isBalanced && <p className="text-orange-500 text-xs mt-0.5">Difere do valor líquido em R$ {fmtBRL(Math.abs(totalInstallments - netValue))}</p>}
                </td>
                <td className="pt-3" />
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
          {approvedPartial ? (
            <button type="button" onClick={onDone}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg shadow-green-200">
              <CheckCircle size={16} /> Concluir
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={loading}
                className="px-5 py-2.5 border border-gray-200 text-[var(--color-ink-2)] rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-lg shadow-green-200">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {loading ? 'Aprovando...' : 'Confirmar e Lançar no Fluxo de Caixa'}
              </button>
            </>
          )}
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
        <span className="text-sm font-semibold text-[var(--color-ink-2)]">Gráfico de Gantt</span>
        <span className="ml-auto text-xs text-[var(--color-ink-3)]">{totalDays} dias úteis</span>
      </div>

      {/* Date markers */}
      <div className="relative h-5 ml-28 mr-16 mb-1 select-none">
        {markers.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 text-[9px] text-[var(--color-ink-3)] whitespace-nowrap"
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
              <span className="text-[11px] font-medium text-[var(--color-ink-2)] block truncate" title={row.name}>{row.name}</span>
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
              {row.endLabel && <span className="text-[10px] text-[var(--color-ink-3)]">até {row.endLabel}</span>}
            </div>
          </div>
        ))}
      </div>

      {startDate && (
        <div className="mt-3 pt-3 border-t border-white/40 text-xs text-[var(--color-ink-3)] flex gap-4">
          <span>Início: <strong className="text-[var(--color-ink-2)]">{new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
          <span>Entrega: <strong className="text-[var(--color-ink-2)]">{calculateBusinessEndDate(startDate, totalDays)?.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong></span>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// PROPOSALS VIEW (LISTING & CRUD)
// -------------------------------------------------------------

function ProposalPrintDocument({ proposal, client, sectionTemplates }: { proposal: Proposal; client: Client | null; sectionTemplates: SectionTemplate[] }) {
  const resolveVars = (text: string, vars: Record<string, string>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');

  const savedContent = proposal.content_json as Record<string, unknown> | null;
  const installments = (savedContent?.installments as { date: string; value: number }[]) || [];
  const discountAmt = (savedContent?.discountAmt as number) || 0;
  const discountType = (savedContent?.discountType as string) || 'fixed';
  const discountRaw = (savedContent?.discountValue as string) || '0';
  const upfrontPrice = (savedContent?.upfrontPrice as string) || '';
  const netValue = (savedContent?.netValue as number) ?? Number(proposal.value);
  const extraServicesPrint = (savedContent?.extraServices as { serviceType: string; value: string }[]) || [];
  const firstServiceValue = (savedContent?.firstServiceValue as string) || '';
  const brand = (savedContent?.brand as 'octo' | 'vinicius' | 'procurada') || 'octo';
  const firstServiceNumeric = parseFloat(firstServiceValue) || (Number(proposal.value) - extraServicesPrint.reduce((s, e) => s + (parseFloat(e.value) || 0), 0));
  const allServicesPrint = [
    { serviceType: proposal.service_type || 'Serviço', value: firstServiceNumeric },
    ...extraServicesPrint.map(e => ({ serviceType: e.serviceType, value: parseFloat(e.value) || 0 }))
  ];
  const fmtPrint = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        {brand === 'vinicius' ? (
          <h1 className="text-3xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
            Vinicius<br />Kolling.
          </h1>
        ) : brand === 'procurada' ? (
          <h1 className="text-3xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
            agência<br />PROCURADA.
          </h1>
        ) : (
          <h1 className="text-4xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
            agência<br />OCTO.
          </h1>
        )}
        <div className="h-12 w-px bg-gray-300 mx-2"></div>
        <div>
          <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase">Proposta de</p>
          <p className="text-2xl font-black tracking-tight text-[#C13584] uppercase mt-1">{proposal.service_type || 'Serviço'}</p>
        </div>
        <div className="ml-auto text-right text-xs text-[var(--color-ink-3)]">
          <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
          <p className="font-mono font-bold text-[var(--color-ink-2)] mt-1">#{propId}</p>
        </div>
      </div>

      {/* Client info */}
      {client && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-[var(--color-ink-3)] uppercase tracking-wider mb-1">Preparado para</p>
          <p className="text-xl font-bold text-[var(--color-ink)]">{client.company_name || client.name}</p>
          {client.company_name && <p className="text-sm text-[var(--color-ink-2)]">{client.name}</p>}
        </div>
      )}

      <div className="space-y-10 text-[var(--color-ink)] text-sm">
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
            <p className="mb-4 text-[var(--color-ink-2)]">
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
        {/* Additional sections (linked templates or custom) — before Investment */}
        <AdditionalSectionsRender sections={proposal.additional_sections} templates={sectionTemplates} rv={rv} />

        <section>
          <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">5. Investimento e Condições de Pagamento</h3>
          {proposal.investment_text && (
            <div className="mb-6 leading-relaxed text-[var(--color-ink-2)]" dangerouslySetInnerHTML={{ __html: rv(proposal.investment_text) }} />
          )}

          {upfrontPrice && (
            <div style={{ backgroundColor: '#ffe8cc', padding: '12px 16px', borderLeft: '4px solid #f97316', marginBottom: '1.5rem', color: '#1f2937', fontSize: '14px' }}>
              <strong>Condição Especial:</strong> Para pagamento à vista do valor total na entrada do projeto, será aplicado um <strong>desconto especial</strong>, com o valor total de investimento de <strong>R$ {Number(upfrontPrice.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '2px solid #C13584' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#C13584', fontWeight: 700 }}>Serviço</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#C13584', fontWeight: 700 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {allServicesPrint.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{s.serviceType}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>R$ {fmtPrint(s.value)}</td>
                </tr>
              ))}
              {allServicesPrint.length > 1 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontStyle: 'italic' }}>Subtotal</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>R$ {fmtPrint(allServicesPrint.reduce((s, e) => s + e.value, 0))}</td>
                </tr>
              )}
              {discountAmt > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>Desconto ({discountType === 'percent' ? `${discountRaw}%` : 'fixo'})</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>- R$ {fmtPrint(discountAmt)}</td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#fdf2f8' }}>
                <td style={{ padding: '12px 12px', fontWeight: 800, fontSize: '15px' }}>Valor Total Líquido</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#C13584' }}>R$ {fmtPrint(netValue)}</td>
              </tr>
            </tbody>
          </table>
          {installments.length > 0 && (
            <>
              <p className="font-semibold text-[var(--color-ink-2)] mb-3">Condições de Pagamento — {installments.length}x parcela(s):</p>
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
          <p className="mt-10 pt-6 border-t border-gray-200 text-xs text-[var(--color-ink-3)]">
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
function ProposalsView({ proposals, refetch, onEditProposal, onApproveProposal, onPrintProposal, onGenerateContract }: {
  proposals: { proposal: Proposal; client: Client | null }[];
  refetch: () => void;
  onEditProposal: (p: ProposalData) => void;
  onApproveProposal: (p: ProposalData) => void;
  onPrintProposal: (p: { proposal: Proposal; client: Client | null }) => void;
  onGenerateContract: (p: { proposal: Proposal; client: Client | null }) => void;
}) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const getStatusBadge = (status: ProposalStatus) => {
    switch (status) {
      case 'Draft': return <span className="badge badge-warning">Rascunho</span>;
      case 'Sent': return <span className="badge badge-info">Enviado</span>;
      case 'Approved': return <span className="badge badge-success">Aprovado</span>;
      case 'Rejected': return <span className="badge badge-danger">Rejeitado</span>;
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
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente ou serviço..."
            className="field-input w-full sm:w-80 pr-10"
          />
        </div>
        <button className="btn-secondary">
          <Filter size={16} />
          Filtrar
        </button>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="p-4 pl-6 font-medium w-24">Nº</th>
            <th className="p-4 font-medium">Cliente / Serviço</th>
            <th className="p-4 font-medium">Valor</th>
            <th className="p-4 font-medium">Valor com Desconto</th>
            <th className="p-4 font-medium">Cabeçalho</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-[var(--color-ink-3)]">
                {search ? `Nenhuma proposta encontrada para "${search}".` : 'Nenhuma proposta cadastrada ainda.'}
              </td>
            </tr>
          ) : (
            filtered.map((p) => (
              <tr key={p.proposal.id} className="border-b border-white/45 hover:bg-white/55 transition-colors">
                <td className="p-4 pl-6">
                  <span className="inline-block font-mono font-bold text-xs text-[#C13584] bg-pink-50 border border-pink-100 px-2 py-1 rounded-lg tracking-widest">
                    #{proposalNumber(p.proposal.id)}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-bold text-[var(--color-ink)]">{p.client?.name || 'Cliente Removido'}</div>
                  <div className="text-sm text-[var(--color-ink-3)] font-normal mt-0.5">{p.proposal.service_type}</div>
                  <div className="text-xs text-[var(--color-ink-3)] font-normal mt-0.5">{new Date(p.proposal.created_at).toLocaleDateString('pt-BR')}</div>
                </td>
                <td className="p-4 font-medium text-[var(--color-ink-2)]">
                  <span className="whitespace-nowrap">R$ {Number(p.proposal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </td>
                <td className="p-4 font-medium text-[var(--color-ink-2)]">
                  {(() => {
                    const content = p.proposal.content_json as { discountAmt?: number; netValue?: number } | null;
                    const discountAmt = Number(content?.discountAmt) || 0;
                    if (discountAmt <= 0) return <span className="text-gray-300">—</span>;
                    const netValue = Number(content?.netValue) || 0;
                    return <span className="whitespace-nowrap text-green-700">R$ {netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>;
                  })()}
                </td>
                <td className="p-4">
                  {(() => {
                    const content = p.proposal.content_json as { brand?: string } | null;
                    const brand = content?.brand === 'vinicius' ? 'vinicius'
                      : content?.brand === 'procurada' ? 'procurada'
                      : 'octo';
                    if (brand === 'vinicius') {
                      return <span className="badge badge-purple">Vinicius Kolling</span>;
                    }
                    if (brand === 'procurada') {
                      return <span className="badge badge-warning">agência Procurada</span>;
                    }
                    return <span className="badge badge-brand">agência OCTO.</span>;
                  })()}
                </td>
                <td className="p-4">
                  {getStatusBadge(p.proposal.status)}
                </td>
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-3 text-[var(--color-ink-3)]">
                    {p.proposal.status !== 'Approved' && (
                      <button onClick={() => onApproveProposal(p)} className="hover:text-green-600 transition-colors cursor-pointer" title="Aprovar Proposta">
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button onClick={() => onPrintProposal(p)} className="hover:text-blue-500 transition-colors cursor-pointer" title="Imprimir / Gerar PDF">
                      <Printer size={16} />
                    </button>
                    <button onClick={() => onGenerateContract(p)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Gerar Contrato">
                      <FileSignature size={16} />
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
      <div className="flex gap-2 glass-card p-1.5 w-fit">
        {(['Income', 'Expense'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${tab === t
              ? t === 'Income' ? 'bg-green-500 text-white shadow-md' : 'bg-red-500 text-white shadow-md'
              : 'text-[var(--color-ink-3)] hover:bg-white/60'
              }`}>
            {t === 'Income' ? '➕ Receitas' : '➖ Despesas'}
          </button>
        ))}
      </div>

      {/* Add form */}
      <div className="glass-panel p-6">
        <h4 className="font-semibold text-[var(--color-ink-2)] mb-4 text-sm uppercase tracking-wider">
          Nova categoria de {tab === 'Income' ? 'Receita' : 'Despesa'}
        </h4>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Nome</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required
              placeholder={tab === 'Income' ? 'Ex: Mensalidade, Consultoria...' : 'Ex: Aluguel, Fornecedor...'}
              className="field-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Cor</label>
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
            className="px-5 py-2.5 btn-primary flex-shrink-0">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Adicionar
          </button>
        </form>
      </div>

      {/* Category list */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20">
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">{filtered.length} categoria{filtered.length !== 1 ? 's' : ''} de {tab === 'Income' ? 'Receita' : 'Despesa'}</p>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-ink-3)] text-sm">Nenhuma categoria cadastrada ainda.</div>
        ) : (
          <ul className="divide-y divide-white/30">
            {filtered.map(cat => (
              <li key={cat.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-[var(--color-ink)]">{cat.name}</span>
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
function CashFlowAllView({ cashFlows, bankAccounts, onEditCashFlow, refetch }: {
  cashFlows: CashFlow[];
  bankAccounts: BankAccount[];
  onEditCashFlow: (c: CashFlow) => void;
  refetch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Income' | 'Expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Paid' | 'Pending'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const markPaid = async (c: CashFlow) => {
    setPayingId(c.id);
    const { error } = await supabase.from('cash_flow').update({ status: 'Paid' }).eq('id', c.id);
    if (error) alert(`Não foi possível marcar como pago: ${error.message}`);
    await refetch();
    setPayingId(null);
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const filtered = cashFlows.filter(c => {
    const matchSearch = !search || (c.description || '').toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.type === filterType;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchCategory = filterCategory === 'all' || c.category === filterCategory;
    const matchAccount = filterAccount === 'all' || (filterAccount === 'none' ? !c.account_id : c.account_id === filterAccount);
    return matchSearch && matchType && matchStatus && matchCategory && matchAccount;
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
    // Parcela não paga com boleto: cancela no Asaas antes de apagar.
    const temBoletoAtivo = !!c.asaas_payment_id && c.status !== 'Paid';
    const msg = temBoletoAtivo
      ? `Excluir "${c.description || 'sem descrição'}"? O boleto também será cancelado no Asaas.`
      : `Excluir "${c.description || 'sem descrição'}"?`;
    if (!confirm(msg)) return;
    setIsDeleting(c.id);
    if (temBoletoAtivo) {
      const { data, error } = await supabase.functions.invoke('asaas', {
        body: { action: 'cancel', payment_id: c.asaas_payment_id },
      });
      if (error || data?.error) {
        alert(`Não foi possível cancelar o boleto: ${data?.error || error?.message}. A parcela não foi excluída.`);
        setIsDeleting(null);
        return;
      }
    }
    await supabase.from('cash_flow').delete().eq('id', c.id);
    setSelected(prev => { const n = new Set(prev); n.delete(c.id); return n; });
    refetch();
    setIsDeleting(null);
  };

  const handleBulkDelete = async () => {
    const rows = cashFlows.filter(c => selected.has(c.id));
    const comBoleto = rows.filter(c => c.asaas_payment_id && c.status !== 'Paid').length;
    const aviso = comBoleto > 0 ? ` ${comBoleto} boleto(s) não pago(s) também serão cancelados no Asaas.` : '';
    if (!confirm(`Excluir ${selected.size} lançamento(s) selecionado(s)?${aviso}`)) return;
    setIsBulkDeleting(true);

    // Cancela os boletos não pagos um a um; só apaga os que deram certo.
    const okIds: string[] = [];
    const falhas: string[] = [];
    for (const c of rows) {
      if (c.asaas_payment_id && c.status !== 'Paid') {
        const { data, error } = await supabase.functions.invoke('asaas', {
          body: { action: 'cancel', payment_id: c.asaas_payment_id },
        });
        if (error || data?.error) { falhas.push(c.description || c.id); continue; }
      }
      okIds.push(c.id);
    }
    if (okIds.length) await supabase.from('cash_flow').delete().in('id', okIds);
    setSelected(new Set());
    refetch();
    setIsBulkDeleting(false);
    if (falhas.length) {
      alert(`Não foi possível cancelar o boleto de ${falhas.length} lançamento(s), que NÃO foram excluídos:\n- ${falhas.join('\n- ')}`);
    }
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

  // Extrato agrupado por mês (a lista cobre todos os meses), mais recente primeiro.
  const monthGroups = (() => {
    const map = new Map<string, CashFlow[]>();
    for (const c of filtered) {
      const key = c.date.slice(0, 7);
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)] pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por descrição ou categoria..."
            className="field-input pl-9" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          className="field-input cursor-pointer sm:flex-none" style={{ width: 'auto' }}>
          <option value="all">Todos os tipos</option>
          <option value="Income">Receitas</option>
          <option value="Expense">Despesas</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="field-input cursor-pointer sm:flex-none" style={{ width: 'auto' }}>
          <option value="all">Todos os status</option>
          <option value="Paid">Pago</option>
          <option value="Pending">Pendente</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="field-input cursor-pointer sm:flex-none" style={{ width: 'auto' }}>
          <option value="all">Todas as categorias</option>
          {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
          className="field-input cursor-pointer sm:flex-none" style={{ width: 'auto' }}>
          <option value="all">Todas as contas</option>
          <option value="none">Sem conta</option>
          {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
          <button onClick={() => setSelected(new Set())} className="text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)] cursor-pointer text-sm">Cancelar</button>
        </div>
      )}

      {/* Extrato (mesma linguagem visual do Por Mês), agrupado por mês */}
      <div className="glass-panel overflow-hidden [font-variant-numeric:tabular-nums]">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-white/50 bg-white/25">
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-3)] cursor-pointer select-none">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-4 h-4 rounded accent-[#C13584] cursor-pointer" />
            Selecionar tudo
          </label>
          <span className="ml-auto text-xs text-[var(--color-ink-3)]">
            {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--color-ink-3)]">Nenhum lançamento com estes filtros.</div>
        ) : (
          <div className="pb-1">
            {monthGroups.map(([monthKey, items]) => (
              <div key={monthKey}>
                {/* Divisor do mês */}
                <div className="flex items-baseline gap-2 px-4 sm:px-6 pt-5 pb-1">
                  <span className="text-[13px] font-bold text-[var(--color-ink)]">{monthLabel(monthKey)}</span>
                  <div className="flex-1 self-center h-px bg-[var(--color-ink)]/8" />
                </div>
                <ul>
                  {items.map(c => {
                    const acc = bankAccounts.find(a => a.id === c.account_id);
                    const isIncome = c.type === 'Income';
                    const isSelected = selected.has(c.id);
                    const metaText = [c.category, acc?.name].filter(Boolean).join(' · ');
                    return (
                      <li key={c.id} onClick={() => onEditCashFlow(c)} title="Editar lançamento"
                        className={`group flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors cursor-pointer ${isSelected ? 'bg-[var(--color-primary-50)]/50' : 'hover:bg-white/50'}`}>
                        <input type="checkbox" checked={isSelected}
                          onClick={e => e.stopPropagation()} onChange={() => toggleOne(c.id)}
                          className="w-4 h-4 rounded accent-[#C13584] cursor-pointer flex-shrink-0" />
                        <span className="w-10 text-[11.5px] text-[var(--color-ink-3)] font-medium flex-shrink-0">
                          {new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <CashStatusIcon c={c} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-ink)] truncate">{c.description || c.category}</p>
                          <p className="truncate mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">{metaText}</p>
                        </div>
                        {/* Largura/altura fixas para o valor alinhar igual em todas as linhas */}
                        <div className="flex flex-col items-end flex-shrink-0 gap-1">
                          <span className={`text-sm font-semibold whitespace-nowrap ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {isIncome ? '+' : '−'} R$ {fmtBRL(Number(c.value))}
                          </span>
                          <span onClick={e => e.stopPropagation()} className="flex items-center justify-end h-4 min-w-4">
                            <PaymentSlot c={c} />
                          </span>
                        </div>
                        <div onClick={e => e.stopPropagation()}
                          className="flex items-center justify-end w-[64px] flex-shrink-0 text-[var(--color-ink-3)] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {c.status === 'Pending' && (
                            <button onClick={() => markPaid(c)} disabled={payingId === c.id} title="Marcar como pago"
                              className="p-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors cursor-pointer disabled:opacity-50">
                              {payingId === c.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            </button>
                          )}
                          <button onClick={() => handleSingleDelete(c)} disabled={isDeleting === c.id} title="Excluir"
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer">
                            {isDeleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CASHFLOW VIEW
// -------------------------------------------------------------
function CashFlowView({ cashFlows, bankAccounts, onEditCashFlow, refetch }: {
  cashFlows: CashFlow[];
  bankAccounts: BankAccount[];
  onEditCashFlow: (c: CashFlow) => void;
  refetch: () => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<'all' | 'income' | 'expense' | 'pending' | 'overdue'>('all');

  const handleDelete = async (c: CashFlow) => {
    // Parcela não paga com boleto: cancela no Asaas antes de apagar, senão o
    // boleto continua ativo (o cliente ainda poderia pagar). Parcela já paga:
    // apaga só do sistema, mantendo o registro no Asaas.
    const temBoletoAtivo = !!c.asaas_payment_id && c.status !== 'Paid';
    const msg = temBoletoAtivo
      ? `Excluir "${c.description || 'sem descrição'}"? O boleto também será cancelado no Asaas.`
      : `Excluir o lançamento "${c.description || 'sem descrição'}"?`;
    if (!confirm(msg)) return;

    setIsDeleting(c.id);
    if (temBoletoAtivo) {
      const { data, error } = await supabase.functions.invoke('asaas', {
        body: { action: 'cancel', payment_id: c.asaas_payment_id },
      });
      if (error || data?.error) {
        alert(`Não foi possível cancelar o boleto: ${data?.error || error?.message}. A parcela não foi excluída.`);
        setIsDeleting(null);
        return;
      }
    }
    await supabase.from('cash_flow').delete().eq('id', c.id);
    refetch();
    setIsDeleting(null);
  };

  // Gera os boletos das parcelas pendentes desta proposta (uma por parcela).
  const handleGenerateBoleto = async (c: CashFlow) => {
    if (!c.proposal_id) return;
    setGenId(c.id);
    const { data, error } = await supabase.functions.invoke('asaas', {
      body: { action: 'generate', proposal_id: c.proposal_id },
    });
    setGenId(null);
    if (error || data?.error) {
      alert(`Não foi possível gerar o boleto: ${data?.error || error?.message}`);
    }
    refetch();
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

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = (c: CashFlow) => c.status === 'Pending' && c.date < today;

  const monthCashFlows = cashFlows.filter(c => {
    const d = new Date(c.date + 'T00:00:00'); // Parse as local timezone to avoid UTC shift
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Filtro rápido aplicado sobre o mês exibido.
  const filteredCashFlows = monthCashFlows.filter(c => {
    if (quickFilter === 'income') return c.type === 'Income';
    if (quickFilter === 'expense') return c.type === 'Expense';
    if (quickFilter === 'pending') return c.status === 'Pending';
    if (quickFilter === 'overdue') return isOverdue(c);
    return true;
  });

  // Extrato: dias em ordem cronológica, lançamentos agrupados por dia.
  const dayGroups = (() => {
    const map = new Map<string, CashFlow[]>();
    for (const c of [...filteredCashFlows].sort((a, b) => a.date.localeCompare(b.date))) {
      const list = map.get(c.date) || [];
      list.push(c);
      map.set(c.date, list);
    }
    return [...map.entries()];
  })();

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthName = monthNames[currentMonth];

  // Totais do mês, separando realizado (Pago) do previsto (Pendente).
  const sum = (arr: CashFlow[]) => arr.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
  const incomePaid = sum(monthCashFlows.filter(c => c.type === 'Income' && c.status === 'Paid'));
  const incomePending = sum(monthCashFlows.filter(c => c.type === 'Income' && c.status === 'Pending'));
  const expensePaid = sum(monthCashFlows.filter(c => c.type === 'Expense' && c.status === 'Paid'));
  const expensePending = sum(monthCashFlows.filter(c => c.type === 'Expense' && c.status === 'Pending'));
  const totalIncome = incomePaid + incomePending;
  const totalExpense = expensePaid + expensePending;
  const overdueMonth = monthCashFlows.filter(isOverdue);

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const markPaid = async (c: CashFlow) => {
    setPayingId(c.id);
    const { error } = await supabase.from('cash_flow').update({ status: 'Paid' }).eq('id', c.id);
    if (error) alert(`Não foi possível marcar como pago: ${error.message}`);
    await refetch();
    setPayingId(null);
  };

  const FILTERS = [
    ['all', 'Tudo'], ['income', 'Receitas'], ['expense', 'Despesas'], ['pending', 'Pendentes'], ['overdue', 'Vencidos'],
  ] as const;

  const previsto = totalIncome - totalExpense;

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl [font-variant-numeric:tabular-nums]">
      {/* Painel do mês: navegação + resumo em 3 colunas */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-6 pt-5 pb-4">
          <h3 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
            {monthName} <span className="font-normal text-[var(--color-ink-3)]">{currentYear}</span>
          </h3>
          <div className="ml-auto flex items-center gap-2">
            {!(currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()) && (
              <button onClick={handleCurrentMonth} className="btn-secondary text-xs px-3 py-1.5">Hoje</button>
            )}
            <div className="flex items-center bg-white/60 border border-white/80 rounded-xl p-0.5 shadow-sm">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors text-[var(--color-ink-3)] cursor-pointer" aria-label="Mês anterior">
                <ChevronLeft size={17} />
              </button>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors text-[var(--color-ink-3)] cursor-pointer" aria-label="Próximo mês">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/50 border-t border-white/50 bg-white/20">
          <div className="px-4 sm:px-6 py-4">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)] mb-1">Receitas</p>
            <p className="text-base sm:text-2xl font-bold tracking-tight text-emerald-600 truncate">R$ {fmtBRL(totalIncome)}</p>
            <div className="mt-2 h-1 rounded-full bg-emerald-500/15 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${totalIncome > 0 ? (incomePaid / totalIncome) * 100 : 0}%` }} />
            </div>
            <p className="hidden sm:block text-xs text-[var(--color-ink-3)] mt-1.5">Recebido R$ {fmtBRL(incomePaid)} · A receber R$ {fmtBRL(incomePending)}</p>
            <p className="sm:hidden text-[10px] text-[var(--color-ink-3)] mt-1">Recebido {Math.round(totalIncome > 0 ? (incomePaid / totalIncome) * 100 : 0)}%</p>
          </div>
          <div className="px-4 sm:px-6 py-4">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)] mb-1">Despesas</p>
            <p className="text-base sm:text-2xl font-bold tracking-tight text-rose-600 truncate">R$ {fmtBRL(totalExpense)}</p>
            <div className="mt-2 h-1 rounded-full bg-rose-500/15 overflow-hidden">
              <div className="h-full rounded-full bg-rose-500" style={{ width: `${totalExpense > 0 ? (expensePaid / totalExpense) * 100 : 0}%` }} />
            </div>
            <p className="hidden sm:block text-xs text-[var(--color-ink-3)] mt-1.5">Pago R$ {fmtBRL(expensePaid)} · A pagar R$ {fmtBRL(expensePending)}</p>
            <p className="sm:hidden text-[10px] text-[var(--color-ink-3)] mt-1">Pago {Math.round(totalExpense > 0 ? (expensePaid / totalExpense) * 100 : 0)}%</p>
          </div>
          <div className="px-4 sm:px-6 py-4">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)] mb-1">Resultado previsto</p>
            <p className={`text-base sm:text-2xl font-bold tracking-tight truncate ${previsto >= 0 ? 'text-[var(--color-ink)]' : 'text-rose-600'}`}>R$ {fmtBRL(previsto)}</p>
            <p className="hidden sm:block text-xs text-[var(--color-ink-3)] mt-[18px]">Realizado até agora: <span className={`font-semibold ${incomePaid - expensePaid >= 0 ? 'text-[var(--color-ink-2)]' : 'text-rose-600'}`}>R$ {fmtBRL(incomePaid - expensePaid)}</span></p>
            <p className="sm:hidden text-[10px] text-[var(--color-ink-3)] mt-1">Realizado R$ {fmtBRL(incomePaid - expensePaid)}</p>
          </div>
        </div>
      </div>

      {/* Extrato do mês */}
      <div className="glass-panel overflow-hidden">
        {/* Filtros do extrato (rolagem horizontal no mobile) */}
        <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 border-b border-white/50 bg-white/25 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setQuickFilter(key)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${quickFilter === key
                ? key === 'overdue' ? 'bg-rose-500 text-white shadow-sm' : 'bg-[var(--color-ink)] text-white shadow-sm'
                : 'text-[var(--color-ink-3)] hover:bg-white/70 hover:text-[var(--color-ink)]'}`}>
              {label}{key === 'overdue' && overdueMonth.length > 0 ? ` · ${overdueMonth.length}` : ''}
            </button>
          ))}
          <span className="ml-auto hidden sm:block text-xs text-[var(--color-ink-3)] flex-shrink-0 pl-3">
            {filteredCashFlows.length} lançamento{filteredCashFlows.length !== 1 ? 's' : ''}
          </span>
        </div>

        {dayGroups.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--color-ink-3)]">
            {monthCashFlows.length === 0
              ? `Nenhum lançamento em ${monthName}. Use "Novo Registro" para adicionar receitas e despesas.`
              : 'Nada por aqui com este filtro.'}
          </div>
        ) : (
          <div className="pb-1">
            {dayGroups.map(([date, items]) => {
              const d = new Date(date + 'T12:00:00');
              const isToday = date === today;
              const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' }).split(',')[0];
              return (
                <div key={date}>
                  {/* Divisor do dia */}
                  <div className="flex items-baseline gap-2 px-4 sm:px-6 pt-5 pb-1">
                    <span className={`text-[13px] font-bold ${isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]'}`}>
                      {String(d.getDate()).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-[var(--color-ink-3)]">{weekday}{isToday ? ' · hoje' : ''}</span>
                    <div className="flex-1 self-center h-px bg-[var(--color-ink)]/8" />
                  </div>
                  {/* Lançamentos do dia — linha inteira clica para editar */}
                  <ul>
                    {items.map(c => {
                      const acc = bankAccounts.find(a => a.id === c.account_id);
                      const isIncome = c.type === 'Income';
                      const metaText = [c.category, acc?.name].filter(Boolean).join(' · ');
                      return (
                        <li key={c.id} onClick={() => onEditCashFlow(c)} title="Editar lançamento"
                          className="group flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-white/50 transition-colors cursor-pointer">
                          <CashStatusIcon c={c} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-ink)] truncate">{c.description || c.category}</p>
                            <p className="truncate mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">{metaText}</p>
                          </div>
                          {/* Largura/altura fixas para o valor alinhar igual em todas as linhas */}
                          <div className="flex flex-col items-end flex-shrink-0 gap-1">
                            <span className={`text-sm font-semibold whitespace-nowrap ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {isIncome ? '+' : '−'} R$ {fmtBRL(Number(c.value))}
                            </span>
                            <span onClick={e => e.stopPropagation()} className="flex items-center justify-end h-4 min-w-4">
                              <PaymentSlot c={c} genBusy={genId === c.id} onGenerate={handleGenerateBoleto} />
                            </span>
                          </div>
                          <div onClick={e => e.stopPropagation()}
                            className="flex items-center justify-end w-[64px] flex-shrink-0 text-[var(--color-ink-3)] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {c.status === 'Pending' && (
                              <button onClick={() => markPaid(c)} disabled={payingId === c.id} title="Marcar como pago"
                                className="p-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors cursor-pointer disabled:opacity-50">
                                {payingId === c.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                              </button>
                            )}
                            <button onClick={() => handleDelete(c)} disabled={isDeleting === c.id} title="Excluir"
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer">
                              {isDeleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PROPOSAL FORM VIEW (Create/Edit full page form)
// -------------------------------------------------------------
function ProposalFormView({ proposalData, services, clients, sectionTemplates, onSave, onCancel, onApprove, onPrint }: {
  proposalData: { proposal: Proposal; client: Client | null } | null;
  services: Service[];
  clients: Client[];
  sectionTemplates: SectionTemplate[];
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
  const savedContent = proposalData?.proposal.content_json as Record<string, unknown> | null;
  const [value, setValue] = useState((savedContent?.firstServiceValue as string) || proposalData?.proposal.value.toString() || '');
  const [status, setStatus] = useState<ProposalStatus>(proposalData?.proposal.status || 'Draft');

  const [visionText, setVisionText] = useState(proposalData?.proposal.vision_text || '');
  const [engineText, setEngineText] = useState(proposalData?.proposal.engine_text || '');
  const [scopeText, setScopeText] = useState(proposalData?.proposal.scope_text || '');
  const [investmentText, setInvestmentText] = useState(proposalData?.proposal.investment_text || '');
  const [startDate, setStartDate] = useState(proposalData?.proposal.start_date || '');
  const [phases, setPhases] = useState<ProposalPhase[]>(proposalData?.proposal.project_phases || []);

  // Additional sections (linked templates or custom one-offs)
  const [additionalSections, setAdditionalSections] = useState<AdditionalSection[]>(proposalData?.proposal.additional_sections || []);
  const [templateToAdd, setTemplateToAdd] = useState<string>('');

  const addCustomSection = () => setAdditionalSections([...additionalSections, { kind: 'custom', title: '', content: '' }]);
  const addTemplateSection = (templateId: string) => {
    if (!templateId) return;
    if (additionalSections.some(s => s.kind === 'template' && s.template_id === templateId)) return; // avoid duplicates
    setAdditionalSections([...additionalSections, { kind: 'template', template_id: templateId }]);
    setTemplateToAdd('');
  };
  // Templates allowed for the selected service. Templates with no services
  // marked are available everywhere; with a service selected, only its
  // templates (plus the unrestricted ones) are offered.
  const allowedTemplates = sectionTemplates.filter(t =>
    !t.service_ids || t.service_ids.length === 0 || (serviceId !== '' && t.service_ids.includes(serviceId))
  );
  // Allowed templates not yet attached to this proposal (drives the dropdown and the bulk-add button)
  const remainingTemplates = allowedTemplates.filter(t =>
    !additionalSections.some(s => s.kind === 'template' && s.template_id === t.id)
  );
  const hiddenTemplatesCount = sectionTemplates.length - allowedTemplates.length;
  const addAllTemplateSections = () => {
    if (remainingTemplates.length === 0) return;
    setAdditionalSections([
      ...additionalSections,
      ...remainingTemplates.map(t => ({ kind: 'template' as const, template_id: t.id })),
    ]);
  };
  const removeSection = (index: number) => setAdditionalSections(additionalSections.filter((_, i) => i !== index));
  const updateCustomSection = (index: number, field: 'title' | 'content', val: string) => {
    setAdditionalSections(additionalSections.map((s, i) => (i === index && s.kind === 'custom') ? { ...s, [field]: val } : s));
  };
  // "Personalizar nesta proposta": copy the live template content into a custom
  // section and break the link, so edits here no longer affect other proposals.
  const detachSection = (index: number) => {
    setAdditionalSections(additionalSections.map((s, i) => {
      if (i !== index || s.kind !== 'template') return s;
      const t = sectionTemplates.find(x => x.id === s.template_id);
      return { kind: 'custom', title: t?.title || '', content: t?.content || '' };
    }));
  };

  // Header brand
  const [brand, setBrand] = useState<'octo' | 'vinicius' | 'procurada'>((savedContent?.brand as 'octo' | 'vinicius' | 'procurada') || 'octo');

  // Discount
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>((savedContent?.discountType as 'fixed' | 'percent') || 'fixed');
  const [discountRaw, setDiscountRaw] = useState<string>((savedContent?.discountValue as string) || '0');
  const [upfrontPrice, setUpfrontPrice] = useState<string>((savedContent?.upfrontPrice as string) || '');

  // Extra services
  const [extraServices, setExtraServices] = useState<{ serviceType: string; value: string }[]>(
    (savedContent?.extraServices as { serviceType: string; value: string }[]) || []
  );

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

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...phases];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setPhases(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const addExtraService = () => setExtraServices([...extraServices, { serviceType: '', value: '' }]);
  const updateExtraService = (index: number, field: 'serviceType' | 'value', val: string) => {
    const updated = [...extraServices];
    updated[index] = { ...updated[index], [field]: val };
    setExtraServices(updated);
  };
  const removeExtraService = (index: number) => setExtraServices(extraServices.filter((_, i) => i !== index));

  // --- Computed discount / net value ---
  const firstServiceValue = parseFloat(value) || 0;
  const extraServicesTotal = extraServices.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
  const grossValue = firstServiceValue + extraServicesTotal;
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
      const payload = {
        service_id: serviceId || null,
        service_type: serviceTypeStr,
        value: grossValue,
        status: status,
        vision_text: visionText,
        engine_text: engineText,
        scope_text: scopeText,
        investment_text: investmentText,
        start_date: startDate ? startDate : null,
        project_phases: phases,
        additional_sections: additionalSections,
        content_json: { brand, discountType, discountValue: discountRaw, discountAmt, netValue, numInstallments, installments, upfrontPrice, extraServices, firstServiceValue: value }
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
      value: grossValue,
      status,
      vision_text: visionText,
      engine_text: engineText,
      scope_text: scopeText,
      investment_text: investmentText,
      project_phases: phases,
      additional_sections: additionalSections,
      start_date: startDate || null,
      content_json: { brand, discountType, discountValue: discountRaw, discountAmt, netValue, numInstallments, installments, upfrontPrice, extraServices, firstServiceValue: value },
      created_at: proposalData?.proposal.created_at || new Date().toISOString(),
    };
    const syntheticClient: Client | null = clientMode === 'existing'
      ? (clients.find(c => c.id === selectedClientId) || null)
      : (clientName ? { id: '', name: clientName, email: null, whatsapp: null, phone: null, cpf: null, cnpj: null, asaas_customer_id: null, company_name: null, website: null, segment: null, city: null, state: null, funnel_stage: null, lead_source: null, notes: null, estimated_value: null, next_follow_up: null, tags: null, created_at: new Date().toISOString() } : null);
    onPrint(syntheticProposal, syntheticClient);
  };

  return (
    <>
      <div className="glass-panel overflow-hidden max-w-4xl mx-auto print:hidden">
        <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
          <h3 className="font-semibold text-xl text-[var(--color-ink)]">
            {isEditing ? 'Editar Proposta' : 'Criar Nova Proposta'}
          </h3>
          <p className="text-sm text-[var(--color-ink-2)] mt-1">Defina o escopo, projeto e valores.</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* CLIENT SECTION */}
            <div>
              <label className="field-label">Cliente</label>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setClientMode('existing')} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${clientMode === 'existing' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-[var(--color-ink-2)] border-white/60 hover:bg-white/60'}`}>
                  Selecionar Existente
                </button>
                <button type="button" onClick={() => setClientMode('new')} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${clientMode === 'new' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-[var(--color-ink-2)] border-white/60 hover:bg-white/60'}`}>
                  + Novo Cliente
                </button>
              </div>
              {clientMode === 'existing' ? (
                <select
                  required
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="field-input text-[var(--color-ink)]"
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
                  className="field-input"
                />
              )}
            </div>

            {/* SERVICES SECTION */}
            <div className="flex flex-col gap-4 p-6 bg-white/30 rounded-2xl border border-white/50">
              <h4 className="font-semibold text-[var(--color-ink)] text-lg">Serviços</h4>

              {/* First service */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-[var(--color-ink-2)]">Serviço Principal (Carrega o Modelo)</label>
                <div className="flex gap-3 items-center">
                  <select
                    value={serviceId}
                    onChange={e => handleApplyService(e.target.value)}
                    className="flex-1 field-input"
                  >
                    <option value="">Selecione para carregar informações...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.base_price}</option>)}
                  </select>
                  <div className="w-44">
                    <CurrencyInput required value={value} onChange={setValue} />
                  </div>
                </div>
              </div>

              {/* Extra services */}
              {extraServices.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-[var(--color-ink-2)]">Serviços Adicionais</label>
                  {extraServices.map((es, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="Nome do serviço..."
                        value={es.serviceType}
                        onChange={e => updateExtraService(i, 'serviceType', e.target.value)}
                        className="flex-1 field-input"
                      />
                      <div className="w-44">
                        <CurrencyInput value={es.value} onChange={v => updateExtraService(i, 'value', v)} />
                      </div>
                      <button type="button" onClick={() => removeExtraService(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button type="button" onClick={addExtraService}
                  className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer">
                  + Adicionar Serviço
                </button>
                {extraServices.length > 0 && (
                  <p className="text-sm text-[var(--color-ink-2)]">
                    Total Bruto: <span className="font-bold text-[var(--color-ink)]">R$ {fmtBRL(grossValue)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* INVESTMENT & PAYMENT */}
            <div className="flex flex-col gap-5 p-6 bg-white/30 rounded-2xl border border-white/50">
              <h4 className="font-semibold text-[var(--color-ink)] text-lg">Investimento e Condições de Pagamento</h4>

              {/* Gross value + status + start date + brand */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="field-label">Valor Bruto Total (R$)</label>
                  <div className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm bg-white/40 text-[var(--color-ink)] font-semibold">
                    R$ {fmtBRL(grossValue)}
                  </div>
                </div>
                <div>
                  <label className="field-label">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as ProposalStatus)}
                    className="field-input text-[var(--color-ink)]">
                    <option value="Draft">Rascunho</option>
                    <option value="Sent">Enviado</option>
                    <option value="Approved">Aprovado</option>
                    <option value="Rejected">Rejeitado</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Data Inicial (Cronograma)</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Cabeçalho</label>
                  <select value={brand} onChange={e => setBrand(e.target.value as 'octo' | 'vinicius' | 'procurada')}
                    className="field-input text-[var(--color-ink)]">
                    <option value="octo">agência OCTO.</option>
                    <option value="vinicius">Vinicius Kolling</option>
                    <option value="procurada">agência Procurada</option>
                  </select>
                </div>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="field-label">Tipo de Desconto</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDiscountType('fixed')}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${discountType === 'fixed' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-[var(--color-ink-2)] border-white/60'}`}>
                      R$ Fixo
                    </button>
                    <button type="button" onClick={() => setDiscountType('percent')}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${discountType === 'percent' ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-[var(--color-ink-2)] border-white/60'}`}>
                      % Percentual
                    </button>
                  </div>
                </div>
                <div>
                  <label className="field-label">
                    {discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
                  </label>
                  {discountType === 'percent' ? (
                    <div className="relative">
                      <input type="number" step="0.01" min="0" max="100" value={discountRaw} onChange={e => setDiscountRaw(e.target.value)}
                        className="field-input pr-10" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-ink-3)] pointer-events-none">%</span>
                    </div>
                  ) : (
                    <CurrencyInput value={discountRaw} onChange={setDiscountRaw} />
                  )}
                </div>
                <div className="bg-gradient-to-r from-[#C13584]/10 to-[#a42b6f]/10 rounded-xl p-4 border border-[#C13584]/20">
                  <p className="text-xs text-[var(--color-ink-3)] mb-1">Valor Líquido Final</p>
                  <p className="text-2xl font-bold text-[#C13584]">R$ {fmtBRL(netValue)}</p>
                  {discountAmt > 0 && <p className="text-xs text-[var(--color-ink-3)] mt-1">Desconto: R$ {fmtBRL(discountAmt)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Valor Especial à Vista (Opcional)</label>
                  <CurrencyInput
                    value={upfrontPrice}
                    onChange={setUpfrontPrice}
                    className="w-full !border-orange-300 focus:!ring-orange-500 shadow-sm"
                  />
                  <p className="text-xs text-[var(--color-ink-3)] mt-1">Gera um quadro de destaque na proposta impressa.</p>
                </div>
              </div>

              {/* Installments */}
              <div>
                <div className="flex items-end gap-4 mb-4">
                  <div className="flex-1">
                    <label className="field-label">Número de Parcelas</label>
                    <select value={numInstallments} onChange={e => setNumInstallments(parseInt(e.target.value))}
                      className="field-input text-[var(--color-ink)]">
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
                        <tr className="bg-white/40 border-b border-white/40 text-[var(--color-ink-3)] text-xs uppercase tracking-wider">
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
                                className="field-input" />
                            </td>
                            <td className="px-4 py-2">
                              <CurrencyInput
                                value={inst.value.toString()}
                                onChange={v => handleInstallmentValueChange(i, parseFloat(v) || 0)}
                                className="!w-36 !rounded-lg"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--color-ink-3)]">
                              {netValue > 0 ? ((inst.value / netValue) * 100).toFixed(1) : '0'}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white/40 border-t border-white/50 font-semibold">
                          <td colSpan={2} className="px-4 py-3 text-[var(--color-ink-2)]">Total</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${Math.abs(installments.reduce((a, b) => a + b.value, 0) - netValue) > 0.05
                              ? 'text-red-500' : 'text-green-600'
                              }`}>
                              R$ {fmtBRL(installments.reduce((a, b) => a + b.value, 0))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-ink-3)]">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-white/50" />
            <h4 className="font-semibold text-lg text-[var(--color-ink)]">Modelo de Orçamento</h4>

            <div className="flex flex-col gap-6 relative z-0">
              <div>
                <label className="field-label">Visão do Projeto</label>
                <div className="glass-card overflow-hidden">
                  <Editor value={visionText} onChange={(e) => setVisionText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
              <div>
                <label className="field-label">Especificações Técnicas (Engine)</label>
                <div className="glass-card overflow-hidden">
                  <Editor value={engineText} onChange={(e) => setEngineText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
              <div>
                <label className="field-label">Escopo de Entregas</label>
                <div className="glass-card overflow-hidden">
                  <Editor value={scopeText} onChange={(e) => setScopeText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
              <div>
                <label className="field-label">Definições de Investimento</label>
                <div className="glass-card overflow-hidden">
                  <Editor value={investmentText} onChange={(e) => setInvestmentText(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
                </div>
                <TemplateVarChips />
              </div>
            </div>

            <hr className="border-white/50" />
            <div className="flex justify-between items-center mb-0">
              <h4 className="font-semibold text-lg text-[var(--color-ink)]">Cronograma e Fases</h4>
              <button type="button" onClick={addPhase} className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer">Adicionar Fase</button>
            </div>

            <div className="flex flex-col gap-3">
              {phases.length === 0 ? <p className="text-sm text-[var(--color-ink-3)] italic">Sem fases definidas.</p> : phases.map((ph, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={`flex gap-4 items-center p-3 rounded-xl border transition-all ${
                    dragOverIndex === i && dragIndex !== i
                      ? 'border-[#C13584] bg-[#C13584]/10 scale-[1.01]'
                      : dragIndex === i
                      ? 'border-white/40 bg-white/10 opacity-50'
                      : 'border-white/40 bg-white/30'
                  }`}
                >
                  <div className="cursor-grab active:cursor-grabbing text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)] flex-shrink-0">
                    <GripVertical size={18} />
                  </div>
                  <input type="text" placeholder="Nome da fase..." value={ph.name} onChange={e => updatePhase(i, 'name', e.target.value)} className="flex-1 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="Dias" value={ph.duration_days} onChange={e => updatePhase(i, 'duration_days', parseInt(e.target.value) || 0)} className="w-20 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                    <span className="text-xs text-[var(--color-ink-3)]">Dias Úteis</span>
                  </div>
                  <button type="button" onClick={() => removePhase(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            {phases.length > 0 && <GanttChart phases={phases} startDate={startDate} />}

            <hr className="border-white/50" />
            <div>
              <div className="flex justify-between items-center mb-1">
                <h4 className="font-semibold text-lg text-[var(--color-ink)]">Seções Adicionais</h4>
              </div>
              <p className="text-sm text-[var(--color-ink-3)] mb-4">Aparecem antes do Investimento. Use um modelo reutilizável (atualiza em todas as propostas) ou crie um texto manual só para esta.</p>

              <div className="flex flex-col gap-3">
                {additionalSections.length === 0 && (
                  <p className="text-sm text-[var(--color-ink-3)] italic">Nenhuma seção adicional.</p>
                )}
                {additionalSections.map((section, i) => {
                  if (section.kind === 'template') {
                    const t = sectionTemplates.find(x => x.id === section.template_id);
                    return (
                      <div key={i} className="p-4 rounded-xl border border-[#C13584]/20 bg-[#C13584]/5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link2 size={16} className="text-[#C13584] flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-ink)] truncate">{t ? t.title : 'Modelo removido'}</p>
                              <p className="text-xs text-[#C13584]">Vinculado ao modelo — atualiza automaticamente</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button type="button" onClick={() => detachSection(i)} title="Personalizar nesta proposta (desvincular)" className="flex items-center gap-1 text-xs font-medium text-[var(--color-ink-2)] px-3 py-1.5 border border-white/60 rounded-lg bg-white/60 hover:bg-white/80 cursor-pointer">
                              <Unlink size={14} /> Personalizar
                            </button>
                            <button type="button" onClick={() => removeSection(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        {t?.content && (
                          <div className="mt-3 pt-3 border-t border-[#C13584]/10 text-sm text-[var(--color-ink-2)] leading-relaxed line-clamp-3" dangerouslySetInnerHTML={{ __html: t.content }} />
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="p-4 rounded-xl border border-white/60 bg-white/40">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="text"
                          placeholder="Título da seção (ex: MATERIAIS A SER FORNECIDOS PELO CLIENTE)"
                          value={section.title}
                          onChange={e => updateCustomSection(i, 'title', e.target.value)}
                          className="flex-1 field-input"
                        />
                        <button type="button" onClick={() => removeSection(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer flex-shrink-0"><Trash2 size={16} /></button>
                      </div>
                      <div className="glass-card overflow-hidden">
                        <Editor value={section.content} onChange={(e) => updateCustomSection(i, 'content', e.target.value)} containerProps={{ style: { minHeight: '10rem', resize: 'vertical' } }} />
                      </div>
                      <TemplateVarChips />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button type="button" onClick={addCustomSection}
                  className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer">
                  + Adicionar Seção Manual
                </button>
                {remainingTemplates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={templateToAdd}
                      onChange={e => addTemplateSection(e.target.value)}
                      className="field-input"
                    >
                      <option value="">+ Adicionar de um Modelo...</option>
                      {remainingTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                )}
                {allowedTemplates.length > 0 && (
                  remainingTemplates.length > 0 ? (
                    <button type="button" onClick={addAllTemplateSections}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/50">
                      <Layers size={15} /> Incluir Todos os Modelos ({remainingTemplates.length})
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-3)] px-4 py-2 border border-white/60 rounded-xl bg-white/30 select-none">
                      <CheckCircle size={15} /> Todos os modelos incluídos
                    </span>
                  )
                )}
              </div>
              {hiddenTemplatesCount > 0 && (
                <p className="text-xs text-[var(--color-ink-2)] mt-2.5">
                  {hiddenTemplatesCount === 1
                    ? '1 modelo de seção pertence a outros serviços e não é exibido aqui.'
                    : `${hiddenTemplatesCount} modelos de seção pertencem a outros serviços e não são exibidos aqui.`}
                </p>
              )}
            </div>

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
                <button type="button" onClick={onCancel} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-6 py-3 btn-primary">
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
          VALOR_BRUTO: `R$ ${grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
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
              {brand === 'vinicius' ? (
                <h1 className="text-3xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Vinicius<br />Kolling.
                </h1>
              ) : brand === 'procurada' ? (
                <h1 className="text-3xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
                  agência<br />PROCURADA.
                </h1>
              ) : (
                <h1 className="text-4xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
                  agência<br />OCTO.
                </h1>
              )}
              <div className="h-12 w-px bg-gray-300 mx-2"></div>
              <div>
                <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase">Proposta de</p>
                <p className="text-2xl font-black tracking-tight text-[#C13584] uppercase mt-1">{serviceTypeStr || 'Serviço'}</p>
              </div>
              <div className="ml-auto text-right text-xs text-[var(--color-ink-3)]">
                <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                {isEditing && proposalData?.proposal && (
                  <p className="font-mono font-bold text-[var(--color-ink-2)] mt-1">
                    #{proposalData.proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            {/* Client info */}
            {isEditing && proposalData?.proposal && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-[var(--color-ink-3)] uppercase tracking-wider mb-1">Preparado para</p>
                <p className="text-xl font-bold text-[var(--color-ink)]">{clientDisplayName}</p>
                {proposalData.client?.company_name && (
                  <p className="text-sm text-[var(--color-ink-2)]">{proposalData.client.name}</p>
                )}
              </div>
            )}

            <div className="space-y-10 text-[var(--color-ink)] text-sm">

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
                  <p className="mb-4 text-[var(--color-ink-2)]">
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

              {/* Additional sections (linked templates or custom) — before Investment */}
              <AdditionalSectionsRender sections={additionalSections} templates={sectionTemplates} rv={rv} />

              {/* 5 - Investment */}
              <section>
                <h3 className="text-xl font-bold text-[#C13584] mb-4 pb-2 border-b border-[#C13584]/20">5. Investimento e Condições de Pagamento</h3>

                {/* Optional investment text */}
                {investmentText && (
                  <div className="mb-6 leading-relaxed text-[var(--color-ink-2)]" dangerouslySetInnerHTML={{
                    __html: resolveVars(investmentText, {
                      NOME_CLIENTE: clientName || proposalData?.client?.name || '',
                      EMPRESA_CLIENTE: proposalData?.client?.company_name || '',
                      SERVICO: serviceTypeStr || '',
                      VALOR_BRUTO: `R$ ${grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
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
                {(() => {
                  const allSvcs = [
                    { serviceType: serviceTypeStr || 'Serviço', value: firstServiceValue },
                    ...extraServices.map(e => ({ serviceType: e.serviceType, value: parseFloat(e.value) || 0 }))
                  ];
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '2px solid #C13584' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: '#C13584', fontWeight: 700 }}>Serviço</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#C13584', fontWeight: 700 }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSvcs.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 12px', color: '#374151' }}>{s.serviceType}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>R$ {fmtBRL(s.value)}</td>
                          </tr>
                        ))}
                        {allSvcs.length > 1 && (
                          <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                            <td style={{ padding: '10px 12px', color: '#6b7280', fontStyle: 'italic' }}>Subtotal</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>R$ {fmtBRL(grossValue)}</td>
                          </tr>
                        )}
                        {discountAmt > 0 && (
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                              Desconto ({discountType === 'percent' ? `${discountRaw}%` : 'fixo'})
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                              - R$ {fmtBRL(discountAmt)}
                            </td>
                          </tr>
                        )}
                        <tr style={{ backgroundColor: '#fdf2f8' }}>
                          <td style={{ padding: '12px 12px', fontWeight: 800, fontSize: '15px' }}>Valor Total Líquido</td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#C13584' }}>
                            R$ {fmtBRL(netValue)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}

                {/* Installments table */}
                {installments.length > 0 && (
                  <>
                    <p className="font-semibold text-[var(--color-ink-2)] mb-3">Condições de Pagamento — {installments.length}x parcela(s):</p>
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

                <p className="mt-10 pt-6 border-t border-gray-200 text-xs text-[var(--color-ink-3)]">
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
function CashFlowFormView({ cashFlowData, cashFlowCategories, bankAccounts, suppliers, defaultType, onSave, onCancel }: {
  cashFlowData: CashFlow | null;
  cashFlowCategories: CashFlowCategoryRecord[];
  bankAccounts: BankAccount[];
  suppliers: Supplier[];
  defaultType?: CashFlowType;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const isEditing = !!cashFlowData;
  const [type, setType] = useState<CashFlowType>(cashFlowData?.type || defaultType || 'Income');
  // Contas ativas + a conta do lançamento mesmo se arquivada (para não sumir na edição).
  const selectableAccounts = bankAccounts.filter(a => a.active || a.id === cashFlowData?.account_id);
  const [accountId, setAccountId] = useState<string>(
    cashFlowData?.account_id || bankAccounts.find(a => a.is_default && a.active)?.id || ''
  );
  const [supplierId, setSupplierId] = useState<string>(cashFlowData?.supplier_id || '');
  // Novo lançamento marcado como recorrente (receita OU despesa): cria também
  // o cadastro em recurring_expenses (dia de vencimento = dia da data
  // escolhida) e os próximos meses passam a ser gerados automaticamente.
  const [isRecurring, setIsRecurring] = useState(false);

  // Default category: existing value, or first matching category from DB, or empty string
  const getDefaultCategory = (t: CashFlowType) => {
    if (cashFlowData?.category) return cashFlowData.category;
    return cashFlowCategories.find(c => c.type === t)?.name || '';
  };
  const [category, setCategory] = useState<string>(getDefaultCategory(cashFlowData?.type || defaultType || 'Income'));
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

      const payload: Record<string, unknown> = {
        type, category, description, value: numericValue, date, status,
        account_id: accountId || null,
        supplier_id: type === 'Expense' ? (supplierId || null) : null,
      };

      if (isEditing && cashFlowData) {
        const { error } = await supabase.from('cash_flow').update(payload).eq('id', cashFlowData.id);
        if (error) throw error;
      } else {
        // Lançamento recorrente: cria o cadastro da recorrência e vincula este
        // lançamento a ela (competence = mês da data). Os meses seguintes são
        // gerados automaticamente pela função generate_recurring_expenses.
        if (isRecurring) {
          const { data: rec, error: recErr } = await supabase
            .from('recurring_expenses')
            .insert({
              description,
              value: numericValue,
              category,
              type,
              account_id: accountId || null,
              supplier_id: type === 'Expense' ? (supplierId || null) : null,
              due_day: Number(date.slice(8, 10)),
              start_date: date,
            })
            .select('id')
            .single();
          if (recErr) throw recErr;
          payload.recurring_expense_id = rec.id;
          payload.competence = date.slice(0, 7);
        }
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
    <div className="glass-panel overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-[var(--color-ink)]">
          {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
        </h3>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">Gerencie suas receitas e despesas.</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="field-label">Tipo</label>
              <select
                value={type}
                onChange={e => handleTypeChange(e.target.value as CashFlowType)}
                className="field-input"
              >
                <option value="Income">Receita (+)</option>
                <option value="Expense">Despesa (-)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Categoria</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="field-input"
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
            <label className="field-label">Descrição</label>
            <input
              required
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="field-input"
              placeholder="Ex: Mensalidade Cliente X"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="field-label">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="field-input"
                placeholder="Ex: 1500.00"
              />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as CashFlowStatus)}
                className="field-input"
              >
                <option value="Paid">Pago</option>
                <option value="Pending">Pendente</option>
              </select>
            </div>
            <div>
              <label className="field-label">Data</label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="field-label">Conta bancária</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="field-input"
              >
                <option value="">Sem conta</option>
                {selectableAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.active ? '' : ' (arquivada)'}</option>
                ))}
              </select>
            </div>
            {type === 'Expense' && (
              <div>
                <label className="field-label">Fornecedor (opcional)</label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="field-input"
                >
                  <option value="">Sem fornecedor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {!isEditing && (
            <label className="flex items-start gap-3 p-4 rounded-xl bg-white/60 border border-white/60 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="w-5 h-5 accent-[#C13584] cursor-pointer mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--color-ink-2)]">
                  {type === 'Income' ? 'Receita recorrente (repete todo mês)' : 'Despesa recorrente (repete todo mês)'}
                </span>
                <span className="block text-xs text-[var(--color-ink-3)] mt-0.5">
                  Todo dia {date ? Number(date.slice(8, 10)) : '—'} será lançada como pendente automaticamente. Gerencie em Financeiro → Recorrentes.
                </span>
              </span>
            </label>
          )}
          <div className="mt-4 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-6 py-3 btn-primary">
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
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja apagar o serviço base ${name}?`)) {
      setIsDeleting(id);
      await supabase.from('services').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  const handleDuplicate = async (s: Service) => {
    setIsDuplicating(s.id);
    try {
      const { error } = await supabase.from('services').insert({
        name: `${s.name} (cópia)`,
        base_price: s.base_price,
        vision_template: s.vision_template,
        engine_template: s.engine_template,
        scope_template: s.scope_template,
        investment_template: s.investment_template,
        phases_template: s.phases_template,
      });
      if (error) throw error;
      refetch();
    } catch (err) {
      console.error(err);
      alert(`Erro ao duplicar serviço base: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsDuplicating(null);
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/50 flex justify-between items-center gap-3">
        <h3 className="font-semibold text-lg text-[var(--color-ink)]">Serviços Base</h3>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="p-4 pl-6 font-medium">Nome</th>
            <th className="p-4 font-medium">Preço Base</th>
            <th className="p-4 font-medium">Cronograma Padrão</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {services.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-[var(--color-ink-3)]">
                Nenhum serviço base cadastrado ainda.
                <button onClick={openNewModal} className="ml-2 text-[#C13584] hover:underline cursor-pointer">Crie o seu primeiro serviço.</button>
              </td>
            </tr>
          ) : (
            services.map(s => (
              <tr key={s.id} className="border-b border-white/45 hover:bg-white/55 transition-colors">
                <td className="p-4 pl-6 text-[var(--color-ink)] font-medium whitespace-nowrap">{s.name}</td>
                <td className="p-4 font-semibold text-[var(--color-ink-2)]">R$ {Number(s.base_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4 text-[var(--color-ink-2)]">
                  {s.phases_template ? `${(s.phases_template as any).length} Fases` : '-'}
                </td>
                <td className="p-4 pr-6 text-right">
                  <div className="flex items-center justify-end gap-3 text-[var(--color-ink-3)]">
                    <button onClick={() => onEditService(s)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button disabled={isDuplicating === s.id} onClick={() => handleDuplicate(s)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Duplicar">
                      {isDuplicating === s.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
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
    <div className="glass-panel overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-[var(--color-ink)]">
          {isEditing ? 'Editar Serviço Base' : 'Novo Serviço Base'}
        </h3>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">Configure o modelo padrão para as propostas deste tipo de serviço.</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="field-label">Nome do Serviço</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="field-input" placeholder="Ex: Criação de Site" />
            </div>
            <div>
              <label className="field-label">Preço Base (R$)</label>
              <CurrencyInput required value={basePrice} onChange={setBasePrice} />
            </div>
          </div>

          <hr className="border-white/50" />
          <h4 className="font-semibold text-lg text-[var(--color-ink)]">Modelos de Textos</h4>

          <div className="flex flex-col gap-6 relative z-0">
            <div>
              <label className="field-label">Visão do Projeto</label>
              <div className="glass-card overflow-hidden">
                <Editor value={visionTemplate} onChange={(e) => setVisionTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
              </div>
              <TemplateVarChips />
            </div>
            <div>
              <label className="field-label">Especificações Técnicas (Engine)</label>
              <div className="glass-card overflow-hidden">
                <Editor value={engineTemplate} onChange={(e) => setEngineTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
              </div>
              <TemplateVarChips />
            </div>
            <div>
              <label className="field-label">Escopo de Entregas</label>
              <div className="glass-card overflow-hidden">
                <Editor value={scopeTemplate} onChange={(e) => setScopeTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
              </div>
              <TemplateVarChips />
            </div>
          </div>
          <div>
            <label className="field-label">Definições de Investimento</label>
            <div className="glass-card overflow-hidden">
              <Editor value={investmentTemplate} onChange={(e) => setInvestmentTemplate(e.target.value)} containerProps={{ style: { minHeight: '16rem', resize: 'vertical' } }} />
            </div>
            <TemplateVarChips />
          </div>

          <hr className="border-white/50" />
          <div className="flex justify-between items-center mb-0">
            <h4 className="font-semibold text-lg text-[var(--color-ink)]">Cronograma Padrão</h4>
            <button type="button" onClick={addPhase} className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer">Adicionar Fase Padrão</button>
          </div>

          <div className="flex flex-col gap-3">
            {phasesTemplate.length === 0 ? <p className="text-sm text-[var(--color-ink-3)] italic">Sem fases padrão definidas.</p> : phasesTemplate.map((ph, i) => (
              <div key={i} className="flex gap-4 items-center bg-white/30 p-3 rounded-xl border border-white/40">
                <input type="text" placeholder="Nome da fase..." value={ph.name} onChange={e => updatePhase(i, 'name', e.target.value)} className="flex-1 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Dias" value={ph.duration_days} onChange={e => updatePhase(i, 'duration_days', parseInt(e.target.value) || 0)} className="w-20 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                  <span className="text-xs text-[var(--color-ink-3)]">Dias Úteis</span>
                </div>
                <button type="button" onClick={() => removePhase(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 btn-primary">
              {loading && <Loader2 size={16} className="animate-spin" />} {isEditing ? 'Atualizar Serviço' : 'Salvar Serviço'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SECTION TEMPLATES VIEW (reusable additional sections, e.g. GARANTIA E SUPORTE)
// -------------------------------------------------------------
function SectionTemplatesView({ sectionTemplates, proposals, services, refetch, openNewModal, onEditTemplate }: {
  sectionTemplates: SectionTemplate[];
  proposals: { proposal: Proposal; client: Client | null }[];
  services: Service[];
  refetch: () => void;
  openNewModal: () => void;
  onEditTemplate: (t: SectionTemplate) => void;
}) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // How many proposals currently link to a given template
  const usageCount = (templateId: string) =>
    proposals.filter(p => (p.proposal.additional_sections || []).some(s => s.kind === 'template' && s.template_id === templateId)).length;

  const handleDelete = async (id: string, title: string) => {
    const uses = usageCount(id);
    const warning = uses > 0
      ? `\n\nAtenção: este modelo está vinculado a ${uses} proposta(s). Essas seções deixarão de aparecer (as personalizadas/desvinculadas não são afetadas).`
      : '';
    if (confirm(`Tem certeza que deseja apagar o modelo de seção "${title}"?${warning}`)) {
      setIsDeleting(id);
      await supabase.from('proposal_section_templates').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  const handleDuplicate = async (t: SectionTemplate) => {
    setIsDuplicating(t.id);
    try {
      const { error } = await supabase.from('proposal_section_templates').insert({
        title: `${t.title} (cópia)`,
        content: t.content,
        service_ids: t.service_ids || [],
      });
      if (error) throw error;
      refetch();
    } catch (err) {
      console.error(err);
      alert(`Erro ao duplicar modelo de seção: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsDuplicating(null);
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-3">
        <h3 className="font-semibold text-lg text-[var(--color-ink)]">Modelos de Seção</h3>
        <p className="text-sm text-[var(--color-ink-3)]">Editar um modelo atualiza todas as propostas vinculadas.</p>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="p-4 pl-6 font-medium">Título</th>
            <th className="p-4 font-medium">Prévia</th>
            <th className="p-4 font-medium">Serviços</th>
            <th className="p-4 font-medium">Em uso</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {sectionTemplates.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-[var(--color-ink-3)]">
                Nenhum modelo de seção cadastrado ainda.
                <button onClick={openNewModal} className="ml-2 text-[#C13584] hover:underline cursor-pointer">Crie o seu primeiro modelo.</button>
              </td>
            </tr>
          ) : (
            sectionTemplates.map(t => {
              const uses = usageCount(t.id);
              return (
                <tr key={t.id} className="border-b border-white/45 hover:bg-white/55 transition-colors">
                  <td className="p-4 pl-6 text-[var(--color-ink)] font-medium align-top whitespace-nowrap">{t.title}</td>
                  <td className="p-4 text-[var(--color-ink-3)] align-top">
                    <div className="line-clamp-2 max-w-md" dangerouslySetInnerHTML={{ __html: t.content || '<span class="italic">Sem conteúdo</span>' }} />
                  </td>
                  <td className="p-4 align-top">
                    {(() => {
                      const linked = (t.service_ids || [])
                        .map(id => services.find(x => x.id === id))
                        .filter((s): s is Service => !!s);
                      if (!t.service_ids || t.service_ids.length === 0) {
                        return <span className="badge badge-neutral">Todos os serviços</span>;
                      }
                      if (linked.length === 0) {
                        return <span className="text-xs text-[var(--color-ink-3)]" title="Os serviços vinculados foram removidos">—</span>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1 max-w-[14rem]">
                          {linked.map(s => <span key={s.id} className="badge badge-brand">{s.name}</span>)}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-4 align-top">
                    {uses > 0
                      ? <span className="badge badge-brand">{uses} proposta(s)</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-4 pr-6 text-right align-top">
                    <div className="flex items-center justify-end gap-3 text-[var(--color-ink-3)]">
                      <button onClick={() => onEditTemplate(t)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button disabled={isDuplicating === t.id} onClick={() => handleDuplicate(t)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Duplicar">
                        {isDuplicating === t.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                      </button>
                      <button disabled={isDeleting === t.id} onClick={() => handleDelete(t.id, t.title)} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                        {isDeleting === t.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
  );
}

// -------------------------------------------------------------
// SECTION TEMPLATE FORM VIEW
// -------------------------------------------------------------
function SectionTemplateFormView({ templateData, proposals, services, onSave, onCancel }: {
  templateData: SectionTemplate | null;
  proposals: { proposal: Proposal; client: Client | null }[];
  services: Service[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!templateData;
  const [title, setTitle] = useState(templateData?.title || '');
  const [content, setContent] = useState(templateData?.content || '');
  // Empty service_ids in the DB means "available for every service"
  const [restrictServices, setRestrictServices] = useState((templateData?.service_ids?.length ?? 0) > 0);
  const [serviceIds, setServiceIds] = useState<string[]>(templateData?.service_ids || []);

  const toggleService = (id: string) => {
    setServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const usageCount = isEditing
    ? proposals.filter(p => (p.proposal.additional_sections || []).some(s => s.kind === 'template' && s.template_id === templateData!.id)).length
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restrictServices && serviceIds.length === 0) return; // inline hint already explains
    const finalServiceIds = restrictServices ? serviceIds : [];
    setLoading(true);
    try {
      if (isEditing && templateData) {
        const { error } = await supabase.from('proposal_section_templates')
          .update({ title, content, service_ids: finalServiceIds, updated_at: new Date().toISOString() })
          .eq('id', templateData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('proposal_section_templates').insert({ title, content, service_ids: finalServiceIds });
        if (error) throw error;
      }
      onSave();
    } catch (err) {
      console.error(err);
      alert(`Erro ao salvar modelo de seção: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-[var(--color-ink)]">
          {isEditing ? 'Editar Modelo de Seção' : 'Novo Modelo de Seção'}
        </h3>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">Conteúdo reutilizável (ex: Garantia e Suporte). Ao salvar, atualiza em todas as propostas vinculadas.</p>
      </div>

      <div className="p-8">
        {isEditing && usageCount > 0 && (
          <div className="mb-6 flex items-center gap-2 p-4 rounded-xl text-sm bg-pink-50 text-[#C13584] border border-pink-200">
            <AlertCircle size={18} />
            <p>Este modelo está vinculado a <strong>{usageCount} proposta(s)</strong>. As alterações serão refletidas em todas elas (exceto nas que foram personalizadas/desvinculadas).</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="field-label">Título da Seção</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="field-input" placeholder="Ex: GARANTIA E SUPORTE" />
          </div>
          <div>
            <label className="field-label">Onde este modelo pode ser usado</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setRestrictServices(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${!restrictServices ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-[var(--color-ink-2)] border-white/60'}`}>
                Todos os Serviços
              </button>
              <button type="button" onClick={() => setRestrictServices(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${restrictServices ? 'bg-[#C13584] text-white border-[#C13584]' : 'bg-white/40 text-[var(--color-ink-2)] border-white/60'}`}>
                Serviços Específicos
              </button>
            </div>
            {!restrictServices && (
              <p className="text-xs text-[var(--color-ink-2)] mt-2">O modelo ficará disponível em qualquer proposta, seja qual for o serviço.</p>
            )}
            {restrictServices && (
              <div className="glass-inset p-3 mt-3">
                {services.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-2)]">Nenhum serviço cadastrado ainda. Cadastre serviços primeiro ou use "Todos os Serviços".</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {services.map(s => {
                        const checked = serviceIds.includes(s.id);
                        return (
                          <label key={s.id}
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer select-none transition-colors duration-200 ${checked
                              ? 'bg-[var(--color-primary-50)] border-[var(--color-primary-200)]'
                              : 'bg-white/60 border-white/70 hover:bg-white/90'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleService(s.id)}
                              className="w-4 h-4 accent-[#C13584] cursor-pointer flex-shrink-0"
                            />
                            <span className={`text-sm font-medium ${checked ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-ink-2)]'}`}>{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className={`mt-3 text-xs ${serviceIds.length === 0 ? 'text-amber-700' : 'text-[var(--color-ink-2)]'}`}>
                      {serviceIds.length === 0
                        ? 'Marque ao menos um serviço para salvar — ou volte para "Todos os Serviços".'
                        : <>Disponível apenas para <strong className="text-[var(--color-ink)]">{serviceIds.length} de {services.length} serviço{services.length > 1 ? 's' : ''}</strong>.</>}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="relative z-0">
            <label className="field-label">Conteúdo</label>
            <div className="glass-card overflow-hidden">
              <Editor value={content} onChange={(e) => setContent(e.target.value)} containerProps={{ style: { minHeight: '20rem', resize: 'vertical' } }} />
            </div>
            <TemplateVarChips />
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || (restrictServices && serviceIds.length === 0)} className="px-6 py-3 btn-primary">
              {loading && <Loader2 size={16} className="animate-spin" />} {isEditing ? 'Atualizar Modelo' : 'Salvar Modelo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CONTRACTS — shared helpers
// -------------------------------------------------------------
const contractBrandLabel = (brand: string) =>
  brand === 'vinicius' ? 'Vinicius Kolling.' : brand === 'procurada' ? 'agência PROCURADA.' : 'agência OCTO.';

const publicSignUrl = (token: string) => `${window.location.origin}/assinar/${token}`;

const fmtContractDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// -------------------------------------------------------------
// CONTRACT PRINT DOCUMENT (PDF) — includes signature, date/time and IP
// -------------------------------------------------------------
function ContractPrintDocument({ contract, agencySettings }: { contract: Contract; agencySettings: AgencySettings | null }) {
  const vars: Record<string, string> = { ...(contract.merge_vars as Record<string, string> || {}), ...(contract.signer_values as Record<string, string> || {}) };
  const body = contract.signed_body || resolveVars(contract.body || '', vars);
  const propId = contract.id.replace(/-/g, '').substring(0, 6).toUpperCase();

  // Agency signature: snapshot frozen at signing, falling back to the current
  // one for contracts signed before the signature was configured.
  const agencySig = contract.agency_signature || agencySettings?.signature_data || '';
  const agRazao = vars.AGENCIA_RAZAO_SOCIAL || agencySettings?.razao_social || contractBrandLabel(contract.brand);
  const agCnpj = vars.AGENCIA_CNPJ || agencySettings?.cnpj || '';
  const agEndereco = vars.AGENCIA_ENDERECO || agencySettings?.endereco || '';
  const agCidade = vars.AGENCIA_CIDADE || agencySettings?.cidade || '';
  const agUf = vars.AGENCIA_UF || agencySettings?.uf || '';

  // Contratante (client) data resolved from the contract variables.
  const cliCpf = vars.CPF || '';
  const cliCnpj = vars.CNPJ_CLIENTE || '';
  const cliEmpresa = vars.EMPRESA_CLIENTE || '';
  const cliCidade = vars.CIDADE_CLIENTE || '';
  const cliUf = vars.ESTADO_CLIENTE || '';
  const cliEmail = vars.EMAIL_CLIENTE || '';
  const cliTelefone = vars.TELEFONE_CLIENTE || '';

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans leading-relaxed">
      <style media="print">
        {`@page { size: A4 portrait; margin: 2cm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
      </style>

      <div className="flex items-center gap-4 border-b-2 border-[#C13584]/30 pb-6 mb-8 mt-4">
        <h1 className="text-3xl font-black text-[#C13584] leading-none tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
          {contractBrandLabel(contract.brand)}
        </h1>
        <div className="h-12 w-px bg-gray-300 mx-2"></div>
        <div>
          <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase">Contrato</p>
          <p className="text-lg font-black tracking-tight text-[#C13584] mt-1">{contract.title}</p>
        </div>
        <div className="ml-auto text-right text-xs text-[var(--color-ink-3)]">
          <p>Emissão: {new Date(contract.created_at).toLocaleDateString('pt-BR')}</p>
          <p className="font-mono font-bold text-[var(--color-ink-2)] mt-1">#{propId}</p>
        </div>
      </div>

      <div className="text-sm text-[var(--color-ink)] leading-relaxed contract-body" dangerouslySetInnerHTML={{ __html: body }} />

      {/* Signature block */}
      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
        {contract.status === 'signed' ? (
          <>
            <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
              {/* Contratante */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <p style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '6px' }}>Contratante</p>
                <div style={{ height: '64px', display: 'flex', alignItems: 'flex-end' }}>
                  {contract.signature_data && <img src={contract.signature_data} alt="Assinatura do contratante" style={{ maxHeight: '64px', maxWidth: '100%' }} />}
                </div>
                <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '4px', marginTop: '2px', fontSize: '11px', color: '#4b5563', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  <p style={{ fontWeight: 700, color: '#1f2937', fontSize: '13px' }}>{contract.signer_name || ''}</p>
                  {cliEmpresa && <p>{cliEmpresa}</p>}
                  {cliCpf && <p>CPF: {cliCpf}</p>}
                  {cliCnpj && <p>CNPJ: {cliCnpj}</p>}
                  {(cliCidade || cliUf) && <p>{[cliCidade, cliUf].filter(Boolean).join(' / ')}</p>}
                  {cliEmail && <p>{cliEmail}</p>}
                  {cliTelefone && <p>{cliTelefone}</p>}
                </div>
              </div>
              {/* Contratada */}
              {agencySig && (
                <div style={{ flex: '1 1 0', minWidth: 0 }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '6px' }}>Contratada</p>
                  <div style={{ height: '64px', display: 'flex', alignItems: 'flex-end' }}>
                    <img src={agencySig} alt="Assinatura da contratada" style={{ maxHeight: '64px', maxWidth: '100%' }} />
                  </div>
                  <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '4px', marginTop: '2px', fontSize: '11px', color: '#4b5563', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    <p style={{ fontWeight: 700, color: '#1f2937', fontSize: '13px' }}>{agRazao}</p>
                    {agCnpj && <p>CNPJ: {agCnpj}</p>}
                    {agEndereco && <p>{agEndereco}</p>}
                    {(agCidade || agUf) && <p>{[agCidade, agUf].filter(Boolean).join(' / ')}</p>}
                    {contract.signed_at && <p>Assinado em {fmtContractDateTime(contract.signed_at)}</p>}
                  </div>
                </div>
              )}
            </div>
            <p style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #f3f4f6', fontSize: '10px', color: '#9ca3af', textAlign: 'center' }}>
              Documento assinado eletronicamente em {contract.signed_at ? fmtContractDateTime(contract.signed_at) : ''} · IP {contract.signer_ip || '—'} · Identificador #{propId}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-ink-3)] italic">Contrato ainda não assinado.</p>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CONTRACTS VIEW (listing)
// -------------------------------------------------------------
function ContractsView({ contracts, proposals, refetch, onDownloadPdf }: {
  contracts: Contract[];
  proposals: { proposal: Proposal; client: Client | null }[];
  refetch: () => void;
  onDownloadPdf: (c: Contract) => void;
}) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'signed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const contractNumber = (id: string) => id.replace(/-/g, '').substring(0, 6).toUpperCase();

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(publicSignUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja apagar este contrato? Esta ação não pode ser desfeita.')) {
      setIsDeleting(id);
      await supabase.from('contracts').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  const filtered = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return (
      contractNumber(c.id).toLowerCase().includes(q) ||
      (c.signer_name || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q)
    );
  });

  const statusBadge = (c: Contract) => {
    const expired = c.status === 'pending' && c.valid_until && new Date(c.valid_until + 'T23:59:59Z') < new Date();
    if (c.status === 'signed') return <span className="badge badge-success">Assinado</span>;
    if (c.status === 'cancelled') return <span className="badge badge-neutral">Cancelado</span>;
    if (expired) return <span className="badge badge-danger">Link expirado</span>;
    return <span className="badge badge-warning">Aguardando assinatura</span>;
  };

  const proposalNumberFor = (c: Contract) => {
    if (!c.proposal_id) return null;
    const found = proposals.find(p => p.proposal.id === c.proposal_id);
    return found ? found.proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase() : null;
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/50 flex flex-wrap justify-between items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por número, cliente ou título..."
          className="field-input w-full sm:w-80"
        />
        <div className="flex gap-1 bg-white/40 p-1 rounded-xl border border-white/60">
          {(['all', 'pending', 'signed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${statusFilter === s ? 'bg-[#C13584] text-white' : 'text-[var(--color-ink-2)] hover:bg-white/60'}`}>
              {s === 'all' ? 'Todos' : s === 'pending' ? 'Aguardando' : 'Assinados'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="p-4 pl-6 font-medium w-24">Nº</th>
            <th className="p-4 font-medium">Cliente / Contrato</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Assinatura</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-[var(--color-ink-3)]">
                {search || statusFilter !== 'all' ? 'Nenhum contrato encontrado.' : 'Nenhum contrato gerado ainda. Gere um a partir de uma proposta.'}
              </td>
            </tr>
          ) : (
            filtered.map(c => {
              const propNum = proposalNumberFor(c);
              return (
                <tr key={c.id} className="border-b border-white/45 hover:bg-white/55 transition-colors">
                  <td className="p-4 pl-6">
                    <span className="inline-block font-mono font-bold text-xs text-[#C13584] bg-pink-50 border border-pink-100 px-2 py-1 rounded-lg tracking-widest">
                      #{contractNumber(c.id)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-[var(--color-ink)]">{c.signer_name || '—'}</div>
                    <div className="text-sm text-[var(--color-ink-3)] font-normal mt-0.5">{c.title}</div>
                    <div className="text-xs text-[var(--color-ink-3)] font-normal mt-0.5">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      {propNum && <> · Proposta #{propNum}</>}
                    </div>
                  </td>
                  <td className="p-4">{statusBadge(c)}</td>
                  <td className="p-4 text-[var(--color-ink-2)]">
                    {c.status === 'signed' && c.signed_at ? (
                      <div className="text-xs">
                        <div className="font-medium text-[var(--color-ink-2)]">{fmtContractDateTime(c.signed_at)}</div>
                        <div className="text-[var(--color-ink-3)]">IP: {c.signer_ip || '—'}</div>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-3 text-[var(--color-ink-3)]">
                      {c.status !== 'signed' && (
                        <>
                          <button onClick={() => copyLink(c.public_token, c.id)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Copiar link público">
                            {copiedId === c.id ? <span className="text-xs text-green-600 font-semibold">Copiado!</span> : <Copy size={16} />}
                          </button>
                          <a href={publicSignUrl(c.public_token)} target="_blank" rel="noreferrer" className="hover:text-blue-500 transition-colors cursor-pointer" title="Abrir página de assinatura">
                            <ExternalLink size={16} />
                          </a>
                        </>
                      )}
                      <button onClick={() => onDownloadPdf(c)} className="hover:text-blue-500 transition-colors cursor-pointer" title="Baixar PDF">
                        <Download size={16} />
                      </button>
                      <button disabled={isDeleting === c.id} onClick={() => handleDelete(c.id)} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
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
    </div>
  );
}

// -------------------------------------------------------------
// CONTRACT FORM VIEW (generate a contract from a proposal)
// -------------------------------------------------------------
function ContractFormView({ proposalData, proposals, contractTemplates, agencySettings, onSave, onCancel }: {
  proposalData: { proposal: Proposal; client: Client | null } | null;
  proposals: { proposal: Proposal; client: Client | null }[];
  contractTemplates: ContractTemplate[];
  agencySettings: AgencySettings | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<{ proposal: Proposal; client: Client | null } | null>(proposalData);
  const [templateId, setTemplateId] = useState<string>('');
  const [brand, setBrand] = useState<string>(((picked?.proposal.content_json as Record<string, unknown>)?.brand as string) || 'octo');
  const [signerName, setSignerName] = useState(picked?.client?.name || '');
  const [signerEmail, setSignerEmail] = useState(picked?.client?.email || '');
  const defaultValid = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })();
  const [validUntil, setValidUntil] = useState(defaultValid);
  // Default payment method inferred from the proposal's installment count.
  const initialMethod: 'avista' | 'parcelado' =
    (((proposalData?.proposal.content_json as Record<string, unknown>)?.numInstallments as number) || 1) > 1 ? 'parcelado' : 'avista';
  const [paymentMethod, setPaymentMethod] = useState<'avista' | 'parcelado'>(initialMethod);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const template = contractTemplates.find(t => t.id === templateId) || null;

  const baseVars = picked
    ? { ...buildProposalVarMap(picked.proposal, picked.client), ...buildAgencyVarMap(agencySettings) }
    : buildAgencyVarMap(agencySettings);
  // Installments from the proposal, used when payment is "parcelado".
  const proposalInstallments = (picked?.proposal.content_json as Record<string, unknown> | null)?.installments as { date: string; value: number }[] | undefined;
  const parcelasHtml = paymentMethod === 'parcelado' ? buildInstallmentsHtml(proposalInstallments) : '';
  // Payment condition clause derived from the selected method.
  const condicaoSentence = !picked ? '' : paymentMethod === 'avista'
    ? `O valor total de ${baseVars.VALOR_AVISTA} deverá ser pago à vista, no prazo de até 7 (sete) dias a contar da assinatura deste contrato.`
    : `O valor total de ${baseVars.VALOR_BRUTO} será pago em ${baseVars.NUM_PARCELAS} parcela(s), conforme as condições da proposta comercial aprovada.`;
  // CONDICAO_PAGAMENTO embeds the installments table when parcelado.
  const condicaoPagamento = condicaoSentence + parcelasHtml;
  // PIX payment paragraph: full value when à vista, down payment when parcelado.
  const pixKey = agencySettings?.pix_key || '';
  const pixBenef = agencySettings?.pix_beneficiario || '';
  const pixSuffix = pixBenef ? ` (titular: ${pixBenef})` : '';
  const pagamentoPix = (!picked || !pixKey) ? '' : paymentMethod === 'avista'
    ? `O pagamento do valor integral de ${baseVars.VALOR_AVISTA} deverá ser realizado via PIX para a chave ${pixKey}${pixSuffix}.`
    : `O pagamento da entrada (1ª parcela) deverá ser realizado via PIX para a chave ${pixKey}${pixSuffix}.`;
  const mergeVars = {
    ...baseVars,
    CONDICAO_PAGAMENTO: condicaoPagamento,
    FORMA_PAGAMENTO: paymentMethod === 'avista' ? 'à vista' : 'parcelado',
    PARCELAS: parcelasHtml,
    PAGAMENTO_PIX: pagamentoPix,
  };
  const previewBody = template ? resolveVars(template.body || '', mergeVars) : '';
  const signerFields = (template?.signer_fields as SignerField[]) || [];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) { alert('Selecione uma proposta.'); return; }
    if (!template) { alert('Selecione um modelo de contrato.'); return; }
    setLoading(true);
    try {
      const token = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '');
      const { error } = await supabase.from('contracts').insert({
        proposal_id: picked.proposal.id,
        template_id: template.id,
        public_token: token,
        status: 'pending',
        title: template.title,
        body: template.body,
        merge_vars: mergeVars,
        signer_fields: template.signer_fields || [],
        brand,
        signer_name: signerName || null,
        signer_email: signerEmail || null,
        valid_until: validUntil || null,
      });
      if (error) throw error;
      setCreated({ token });
    } catch (err) {
      console.error(err);
      alert(`Erro ao gerar contrato: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = 'field-input';

  // Success state — show the public link
  if (created) {
    const link = publicSignUrl(created.token);
    return (
      <div className="glass-panel overflow-hidden max-w-2xl mx-auto">
        <div className="p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-500 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} />
          </div>
          <h3 className="font-semibold text-xl text-[var(--color-ink)]">Contrato gerado!</h3>
          <p className="text-sm text-[var(--color-ink-2)] mt-1 mb-6">Envie o link abaixo para o cliente preencher os dados e assinar.</p>
          <div className="flex items-center gap-2 bg-white/70 border border-white/60 rounded-xl p-2 pl-4">
            <span className="flex-1 text-sm text-[var(--color-ink-2)] truncate text-left">{link}</span>
            <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
              className="px-4 py-2 bg-[#C13584] text-white rounded-lg text-sm font-medium hover:bg-[#A42D70] cursor-pointer flex items-center gap-2 whitespace-nowrap">
              <Copy size={16} /> {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <a href={link} target="_blank" rel="noreferrer" className="btn-secondary">
              <ExternalLink size={16} /> Abrir página
            </a>
            <button onClick={onSave} className="px-6 py-3 btn-primary">
              Ir para Contratos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden max-w-3xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-[var(--color-ink)]">Gerar Contrato</h3>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">Crie um contrato a partir de uma proposta e gere o link público de assinatura.</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleGenerate} className="flex flex-col gap-6">
          {/* Proposal selector (when not pre-selected) */}
          <div>
            <label className="field-label">Proposta de origem</label>
            {proposalData ? (
              <div className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm bg-white/40 text-[var(--color-ink)]">
                <span className="font-semibold">{picked?.client?.name || 'Cliente'}</span> — {picked?.proposal.service_type} (#{picked?.proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase()})
              </div>
            ) : (
              <select required value={picked?.proposal.id || ''} onChange={e => {
                const f = proposals.find(p => p.proposal.id === e.target.value) || null;
                setPicked(f);
                setSignerName(f?.client?.name || '');
                setSignerEmail(f?.client?.email || '');
                setBrand(((f?.proposal.content_json as Record<string, unknown>)?.brand as string) || 'octo');
              }} className={fieldClass}>
                <option value="">Selecione uma proposta...</option>
                {proposals.map(p => (
                  <option key={p.proposal.id} value={p.proposal.id}>
                    {p.client?.name || 'Cliente'} — {p.proposal.service_type} (#{p.proposal.id.replace(/-/g, '').substring(0, 6).toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="field-label">Modelo de Contrato</label>
            {contractTemplates.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-3)] italic">Nenhum modelo de contrato cadastrado. Crie um em "Modelos de Contrato" primeiro.</p>
            ) : (
              <select required value={templateId} onChange={e => setTemplateId(e.target.value)} className={fieldClass}>
                <option value="">Selecione um modelo...</option>
                {contractTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Nome do Contratante</label>
              <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="field-label">Link válido até</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Cabeçalho</label>
              <select value={brand} onChange={e => setBrand(e.target.value)} className={fieldClass}>
                <option value="octo">agência OCTO.</option>
                <option value="vinicius">Vinicius Kolling</option>
                <option value="procurada">agência PROCURADA.</option>
              </select>
            </div>
            <div>
              <label className="field-label">Forma de Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'avista' | 'parcelado')} className={fieldClass}>
                <option value="avista">À vista (valor líquido, prazo 7 dias)</option>
                <option value="parcelado">Parcelado (valor bruto + nº de parcelas)</option>
              </select>
            </div>
          </div>

          {picked && (
            <div className="p-3 rounded-xl bg-white/30 border border-white/50 text-sm text-[var(--color-ink-2)]">
              <span className="font-medium text-[var(--color-ink-2)]">Condição que entrará no contrato: </span>
              {condicaoSentence}
              {paymentMethod === 'parcelado' && (
                parcelasHtml
                  ? <span className="text-[var(--color-ink-3)]"> + tabela com {proposalInstallments?.length} parcela(s).</span>
                  : <span className="text-amber-600"> (Atenção: esta proposta não tem parcelas geradas — a tabela ficará vazia.)</span>
              )}
            </div>
          )}

          {signerFields.length > 0 && (
            <div className="p-4 rounded-xl bg-white/30 border border-white/50">
              <p className="text-sm font-medium text-[var(--color-ink-2)] mb-2">O cliente preencherá:</p>
              <div className="flex flex-wrap gap-2">
                {signerFields.map(f => (
                  <span key={f.key} className="px-2.5 py-1 text-xs rounded-lg bg-[#C13584]/10 text-[#C13584] border border-[#C13584]/20">
                    {f.label}{f.required ? ' *' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {template && (template.body || '').includes('{{AGENCIA_') && !agencySettings?.razao_social && (
            <div className="flex items-center gap-2 p-4 rounded-xl text-sm bg-amber-50 text-amber-700 border border-amber-200">
              <AlertCircle size={18} className="flex-shrink-0" />
              <p>Este modelo usa dados da agência, mas eles ainda não foram preenchidos em <strong>Configurações → Dados da Agência</strong>. As variáveis ficarão em branco no contrato.</p>
            </div>
          )}

          {template && (
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-2)] mb-2">Prévia do contrato</p>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 max-h-72 overflow-y-auto text-sm text-[var(--color-ink-2)] leading-relaxed contract-body" dangerouslySetInnerHTML={{ __html: previewBody }} />
              <p className="text-xs text-[var(--color-ink-3)] mt-2">Os campos do cliente (ex.: CPF) aparecerão preenchidos após a assinatura.</p>
            </div>
          )}

          <div className="mt-2 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 btn-primary">
              {loading && <Loader2 size={16} className="animate-spin" />} Gerar Contrato e Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CONTRACT TEMPLATES VIEW
// -------------------------------------------------------------
function ContractTemplatesView({ contractTemplates, contracts, refetch, openNewModal, onEditTemplate, onBack }: {
  contractTemplates: ContractTemplate[];
  contracts: Contract[];
  refetch: () => void;
  openNewModal: () => void;
  onEditTemplate: (t: ContractTemplate) => void;
  onBack: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  const usageCount = (id: string) => contracts.filter(c => c.template_id === id).length;

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Apagar o modelo de contrato "${title}"? Contratos já gerados não são afetados.`)) {
      setIsDeleting(id);
      await supabase.from('contract_templates').delete().eq('id', id);
      refetch();
      setIsDeleting(null);
    }
  };

  const handleDuplicate = async (t: ContractTemplate) => {
    setIsDuplicating(t.id);
    try {
      const { error } = await supabase.from('contract_templates').insert({
        title: `${t.title} (cópia)`, body: t.body, signer_fields: t.signer_fields || [],
      });
      if (error) throw error;
      refetch();
    } catch (err) {
      console.error(err);
      alert(`Erro ao duplicar: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setIsDuplicating(null);
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/50 flex justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-[var(--color-ink-3)] hover:text-[#C13584] cursor-pointer flex items-center gap-1">
            <ChevronLeft size={16} /> Contratos
          </button>
          <h3 className="font-semibold text-lg text-[var(--color-ink)]">Modelos de Contrato</h3>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="p-4 pl-6 font-medium">Título</th>
            <th className="p-4 font-medium">Campos do cliente</th>
            <th className="p-4 font-medium">Em uso</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {contractTemplates.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-[var(--color-ink-3)]">
                Nenhum modelo de contrato ainda.
                <button onClick={openNewModal} className="ml-2 text-[#C13584] hover:underline cursor-pointer">Crie o seu primeiro modelo.</button>
              </td>
            </tr>
          ) : (
            contractTemplates.map(t => {
              const fields = (t.signer_fields as SignerField[]) || [];
              const uses = usageCount(t.id);
              return (
                <tr key={t.id} className="border-b border-white/45 hover:bg-white/55 transition-colors">
                  <td className="p-4 pl-6 text-[var(--color-ink)] font-medium align-top">{t.title}</td>
                  <td className="p-4 align-top text-[var(--color-ink-3)]">
                    {fields.length === 0 ? <span className="text-gray-300">—</span> : (
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {fields.map(f => <span key={f.key} className="px-2 py-0.5 text-xs rounded-md bg-gray-100 text-[var(--color-ink-2)]">{f.label}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="p-4 align-top">
                    {uses > 0 ? <span className="badge badge-brand">{uses} contrato(s)</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-4 pr-6 text-right align-top">
                    <div className="flex items-center justify-end gap-3 text-[var(--color-ink-3)]">
                      <button onClick={() => onEditTemplate(t)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Editar"><Edit2 size={16} /></button>
                      <button disabled={isDuplicating === t.id} onClick={() => handleDuplicate(t)} className="hover:text-[#C13584] transition-colors cursor-pointer" title="Duplicar">
                        {isDuplicating === t.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                      </button>
                      <button disabled={isDeleting === t.id} onClick={() => handleDelete(t.id, t.title)} className="hover:text-red-500 transition-colors cursor-pointer" title="Excluir">
                        {isDeleting === t.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
  );
}

// -------------------------------------------------------------
// CONTRACT TEMPLATE FORM VIEW
// -------------------------------------------------------------
const SIGNER_FIELD_TYPES: { value: SignerField['type']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'E-mail' },
  { value: 'date', label: 'Data' },
  { value: 'textarea', label: 'Texto longo' },
];

function ContractTemplateFormView({ templateData, contracts, onSave, onCancel }: {
  templateData: ContractTemplate | null;
  contracts: Contract[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!templateData;
  const [title, setTitle] = useState(templateData?.title || '');
  const [body, setBody] = useState(templateData?.body || '');
  const [fields, setFields] = useState<SignerField[]>((templateData?.signer_fields as SignerField[]) || [{ key: 'CPF', label: 'CPF', type: 'cpf', required: true }]);

  const usageCount = isEditing ? contracts.filter(c => c.template_id === templateData!.id).length : 0;

  // Normalize a label into an uppercase variable key (no spaces/accents)
  const toKey = (s: string) => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const addField = () => setFields([...fields, { key: '', label: '', type: 'text', required: false }]);
  const updateField = (i: number, patch: Partial<SignerField>) => setFields(fields.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-fill keys from labels where empty, and validate uniqueness
    const cleaned = fields
      .map(f => ({ ...f, key: (f.key || toKey(f.label)).trim(), label: f.label.trim() }))
      .filter(f => f.key && f.label);
    const keys = cleaned.map(f => f.key);
    if (new Set(keys).size !== keys.length) {
      alert('Há variáveis (chaves) de campo duplicadas. Cada campo precisa de uma chave única.');
      return;
    }
    setLoading(true);
    try {
      const payload = { title, body, signer_fields: cleaned };
      if (isEditing && templateData) {
        const { error } = await supabase.from('contract_templates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', templateData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contract_templates').insert(payload);
        if (error) throw error;
      }
      onSave();
    } catch (err) {
      console.error(err);
      alert(`Erro ao salvar modelo de contrato: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = 'field-input';

  // Available variables = proposal vars + agency vars + signer field keys
  const allVars = [
    ...CONTRACT_TEMPLATE_VARS.map(v => v.key),
    ...AGENCY_TEMPLATE_VARS.map(v => v.key),
    ...fields.map(f => f.key || toKey(f.label)).filter(Boolean),
  ];

  return (
    <div className="glass-panel overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-[var(--color-ink)]">{isEditing ? 'Editar Modelo de Contrato' : 'Novo Modelo de Contrato'}</h3>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">Use variáveis no texto; os campos do cliente são preenchidos na assinatura. Contratos já gerados guardam o texto da época.</p>
      </div>

      <div className="p-8">
        {isEditing && usageCount > 0 && (
          <div className="mb-6 flex items-center gap-2 p-4 rounded-xl text-sm bg-pink-50 text-[#C13584] border border-pink-200">
            <AlertCircle size={18} />
            <p>Este modelo já gerou <strong>{usageCount} contrato(s)</strong>. Alterações aqui valem apenas para novos contratos.</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="field-label">Título do Contrato</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className={fieldClass} placeholder="Ex: Contrato de Prestação de Serviços" />
          </div>

          {/* Signer fields editor */}
          <div className="p-4 rounded-2xl bg-white/30 border border-white/50">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="font-semibold text-[var(--color-ink)]">Campos preenchidos pelo cliente</h4>
                <p className="text-xs text-[var(--color-ink-3)]">Cada campo vira uma variável (a "chave") que você pode usar no texto, ex.: <span className="font-mono">{'{{CPF}}'}</span></p>
              </div>
              <button type="button" onClick={addField} className="text-sm font-medium text-[#C13584] px-4 py-2 border border-[#C13584]/20 rounded-xl bg-white/40 hover:bg-white/60 cursor-pointer whitespace-nowrap">+ Campo</button>
            </div>
            <div className="flex flex-col gap-2">
              {fields.length === 0 && <p className="text-sm text-[var(--color-ink-3)] italic">Nenhum campo. O cliente apenas assinará.</p>}
              {fields.map((f, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-center bg-white/40 p-2 rounded-xl border border-white/50">
                  <input type="text" placeholder="Rótulo (ex: CPF)" value={f.label}
                    onChange={e => updateField(i, { label: e.target.value, key: f.key || toKey(e.target.value) })}
                    className="flex-1 min-w-[140px] border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60" />
                  <input type="text" placeholder="Chave (variável)" value={f.key}
                    onChange={e => updateField(i, { key: toKey(e.target.value) })}
                    className="w-36 border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60 font-mono" />
                  <select value={f.type} onChange={e => updateField(i, { type: e.target.value as SignerField['type'] })}
                    className="border border-white/60 rounded-lg px-3 py-2 text-sm bg-white/60">
                    {SIGNER_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] px-2 cursor-pointer">
                    <input type="checkbox" checked={f.required} onChange={e => updateField(i, { required: e.target.checked })} className="accent-[#C13584]" />
                    Obrigatório
                  </label>
                  <button type="button" onClick={() => removeField(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-0">
            <label className="field-label">Texto do Contrato</label>
            <div className="glass-card overflow-hidden">
              <Editor value={body} onChange={(e) => setBody(e.target.value)} containerProps={{ style: { minHeight: '24rem', resize: 'vertical' } }} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs text-[var(--color-ink-3)] self-center mr-1">Variáveis disponíveis:</span>
              {allVars.map(k => <span key={k} className="px-2 py-0.5 text-xs rounded-md bg-[#C13584]/10 text-[#C13584] border border-[#C13584]/20 font-mono">{`{{${k}}}`}</span>)}
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 btn-primary">
              {loading && <Loader2 size={16} className="animate-spin" />} {isEditing ? 'Atualizar Modelo' : 'Salvar Modelo'}
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
    <div className="min-h-screen w-full flex items-center justify-center font-sans relative overflow-hidden bg-[#f6f4f8]">
      <div className="absolute top-[-15%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-[#C13584]/14 to-violet-400/12 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[46rem] h-[46rem] rounded-full bg-gradient-to-tr from-indigo-300/12 to-[#C13584]/10 blur-[150px] pointer-events-none" />

      <div className="glass-panel p-8 sm:p-10 w-full max-w-md flex flex-col items-center z-10 relative mx-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C13584] to-violet-600 shadow-[0_8px_20px_-4px_rgba(193,53,132,0.5)] flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl leading-none">O</span>
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-1.5">OctaOS <span className="font-normal text-[var(--color-ink-3)]">CRM</span></h2>
        <p className="text-sm text-[var(--color-ink-3)] mb-8">Faça login para gerenciar sua agência.</p>

        {error && (
          <div className="w-full p-3.5 mb-6 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-200 text-center" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <label className="field-label">E-mail</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="admin@octaos.com"
            />
          </div>
          <div>
            <label className="field-label">Senha</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loggingIn}
            className="btn-primary w-full mt-3 py-3"
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
    lead: { label: 'Lead', color: 'bg-gray-100 text-[var(--color-ink-2)]' },
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
    <div className="glass-panel overflow-hidden">
      <div className="p-5 border-b border-white/50 flex justify-between items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, e-mail ou CNPJ..."
          className="field-input w-full sm:w-96"
        />
        <span className="text-sm text-[var(--color-ink-3)] font-medium">{filtered.length} cliente(s)</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="p-4 pl-6 font-medium">Nome / Empresa</th>
            <th className="p-4 font-medium">Contato</th>
            <th className="p-4 font-medium">CNPJ</th>
            <th className="p-4 font-medium">Funil</th>
            <th className="p-4 pr-6 font-medium text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.length === 0 ? (
            <tr><td colSpan={5} className="p-8 text-center text-[var(--color-ink-3)]">{search ? `Nenhum cliente encontrado para "${search}".` : 'Nenhum cliente cadastrado ainda.'}</td></tr>
          ) : (
            filtered.map(c => {
              const stage = funnelLabel[c.funnel_stage || 'lead'];
              return (
                <tr key={c.id} className="border-b border-white/45 hover:bg-white/55 transition-colors">
                  <td className="p-4 pl-6">
                    <p className="font-semibold text-[var(--color-ink)]">{c.name}</p>
                    {c.company_name && <p className="text-xs text-[var(--color-ink-3)] mt-0.5">{c.company_name}</p>}
                  </td>
                  <td className="p-4">
                    {c.email && <p className="text-[var(--color-ink-2)]">{c.email}</p>}
                    {c.phone && <p className="text-xs text-[var(--color-ink-3)] mt-0.5">{c.phone}</p>}
                  </td>
                  <td className="p-4 text-[var(--color-ink-3)] font-mono text-xs">{c.cnpj || '—'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-3 text-[var(--color-ink-3)]">
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

  const fieldClass = "field-input";

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
    <div className="glass-panel overflow-hidden max-w-4xl mx-auto">
      <div className="p-8 border-b border-white/40 bg-white/30 backdrop-blur-md">
        <h3 className="font-semibold text-xl text-[var(--color-ink)]">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
        <p className="text-sm text-[var(--color-ink-2)] mt-1">Dados de contato e posição no funil de vendas.</p>
      </div>
      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">

          <div>
            <h4 className="font-semibold text-[var(--color-ink-2)] mb-4 text-sm uppercase tracking-wider">Identificação</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="field-label">Nome do Contato *</label><input required value={name} onChange={e => setName(e.target.value)} className={fieldClass} /></div>
              <div><label className="field-label">Empresa / Razão Social</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className={fieldClass} /></div>
              <div><label className="field-label">CNPJ</label><input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className={fieldClass} /></div>
              <div><label className="field-label">Segmento / Nicho</label><input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex: E-commerce, Restaurante..." className={fieldClass} /></div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--color-ink-2)] mb-4 text-sm uppercase tracking-wider">Contato</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="field-label">E-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} /></div>
              <div><label className="field-label">Telefone / WhatsApp</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 90000-0000" className={fieldClass} /></div>
              <div><label className="field-label">Website</label><input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." className={fieldClass} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="field-label">Cidade</label><input value={city} onChange={e => setCity(e.target.value)} className={fieldClass} /></div>
                <div><label className="field-label">Estado</label><input value={state} onChange={e => setState(e.target.value)} maxLength={2} placeholder="SP" className={fieldClass} /></div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--color-ink-2)] mb-4 text-sm uppercase tracking-wider">Funil de Vendas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Estágio no Funil</label>
                <select value={funnelStage} onChange={e => setFunnelStage(e.target.value)} className={fieldClass + ' text-[var(--color-ink)]'}>
                  <option value="lead">Lead (Contato Inicial)</option>
                  <option value="qualified">Qualificado</option>
                  <option value="proposal">Proposta Enviada</option>
                  <option value="negotiation">Em Negociação</option>
                  <option value="closed_won">Fechado ✓</option>
                  <option value="closed_lost">Perdido</option>
                </select>
              </div>
              <div>
                <label className="field-label">Origem do Lead</label>
                <select value={leadSource} onChange={e => setLeadSource(e.target.value)} className={fieldClass + ' text-[var(--color-ink)]'}>
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
              <div><label className="field-label">Valor Estimado do Contrato (R$)</label><input type="number" step="0.01" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} className={fieldClass} /></div>
              <div><label className="field-label">Próximo Follow-up</label><input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} className={fieldClass} /></div>
            </div>
          </div>

          <div>
            <label className="field-label">Observações Internas</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexto, histórico, decisores..." className={fieldClass + ' resize-y'} />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-white/40">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 btn-primary">
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
