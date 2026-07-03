import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Proposal, CashFlow, Client, Service, CashFlowCategoryRecord, Task, SectionTemplate, Contract, ContractTemplate, AgencySettings, Lead } from '../types/database';

export function useSupabase() {
    const [proposals, setProposals] = useState<{ proposal: Proposal; client: Client | null }[]>([]);
    const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [cashFlowCategories, setCashFlowCategories] = useState<CashFlowCategoryRecord[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [sectionTemplates, setSectionTemplates] = useState<SectionTemplate[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
    const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null);
    const [loading, setLoading] = useState(true);

    const loadAll = useCallback(async (showLoading: boolean) => {
        if (showLoading) setLoading(true);

        const { data: propData } = await supabase
            .from('proposals')
            .select('*, client:clients(*)')
            .order('created_at', { ascending: false });

        const { data: cashData } = await supabase
            .from('cash_flow')
            .select('*')
            .order('date', { ascending: false });

        const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });

        const { data: serviceData } = await supabase
            .from('services')
            .select('*')
            .order('name', { ascending: true });

        const { data: categoriesData } = await supabase
            .from('cash_flow_categories')
            .select('*')
            .order('type', { ascending: true })
            .order('name', { ascending: true });

        const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: leadsData } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: sectionTemplatesData } = await supabase
            .from('proposal_section_templates')
            .select('*')
            .order('title', { ascending: true });

        const { data: contractsData } = await supabase
            .from('contracts')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: contractTemplatesData } = await supabase
            .from('contract_templates')
            .select('*')
            .order('title', { ascending: true });

        const { data: agencyData } = await supabase
            .from('agency_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (propData) {
            const mapped = propData.map((p: any) => ({
                proposal: { ...p, client: undefined },
                client: p.client,
            }));
            setProposals(mapped);
        }
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

        if (showLoading) setLoading(false);
    }, []);

    const fetchDashboardData = useCallback(() => loadAll(true), [loadAll]);
    // Silent: refreshes data without triggering the loading spinner (keeps current view mounted)
    const silentRefetch = useCallback(() => loadAll(false), [loadAll]);

    return { proposals, cashFlows, clients, services, cashFlowCategories, tasks, leads, sectionTemplates, contracts, contractTemplates, agencySettings, loading, refetch: fetchDashboardData, silentRefetch };
}
