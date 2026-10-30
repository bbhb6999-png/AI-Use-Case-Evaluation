import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, Cpu, HardDrive, Network, Play, Pause, RefreshCw, Search, Trash2, ArrowLeft,
  BarChart3, Server, Monitor, TrendingUp, Timer, AlertTriangle, Cpu as CpuIcon, Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import { useStore, Confirm, rnd, ResourceRecord } from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props { activeSubTab: string; navigate: (tab: string, sub?: string) => void; }
type ViewState = 'main' | 'detail';

const CYCLE_MS: Record<string, number> = { '1s': 1000, '5s': 5000, '10s': 10000, '30s': 30000 };
const NODES = ['本机', '服务器', '虚拟机'] as const;

interface Point { time: string; cpu: number; memory: number; gpu: number; network: number; latency: number; processed: number; }

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

function genPoint(node: string, busy: number): Point {
  const base = node === '服务器' ? 42 : node === '虚拟机' ? 32 : 24;
  const j = (v: number, amp: number) => Math.max(3, Math.min(98, Math.round(v + rnd(-amp, amp) + busy)));
  return {
    time: hhmm(new Date()),
    cpu: j(base, 8), memory: j(base + 18, 6), gpu: j(base + (node === '服务器' ? 22 : 8), 12),
    network: Math.round(rnd(40, 180) + busy * 4), latency: Math.round(rnd(90, 220) + busy * 6),
    processed: Math.round(rnd(60, 180) + busy * 8),
  };
}

function seedSeries(node: string, busy: number): Point[] {
  return Array.from({ length: 30 }).map((_, i) => {
    const p = genPoint(node, busy);
    return { ...p, time: hhmm(new Date(Date.now() - (30 - i) * 2000)) };
  });
}

export default function ResourceEvaluation({ activeSubTab, navigate }: Props) {
  const { tasks, resources, deleteResource, notify } = useStore();
  const [view, setView] = useState<ViewState>('main');
  const [detail, setDetail] = useState<ResourceRecord | null>(null);
  const [confirmDel, setConfirmDel] = useState<ResourceRecord | null>(null);

  // 监控
  const [node, setNode] = useState<typeof NODES[number]>('服务器');
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState('5s');
  const [taskSel, setTaskSel] = useState('auto');
  const [series, setSeries] = useState<Point[]>(() => seedSeries('服务器', 10));

  // 历史筛选
  const [historySearch, setHistorySearch] = useState('');
  const [historyNodeFilter, setHistoryNodeFilter] = useState('所有节点');

  // 性能统计所选任务
  const [statTaskId, setStatTaskId] = useState('');

  useEffect(() => { setView('main'); }, [activeSubTab]);

  const runningTasks = tasks.filter(t => t.status === 'running');
  const effectiveTask = taskSel === 'auto' ? runningTasks[0] : tasks.find(t => t.id === taskSel);
  const busy = effectiveTask?.status === 'running' ? 28 : effectiveTask ? 8 : 0;
  const busyKey = `${node}-${effectiveTask?.id || 'none'}-${effectiveTask?.status}`;

  // 实时采样：周期由"上报周期"真实控制
  useEffect(() => {
    if (activeSubTab !== 'res-monitor' || paused || view !== 'main') return;
    const iv = setInterval(() => setSeries(prev => [...prev.slice(-59), genPoint(node, busy)]), CYCLE_MS[cycle] || 5000);
    return () => clearInterval(iv);
  }, [node, paused, cycle, busyKey, activeSubTab, view]);

  useEffect(() => { setSeries(seedSeries(node, busy)); /* eslint-disable-next-line */ }, [node, busyKey]);

  const last = series[series.length - 1] || genPoint(node, busy);

  /* ---------- 资源监控 ---------- */
  const renderMonitor = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">资源监控</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">采样周期 = 上报周期（真实生效）；选择运行中的任务后负载将整体抬升</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={taskSel} onChange={e => setTaskSel(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm max-w-[260px]">
            <option value="auto">跟随运行中任务{runningTasks.length ? `（${runningTasks.length} 个在跑）` : '（暂无）'}</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.id} {t.name}{t.status === 'running' ? ' ●' : ''}</option>)}
          </select>
          <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden">
            {NODES.map(n => <button key={n} onClick={() => setNode(n)} className={cn("px-3 py-2 text-sm", node === n ? 'bg-blue-600 text-white' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)]')}>{n}</button>)}
          </div>
          <select value={cycle} onChange={e => setCycle(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
            {Object.keys(CYCLE_MS).map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setPaused(p => !p)} className={cn("flex items-center px-3 py-2 rounded-lg text-sm font-medium", paused ? "bg-emerald-600 text-white" : "bg-[var(--bg-secondary)] border border-[var(--border-color)]")}>
            {paused ? <><Play className="w-4 h-4 mr-1" /> 继续</> : <><Pause className="w-4 h-4 mr-1" /> 暂停</>}
          </button>
        </div>
      </div>

      {effectiveTask && (
        <div className="card p-3 px-4 flex items-center text-xs border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300">
          <Activity className="w-4 h-4 mr-2 shrink-0" />
          当前监控对象：{effectiveTask.id}《{effectiveTask.name}》— {effectiveTask.status === 'running' ? `运行中 ${effectiveTask.progress}%，资源占用抬升` : '已结束，展示基线负载'}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: 'CPU 占用', v: `${last.cpu}%`, i: Cpu, c: last.cpu > 80 ? 'text-red-500' : 'text-blue-500' },
          { l: '内存占用', v: `${last.memory}%`, i: Boxes, c: last.memory > 85 ? 'text-red-500' : 'text-purple-500' },
          { l: 'GPU 利用率', v: `${last.gpu}%`, i: CpuIcon, c: last.gpu > 90 ? 'text-red-500' : 'text-emerald-500' },
          { l: '网络吞吐', v: `${last.network} MB/s`, i: Network, c: 'text-orange-500' },
        ].map(s => (
          <div key={s.l} className="card p-4">
            <div className="flex items-center justify-between"><p className={cn("text-2xl font-bold", s.c)}>{s.v}</p><s.i className={cn("w-5 h-5", s.c)} opacity={0.5} /></div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{s.l} @ {node}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-blue-500" /> CPU / 内存 / GPU 实时曲线 {paused && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30">已暂停</span>}</h3>
          <span className="text-[10px] text-[var(--text-secondary)] flex items-center"><RefreshCw className={cn("w-3 h-3 mr-1", !paused && 'animate-spin')} /> 每 {cycle} 采样</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                {[['cpu', '#3b82f6'], ['memory', '#8b5cf6'], ['gpu', '#10b981']].map(([k, c]) => (
                  <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.35} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={10} interval={5} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" fill="url(#g-cpu)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="memory" name="内存 %" stroke="#8b5cf6" fill="url(#g-memory)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="gpu" name="GPU %" stroke="#10b981" fill="url(#g-gpu)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  /* ---------- 性能统计：按任务真实记录 ---------- */
  const tasksWithRes = useMemo(() => {
    const ids = new Set(resources.map(r => r.taskId).filter(Boolean));
    return tasks.filter(t => ids.has(t.id));
  }, [tasks, resources]);

  const statRecord = useMemo(() => {
    const recs = resources.filter(r => r.taskId === statTaskId).sort((a, b) => b.time.localeCompare(a.time));
    return recs[0] || null;
  }, [resources, statTaskId]);

  useEffect(() => { if (!statTaskId && tasksWithRes.length) setStatTaskId(tasksWithRes[0].id); }, [tasksWithRes, statTaskId]);

  const statSeries = useMemo(() => {
    if (!statRecord) return [];
    return Array.from({ length: 30 }).map((_, i) => ({
      time: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
      latency: Math.max(20, Math.round(statRecord.avgLatency * (1 + Math.sin(i / 3) * 0.15 + rnd(-0.08, 0.08)))),
      processed: Math.round(statRecord.processed / 30 * (1 + rnd(-0.3, 0.3))),
      frameDrop: +Math.max(0, statRecord.frameDrop * (1 + rnd(-0.4, 0.4))).toFixed(2),
    }));
  }, [statRecord]);

  const renderStats = () => (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">性能统计</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">数据来自各评测任务执行时自动记录的资源与性能档案</p>
        </div>
        <select value={statTaskId} onChange={e => setStatTaskId(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm max-w-[320px]">
          {tasksWithRes.length === 0 && <option value="">暂无含性能档案的任务</option>}
          {tasksWithRes.map(t => <option key={t.id} value={t.id}>{t.id} {t.name}</option>)}
        </select>
      </div>
      {!statRecord ? (
        <div className="card p-12 text-center text-[var(--text-secondary)]">尚无性能档案 —— 执行任意评测任务后将自动生成</div>
      ) : (<>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { l: '处理样本', v: statRecord.processed.toLocaleString() }, { l: '运行时长', v: statRecord.duration },
            { l: '平均延迟', v: `${statRecord.avgLatency}ms` }, { l: '丢帧率', v: `${statRecord.frameDrop}%` },
            { l: '峰值GPU', v: `${statRecord.gpu}%` }, { l: '执行节点', v: statRecord.node },
          ].map(s => (
            <div key={s.l} className="card p-3 text-center"><p className="text-sm font-bold truncate">{s.v}</p><p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{s.l}</p></div>
          ))}
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-4">处理延迟曲线（围绕任务真实均值波动）</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={statSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={10} interval={3} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="latency" name="延迟(ms)" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)]"><h4 className="text-sm font-semibold">统计明细（最近 10 个区间）</h4></div>
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-3 font-semibold">区间</th><th className="px-6 py-3 font-semibold">延迟(ms)</th><th className="px-6 py-3 font-semibold">处理数</th><th className="px-6 py-3 font-semibold">丢帧率(%)</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {statSeries.slice(-10).map((r, i) => (
                <tr key={i} className="hover:bg-[var(--bg-primary)]">
                  <td className="px-6 py-2.5 text-[var(--text-secondary)]">{r.time}</td>
                  <td className="px-6 py-2.5 font-medium">{r.latency}</td>
                  <td className="px-6 py-2.5">{r.processed}</td>
                  <td className={cn("px-6 py-2.5 font-medium", r.frameDrop > 1 ? 'text-red-500' : 'text-emerald-600')}>{r.frameDrop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );

  /* ---------- 历史记录：来自真实执行 ---------- */
  const filteredHistory = useMemo(() => resources.filter(r => {
    if (historySearch && !r.name.toLowerCase().includes(historySearch.toLowerCase())) return false;
    if (historyNodeFilter !== '所有节点' && r.node !== historyNodeFilter) return false;
    return true;
  }), [resources, historySearch, historyNodeFilter]);

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">历史记录</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">每一次任务执行都会自动落一条资源档案（与评测管理联动）</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="搜索任务名..."
              className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-52" />
          </div>
          <select value={historyNodeFilter} onChange={e => setHistoryNodeFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
            <option>所有节点</option><option>GPU服务器_A100_01</option><option>GPU-Node-04</option><option>边缘计算节点_05</option><option>本机</option><option>评测引擎-本机</option>
          </select>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">任务</th><th className="px-6 py-4 font-semibold">节点</th>
              <th className="px-6 py-4 font-semibold">CPU</th><th className="px-6 py-4 font-semibold">内存</th><th className="px-6 py-4 font-semibold">GPU</th>
              <th className="px-6 py-4 font-semibold">时长</th><th className="px-6 py-4 font-semibold">丢帧率</th><th className="px-6 py-4 font-semibold">时间</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredHistory.map(r => (
              <tr key={r.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{r.id}{r.taskId ? ` · ${r.taskId}` : ''}</p>
                </td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{r.node}</td>
                <td className="px-6 py-4 text-sm">{r.cpu}%</td>
                <td className="px-6 py-4 text-sm">{r.mem}%</td>
                <td className={cn("px-6 py-4 text-sm font-medium", r.gpu > 85 && 'text-red-500')}>{r.gpu}%</td>
                <td className="px-6 py-4 text-sm">{r.duration}</td>
                <td className={cn("px-6 py-4 text-sm", r.frameDrop > 1 ? 'text-red-500 font-medium' : 'text-emerald-600')}>{r.frameDrop}%</td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{r.time}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button title="详情" onClick={() => { setDetail(r); setView('detail'); }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><BarChart3 className="w-4 h-4" /></button>
                    <button title="删除" onClick={() => setConfirmDel(r)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredHistory.length === 0 && <tr><td colSpan={9} className="px-6 py-12 text-center text-[var(--text-secondary)]">暂无记录 —— 执行任务后自动生成</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ---------- 记录详情 ---------- */
  const detailSeries = useMemo(() => {
    if (!detail) return [];
    return Array.from({ length: 40 }).map((_, i) => ({
      time: `${String(Math.floor(i * 2 / 60)).padStart(2, '0')}:${String((i * 2) % 60).padStart(2, '0')}`,
      cpu: Math.round(detail.cpu * (1 + Math.sin(i / 4) * 0.25 + rnd(-0.08, 0.08))),
      memory: Math.round(detail.mem * (1 + Math.cos(i / 5) * 0.15 + rnd(-0.05, 0.05))),
      gpu: Math.round(detail.gpu * (1 + Math.sin(i / 3 + 1) * 0.25 + rnd(-0.1, 0.1))),
    }));
  }, [detail]);

  const renderDetail = () => {
    if (!detail) return null;
    const task = tasks.find(t => t.id === detail.taskId);
    return (
      <div className="space-y-6">
        <button onClick={() => setView('main')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回</button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{detail.name} - 资源档案</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{detail.id} · {detail.node} · {detail.time}
              {task && <> · <button onClick={() => navigate('evaluation', 'task-mgmt')} className="text-blue-500 hover:underline">来源任务 {task.id} →</button></>}
            </p>
          </div>
          {detail.frameDrop > 1 && <span className="flex items-center text-xs px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle className="w-4 h-4 mr-2" /> 丢帧率 {detail.frameDrop}% 超过 1% 阈值</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { l: '平均CPU', v: `${detail.cpu}%`, i: Monitor }, { l: '平均内存', v: `${detail.mem}%`, i: HardDrive },
            { l: '峰值GPU', v: `${detail.gpu}%`, i: Cpu }, { l: '运行时长', v: detail.duration, i: Timer },
            { l: '处理样本', v: detail.processed.toLocaleString(), i: Server }, { l: '平均延迟', v: `${detail.avgLatency}ms`, i: Activity },
          ].map(s => (
            <div key={s.l} className="card p-4"><p className="text-lg font-bold">{s.v}</p><p className="text-[10px] text-[var(--text-secondary)] mt-0.5 flex items-center"><s.i className="w-3 h-3 mr-1" />{s.l}</p></div>
          ))}
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-4">资源占用回放（围绕记录均值模拟回放）</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={detailSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={10} interval={4} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="memory" name="内存 %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gpu" name="GPU %" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (view === 'detail') return renderDetail();
    switch (activeSubTab) {
      case 'perf-stats': return renderStats();
      case 'history-log': return renderHistory();
      default: return renderMonitor();
    }
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div key={`${activeSubTab}-${view}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <Confirm open={!!confirmDel} message={confirmDel ? `确定删除资源档案 ${confirmDel.id}（${confirmDel.name}）吗？` : ''}
        onConfirm={() => { if (confirmDel) { deleteResource(confirmDel.id); notify('资源档案已删除', 'info'); } setConfirmDel(null); }}
        onCancel={() => setConfirmDel(null)} />
    </div>
  );
}
