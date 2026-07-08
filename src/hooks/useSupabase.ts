import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Proposal, CashFlow, Client, Service, CashFlowCategoryRecord, Task, SectionTemplate, Contract, ContractTemplate, AgencySettings, Lead, BankAccount, Supplier, RecurringExpense, AccountTransfer } from '../types/database';

// Snapshot of the last successful load, so a refresh paints data instantly
// (stale-while-revalidate) instead of holding the whole UI on a spinner.
// v2: adiciona os arrays do módulo Financeiro (invalida snapshots antigos).
const CACHE_KEY = 'procurada-data-cache-v2';

type DataSnapshot = {
    proposals: { proposal: Proposal; client: Client | null }[];
    cashFlows: CashFlow[];
    clients: Client[];
    services: Service[];
    cashFlowCategories: CashFlowCategoryRecord[];
    tasks: Task[];
    leads: Lead[];
    sectionTemplates: SectionTemplate[];
    contracts: Contract[];
    contractTemplates: ContractTemplate[];
    agencySettings: AgencySettings | null;
    bankAccounts: BankAccount[];
    suppliers: Supplier[];
    recurringExpenses: RecurringExpense[];
    accountTransfers: AccountTransfer[];
};

function readCache(): DataSnapshot | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? (JSON.parse(raw) as DataSnapshot) : null;
    } catch {
        return null;
    }
}

// Called on sign-out so the next user never sees someone else's snapshot.
export function clearDataCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}

export function useSupabase() {
    // Read once per mount (lazy initializers below reuse the same object).
    const cacheRef = useRef<DataSnapshot | null | undefined>(undefined);
    if (cacheRef.current === undefined) cacheRef.current = readCache();
    const cached = cacheRef.current;

    const [proposals, setProposals] = useState<{ proposal: Proposal; client: Client | null }[]>(cached?.proposals ?? []);
    const [cashFlows, setCashFlows] = useState<CashFlow[]>(cached?.cashFlows ?? []);
    const [clients, setClients] = useState<Client[]>(cached?.clients ?? []);
    const [services, setServices] = useState<Service[]>(cached?.services ?? []);
    const [cashFlowCategories, setCashFlowCategories] = useState<CashFlowCategoryRecord[]>(cached?.cashFlowCategories ?? []);
    const [tasks, setTasks] = useState<Task[]>(cached?.tasks ?? []);
    const [leads, setLeads] = useState<Lead[]>(cached?.leads ?? []);
    const [sectionTemplates, setSectionTemplates] = useState<SectionTemplate[]>(cached?.sectionTemplates ?? []);
    const [contracts, setContracts] = useState<Contract[]>(cached?.contracts ?? []);
    const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>(cached?.contractTemplates ?? []);
    const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(cached?.agencySettings ?? null);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(cached?.bankAccounts ?? []);
    const [suppliers, setSuppliers] = useState<Supplier[]>(cached?.suppliers ?? []);
    const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(cached?.recurringExpenses ?? []);
    const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>(cached?.accountTransfers ?? []);
    // With a snapshot on screen there is nothing to wait for; the fetch below
    // refreshes silently. The spinner only shows on the very first login.
    const [loading, setLoading] = useState(!cached);
    const hasData = useRef(!!cached);
    // Dedupes concurrent calls (StrictMode double-effects, rapid refetches):
    // while one load is in flight, new callers await the same promise.
    const inFlight = useRef<Promise<void> | null>(null);

    const doLoad = useCallback(async (showLoading: boolean) => {
        // Block the UI only when there is nothing on screen yet.
        if (showLoading && !hasData.current) setLoading(true);

        // All queries fire in parallel: total wait = the slowest one, not the sum of all.
        const [
            { data: propData },
            { data: cashData },
            { data: clientData },
            { data: serviceData },
            { data: categoriesData },
            { data: tasksData },
            { data: leadsData },
            { data: sectionTemplatesData },
            { data: contractsData },
            { data: contractTemplatesData },
            { data: agencyData },
            { data: bankAccountsData },
            { data: suppliersData },
            { data: recurringData },
            { data: transfersData },
        ] = await Promise.all([
            supabase.from('proposals').select('*, client:clients(*)').order('created_at', { ascending: false }),
            supabase.from('cash_flow').select('*').order('date', { ascending: false }),
            supabase.from('clients').select('*').order('name', { ascending: true }),
            supabase.from('services').select('*').order('name', { ascending: true }),
            supabase.from('cash_flow_categories').select('*').order('type', { ascending: true }).order('name', { ascending: true }),
            supabase.from('tasks').select('*').order('created_at', { ascending: false }),
            supabase.from('leads').select('*').order('created_at', { ascending: false }),
            supabase.from('proposal_section_templates').select('*').order('title', { ascending: true }),
            supabase.from('contracts').select('*').order('created_at', { ascending: false }),
            supabase.from('contract_templates').select('*').order('title', { ascending: true }),
            supabase.from('agency_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('bank_accounts').select('*').order('name', { ascending: true }),
            supabase.from('suppliers').select('*').order('name', { ascending: true }),
            supabase.from('recurring_expenses').select('*').order('description', { ascending: true }),
            supabase.from('account_transfers').select('*').order('date', { ascending: false }),
        ]);

        const mappedProposals = propData
            ? propData.map((p: any) => ({ proposal: { ...p, client: undefined }, client: p.client }))
            : null;

        if (mappedProposals) setProposals(mappedProposals);
        if (cashData) setCashFlows(cashData as CashFlow[]);
        if (clientData) setClients(clientData as Client[]);
        if (serviceData) setServices(serviceData as Service[]);
        if (categoriesData) setCashFlowCategories(categoriesData as CashFlowCategoryRecord[]);
        if (tasksData) setTasks(tasksData as Task[]);
        if (leadsData) setLeads(leadsData as Lead[]);
        if (sectionTemplatesData) setSectionTemplates(sectionTemplatesData as SectionTemplate[]);
        if (contractsData) setContracts(contractsData as Contract[]);
        if (contractTemplatesData) setContractTemplates(contractTemplatesData as ContractTemplate[]);
        setAgencySettings((agencyData as AgencySettings) || null);
        if (bankAccountsData) setBankAccounts(bankAccountsData as BankAccount[]);
        if (suppliersData) setSuppliers(suppliersData as Supplier[]);
        if (recurringData) setRecurringExpenses(recurringData as RecurringExpense[]);
        if (transfersData) setAccountTransfers(transfersData as AccountTransfer[]);

        hasData.current = true;
        setLoading(false);

        // Persist the snapshot for an instant paint on the next refresh.
        // Quota/serialization failures just mean no cache — never break the app.
        try {
            const snapshot: DataSnapshot = {
                proposals: mappedProposals ?? [],
                cashFlows: (cashData as CashFlow[]) ?? [],
                clients: (clientData as Client[]) ?? [],
                services: (serviceData as Service[]) ?? [],
                cashFlowCategories: (categoriesData as CashFlowCategoryRecord[]) ?? [],
                tasks: (tasksData as Task[]) ?? [],
                leads: (leadsData as Lead[]) ?? [],
                sectionTemplates: (sectionTemplatesData as SectionTemplate[]) ?? [],
                contracts: (contractsData as Contract[]) ?? [],
                contractTemplates: (contractTemplatesData as ContractTemplate[]) ?? [],
                agencySettings: (agencyData as AgencySettings) || null,
                bankAccounts: (bankAccountsData as BankAccount[]) ?? [],
                suppliers: (suppliersData as Supplier[]) ?? [],
                recurringExpenses: (recurringData as RecurringExpense[]) ?? [],
                accountTransfers: (transfersData as AccountTransfer[]) ?? [],
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
        } catch { /* noop */ }
    }, []);

    const loadAll = useCallback((showLoading: boolean): Promise<void> => {
        if (inFlight.current) return inFlight.current;
        const run = doLoad(showLoading).finally(() => { inFlight.current = null; });
        inFlight.current = run;
        return run;
    }, [doLoad]);

    const fetchDashboardData = useCallback(() => loadAll(true), [loadAll]);
    // Silent: refreshes data without triggering the loading spinner (keeps current view mounted)
    const silentRefetch = useCallback(() => loadAll(false), [loadAll]);

    return { proposals, cashFlows, clients, services, cashFlowCategories, tasks, leads, sectionTemplates, contracts, contractTemplates, agencySettings, bankAccounts, suppliers, recurringExpenses, accountTransfers, loading, refetch: fetchDashboardData, silentRefetch };
}
