import React, { useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, XCircle, Play,
  ArrowRight, Plus, Monitor, Database, Activity, Search, Tags
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { useStore, rnd } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getResourceData = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(d.getHours() - i * 4);
    data.push({
      time: `${String(d.getHours()).padStart(2, '0')}:00`,
      cpu: Math.floor(rnd(30, 80)), memory: Math.floor(rnd(40, 80)), gpu: Math.floor(rnd(20, 80)),
    });
  }
  return data;
};
const RESOURCE_DATA = getResourceData();

const QUICK_ENTRIES = [
  { label: '新建评测', icon: Plus, color: 'bg-blue-500', tab: 'evaluation', subTab: 'task-mgmt' },
  { label: '数据标注', icon: Tags, color: 'bg-emerald-500', tab: 'annotation', subTab: 'img-anno' },
  { label: '资源监控', icon: Monitor, color: 'bg-indigo-500', tab: 'resource', subTab: 'res-monitor' },
  { label: '结果对比', icon: Activity, color: 'bg-orange-500', tab: 'verification', subTab: 'res-comp' },
];

interface WorkbenchProps {
  navigate: (tabId: string, subTabId?: string) => void;
}

export default function Workbench({ navigate }: WorkbenchProps) {
  const { tasks, results, reports, resources } = useStore();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const running = tasks.filter(t => t.status === 'running');
  const failed = tasks.filter(t => t.status === 'failed');
  const completed = tasks.filter(t => t.status === 'completed');

  // 标注框总数：读取数据标注模块的真实持久化
  const annoCount = useMemo(() => {
    try {
      const raw = localStorage.getItem('as-eval-annotations');
      if (!raw) return 0;
      const map = JSON.parse(raw);
      return Object.values(map).reduce((s: number, boxes: any) => s + (Array.isArray(boxes) ? boxes.length : 0), 0) as number;
    } catch { return 0; }
  }, []);

  const health = tasks.length ? Math.max(60, +(100 - failed.length / tasks.length * 20 - running.length * 1.5).toFixed(1)) : 100;

  const STATS = [
    { label: '评测任务总数', value: tasks.length, sub: `${completed.length} 已完成 / ${failed.length} 失败`, trend: 'up' as const, icon: Activity },
    { label: '当前运行中', value: running.length, sub: running.length ? `最快 ${Math.max(...running.map(t => t.progress))}%` : '空闲', trend: running.length ? 'up' as const : 'stable' as const, icon: Play },
    { label: '标注框总数', value: annoCount, sub: '来自数据标注模块', trend: 'up' as const, icon: Tags },
    { label: '系统健康度', value: `${health}`, unit: '%', sub: `${resources.length} 份资源档案`, trend: health > 90 ? 'up' as const : 'down' as const, icon: CheckCircle2 },
  ];

  const types = ['all', ...new Set(tasks.map(t => t.type))];
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  }).slice(0, 6), [tasks, searchQuery, typeFilter, statusFilter]);

  const statusBadge = (s: string) => {
    switch (s) {
      case 'running': return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold w-fit"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-ping" />运行中</span>;
      case 'completed': return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold w-fit"><CheckCircle2 className="w-3 h-3 mr-1" />已完成</span>;
      case 'failed': return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold w-fit"><XCircle className="w-3 h-3 mr-1" />失败</span>;
      default: return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold w-fit"><Clock className="w-3 h-3 mr-1" />等待中</span>;
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[var(--text-secondary)] text-sm">{stat.label}</p>
              <stat.icon className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-[var(--text-primary)]">{stat.value}</span>
              {stat.unit && <span className="text-sm text-[var(--text-secondary)]">{stat.unit}</span>}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* 快捷入口 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">快捷入口</h3>
          <span className="text-xs text-[var(--text-secondary)]">数据全平台共享 · 执行结果实时流转</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_ENTRIES.map((entry, idx) => (
            <motion.button key={idx} onClick={() => navigate(entry.tab, entry.subTab)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center p-4 rounded-xl border border-[var(--border-color)] hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group text-left">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mr-3", entry.color)}>
                <entry.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">{entry.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">前往模块</p>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 平台数据流 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center"><Database className="w-5 h-5 mr-2 text-blue-500" /> 平台数据概况</h3>
          <div className="space-y-3">
            {[
              { l: '评测任务', v: tasks.length, to: 'evaluation' },
              { l: '测试结果', v: results.length, to: 'verification' },
              { l: '测试报告', v: reports.length, to: 'evaluation' },
              { l: '资源档案', v: resources.length, to: 'resource' },
            ].map(row => (
              <button key={row.l} onClick={() => navigate(row.to)} className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left">
                <span className="text-sm text-[var(--text-secondary)]">{row.l}</span>
                <span className="flex items-center text-sm font-bold text-[var(--text-primary)]">{row.v} <ArrowRight className="w-3.5 h-3.5 ml-2 text-blue-500" /></span>
              </button>
            ))}
          </div>
        </div>

        {/* 资源占用 */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center"><Monitor className="w-5 h-5 mr-2 text-blue-500" /> 集群资源占用（近 24h）</h3>
            <button onClick={() => navigate('resource', 'res-monitor')} className="text-xs text-blue-500 hover:underline">实时资源监控 →</button>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={RESOURCE_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="colorGpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" name="CPU" />
                <Area type="monotone" dataKey="gpu" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorGpu)" name="GPU" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 最近任务：真实任务表，进度实时刷新 */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">最近评测任务</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">与「评测管理」共享同一数据源，运行中任务进度实时刷新</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索任务..."
                className="pl-9 pr-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
              {types.map(t => <option key={t} value={t}>{t === 'all' ? '全部类型' : t}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
              <option value="all">全部状态</option><option value="pending">等待中</option><option value="running">运行中</option><option value="completed">已完成</option><option value="failed">失败</option>
            </select>
            <button onClick={() => navigate('evaluation', 'task-mgmt')} className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center">查看全部 <ArrowRight className="w-3.5 h-3.5 ml-1" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">任务 ID</th>
                <th className="px-6 py-4 font-semibold">名称</th>
                <th className="px-6 py-4 font-semibold">类型</th>
                <th className="px-6 py-4 font-semibold">状态</th>
                <th className="px-6 py-4 font-semibold">进度</th>
                <th className="px-6 py-4 font-semibold">创建人</th>
                <th className="px-6 py-4 font-semibold">时间</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredTasks.length ? filteredTasks.map(task => (
                <tr key={task.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-6 py-4"><span className="text-sm font-mono text-[var(--text-secondary)]">{task.id}</span></td>
                  <td className="px-6 py-4"><span className="text-sm font-medium text-[var(--text-primary)]">{task.name}</span></td>
                  <td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">{task.type}</span></td>
                  <td className="px-6 py-4">{statusBadge(task.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", task.status === 'failed' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${task.progress}%` }} />
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">{task.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{task.creator}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{task.time}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => navigate('evaluation', 'task-mgmt')} className="text-blue-500 hover:text-blue-600 text-xs font-medium">详情</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-[var(--text-secondary)]">未找到匹配的任务</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

void TrendingUp; void TrendingDown; void Minus; void BarChart; void Bar; void Cell;
