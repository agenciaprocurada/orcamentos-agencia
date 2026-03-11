import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Task } from '../types/database';
import {
  Plus,
  Search,
  Inbox,
  Calendar,
  CalendarDays,
  LayoutGrid,
  MoreHorizontal,
  Hash,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';

export function TasksView({ tasks, refetch }: { tasks: Task[]; refetch: () => void }) {
  const [activeSection, setActiveSection] = useState<'entrada' | 'hoje' | 'breve' | 'calendario'>('breve');
  const [addingTask, setAddingTask] = useState<string | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tmrw = new Date(today);
  tmrw.setDate(today.getDate() + 1);

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const strToday = formatDateStr(today);
  const strTmrw = formatDateStr(tmrw);

  const incompleteTasks = tasks.filter(t => !t.completed);

  const tasksEntrada = incompleteTasks.filter(t => t.project === 'Entrada');
  const tasksHoje = incompleteTasks.filter(t => t.due_date === strToday);
  const tasksAtrasadas = incompleteTasks.filter(t => t.due_date && t.due_date < strToday);
  const tasksBreve = incompleteTasks.filter(t => t.due_date && t.due_date > strToday);

  const handleComplete = async (taskId: string) => {
    await supabase.from('tasks').update({ completed: true }).eq('id', taskId);
    refetch();
  };

  const handleSaveTask = async (targetDate: string | null = null) => {
    if (!newTaskTitle.trim()) {
      setAddingTask(null);
      return;
    }

    setAddingSaving(true);
    try {
      let pDate = targetDate;
      if (activeSection === 'hoje' && !targetDate) pDate = strToday;

      await supabase.from('tasks').insert({
        title: newTaskTitle,
        description: newTaskDesc || null,
        due_date: pDate,
        project: activeSection === 'calendario' ? 'Calendário de Atividades' : 'Entrada'
      });

      setNewTaskTitle('');
      setNewTaskDesc('');
      setAddingTask(null);
      refetch();
    } finally {
      setAddingSaving(false);
    }
  };

  const NavItem = ({ id, icon: Icon, label, count, colorClass = "text-[#202020]", activeBg = "bg-[#ffefe5]", iconColor = "text-gray-500", onClick }: any) => {
    const isActive = activeSection === id;
    return (
      <button
        onClick={() => { setActiveSection(id); if (onClick) onClick(); }}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all cursor-pointer ${isActive ? activeBg : 'hover:bg-gray-100'}`}
      >
        <div className={`flex items-center gap-3 ${isActive ? 'text-[#db4c3f]' : colorClass}`}>
          <Icon size={18} strokeWidth={2} className={isActive ? 'text-[#db4c3f]' : iconColor} />
          <span className={`text-[13px] ${isActive ? 'font-semibold text-[#db4c3f]' : 'font-normal text-[#202020]'}`}>{label}</span>
        </div>
        {count > 0 && (
          <span className={`text-xs ${isActive ? 'text-[#db4c3f] font-semibold' : 'text-gray-400 font-normal'}`}>{count}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-full absolute inset-0 bg-white font-sans text-[#202020]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Inner Sidebar */}
      <div className="w-[300px] bg-[#fafafa] flex flex-col pt-5 pb-4 transition-all duration-300">
        <div className="px-4 mb-3 flex items-center gap-2">
          <button
            onClick={() => { setActiveSection('entrada'); setAddingTask('generic'); }}
            className="flex items-center gap-2 text-[#db4c3f] font-semibold hover:bg-gray-100 w-full px-2 py-1.5 rounded-lg transition-colors cursor-pointer text-sm"
          >
            <div className="bg-[#db4c3f] text-white rounded-full p-[2px] shadow-sm">
              <Plus size={16} strokeWidth={3} />
            </div>
            Adicionar tarefa
          </button>
        </div>

        <div className="px-2 mb-2">
          <button className="flex items-center gap-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full px-3 py-1.5 rounded-lg transition-colors cursor-text text-[13px] font-medium">
            <Search size={18} />
            Buscar
          </button>
        </div>

        <div className="px-2 flex flex-col gap-0.5">
          <NavItem id="entrada" icon={Inbox} label="Entrada" count={tasksEntrada.length} iconColor="text-blue-500" />
          <NavItem id="hoje" icon={Calendar} label="Hoje" count={tasksHoje.length + tasksAtrasadas.length} iconColor="text-green-600" />
          <NavItem id="breve" icon={CalendarDays} label="Em breve" count={tasksBreve.length} iconColor="text-purple-600" />
          <NavItem id="filtros" icon={LayoutGrid} label="Filtros e Etiquetas" count={0} iconColor="text-orange-400" />
          <NavItem id="mais" icon={MoreHorizontal} label="Mais" count={0} />
        </div>

        <div className="px-6 pt-5 pb-1 text-[11px] font-bold text-gray-400 flex justify-between items-center group cursor-pointer hover:bg-gray-100 rounded-lg mx-2 transition-colors">
          Favoritos
          <ChevronDown size={14} className="opacity-0 group-hover:opacity-100" />
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          <NavItem id="remarcar" icon={AlertCircle} label="Remarcar" count={0} colorClass="text-[#202020]" />
          <NavItem id="pessoal" icon={CheckCircle2} label="Pessoal" count={0} iconColor="text-green-500" />
          <NavItem id="delegar" icon={CheckCircle2} label="Delegar" count={0} iconColor="text-orange-400" />
          <NavItem id="importante" icon={CheckCircle2} label="Importante" count={0} iconColor="text-blue-500" />
          <NavItem id="urgente" icon={CheckCircle2} label="URGENTE" count={0} iconColor="text-red-500" />
        </div>

        <div className="px-6 pt-5 pb-1 text-[11px] font-bold text-gray-400 flex justify-between items-center group cursor-pointer hover:bg-gray-100 rounded-lg mx-2 transition-colors">
          Meus projetos
          <ChevronDown size={14} className="opacity-0 group-hover:opacity-100" />
        </div>
        <div className="px-2 flex flex-col gap-0.5">
          <NavItem id="calendario" icon={Hash} label="Calendário de Atividades" count={tasks.filter(t => !t.completed && t.project === 'Calendário de Atividades').length} iconColor="text-pink-500" />
        </div>

        <div className="mt-auto px-4 text-xs text-gray-400 flex items-center gap-1 font-medium hover:text-gray-600 cursor-pointer">
          <AlertCircle size={14} /> Ajuda e recursos
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white pt-10 pb-24 px-8 md:px-14 lg:px-24">
        <div className="max-w-4xl mx-auto border-b border-transparent">
          {/* Header: Em breve */}
          {activeSection === 'breve' && (
            <div className="mb-6 flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-[#202020]">Em breve</h1>
              <span className="text-sm font-normal text-gray-500 cursor-pointer hover:underline">Março {new Date().getFullYear()} <ChevronDown size={14} className="inline opacity-80" /></span>

              <div className="ml-auto border border-gray-200 rounded-md px-2 py-1 text-xs font-medium text-gray-600 flex items-center gap-1 hover:bg-gray-50 cursor-pointer">
                <ChevronLeft size={14} /> Hoje <ChevronRight size={14} />
              </div>
            </div>
          )}

          {/* Header: Hoje */}
          {activeSection === 'hoje' && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#202020] flex items-center gap-2">
                Hoje
              </h1>
              <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                <CheckCircle2 size={12} className="opacity-60" /> {tasksHoje.length + tasksAtrasadas.length} tarefas
              </div>
            </div>
          )}

          {activeSection === 'entrada' && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#202020]">Entrada</h1>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Em Breve grid layout */}
            {activeSection === 'breve' && (
              <div className="flex gap-6 w-full items-start overflow-x-auto pb-4">
                {/* Atrasadas Column */}
                {tasksAtrasadas.length > 0 && (
                  <div className="min-w-[300px] flex-1">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                      <h3 className="font-bold text-sm text-[#202020] flex items-center gap-2">
                        Atrasada <span className="text-[11px] text-gray-400 font-normal">{tasksAtrasadas.length}</span>
                      </h3>
                      <button className="text-[#db4c3f] text-xs font-medium hover:underline cursor-pointer">Reagendar</button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {tasksAtrasadas.map(t => <TodoistTaskRow key={t.id} task={t} onComplete={handleComplete} />)}
                    </div>
                  </div>
                )}

                {/* Hoje Column */}
                <div className="min-w-[300px] flex-1">
                  <div className="border-b border-gray-100 pb-2 mb-2 text-sm font-bold flex items-center gap-2 text-[#202020]">
                    <span className="capitalize">{new Date(strToday + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).replace('.', '')}</span> · Hoje <span className="text-[11px] font-normal text-gray-400">{tasksHoje.length}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {tasksHoje.map(t => <TodoistTaskRow key={t.id} task={t} onComplete={handleComplete} />)}
                  </div>
                  <button onClick={() => { setActiveSection('hoje'); setAddingTask('hoje_inline'); }} className="flex items-center gap-2 text-gray-500 hover:text-[#db4c3f] mt-1 group text-[13px] cursor-pointer w-full p-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Plus size={16} className="text-[#db4c3f] opacity-80" /> Adicionar tarefa
                  </button>
                </div>

                {/* Amanha Column */}
                <div className="min-w-[300px] flex-1">
                  <div className="border-b border-gray-100 pb-2 mb-2 text-sm font-bold flex items-center gap-2 text-[#202020]">
                    <span className="capitalize">{new Date(strTmrw + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).replace('.', '')}</span> · Amanhã <span className="text-[11px] font-normal text-gray-400">{tasksBreve.filter(t => t.due_date === strTmrw).length}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {tasksBreve.filter(t => t.due_date === strTmrw).map(t => <TodoistTaskRow key={t.id} task={t} onComplete={handleComplete} />)}
                  </div>
                  {addingTask === strTmrw ? (
                    <AddTaskForm
                      title={newTaskTitle} desc={newTaskDesc} setTitle={setNewTaskTitle} setDesc={setNewTaskDesc}
                      onSave={() => handleSaveTask(strTmrw)} onCancel={() => { setAddingTask(null); setNewTaskTitle(''); setNewTaskDesc(''); }} loading={addingSaving}
                    />
                  ) : (
                    <button onClick={() => setAddingTask(strTmrw)} className="flex items-center gap-2 text-gray-500 hover:text-[#db4c3f] mt-1 group text-[13px] cursor-pointer w-full p-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <Plus size={16} className="text-[#db4c3f] opacity-80" /> Adicionar tarefa
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* HOJE List Layout */}
            {activeSection === 'hoje' && (
              <div className="flex flex-col">
                {tasksAtrasadas.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                      <h3 className="font-bold text-sm text-[#202020] flex items-center gap-1">
                        Atrasada
                        <ChevronDown size={14} className="text-gray-400 opacity-80" />
                      </h3>
                      <button className="text-[#db4c3f] text-xs font-semibold hover:underline cursor-pointer">Reagendar</button>
                    </div>
                    {tasksAtrasadas.map(t => <TodoistTaskRow key={t.id} task={t} onComplete={handleComplete} isList={true} />)}
                  </div>
                )}

                {tasksHoje.map(t => <TodoistTaskRow key={t.id} task={t} onComplete={handleComplete} isList={true} />)}

                {addingTask === 'hoje_inline' ? (
                  <AddTaskForm
                    title={newTaskTitle} desc={newTaskDesc} setTitle={setNewTaskTitle} setDesc={setNewTaskDesc}
                    onSave={() => handleSaveTask(strToday)} onCancel={() => { setAddingTask(null); setNewTaskTitle(''); setNewTaskDesc(''); }} loading={addingSaving}
                    isList={true}
                  />
                ) : (
                  <button onClick={() => setAddingTask('hoje_inline')} className="flex items-center gap-3 text-gray-500 hover:text-[#db4c3f] group w-full text-left py-2 cursor-pointer transition-colors mt-2 text-[14px]">
                    <Plus size={20} className="text-[#db4c3f] rounded-full group-hover:bg-[#ffefe5] p-0.5 transition-colors" />
                    <span>Adicionar tarefa</span>
                  </button>
                )}
              </div>
            )}

            {/* ENTRADA Layout */}
            {(activeSection === 'entrada' || activeSection === 'calendario') && (
              <div className="flex flex-col">
                {incompleteTasks.filter(t => {
                  if (activeSection === 'entrada') return t.project === 'Entrada';
                  if (activeSection === 'calendario') return t.project === 'Calendário de Atividades';
                  return false;
                }).map(t => <TodoistTaskRow key={t.id} task={t} onComplete={handleComplete} isList={true} />)}

                {addingTask === 'generic' ? (
                  <AddTaskForm
                    title={newTaskTitle} desc={newTaskDesc} setTitle={setNewTaskTitle} setDesc={setNewTaskDesc}
                    onSave={() => handleSaveTask(null)} onCancel={() => { setAddingTask(null); setNewTaskTitle(''); setNewTaskDesc(''); }} loading={addingSaving}
                    isList={true}
                  />
                ) : (
                  <button onClick={() => setAddingTask('generic')} className="flex items-center gap-3 text-gray-500 hover:text-[#db4c3f] group w-full text-left py-2 cursor-pointer transition-colors mt-2 text-[14px]">
                    <Plus size={20} className="text-[#db4c3f] rounded-full group-hover:bg-[#ffefe5] p-0.5 transition-colors" />
                    <span>Adicionar tarefa</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function TodoistTaskRow({ task, onComplete, isList = false }: { task: Task; onComplete: (id: string) => void; isList?: boolean }) {
  const isOverdue = task.due_date && new Date(task.due_date + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));

  // Formatting presentation date
  let dateLabel = '';
  if (task.due_date) {
    const d = new Date(task.due_date + 'T12:00:00');
    dateLabel = d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).replace('.', '');
    if (d.getFullYear() > new Date().getFullYear()) {
      dateLabel += ` ${d.getFullYear()}`;
    }
  }

  // Has description link
  const isLink = task.description?.includes('http');

  return (
    <div className={`group flex items-start flex-col sm:flex-row shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:items-center gap-2.5 py-2.5 border border-gray-200 mt-2 hover:bg-white rounded-xl transition-all cursor-pointer bg-white overflow-hidden px-3`}>
      <div className="flex w-full items-start gap-2.5">
        <button onClick={() => onComplete(task.id)} className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors cursor-pointer flex-shrink-0">
          <Circle size={18} strokeWidth={2} />
        </button>
        <div className="flex-1 flex flex-col pt-[1px] min-w-0">
          <p className={`text-[13px] text-[#202020] leading-[18px] ${isList ? 'font-normal' : 'font-normal'}`}>{task.title}</p>
          {task.description && (
            <p className="text-[12px] text-gray-500 truncate mt-0.5">
              {isLink ? (
                <a href={task.description} target="_blank" rel="noreferrer" className="text-gray-400 underline decoration-gray-300 hover:text-blue-500">{task.description}</a>
              ) : task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.due_date && (
              <div className={`flex items-center gap-1 text-[11px] ${isOverdue ? 'text-[#db4c3f] font-medium' : 'text-gray-500'}`}>
                <CalendarIcon size={11} className={isOverdue ? 'text-[#db4c3f]' : 'text-green-600'} />
                {dateLabel}
                {isOverdue && <MessageSquare size={10} className="ml-1 opacity-70" />}
                {isOverdue && <span className="opacity-70">1</span>}
              </div>
            )}
            {task.project && task.project !== 'Entrada' && (
              <div className="text-[11px] text-gray-400 flex items-center gap-1 md:ml-auto">
                Entrada <Hash size={11} className="opacity-50" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTaskForm({ title, desc, setTitle, setDesc, onSave, onCancel, loading }: any) {
  return (
    <div className={`border border-gray-200 rounded-xl p-3 bg-white shadow-sm mt-2 transition-all w-full focus-within:border-gray-300`}>
      <input
        type="text"
        autoFocus
        placeholder="Nome da tarefa"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave();
          }
        }}
        className="w-full text-sm font-semibold text-[#202020] focus:outline-none placeholder:text-gray-400 mb-1"
      />
      <textarea
        placeholder="Descrição"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        rows={1}
        className="w-full text-xs text-gray-600 focus:outline-none placeholder:text-gray-400 resize-none mt-1 h-6"
      />
      <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer border border-gray-200">
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={!title.trim() || loading}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#db4c3f] disabled:opacity-50 hover:bg-[#c53727] rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
        >
          {loading ? 'Adicionando...' : 'Adicionar tarefa'}
        </button>
      </div>
    </div>
  );
}
