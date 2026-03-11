// Integration script: hooks useSupabase + App.tsx
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

// ─── 1. Add Task type to database.ts ───────────────────────────────────────
{
  const file = path.join(root, 'src', 'types', 'database.ts');
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes('export type Task =')) { console.log('SKIP: Task type already exists'); }
  else {
    const append = `
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  priority: TaskPriority;
  parent_task_id: string | null;
  project: string | null;
  labels: string[] | null;
  created_at: string;
};
`;
    fs.writeFileSync(file, c + append, 'utf8');
    console.log('OK: added Task type to database.ts');
  }
}

// ─── 2. Update useSupabase hook to include tasks ─────────────────────────────
{
  const file = path.join(root, 'src', 'hooks', 'useSupabase.ts');
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes('tasks')) { console.log('SKIP: tasks already in useSupabase'); }
  else {
    // Add Task to imports
    c = c.replace(
      "import type { Proposal, CashFlow, Client, Service, CashFlowCategoryRecord } from '../types/database';",
      "import type { Proposal, CashFlow, Client, Service, CashFlowCategoryRecord, Task } from '../types/database';"
    );

    // Add tasks state
    c = c.replace(
      "    const [cashFlowCategories, setCashFlowCategories] = useState<CashFlowCategoryRecord[]>([]);",
      "    const [cashFlowCategories, setCashFlowCategories] = useState<CashFlowCategoryRecord[]>([]);\n    const [tasks, setTasks] = useState<Task[]>([]);"
    );

    // Add tasks query in loadAll
    c = c.replace(
      "        const { data: categoriesData } = await supabase\n            .from('cash_flow_categories')\n            .select('*')\n            .order('type', { ascending: true })\n            .order('name', { ascending: true });",
      `        const { data: categoriesData } = await supabase
            .from('cash_flow_categories')
            .select('*')
            .order('type', { ascending: true })
            .order('name', { ascending: true });

        const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: true });`
    );

    // Set tasks after fetch
    c = c.replace(
      "        if (categoriesData) setCashFlowCategories(categoriesData as CashFlowCategoryRecord[]);",
      "        if (categoriesData) setCashFlowCategories(categoriesData as CashFlowCategoryRecord[]);\n        if (tasksData) setTasks(tasksData as Task[]);"
    );

    // Return tasks
    c = c.replace(
      "    return { proposals, cashFlows, clients, services, cashFlowCategories, loading, refetch: fetchDashboardData, silentRefetch };",
      "    return { proposals, cashFlows, clients, services, cashFlowCategories, tasks, loading, refetch: fetchDashboardData, silentRefetch };"
    );

    fs.writeFileSync(file, c, 'utf8');
    console.log('OK: updated useSupabase hook with tasks');
  }
}

// ─── 3. Update App.tsx ────────────────────────────────────────────────────────
{
  const file = path.join(root, 'src', 'App.tsx');
  let c = fs.readFileSync(file, 'utf8');

  // 3a. Add ListTodo to lucide-react imports
  if (!c.includes('ListTodo')) {
    c = c.replace(
      "  ChevronLeft,\n  ChevronRight\n} from 'lucide-react';",
      "  ChevronLeft,\n  ChevronRight,\n  ListTodo\n} from 'lucide-react';"
    );
    console.log('OK: added ListTodo icon import');
  }

  // 3b. Add TasksView import after existing imports
  if (!c.includes("TasksView")) {
    c = c.replace(
      "import type { User } from '@supabase/supabase-js';",
      "import type { User } from '@supabase/supabase-js';\nimport { TasksView } from './components/TasksView';"
    );
    console.log('OK: added TasksView import');
  }

  // 3c. Destructure tasks from useSupabase
  if (!c.includes('tasks,') && !c.includes('tasks }')) {
    c = c.replace(
      "const { proposals, cashFlows, clients, services, cashFlowCategories, loading, refetch, silentRefetch } = useSupabase();",
      "const { proposals, cashFlows, clients, services, cashFlowCategories, tasks, loading, refetch, silentRefetch } = useSupabase();"
    );
    console.log('OK: destructured tasks from useSupabase');
  }

  // 3d. Add "Tarefas" nav button (after Clientes button)
  const clientesBtn = `            <button
              onClick={() => setActiveTab('clients')}
              className={`;
  if (!c.includes('setActiveTab(\'tasks\')') && c.includes(clientesBtn)) {
    const navInsert = `            <button
              onClick={() => setActiveTab('tasks')}
              className={\`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 cursor-pointer \${activeTab === 'tasks' || activeTab.startsWith('task') ? 'bg-white/60 shadow-sm border border-white/50 text-[#C13584] backdrop-blur-md' : 'text-gray-600 hover:bg-white/40'}\`}
            >
              <ListTodo size={20} />
              Tarefas
            </button>
`;
    c = c.replace(clientesBtn, navInsert + clientesBtn);
    console.log('OK: added Tarefas nav button');
  }

  // 3e. Add activeTab header label for tasks
  const headerLabel = `activeTab === 'proposal-form' ? (selectedProposal ? 'Editar Proposta' : 'Nova Proposta') :`;
  if (c.includes(headerLabel) && !c.includes("activeTab === 'tasks' ? 'Tarefas'")) {
    c = c.replace(
      headerLabel,
      `activeTab === 'tasks' ? 'Tarefas' :\n                  ${headerLabel}`
    );
    console.log('OK: added tasks tab header label');
  }

  // 3f. Render TasksView when activeTab === 'tasks'
  const cashflowTab = `                {activeTab === 'cashflow' && <CashFlowView`;
  if (!c.includes("activeTab === 'tasks'") && c.includes(cashflowTab)) {
    const taskViewJSX = `                {activeTab === 'tasks' && (
                  <TasksView tasks={tasks} refetch={refetch} />
                )}
`;
    c = c.replace(cashflowTab, taskViewJSX + cashflowTab);
    console.log('OK: added TasksView render in App');
  }

  fs.writeFileSync(file, c, 'utf8');
}

console.log('\nAll done! Run: npm run build');
