import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Search, ChevronRight, ArrowLeft, BarChart3, FileText, Layers,
  CheckCircle2, XCircle, AlertCircle, Trash2, Download, Eye, ArrowRightLeft,
  Activity, Maximize2, GitCompare, Plus, TrendingUp, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RePieChart, Pie, Legend
} from 'recharts';
import { useStore, Confirm, downloadText, TestResult, TestItem } from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props { activeSubTab: string; navigate: (tab: string, sub?: string) => void; }
type ViewState = 'list' | 'detail' | 'compare' | 'analysis';

/** 从 "120ms" / "98.5%" / "4.2GB" 之类的字符串提取数值，失败返回 null */
const parseNum = (s: string): number | null => {
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const unitOf = (s: string) => String(s).replace(/^-?[\d.,]+/, '');

const statusBadge = (s: string) => s === 'success'
  ? <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold w-fit"><CheckCircle2 className="w-3 h-3 mr-1" /> 正常</span>
  : s === 'warning'
    ? <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold w-fit"><AlertCircle className="w-3 h-3 mr-1" /> 警告</span>
    : <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:red-400 font-bold w-fit"><XCircle className="w-3 h-3 mr-1" /> 异常</span>;

const itemColor = (s: string) => s === 'success' ? 'text-emerald-600' : s === 'warning' ? 'text-orange-500' : 'text-red-500';

export default function ResultVerification({ activeSubTab, navigate }: Props) {
  const { results, tasks, deleteResult, notify } = useStore();
  const [view, setView] = useState<ViewState>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<TestResult | null>(null);

  // 对比：默认取最近两次
  const [compareIds, setCompareIds] = useState<string[]>(() => results.slice(0, 2).map(r => r.id));
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);
  const [vertical, setVertical] = useState(false);

  // 分析：默认取最近两次
  const [pair, setPair] = useState<string[]>(() => results.slice(0, 2).map(r => r.id));

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => results.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  }), [results, search, typeFilter]);

  const selected = results.find(r => r.id === selectedId);
  const compared = compareIds.map(id => results.find(r => r.id === id)).filter(Boolean) as TestResult[];
  const pairResults = pair.map(id => results.find(r => r.id === id)).filter(Boolean) as TestResult[];

  /* ---------- 列表 ---------- */
  const renderList = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">测试结果</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">汇聚评测任务、接口执行、多版本测试的真实产出，可用于横向对比与差异分析</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索结果名称、ID..."
              className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-56" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
            <option value="">全部类型</option><option>UI测试</option><option>接口测试</option><option>性能测试</option>
          </select>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">结果名称</th>
                <th className="px-6 py-4 font-semibold">类型</th>
                <th className="px-6 py-4 font-semibold">来源</th>
                <th className="px-6 py-4 font-semibold">判定</th>
                <th className="px-6 py-4 font-semibold">成功率</th>
                <th className="px-6 py-4 font-semibold">生成时间</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mr-3 shrink-0"><FileText className="w-4 h-4 text-blue-500" /></div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{r.id} · {r.config}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">{r.type}</span></td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{r.taskName}</td>
                  <td className="px-6 py-4">{statusBadge(r.status)}</td>
                  <td className="px-6 py-4 text-sm font-medium">{r.successRate}%</td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{r.generationTime}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button title="详情" onClick={() => { setSelectedId(r.id); setView('detail'); }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><Eye className="w-4 h-4" /></button>
                      <button title="加入对比" onClick={() => {
                        setCompareIds(prev => prev.includes(r.id) ? prev : [r.id, ...prev].slice(0, 4));
                        navigate('verification', 'res-comp'); setView('compare');
                        notify(`已将「${r.name}」加入对比集`, 'info');
                      }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><ArrowRightLeft className="w-4 h-4" /></button>
                      <button title="差异分析" onClick={() => {
                        const other = results.find(x => x.id !== r.id);
                        setPair(other ? [r.id, other.id] : [r.id]);
                        navigate('verification', 'diff-analysis'); setView('analysis');
                      }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><GitCompare className="w-4 h-4" /></button>
                      <button title="删除" onClick={() => setConfirmDel(r)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-[var(--text-secondary)]">暂无结果 —— 执行任意评测任务/接口测试后会自动出现在这里</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ---------- 详情 ---------- */
  const renderDetail = () => {
    if (!selected) return null;
    const task = selected.taskId ? tasks.find(t => t.id === selected.taskId) : undefined;
    return (
      <div className="space-y-6">
        <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3"><h2 className="text-2xl font-bold text-[var(--text-primary)]">{selected.name}</h2>{statusBadge(selected.status)}</div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{selected.id} · {selected.type} · {selected.generationTime} · 节点 {selected.node}</p>
          </div>
          <button onClick={() => {
            downloadText(`${selected.id}.txt`, [`# ${selected.name} (${selected.id})`, `来源: ${selected.taskName}`, `配置: ${selected.config}`, `成功率: ${selected.successRate}% 失败率: ${selected.failureRate}%`, '', ...selected.items.map(i => `- ${i.name}: ${i.value} [${i.status}]`)].join('\n'));
            notify('结果已导出');
          }} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><Download className="w-4 h-4 mr-2" /> 导出结果</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: '成功率', v: `${selected.successRate}%`, c: 'text-emerald-500' },
            { l: '失败率', v: `${selected.failureRate}%`, c: 'text-red-500' },
            { l: '平均延迟', v: `${selected.metrics.avgLatency}ms`, c: 'text-blue-500' },
            { l: '最大延迟', v: `${selected.metrics.maxLatency}ms`, c: 'text-purple-500' },
          ].map(s => <div key={s.l} className="card p-4"><p className={cn("text-2xl font-bold", s.c)}>{s.v}</p><p className="text-xs text-[var(--text-secondary)] mt-1">{s.l}</p></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold mb-4">测试项明细</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border-color)]">
                {selected.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 text-[var(--text-secondary)]">{item.name}</td>
                    <td className={cn("py-3 font-semibold text-right", itemColor(item.status))}>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-sm font-semibold mb-4">结果溯源</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">来源</span><span className="font-medium text-right">{selected.taskName}</span></div>
                {selected.taskId && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">任务 ID</span>
                  <button className="text-blue-500 hover:underline font-mono" onClick={() => navigate('evaluation', 'task-mgmt')}>{selected.taskId} →</button></div>}
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">配置</span><span className="font-medium">{selected.config}</span></div>
                {task && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">任务状态</span><span className="font-medium">{task.status === 'completed' ? '已完成' : task.status === 'running' ? '运行中' : task.status}</span></div>}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="text-sm font-semibold mb-3">快速操作</h3>
              <div className="space-y-2">
                <button onClick={() => { setCompareIds([selected.id, ...results.filter(r => r.id !== selected.id).slice(0, 1).map(r => r.id)]); setView('compare'); }} className="w-full flex items-center px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]"><ArrowRightLeft className="w-4 h-4 mr-2 text-blue-500" /> 与其他结果对比</button>
                <button onClick={() => { setPair([selected.id, results.find(r => r.id !== selected.id)?.id || selected.id]); setView('analysis'); }} className="w-full flex items-center px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]"><GitCompare className="w-4 h-4 mr-2 text-purple-500" /> 发起差异分析</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- 结果对比（真实 diff） ---------- */
  const renderCompare = () => {
    // 汇总所有测试项名
    const allNames = [...new Set(compared.flatMap(r => r.items.map(i => i.name)))];
    const rows = allNames.map(name => {
      const vals = compared.map(r => r.items.find(i => i.name === name));
      const defined = vals.filter(Boolean) as TestItem[];
      const distinct = new Set(defined.map(v => v.value));
      const isDiff = distinct.size > 1;
      return { name, vals, isDiff };
    });
    const shown = diffOnly ? rows.filter(r => r.isDiff) : rows;
    const diffCount = rows.filter(r => r.isDiff).length;
    return (
      <div className="space-y-6">
        <button onClick={() => { setView('list'); navigate('verification', 'res-list'); }} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">结果对比</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">按测试项逐项对比多份真实结果，差异自动高亮（当前 {compared.length} 份 · {diffCount} 项存在差异）</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddModalOpen(true)} className="flex items-center px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-secondary)]"><Plus className="w-4 h-4 mr-1" /> 添加结果</button>
            <button onClick={() => setVertical(v => !v)} className="flex items-center px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-secondary)]"><Maximize2 className="w-4 h-4 mr-1" /> {vertical ? '横向对比' : '纵向对比'}</button>
            <label className="flex items-center gap-1.5 text-sm px-2"><input type="checkbox" checked={diffOnly} onChange={e => setDiffOnly(e.target.checked)} className="accent-blue-600" /> 只看差异项</label>
            <button disabled={!compared.length} onClick={() => {
              downloadText('结果对比.txt', ['结果对比', '', ...rows.map(r => `${r.name}: ` + r.vals.map((v, i) => `${compared[i]?.id}=${v?.value ?? '-'}`).join(' | '))].join('\n'));
              notify('对比结果已导出');
            }} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"><Download className="w-4 h-4 mr-1" /> 导出</button>
          </div>
        </div>
        {compared.length === 0 ? (
          <div className="card p-12 text-center text-[var(--text-secondary)]">还没有对比对象，点击「添加结果」或从结果列表点 ⇄ 加入</div>
        ) : (<>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {compared.map(r => (
              <div key={r.id} className="card p-4 relative group">
                <button title="移出对比" onClick={() => setCompareIds(prev => prev.filter(x => x !== r.id))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"><XCircle className="w-4 h-4" /></button>
                <p className="text-sm font-semibold truncate">{r.name}</p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{r.id} · {r.generationTime}</p>
                <div className="flex items-center justify-between mt-3">
                  {statusBadge(r.status)}
                  <span className="text-lg font-bold">{r.successRate}%</span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">均延 {r.metrics.avgLatency}ms · {r.node}</p>
              </div>
            ))}
          </div>
          {!vertical ? (
            <div className="card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">测试项</th>
                    {compared.map(r => <th key={r.id} className="px-6 py-4 font-semibold">{r.id}<span className="block normal-case font-normal text-[10px] truncate max-w-[160px]">{r.name}</span></th>)}
                    <th className="px-6 py-4 font-semibold text-right">差异分析</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {shown.map(row => {
                    const nums = row.vals.map(v => v ? parseNum(v.value) : null);
                    const defined = nums.filter(n => n !== null) as number[];
                    const diff = defined.length >= 2 ? Math.max(...defined) - Math.min(...defined) : null;
                    return (
                      <tr key={row.name} className={cn(row.isDiff && 'bg-amber-50/60 dark:bg-amber-900/10')}>
                        <td className="px-6 py-3.5 font-medium">{row.name}{row.isDiff && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-bold">差异</span>}</td>
                        {row.vals.map((v, i) => <td key={i} className={cn("px-6 py-3.5", v ? itemColor(v.status) : 'text-[var(--border-color)]')}>{v?.value ?? '—'}</td>)}
                        <td className="px-6 py-3.5 text-right">
                          {row.isDiff ? (diff !== null && nums.filter(n => n !== null).length === row.vals.length
                            ? <span className="flex items-center justify-end text-amber-600 dark:text-amber-400 font-medium"><TrendingUp className="w-3.5 h-3.5 mr-1" />Δ {diff}{unitOf(compared[0]?.items.find(it => it.name === row.name)?.value || row.vals.find(Boolean)?.value || '')}</span>
                            : <span className="text-amber-600 dark:text-amber-400">值不一致</span>)
                            : <span className="flex items-center justify-end text-[var(--text-secondary)]"><Minus className="w-3.5 h-3.5 mr-1" /> 一致</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && <tr><td colSpan={compared.length + 2} className="px-6 py-10 text-center text-[var(--text-secondary)]">所对比结果之间没有差异项 🎉</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {compared.map(r => (
                <div key={r.id} className="card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div><p className="font-semibold">{r.name}</p><p className="text-[10px] text-[var(--text-secondary)]">{r.id} · {r.type} · {r.node}</p></div>
                    {statusBadge(r.status)}
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer>
                      <RePieChart>
                        <Pie data={[{ name: '成功', value: r.successRate }, { name: '失败', value: r.failureRate }]} dataKey="value" innerRadius={35} outerRadius={55} startAngle={90} endAngle={-270}>
                          <Cell fill="#10b981" /><Cell fill="#ef4444" />
                        </Pie>
                        <Legend />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="w-full text-xs mt-2">
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {r.items.map((it, i) => <tr key={i}><td className="py-1.5 text-[var(--text-secondary)]">{it.name}</td><td className={cn("py-1.5 text-right font-medium", itemColor(it.status))}>{it.value}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>)}
        {addModalOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAddModalOpen(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-y-auto p-4">
              <h3 className="font-bold mb-3 px-2">选择要加入对比的结果</h3>
              <div className="space-y-1">
                {results.map(r => (
                  <button key={r.id} onClick={() => { setCompareIds(prev => prev.includes(r.id) ? prev : [...prev, r.id].slice(0, 4)); setAddModalOpen(false); notify(`已加入 ${r.id}`); }}
                    className={cn("w-full flex items-center justify-between p-3 rounded-lg text-sm text-left hover:bg-[var(--bg-primary)]", compareIds.includes(r.id) && 'opacity-40 cursor-default')}>
                    <span><span className="font-medium">{r.name}</span><span className="block text-[10px] text-[var(--text-secondary)]">{r.id} · {r.type} · {r.generationTime}</span></span>
                    {compareIds.includes(r.id) ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Plus className="w-4 h-4 text-blue-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ---------- 差异分析（真实计算） ---------- */
  const renderAnalysis = () => {
    const backBtn = <button onClick={() => { setView('list'); navigate('verification', 'res-list'); }} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>;
    const a = pairResults[0];
    const b = pairResults[1];
    if (!a || !b) return (
      <div className="space-y-4">
        {backBtn}
        <h2 className="text-2xl font-bold">差异分析</h2>
        <div className="card p-12 text-center text-[var(--text-secondary)]">需要在右上角选择两份结果进行对比分析</div>
        {results.length >= 2 && <div className="flex justify-center"><button onClick={() => setPair([results[0].id, results[1].id])} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">使用最近两份结果分析</button></div>}
      </div>
    );
    const names = [...new Set([...a.items.map(i => i.name), ...b.items.map(i => i.name)])];
    const rows = names.map(name => {
      const ia = a.items.find(i => i.name === name);
      const ib = b.items.find(i => i.name === name);
      const na = ia ? parseNum(ia.value) : null;
      const nb = ib ? parseNum(ib.value) : null;
      const same = ia && ib && ia.value === ib.value;
      const diff = na !== null && nb !== null ? nb - na : null;
      return { name, ia, ib, na, nb, diff, isDiff: !same };
    });
    const diffs = rows.filter(r => r.isDiff);
    const numDiffs = rows.filter(r => r.diff !== null);
    const maxAbs = numDiffs.length ? Math.max(...numDiffs.map(r => Math.abs(r.diff as number))) : 0;
    const avgAbs = numDiffs.length ? numDiffs.reduce((s, r) => s + Math.abs(r.diff as number), 0) / numDiffs.length : 0;
    const statusChanges = rows.filter(r => r.ia && r.ib && r.ia.status !== r.ib.status);
    const distribution = [
      { name: '数值差异', value: numDiffs.filter(r => r.isDiff).length, color: '#3b82f6' },
      { name: '状态变化', value: statusChanges.length, color: '#f59e0b' },
      { name: '缺失项', value: rows.filter(r => !r.ia || !r.ib).length, color: '#ef4444' },
      { name: '无差异', value: rows.filter(r => !r.isDiff).length, color: '#10b981' },
    ].filter(d => d.value > 0);
    const fmtDiff = (r: typeof rows[0]) => {
      if (!r.ia) return `新增: ${r.ib?.value}`;
      if (!r.ib) return `缺失`;
      if (r.diff === null) return `${r.ia.value} → ${r.ib.value}`;
      const sign = r.diff > 0 ? '+' : '';
      return `${sign}${+r.diff.toFixed(2)}${unitOf(r.ib.value)}`;
    };
    return (
      <div className="space-y-6">
        {backBtn}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">差异分析</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">所有统计均由所选两份结果实时计算得出</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={a.id} onChange={e => setPair([e.target.value, b.id])} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm max-w-[220px]">
              {results.map(r => <option key={r.id} value={r.id}>{r.id} {r.name}</option>)}
            </select>
            <span className="text-[var(--text-secondary)] text-sm">vs</span>
            <select value={b.id} onChange={e => setPair([a.id, e.target.value])} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm max-w-[220px]">
              {results.map(r => <option key={r.id} value={r.id}>{r.id} {r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-2xl font-bold text-amber-500">{diffs.length}</p><p className="text-xs text-[var(--text-secondary)] mt-1">差异项数量（共 {names.length} 项）</p></div>
          <div className="card p-4"><p className="text-2xl font-bold text-purple-500">{names.length ? (diffs.length / names.length * 100).toFixed(1) : 0}%</p><p className="text-xs text-[var(--text-secondary)] mt-1">差异率</p></div>
          <div className="card p-4"><p className="text-2xl font-bold text-red-500">{maxAbs ? +maxAbs.toFixed(2) : 0}</p><p className="text-xs text-[var(--text-secondary)] mt-1">最大数值差</p></div>
          <div className="card p-4"><p className="text-2xl font-bold text-blue-500">{avgAbs ? +avgAbs.toFixed(2) : 0}</p><p className="text-xs text-[var(--text-secondary)] mt-1">平均绝对差</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold mb-4">差异类型分布</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <RePieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {distribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold mb-4">各测试项数值差（{a.id} → {b.id}）</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={numDiffs.map(r => ({ name: r.name, diff: +(r.diff as number).toFixed(2) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Bar dataKey="diff" name="差值">
                    {numDiffs.map((r, i) => <Cell key={i} fill={(r.diff as number) >= 0 ? '#3b82f6' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h4 className="text-sm font-semibold">差异明细（{diffs.length}）</h4>
            <button onClick={() => { downloadText(`差异分析_${a.id}_${b.id}.txt`, ['差异明细', ...diffs.map(r => `- ${r.name}: ${r.ia?.value ?? '—'} → ${r.ib?.value ?? '—'} (${fmtDiff(r)})`)].join('\n')); notify('差异明细已导出'); }}
              className="flex items-center text-xs text-blue-500 hover:underline"><Download className="w-3.5 h-3.5 mr-1" /> 导出</button>
          </div>
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-3 font-semibold">测试项</th><th className="px-6 py-3 font-semibold">{a.id}</th><th className="px-6 py-3 font-semibold">{b.id}</th><th className="px-6 py-3 font-semibold text-right">差异值</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {diffs.map(r => (
                <tr key={r.name} className="hover:bg-[var(--bg-primary)]">
                  <td className="px-6 py-3 font-medium">{r.name}</td>
                  <td className="px-6 py-3">{r.ia ? <span className={itemColor(r.ia.status)}>{r.ia.value}</span> : <span className="text-[var(--border-color)]">—</span>}</td>
                  <td className="px-6 py-3">{r.ib ? <span className={itemColor(r.ib.status)}>{r.ib.value}</span> : <span className="text-[var(--border-color)]">—</span>}</td>
                  <td className="px-6 py-3 text-right font-medium text-amber-600 dark:text-amber-400">{fmtDiff(r)}</td>
                </tr>
              ))}
              {diffs.length === 0 && <tr><td colSpan={4} className="px-6 py-10 text-center text-[var(--text-secondary)]">两份结果完全一致</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (view === 'detail') return renderDetail();
    if (view === 'compare' || activeSubTab === 'res-comp') return renderCompare();
    if (view === 'analysis' || activeSubTab === 'diff-analysis') return renderAnalysis();
    return renderList();
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div key={`${activeSubTab}-${view}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <Confirm open={!!confirmDel} message={confirmDel ? `确定删除结果 ${confirmDel.id}《${confirmDel.name}》吗？` : ''}
        onConfirm={() => { if (confirmDel) { deleteResult(confirmDel.id); notify('结果已删除', 'info'); } setConfirmDel(null); }}
        onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

void ShieldCheck; void ChevronRight; void BarChart3; void Layers; void Activity; void Search;
