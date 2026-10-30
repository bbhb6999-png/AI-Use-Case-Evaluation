import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Play, 
  Trash2, 
  Eye, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  PauseCircle,
  BarChart3,
  ArrowLeft,
  User,
  Settings,
  Database,
  Activity,
  Zap,
  FileText,
  GitCompare,
  Edit2,
  AlertTriangle,
  Server,
  Layers,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  useStore, Modal, Confirm, fmtNow, fmtDur, buildReportText, downloadText,
  EvalTask, TestResult, TestReport, ResourceRecord
} from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  activeSubTab: string;
  navigate: (tab: string, sub?: string) => void;
}

type ViewType = 'list' | 'taskDetail' | 'reportDetail' | 'versionDiff';

const TYPE_COLORS: Record<string, string> = {
  'UI测试': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '接口测试': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  '性能测试': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function EvaluationManagement({ activeSubTab, navigate }: Props) {
  const store = useStore();
  const { tasks, results, reports, resources, addTask, updateTask, deleteTask, runTask, stopTask, generateReport, deleteReport, notify } = store;

  const [view, setView] = useState<ViewType>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: EvalTask; initialType?: string }>({ open: false });
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ type: 'task' | 'report'; id: string; name: string } | null>(null);

  const [taskSearch, setTaskSearch] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportResultFilter, setReportResultFilter] = useState('');

  // 报告生成：选中的来源任务
  const [repTaskId, setRepTaskId] = useState('');

  const subTabTypeMap: Record<string, string> = { 'ui-test': 'UI测试', 'api-test': '接口测试', 'perf-test': '性能测试' };
  const forcedType = subTabTypeMap[activeSubTab];

  const statusMeta = (t: { status: string; progress?: number }) => {
    switch (t.status) {
      case 'running': return { label: '运行中', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', pulse: true };
      case 'completed': return { label: '已完成', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', pulse: false };
      case 'failed': return { label: '失败', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', pulse: false };
      default: return { label: '等待中', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', pulse: false };
    }
  };

  const itemsBadge = (s: string) => s === 'success' ? 'text-emerald-600' : s === 'warning' ? 'text-orange-500' : 'text-red-500';

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (forcedType && t.type !== forcedType) return false;
    if (taskSearch && !t.name.toLowerCase().includes(taskSearch.toLowerCase()) && !t.id.toLowerCase().includes(taskSearch.toLowerCase())) return false;
    if (taskTypeFilter && t.type !== taskTypeFilter) return false;
    if (taskStatusFilter && t.status !== taskStatusFilter) return false;
    return true;
  }), [tasks, taskSearch, taskTypeFilter, taskStatusFilter, forcedType]);

  const filteredReports = useMemo(() => reports.filter(r => {
    if (reportSearch && !r.name.toLowerCase().includes(reportSearch.toLowerCase()) && !r.id.toLowerCase().includes(reportSearch.toLowerCase())) return false;
    if (reportResultFilter && r.result !== reportResultFilter) return false;
    return true;
  }), [reports, reportSearch, reportResultFilter]);

  const doneTasks = useMemo(() => tasks.filter(t => t.status === 'completed'), [tasks]);
  const taskById = (id: string) => tasks.find(t => t.id === id);
  const resultOfTask = (id: string) => results.filter(r => r.taskId === id).sort((a, b) => b.generationTime.localeCompare(a.generationTime))[0];
  const resourceOfTask = (id: string) => resources.filter(r => r.taskId === id).sort((a, b) => b.time.localeCompare(a.time))[0];

  /* ---------- 动作 ---------- */
  const handleRun = (t: EvalTask) => {
    if (t.status === 'running') {
      stopTask(t.id);
      notify(`任务 ${t.id} 已手动停止，进度已重置`, 'info');
    } else {
      if (t.status === 'completed' || t.status === 'failed') {
        // 重新执行前清掉旧一次的结果引用关系无需处理，直接重跑生成新结果
      }
      runTask(t.id);
      notify(`任务 ${t.id}《${t.name}》已开始执行，可在下方列表观察进度`, 'info');
    }
  };

  const handleSaveTask = (form: { name: string; type: string; target: string; config: string }) => {
    if (taskModal.task) {
      updateTask({ ...taskModal.task, ...form, time: fmtNow() });
      notify(`任务 ${taskModal.task.id} 已更新`);
    } else {
      const t = addTask(form);
      notify(`任务 ${t.id}《${t.name}》创建成功，点击"执行"即可开始评测`);
    }
    setTaskModal({ open: false });
  };

  const handleGenerateReport = (opts: { template: string; modules: string[]; format: string }, alsoDownload: boolean) => {
    if (!repTaskId) { notify('请先选择一个已完成的任务', 'error'); return; }
    const report = generateReport(repTaskId, opts);
    if (!report) { notify('任务不存在', 'error'); return; }
    const task = taskById(repTaskId);
    const result = resultOfTask(repTaskId);
    const res = resourceOfTask(repTaskId);
    notify(`报告 ${report.id} 生成成功（结论：${report.result}），数据来自任务真实执行结果`);
    if (alsoDownload) {
      downloadText(`${report.id}_${report.name}.txt`, buildReportText(report, task, result, res));
    }
    setReportModalOpen(false);
    setSelectedId(report.id);
    setView('reportDetail');
    if (activeSubTab !== 'reports') navigate('evaluation', 'reports');
  };

  const doDelete = () => {
    if (!confirmDel) return;
    if (confirmDel.type === 'task') { deleteTask(confirmDel.id); notify(`任务 ${confirmDel.name} 及其关联结果、报告、资源记录已删除`, 'info'); }
    else { deleteReport(confirmDel.id); notify(`报告 ${confirmDel.name} 已删除`, 'info'); }
    setConfirmDel(null);
  };

  /* ---------- 通用头部 ---------- */
  const Header = ({ title, sub }: { title: string; sub: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{sub}</p>
      </div>
    </div>
  );

  /* ---------- 任务列表 ---------- */
  const TaskTable = ({ list, showType = true }: { list: EvalTask[]; showType?: boolean }) => (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">任务</th>
              {showType && <th className="px-6 py-4 font-semibold">类型</th>}
              <th className="px-6 py-4 font-semibold">状态</th>
              <th className="px-6 py-4 font-semibold">进度</th>
              <th className="px-6 py-4 font-semibold">创建人</th>
              <th className="px-6 py-4 font-semibold">时间</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {list.map(t => {
              const meta = statusMeta(t);
              return (
                <tr key={t.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mr-3 shrink-0">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{t.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t.id} · 对象: {t.target}</p>
                      </div>
                    </div>
                  </td>
                  {showType && <td className="px-6 py-4"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", TYPE_COLORS[t.type] || '')}>{t.type}</span></td>}
                  <td className="px-6 py-4">
                    <span className={cn("flex items-center w-fit text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", meta.cls)}>
                      {meta.pulse && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-ping" />}
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", t.status === 'failed' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${t.progress}%` }} />
                      </div>
                      <span className="text-xs text-[var(--text-secondary)] w-8">{t.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{t.creator}</td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{t.time}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button title="查看详情" onClick={() => { setSelectedId(t.id); setView('taskDetail'); }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><Eye className="w-4 h-4" /></button>
                      <button title={t.status === 'running' ? '停止' : '执行'} onClick={() => handleRun(t)}
                        className={cn("p-2 rounded-lg", t.status === 'running' ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" : "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20")}>
                        {t.status === 'running' ? <PauseCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button title="编辑" onClick={() => setTaskModal({ open: true, task: t })} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>
                      <button title="删除" onClick={() => setConfirmDel({ type: 'task', id: t.id, name: t.name })} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                暂无任务，点击右上角"新建任务"创建第一个评测任务
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const FilterBar = ({ showType = true }: { showType?: boolean }) => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="搜索任务名称、ID..."
          className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-56" />
      </div>
      {showType && (
        <select value={taskTypeFilter} onChange={e => setTaskTypeFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
          <option value="">全部类型</option><option>UI测试</option><option>接口测试</option><option>性能测试</option>
        </select>
      )}
      <select value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
        <option value="">全部状态</option><option value="pending">等待中</option><option value="running">运行中</option><option value="completed">已完成</option><option value="failed">失败</option>
      </select>
      {(taskSearch || taskTypeFilter || taskStatusFilter) && (
        <button onClick={() => { setTaskSearch(''); setTaskTypeFilter(''); setTaskStatusFilter(''); }} className="text-xs text-blue-500 hover:underline">清除筛选</button>
      )}
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-4">
      <Header title={forcedType ? `${forcedType}工作台` : '测试任务管理'} sub="任务由统一执行引擎驱动：执行 → 生成测试结果 → 资源消耗记录 → 可基于结果生成报告" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <FilterBar showType={!forcedType} />
        <button onClick={() => setTaskModal({ open: true, initialType: forcedType })}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" /> 新建任务
        </button>
      </div>
      <TaskTable list={filteredTasks} showType={!forcedType} />
    </div>
  );

  /* ---------- 报告列表 ---------- */
  const renderReports = () => (
    <div className="space-y-4">
      <Header title="测试报告" sub="报告数据直接取自任务真实执行结果与资源消耗，支持导出文件" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="搜索报告..."
              className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-56" />
          </div>
          <select value={reportResultFilter} onChange={e => setReportResultFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
            <option value="">全部结论</option><option>通过</option><option>部分失败</option><option>失败</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select value={repTaskId} onChange={e => setRepTaskId(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm max-w-[240px]">
            <option value="">选择已完成任务…</option>
            {doneTasks.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
          </select>
          <button onClick={() => { if (!repTaskId) { notify('请先在左侧选择一个已完成的任务', 'error'); return; } setReportModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20">
            <FileCheck2 className="w-4 h-4 mr-2" /> 生成报告
          </button>
        </div>
      </div>
      {doneTasks.length === 0 && (
        <div className="card p-4 border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 text-sm text-blue-700 dark:text-blue-300 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 shrink-0" /> 当前没有"已完成"的任务。请先在「测试任务管理」中执行任务，任务完成后可基于其真实结果生成报告。
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">报告</th>
              <th className="px-6 py-4 font-semibold">类型</th>
              <th className="px-6 py-4 font-semibold">结论</th>
              <th className="px-6 py-4 font-semibold">模板/格式</th>
              <th className="px-6 py-4 font-semibold">生成时间</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredReports.map(r => (
              <tr key={r.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mr-3 shrink-0">
                      <BarChart3 className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{r.id} · 来源任务: {r.taskId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", TYPE_COLORS[r.type] || '')}>{r.type}</span></td>
                <td className="px-6 py-4">
                  <span className={cn("text-xs px-2 py-1 rounded-full font-bold", r.result === '通过' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : r.result === '部分失败' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>{r.result}</span>
                </td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{r.template} · {r.format.toUpperCase()}</td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{r.time}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button title="查看" onClick={() => { setSelectedId(r.id); setView('reportDetail'); }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><Eye className="w-4 h-4" /></button>
                    <button title="导出文件" onClick={() => {
                      const task = taskById(r.taskId);
                      downloadText(`${r.id}_${r.name}.txt`, buildReportText(r, task, resultOfTask(r.taskId), resourceOfTask(r.taskId)));
                      notify(`报告 ${r.id} 已导出为文件`);
                    }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><Download className="w-4 h-4" /></button>
                    <button title="删除" onClick={() => setConfirmDel({ type: 'report', id: r.id, name: r.name })} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--text-secondary)]">暂无报告</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ---------- 任务详情 ---------- */
  const renderTaskDetail = () => {
    const t = taskById(selectedId || ''); if (!t) return null;
    const result: TestResult | undefined = resultOfTask(t.id);
    const res: ResourceRecord | undefined = resourceOfTask(t.id);
    const meta = statusMeta(t);
    const relatedReports = reports.filter(r => r.taskId === t.id);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500">
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
          </button>
          <div className="flex gap-2">
            <button onClick={() => handleRun(t)} className={cn("flex items-center px-4 py-2 rounded-lg text-sm font-medium", t.status === 'running' ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")}>
              {t.status === 'running' ? <><PauseCircle className="w-4 h-4 mr-2" /> 停止执行</> : <><Play className="w-4 h-4 mr-2" /> {t.status === 'pending' ? '开始执行' : '重新执行'}</>}
            </button>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t.name}</h2>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", meta.cls)}>{meta.label}</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t.id} · {t.type} · 测试对象 {t.target}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center"><Settings className="w-5 h-5 mr-2 text-blue-500" /> 基本信息与配置</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><p className="text-xs text-[var(--text-secondary)]">创建人</p><p className="text-sm font-medium flex items-center mt-1"><User className="w-3.5 h-3.5 mr-1 text-slate-400" />{t.creator}</p></div>
                <div><p className="text-xs text-[var(--text-secondary)]">创建时间</p><p className="text-sm font-medium mt-1">{t.time}</p></div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-2">运行参数</p>
              <div className="bg-[var(--bg-primary)] p-4 rounded-lg font-mono text-xs border border-[var(--border-color)] whitespace-pre-wrap">{t.config}</div>
              <button onClick={() => setTaskModal({ open: true, task: t })} className="mt-3 text-xs text-blue-500 hover:underline flex items-center"><Edit2 className="w-3 h-3 mr-1" /> 编辑任务配置</button>
            </div>
            {result && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-500" /> 最近一次执行结果</h3>
                  <button onClick={() => navigate('verification', 'res-list')} className="text-xs text-blue-500 hover:underline">前往结果校验 →</button>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {result.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2 text-[var(--text-secondary)]">{item.name}</td>
                        <td className={cn("py-2 font-medium text-right", itemsBadge(item.status))}>{item.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-500" /> 执行状态</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">执行进度</span><span className="font-medium text-blue-500">{t.progress}%</span></div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700", t.status === 'failed' ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${t.progress}%` }} />
                  </div>
                  {t.status === 'running' && <p className="text-[10px] text-[var(--text-secondary)] animate-pulse">执行引擎运行中，进度每 0.85s 自动刷新…</p>}
                </div>
                {t.failReason && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-start">
                    <XCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" /> {t.failReason}
                  </div>
                )}
                {t.status === 'completed' && !relatedReports.length && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-700 dark:text-emerald-300">
                    任务已完成，可前往「测试报告」基于本次结果生成报告。
                  </div>
                )}
                {relatedReports.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-color)] space-y-2">
                    <p className="text-xs text-[var(--text-secondary)]">关联报告</p>
                    {relatedReports.map(r => (
                      <button key={r.id} onClick={() => { setSelectedId(r.id); setView('reportDetail'); }} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-primary)] text-sm">
                        <span className="flex items-center"><FileText className="w-4 h-4 mr-2 text-orange-500" /> {r.id} {r.name}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {res && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center"><Server className="w-4 h-4 mr-2 text-blue-500" /> 本次执行资源消耗</h3>
                  <button onClick={() => navigate('resource', 'res-monitor')} className="text-xs text-blue-500 hover:underline">资源监控 →</button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[['CPU', res.cpu, '%'], ['内存', res.mem, '%'], ['GPU', res.gpu, '%']].map(([l, v, u]) => (
                    <div key={l as string} className="p-3 bg-[var(--bg-primary)] rounded-lg">
                      <p className="text-lg font-bold">{v}{u}</p><p className="text-[10px] text-[var(--text-secondary)]">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 text-center mt-3">
                  <div className="p-3 bg-[var(--bg-primary)] rounded-lg"><p className="text-sm font-bold">{res.processed.toLocaleString()}</p><p className="text-[10px] text-[var(--text-secondary)]">处理样本数</p></div>
                  <div className="p-3 bg-[var(--bg-primary)] rounded-lg"><p className="text-sm font-bold">{res.duration}</p><p className="text-[10px] text-[var(--text-secondary)]">运行时长</p></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- 报告详情 ---------- */
  const renderReportDetail = () => {
    const report = reports.find(r => r.id === selectedId) || reports[0];
    if (!report) return null;
    const task = taskById(report.taskId);
    const result = resultOfTask(report.taskId);
    const res = resourceOfTask(report.taskId);
    const pieData = [
      { name: '成功', value: result?.successRate ?? 0, color: '#10b981' },
      { name: '失败', value: result?.failureRate ?? 0, color: '#ef4444' },
    ];
    const trend = Array.from({ length: 8 }).map((_, i) => ({
      time: `${String(new Date().getHours()).padStart(2, '0')}:${String((new Date().getMinutes() - (8 - i) * 5 + 60) % 60).padStart(2, '0')}`,
      latency: Math.round((result?.metrics.avgLatency ?? 150) * (0.85 + Math.sin(i) * 0.1 + Math.random() * 0.12)),
      successRate: +Math.min(100, (result?.successRate ?? 97) - Math.random() * 2).toFixed(1),
    }));
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
          <button onClick={() => { downloadText(`${report.id}_${report.name}.txt`, buildReportText(report, task, result, res)); notify(`报告 ${report.id} 已导出`); }}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            <Download className="w-4 h-4 mr-2" /> 导出报告文件
          </button>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{report.name} - 测试报告</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{report.id} · 来源任务 <button className="text-blue-500 hover:underline" onClick={() => { if (task) { setSelectedId(task.id); setView('taskDetail'); } }}>{report.taskId}</button> · {report.time} · 结论：
            <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs font-bold", report.result === '通过' ? 'bg-emerald-100 text-emerald-700' : report.result === '部分失败' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700')}>{report.result}</span>
          </p>
        </div>
        {!result && <div className="card p-4 text-sm text-orange-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> 来源任务尚无执行结果数据。</div>}
        {result && (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: '成功率', v: `${result.successRate}%`, c: 'text-emerald-500' },
              { l: '失败率', v: `${result.failureRate}%`, c: 'text-red-500' },
              { l: '平均延迟', v: `${result.metrics.avgLatency}ms`, c: 'text-blue-500' },
              { l: '最大延迟', v: `${result.metrics.maxLatency}ms`, c: 'text-purple-500' },
            ].map(s => (
              <div key={s.l} className="card p-4"><p className={cn("text-2xl font-bold", s.c)}>{s.v}</p><p className="text-xs text-[var(--text-secondary)] mt-1">{s.l}</p></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-4">执行期延迟趋势（基于真实结果波动模拟）</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={2} dot={false} name="延迟(ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-6">
              <h3 className="text-sm font-semibold mb-4">通过/失败占比</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">详细测试结果（{result.id}）</h3>
              <button onClick={() => navigate('verification', 'res-list')} className="text-xs text-blue-500 hover:underline">在结果校验中对比分析 →</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--text-secondary)] text-xs uppercase"><th className="py-2">测试项</th><th className="py-2">数值</th><th className="py-2 text-right">判定</th></tr></thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {result.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 text-[var(--text-secondary)]">{item.name}</td>
                    <td className="py-2.5 font-medium">{item.value}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn("inline-flex items-center text-xs font-bold", itemsBadge(item.status))}>
                        {item.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}{item.status === 'success' ? '通过' : item.status === 'warning' ? '警告' : '失败'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center"><Server className="w-4 h-4 mr-2 text-blue-500" /> 资源消耗（节点 {res.node}）</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                {[['CPU', `${res.cpu}%`], ['内存', `${res.mem}%`], ['GPU', `${res.gpu}%`], ['丢帧率', `${res.frameDrop}%`], ['处理样本', res.processed.toLocaleString()], ['运行时长', res.duration]].map(([l, v]) => (
                  <div key={l} className="p-3 bg-[var(--bg-primary)] rounded-lg"><p className="text-sm font-bold">{v}</p><p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{l}</p></div>
                ))}
              </div>
            </div>
          )}
        </>)}
      </div>
    );
  };

  /* ---------- 版本对比（接口域，静态分析视图） ---------- */
  const renderVersionDiff = () => {
    const diffData = [
      { path: '/api/v1/face/detect', method: 'POST', type: 'modified', impact: '高', desc: '响应体新增结构化描述字段' },
      { path: '/api/v1/face/match', method: 'POST', type: 'modified', impact: '中', desc: '相似度字段类型变更' },
      { path: '/api/v1/face/liveness', method: 'POST', type: 'added', impact: '低', desc: '新增活体检测接口' },
      { path: '/api/v1/face/compare', method: 'POST', type: 'deleted', impact: '高', desc: '旧版比对接口已下线' },
    ];
    return (
      <div className="space-y-6">
        <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <div><h2 className="text-2xl font-bold text-[var(--text-primary)]">多版本差异分析</h2><p className="text-sm text-[var(--text-secondary)] mt-1">对比不同算法版本接口行为与输出结果差异</p></div>
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h4 className="text-sm font-semibold">接口变更检测</h4>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" /> 修改</span>
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" /> 新增</span>
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1.5" /> 删除</span>
            </div>
          </div>
          <table className="w-full text-left">
            <thead><tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">接口路径</th><th className="px-6 py-4 font-semibold">变更类型</th><th className="px-6 py-4 font-semibold">影响程度</th><th className="px-6 py-4 font-semibold">变更描述</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {diffData.map((item, i) => (
                <tr key={i} className="hover:bg-[var(--bg-primary)]">
                  <td className="px-6 py-4"><div className="flex items-center"><span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mr-2">{item.method}</span><span className="text-sm font-medium">{item.path}</span></div></td>
                  <td className="px-6 py-4"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", item.type === 'modified' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : item.type === 'added' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>{item.type === 'modified' ? '修改' : item.type === 'added' ? '新增' : '删除'}</span></td>
                  <td className="px-6 py-4 text-sm">{item.impact}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (view === 'taskDetail') return renderTaskDetail();
    if (view === 'reportDetail') return renderReportDetail();
    if (view === 'versionDiff') return renderVersionDiff();
    if (activeSubTab === 'reports') return renderReports();
    return renderTasks();
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div key={`${activeSubTab}-${view}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="h-full">
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      {taskModal.open && (
        <Modal title={taskModal.task ? `编辑任务 ${taskModal.task.id}` : '新建测试任务'} icon={<Layers className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setTaskModal({ open: false })} width="max-w-xl">
          <TaskForm key={taskModal.task?.id || 'new'}
            initial={{ name: taskModal.task?.name || '', type: taskModal.task?.type || taskModal.initialType || 'UI测试', target: taskModal.task?.target || '' }}
            initialCfg={taskModal.task?.config || '{\n  "threshold": 0.85,\n  "max_iterations": 1000,\n  "retry_on_failure": true,\n  "log_level": "INFO"\n}'}
            onSave={handleSaveTask} />
        </Modal>
      )}
      {reportModalOpen && (
        <Modal title="生成测试报告" icon={<BarChart3 className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setReportModalOpen(false)} width="max-w-xl">
          <ReportModal key={repTaskId} taskId={repTaskId} onGenerate={handleGenerateReport} />
        </Modal>
      )}
      <Confirm open={!!confirmDel} message={confirmDel ? `确定删除${confirmDel.type === 'task' ? '任务' : '报告'} ${confirmDel.name} 吗？${confirmDel.type === 'task' ? '其关联的测试结果、报告与资源记录将一并删除。' : ''}` : ''} confirmText="确认删除"
        onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

void Clock; void Zap; void GitCompare; void Database;

/* ================= 顶层表单组件（模块级定义，避免执行引擎 tick 触发重挂载丢失输入） ================= */
const TaskForm = ({ initial, initialCfg, onSave }: { initial: { name: string; type: string; target: string }; initialCfg: string; onSave: (f: { name: string; type: string; target: string; config: string }) => void }) => {
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [target, setTarget] = useState(initial.target);
  const [config, setConfig] = useState(initialCfg);
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('请输入任务名称'); return; }
    if (!target.trim()) { setErr('请输入测试对象'); return; }
    try { JSON.parse(config); } catch { setErr('运行参数必须是合法 JSON'); return; }
    onSave({ name: name.trim(), type, target: target.trim(), config });
  };
  const inputCls = "w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm flex items-center"><AlertTriangle className="w-4 h-4 mr-2" />{err}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">任务名称 *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="如：车牌识别夜间场景评测" className={inputCls} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">任务类型</label>
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
            <option>UI测试</option><option>接口测试</option><option>性能测试</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">测试对象（算法/服务版本）*</label>
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="如：PlateOCR-v2.3" className={inputCls} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">运行参数（JSON）</label>
        <textarea value={config} onChange={e => setConfig(e.target.value)} rows={7} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <p className="text-[10px] text-[var(--text-secondary)] mr-auto self-center">创建后可在列表中点击 ▶ 由执行引擎真实推进</p>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{initial.name ? '保存修改' : '创建任务'}</button>
      </div>
    </form>
  );
};

const ALL_MODULES = ['测试概要', '测试环境', '测试数据', '详细结果', '资源消耗', '测试结论', '问题与建议'];
const ReportModal = ({ taskId, onGenerate }: { taskId: string; onGenerate: (opts: { template: string; modules: string[]; format: string }, download: boolean) => void }) => {
  const { tasks, results } = useStore();
  const task = tasks.find(t => t.id === taskId);
  const result = results.filter(r => r.taskId === taskId).sort((a, b) => b.generationTime.localeCompare(a.generationTime))[0];
  const [template, setTemplate] = useState('标准模板');
  const [modules, setModules] = useState<string[]>(['测试概要', '测试结论']);
  const [format, setFormat] = useState('pdf');
  return (
    <div className="p-6 space-y-6">
      <div className="p-4 rounded-lg bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/40 text-sm">
        <p className="font-medium mb-1">数据来源：{taskId} {task?.name}</p>
        {result ? <p className="text-xs text-[var(--text-secondary)]">将引用执行结果 {result.id}：成功率 {result.successRate}%、平均延迟 {result.metrics.avgLatency}ms、共 {result.items.length} 项指标</p>
          : <p className="text-xs text-orange-600">该任务暂无执行结果，报告将缺少详细数据</p>}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">报告模板</p>
        <div className="grid grid-cols-3 gap-3">
          {['标准模板', '简要模板', '详细模板'].map(t => (
            <button key={t} type="button" onClick={() => setTemplate(t)} className={cn("p-3 border rounded-lg text-sm text-left", template === t ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10" : "border-[var(--border-color)] hover:border-blue-300")}>
              <FileText className={cn("w-4 h-4 mb-1", template === t ? "text-blue-500" : "text-[var(--text-secondary)]")} />{t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">报告内容</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_MODULES.map(m => (
            <label key={m} className="flex items-center space-x-2 text-sm cursor-pointer">
              <input type="checkbox" checked={modules.includes(m)} onChange={e => setModules(prev => e.target.checked ? [...prev, m] : prev.filter(x => x !== m))} className="rounded border-[var(--border-color)] accent-blue-600" />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">导出格式</p>
        <div className="flex gap-2">
          {['pdf', 'word', 'excel', 'zip'].map(f => (
            <button key={f} type="button" onClick={() => setFormat(f)} className={cn("px-4 py-1.5 border rounded-lg text-sm uppercase", format === f ? "border-blue-500 text-blue-500 bg-blue-50/50 dark:bg-blue-900/10" : "border-[var(--border-color)]")}>{f}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={() => onGenerate({ template, modules, format }, false)} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">仅生成</button>
        <button onClick={() => onGenerate({ template, modules, format }, true)} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Download className="w-4 h-4 mr-2" /> 生成并导出文件
        </button>
      </div>
    </div>
  );
};
