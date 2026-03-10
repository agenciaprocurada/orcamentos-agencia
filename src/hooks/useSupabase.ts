import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Proposal, CashFlow, Client, Service, CashFlowCategoryRecord } from '../types/database';

export function useSupabase() {
    const [proposals, setProposals] = useState<{ proposal: Proposal; client: Client | null }[]>([]);
    const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [cashFlowCategories, setCashFlowCategories] = useState<CashFlowCategoryRecord[]>([]);
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

        if (showLoading) setLoading(false);
    }, []);

    const fetchDashboardData = useCallback(() => loadAll(true), [loadAll]);
    // Silent: refreshes data without triggering the loading spinner (keeps current view mounted)
    const silentRefetch = useCallback(() => loadAll(false), [loadAll]);

    return { proposals, cashFlows, clients, services, cashFlowCategories, loading, refetch: fetchDashboardData, silentRefetch };
}
