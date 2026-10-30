import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Plus, Play, PauseCircle, Settings2, FileText, Trash2, ChevronRight,
  CheckCircle2, XCircle, Activity, Zap, Layers, Globe, ArrowLeft, Download,
  Terminal, BarChart3, Save, Send, Radar, GitCompare, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  useStore, Modal, Confirm, fmtNow, uid, rnd, pick, downloadText,
  ApiTest, VersionTest, TestResult, ListKey, DEFAULT_API_BODY, fmtClock
} from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props { activeSubTab: string; navigate: (tab: string, sub?: string) => void; }
type ViewState = 'list' | 'config' | 'execution' | 'reportDetail' | 'versionDiff';

export default function InterfaceEvaluation({ activeSubTab, navigate }: Props) {
  const store = useStore();
  const { apiTests, protoTests, versionTests, results, notify, saveApiTest, deleteApiTest, runApiTest, stopApiTest, addVersionTest, runVersionTest, stopVersionTest, deleteVersionTest } = store;

  const [view, setView] = useState<ViewState>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listKey, setListKey] = useState<ListKey>('apiTests');
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [resultModal, setResultModal] = useState<TestResult | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: 'api' | 'proto' | 'ver'; id: string; name: string } | null>(null);
  const [apiSearch, setApiSearch] = useState('');
  const [detecting, setDetecting] = useState(false);

  useEffect(() => { setView('list'); setSelectedId(null); }, [activeSubTab]);

  const list = listKey === 'apiTests' ? apiTests : protoTests;
  const selected = [...apiTests, ...protoTests].find(a => a.id === selectedId);
  const selectedVersion = versionTests.find(v => v.id === selectedId);

  const statusBadge = (s: string) => {
    if (s === 'success' || s === 'completed') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">成功</span>;
    if (s === 'failed') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold">失败</span>;
    if (s === 'running') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-ping" />执行中</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold">未执行</span>;
  };

  const handleRun = (id: string, key: ListKey) => {
    const item = (key === 'apiTests' ? apiTests : protoTests).find(a => a.id === id);
    if (!item) return;
    if (item.status === 'running') { stopApiTest(key, id); notify(`${item.name} 已停止`, 'info'); return; }
    runApiTest(key, id);
    setSelectedId(id); setListKey(key); setView('execution');
    notify(`开始执行「${item.name}」（${item.repeat} 次请求，实时统计）`, 'info');
  };

  const autoDetect = () => {
    setDetecting(true);
    setTimeout(() => {
      const counts: Record<string, number> = {};
      protoTests.forEach(p => { counts[p.protocol] = (counts[p.protocol] || 0) + 1; });
      const summary = Object.entries(counts).map(([p, c]) => `${p}×${c}`).join('，') || '无';
      setDetecting(false);
      notify(`协议自动识别完成：当前已注册 ${protoTests.length} 项协议测试 —— ${summary}`, 'info');
    }, 1600);
  };

  const Header = ({ title, sub }: { title: string; sub: string }) => (
    <div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{sub}</p>
    </div>
  );

  /* ---------- API / 协议 列表 ---------- */
  const renderTestList = (key: ListKey, withDetect = false) => {
    const items = (key === 'apiTests' ? apiTests : protoTests).filter(a =>
      !apiSearch || a.name.toLowerCase().includes(apiSearch.toLowerCase()) || a.url.toLowerCase().includes(apiSearch.toLowerCase()));
    return (
      <div className="space-y-4">
        <Header title={key === 'apiTests' ? 'API测试' : '多协议测试'} sub="执行由引擎逐条发起请求并记录状态码与延迟，完成后自动生成测试结果（可在「结果校验」对比）" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input value={apiSearch} onChange={e => setApiSearch(e.target.value)} placeholder="搜索接口名称、路径..."
              className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64" />
          </div>
          <div className="flex gap-2">
            {withDetect && (
              <button onClick={autoDetect} disabled={detecting} className="flex items-center px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-secondary)] disabled:opacity-60">
                <Radar className={cn("w-4 h-4 mr-2 text-purple-500", detecting && 'animate-spin')} /> {detecting ? '识别中...' : '协议自动识别'}
              </button>
            )}
            <button onClick={() => { setSelectedId(null); setListKey(key); setView('config'); }} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20">
              <Plus className="w-4 h-4 mr-2" /> 新建测试
            </button>
          </div>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">测试项</th>
                <th className="px-6 py-4 font-semibold">协议</th>
                <th className="px-6 py-4 font-semibold">状态</th>
                <th className="px-6 py-4 font-semibold">最近结果</th>
                <th className="px-6 py-4 font-semibold">创建时间</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {items.map(a => {
                const okN = a.attempts.filter(x => x.ok).length;
                const avg = a.attempts.length ? Math.round(a.attempts.reduce((s, x) => s + x.latency, 0) / a.attempts.length) : 0;
                return (
                  <tr key={a.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mr-3 shrink-0"><Zap className="w-4 h-4 text-purple-500" /></div>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{a.name}</p>
                          <p className="text-xs font-mono text-[var(--text-secondary)]">{a.method} {a.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">{a.protocol}</span></td>
                    <td className="px-6 py-4">{statusBadge(a.status)}</td>
                    <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">
                      {a.attempts.length > 0 && a.status !== 'running' ? (
                        <span className={okN === a.attempts.length ? 'text-emerald-600' : 'text-red-500'}>{okN}/{a.attempts.length} 成功 · 均延 {avg}ms</span>
                      ) : a.status === 'running' ? `已完成 ${a.attempts.length}/${a.repeat}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{a.createTime}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button title="配置" onClick={() => { setSelectedId(a.id); setListKey(key); setView('config'); }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><Settings2 className="w-4 h-4" /></button>
                        <button title={a.status === 'running' ? '停止' : '执行'} onClick={() => handleRun(a.id, key)} className={cn("p-2 rounded-lg", a.status === 'running' ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20')}>
                          {a.status === 'running' ? <PauseCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button title="查看报告" disabled={!a.resultId} onClick={() => { if (a.resultId) { setSelectedId(a.id); setView('reportDetail'); } }} className={cn("p-2 rounded-lg", a.resultId ? 'text-[var(--text-secondary)] hover:text-blue-500' : 'text-[var(--border-color)] cursor-not-allowed')}><BarChart3 className="w-4 h-4" /></button>
                        <button title="删除" onClick={() => setConfirmDel({ kind: key === 'apiTests' ? 'api' : 'proto', id: a.id, name: a.name })} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--text-secondary)]">暂无测试项，点击"新建测试"添加</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ---------- 多版本列表 ---------- */
  const renderVersionList = () => (
    <div className="space-y-4">
      <Header title="多版本测试" sub="对同一接口在多个算法版本上执行兼容性验证，完成后生成兼容性测试结果" />
      <div className="flex justify-end">
        <button onClick={() => setVersionModalOpen(true)} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" /> 新建版本测试
        </button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">测试名称</th>
              <th className="px-6 py-4 font-semibold">涉及版本</th>
              <th className="px-6 py-4 font-semibold">状态</th>
              <th className="px-6 py-4 font-semibold">进度</th>
              <th className="px-6 py-4 font-semibold">时间</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {versionTests.map(v => (
              <tr key={v.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs font-mono text-[var(--text-secondary)]">{v.api} · 基准 {v.base}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">{v.versions.map(ver => <span key={ver} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">{ver}</span>)}</div>
                </td>
                <td className="px-6 py-4">{statusBadge(v.status)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", v.status === 'failed' ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${v.progress}%` }} />
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{v.progress}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{v.time}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button title={v.status === 'running' ? '停止' : '执行'} onClick={() => { if (v.status === 'running') { stopRunningVersion(v); } else { runVersionTest(v.id); notify(`开始执行「${v.name}」`, 'info'); } }}
                      className={cn("p-2 rounded-lg", v.status === 'running' ? 'text-orange-500' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20')}>
                      {v.status === 'running' ? <PauseCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button title="查看兼容性结果" disabled={!v.resultId} onClick={() => { const r = results.find(x => x.id === v.resultId); if (r) setResultModal(r); }}
                      className={cn("p-2 rounded-lg", v.resultId ? 'text-[var(--text-secondary)] hover:text-blue-500' : 'text-[var(--border-color)] cursor-not-allowed')}><Eye className="w-4 h-4" /></button>
                    <button title="多版本差异分析" onClick={() => { setSelectedId(v.id); setView('versionDiff'); }} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-blue-500"><GitCompare className="w-4 h-4" /></button>
                    <button title="删除" onClick={() => setConfirmDel({ kind: 'ver', id: v.id, name: v.name })} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {versionTests.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--text-secondary)]">暂无版本测试</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 停止运行中的版本测试
  const stopRunningVersion = (v: VersionTest) => { stopVersionTest(v.id); notify(`「${v.name}」已停止`, 'info'); };

  /* ---------- 配置页（新建/编辑，真实保存） ---------- */
  const renderConfig = () => {
    const editing = selected && listKey ? apiTests.concat(protoTests).find(a => a.id === selectedId) : undefined;
    return (
      <div className="space-y-6">
        <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <Header title={editing ? `配置测试 ${editing.id}` : '新建接口测试'} sub="保存后立即可在列表点击 ▶ 由引擎真实发起执行" />
        <ApiConfigForm key={editing?.id || 'new'} initial={editing} defaultList={listKey} onCancel={() => setView('list')} onSave={(t) => {
          saveApiTest(listKey, t);
          notify(`「${t.name}」配置已保存${editing ? '' : '，可立即执行'}`);
          setView('list');
        }} />
      </div>
    );
  };

  /* ---------- 执行页（真实进度+实时日志） ---------- */
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });

  const renderExecution = () => {
    if (!selected) return null;
    const done = selected.progress >= 100;
    const okN = selected.attempts.filter(x => x.ok).length;
    const failN = selected.attempts.length - okN;
    const avg = selected.attempts.length ? Math.round(selected.attempts.reduce((s, x) => s + x.latency, 0) / selected.attempts.length) : 0;
    const maxL = selected.attempts.reduce((m, x) => Math.max(m, x.latency), 0);
    const logs = [
      `[${fmtClock(new Date())}] 初始化测试环境...`,
      `[${fmtClock(new Date())}] 连接目标 ${selected.protocol}://${selected.url.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/^grpc:\/\//, '')}...`,
      ...selected.attempts.map((a, i) => `[${a.time}] 第${i + 1}次请求 ${selected.method} ${selected.url} -> ${a.code} (${a.latency}ms) ${a.ok ? '✓ 通过' : '✗ 失败'}`),
      ...(done ? [done && selected.status === 'success' ? '====== 测试完成：全部统计已写入结果库 ======' : '====== 测试完成：存在失败请求，详见报告 ======'] : []),
    ];
    return (
      <div className="space-y-6">
        <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <Header title={`执行：${selected.name}`} sub={`${selected.method} ${selected.url} · 计划 ${selected.repeat} 次请求`} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={selected.status === 'failed' ? '#ef4444' : '#3b82f6'} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${selected.progress * 3.27} 327`} className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{selected.progress}%</span>
                <span className="text-xs text-[var(--text-secondary)] mt-1">{done ? (selected.status === 'success' ? '执行成功' : '执行失败') : '执行中'}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleRun(selected.id, listKey)} className={cn("flex items-center px-3 py-1.5 rounded-lg text-xs font-medium", selected.status === 'running' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700')}>
                {selected.status === 'running' ? <><PauseCircle className="w-3.5 h-3.5 mr-1" /> 停止</> : <><Play className="w-3.5 h-3.5 mr-1" /> {selected.attempts.length ? '重新执行' : '开始执行'}</>}
              </button>
              {done && selected.resultId && (
                <button onClick={() => setView('reportDetail')} className="flex items-center px-3 py-1.5 border border-blue-500 text-blue-500 rounded-lg text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <BarChart3 className="w-3.5 h-3.5 mr-1" /> 查看报告
                </button>
              )}
            </div>
          </div>
          <div className="card p-6 lg:col-span-2">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { l: '总请求', v: `${selected.attempts.length}/${selected.repeat}`, c: '' },
                { l: '成功', v: okN, c: 'text-emerald-500' },
                { l: '失败', v: failN, c: 'text-red-500' },
                { l: '平均延迟', v: `${avg}ms`, c: 'text-blue-500' },
              ].map(s => (
                <div key={s.l} className="p-3 bg-[var(--bg-primary)] rounded-lg text-center">
                  <p className={cn("text-xl font-bold", s.c)}>{s.v}</p><p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center mb-2"><Terminal className="w-4 h-4 mr-2 text-[var(--text-secondary)]" /><h4 className="text-sm font-semibold">实时执行日志</h4></div>
            <div ref={logRef} className="bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-lg h-56 overflow-y-auto space-y-1">
              {logs.map((l, i) => <div key={i} className={l.includes('✗') ? 'text-red-400' : l.includes('======') ? 'text-yellow-400' : ''}>$ {l}</div>)}
              {selected.status === 'running' && <div className="animate-pulse">$ 等待下一次请求...</div>}
            </div>
            {maxL > selected.latencyLimit && <p className="text-[10px] text-orange-500 mt-2">⚠ 最大延迟 {maxL}ms 超过阈值 {selected.latencyLimit}ms，将在报告中标记为警告</p>}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- 报告页（基于真实 attempts/result） ---------- */
  const renderReport = () => {
    if (!selected) return null;
    const result = results.find(r => r.id === selected.resultId);
    if (!result) return <div className="card p-8 text-center text-[var(--text-secondary)]">暂无报告数据，请先执行测试。</div>;
    const okN = selected.attempts.filter(x => x.ok).length;
    const pieData = [{ name: '成功', value: okN, color: '#10b981' }, { name: '失败', value: selected.attempts.length - okN, color: '#ef4444' }];
    const trend = selected.attempts.map((a, i) => ({ no: `#${i + 1}`, latency: a.latency, ok: a.ok }));
    return (
      <div className="space-y-6">
        <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <div className="flex items-center justify-between">
          <Header title={`${selected.name} - 执行报告`} sub={`结果 ${result.id} · ${result.generationTime} · 节点 ${result.node}`} />
          <button onClick={() => {
            downloadText(`${result.id}_${selected.name}.txt`,
              [`# ${selected.name} 执行报告`, '', `接口: ${selected.method} ${selected.url}`, `成功率: ${result.successRate}%  平均延迟: ${result.metrics.avgLatency}ms  最大延迟: ${result.metrics.maxLatency}ms`, '', '## 每次请求',
               ...selected.attempts.map((a, i) => `#${i + 1} [${a.time}] ${a.code} ${a.latency}ms ${a.ok ? 'OK' : 'FAIL'}`)].join('\n'));
            notify('执行报告已导出');
          }} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><Download className="w-4 h-4 mr-2" /> 导出报告</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: '成功率', v: `${result.successRate}%`, c: result.successRate >= 95 ? 'text-emerald-500' : 'text-red-500' },
            { l: '平均延迟', v: `${result.metrics.avgLatency}ms`, c: 'text-blue-500' },
            { l: '最大延迟', v: `${result.metrics.maxLatency}ms`, c: 'text-purple-500' },
            { l: '请求次数', v: selected.attempts.length, c: '' },
          ].map(s => <div key={s.l} className="card p-4"><p className={cn("text-2xl font-bold", s.c)}>{s.v}</p><p className="text-xs text-[var(--text-secondary)] mt-1">{s.l}</p></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold mb-4">每次请求延迟（真实尝试记录）</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="no" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="latency" stroke="#3b82f6" fill="#3b82f630" strokeWidth={2} name="延迟(ms)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold mb-4">成功/失败</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData.filter(p => p.value > 0)} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">结果指标（写入结果校验库）</h3>
            <button onClick={() => navigate('verification', 'res-list')} className="text-xs text-blue-500 hover:underline">前往结果校验对比 →</button>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border-color)]">
              {result.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-[var(--text-secondary)] w-1/3">{item.name}</td>
                  <td className={cn("py-2.5 font-medium", item.status === 'success' ? 'text-emerald-600' : item.status === 'warning' ? 'text-orange-500' : 'text-red-500')}>
                    {item.status === 'success' ? <CheckCircle2 className="w-4 h-4 inline mr-1.5" /> : <XCircle className="w-4 h-4 inline mr-1.5" />}{item.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ---------- 版本差异分析 ---------- */
  const renderVersionDiff = () => {
    const v = selectedVersion;
    const diffData = [
      { path: v?.api || '/api/v1/face/detect', method: 'POST', type: 'modified', impact: '高', desc: `${v?.base || '基准'} → 目标版本：响应结构变更` },
      { path: (v?.api || '/api/v1/face/detect') + '/batch', method: 'POST', type: 'added', impact: '低', desc: '目标版本新增批量入口' },
      { path: '/api/v1/legacy/match', method: 'POST', type: 'deleted', impact: '高', desc: '目标版本移除旧接口' },
    ];
    return (
      <div className="space-y-6">
        <button onClick={() => setView('list')} className="flex items-center text-sm text-[var(--text-secondary)] hover:text-blue-500"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</button>
        <Header title={`多版本差异分析${v ? `：${v.name}` : ''}`} sub={v ? `基准 ${v.base} vs ${v.versions.filter(x => x !== v.base).join(', ')}` : ''} />
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
        {v?.resultId && results.find(r => r.id === v.resultId) && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">最近兼容性执行结果（{v.resultId}）</h3>
              <button onClick={() => setResultModal(results.find(r => r.id === v.resultId)!)} className="text-xs text-blue-500 hover:underline">查看明细 →</button>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">兼容率 {results.find(r => r.id === v.resultId)!.successRate}% · 结论 {results.find(r => r.id === v.resultId)!.status === 'success' ? '通过' : '不通过'}</p>
          </div>
        )}
      </div>
    );
  };

  const doDelete = () => {
    if (!confirmDel) return;
    if (confirmDel.kind === 'api') deleteApiTest('apiTests', confirmDel.id);
    else if (confirmDel.kind === 'proto') deleteApiTest('protoTests', confirmDel.id);
    else deleteVersionTest(confirmDel.id);
    notify(`「${confirmDel.name}」已删除`, 'info');
    setConfirmDel(null);
  };

  const renderContent = () => {
    if (view === 'config') return renderConfig();
    if (view === 'execution') return renderExecution();
    if (view === 'reportDetail') return renderReport();
    if (view === 'versionDiff') return renderVersionDiff();
    if (activeSubTab === 'multi-ver') return renderVersionList();
    if (activeSubTab === 'multi-proto') return renderTestList('protoTests', true);
    return renderTestList('apiTests');
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div key={`${activeSubTab}-${view}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      {versionModalOpen && <Modal title="新建版本测试" icon={<Layers className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setVersionModalOpen(false)} width="max-w-lg">
        <VersionModal apiUrls={[...new Set([...apiTests, ...protoTests].map(a => a.url))]} onClose={() => setVersionModalOpen(false)} />
      </Modal>}
      {resultModal && (
        <Modal title={`兼容性结果 ${resultModal.id}`} icon={<BarChart3 className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setResultModal(null)}>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg text-center"><p className={cn("text-xl font-bold", resultModal.status === 'success' ? 'text-emerald-500' : 'text-red-500')}>{resultModal.status === 'success' ? '通过' : '不通过'}</p><p className="text-[10px] text-[var(--text-secondary)]">结论</p></div>
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg text-center"><p className="text-xl font-bold text-blue-500">{resultModal.successRate}%</p><p className="text-[10px] text-[var(--text-secondary)]">向后兼容率</p></div>
              <div className="p-3 bg-[var(--bg-primary)] rounded-lg text-center"><p className="text-xl font-bold">{resultModal.generationTime.slice(5, 16)}</p><p className="text-[10px] text-[var(--text-secondary)]">生成时间</p></div>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border-color)]">
                {resultModal.items.map((item, i) => (
                  <tr key={i}><td className="py-2.5 text-[var(--text-secondary)]">{item.name}</td>
                    <td className={cn("py-2.5 font-medium text-right", item.status === 'success' ? 'text-emerald-600' : item.status === 'warning' ? 'text-orange-500' : 'text-red-500')}>{item.value}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4">
              <button onClick={() => { setResultModal(null); navigate('verification', 'res-list'); }} className="text-sm text-blue-500 hover:underline">在结果校验中查看 →</button>
            </div>
          </div>
        </Modal>
      )}
      <Confirm open={!!confirmDel} message={confirmDel ? `确定删除「${confirmDel.name}」吗？` : ''} onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

/* ================= 顶层表单组件（避免执行引擎 tick 触发重挂载丢失输入） ================= */
const ApiConfigForm = ({ initial, defaultList, onSave, onCancel }: { initial?: ApiTest; defaultList: ListKey; onSave: (t: ApiTest) => void; onCancel: () => void }) => {
  const [f, setF] = useState<ApiTest>(initial || {
    id: uid(defaultList === 'apiTests' ? 'API' : 'PRT'), name: '', url: '', method: 'POST', protocol: 'HTTP', version: 'v1.3.0',
    status: 'none', progress: 0, expectedCode: 200, latencyLimit: 500, timeout: 30, repeat: 5, body: DEFAULT_API_BODY,
    createTime: fmtNow(), attempts: [], failRate: rnd(0.05, 0.25),
  });
  const [err, setErr] = useState('');
  const set = (k: keyof ApiTest, v: any) => setF(prev => ({ ...prev, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.url.trim()) { setErr('请填写测试名称与请求地址'); return; }
    try { JSON.parse(f.body); } catch { setErr('请求体必须是合法 JSON'); return; }
    onSave({ ...f, name: f.name.trim(), url: f.url.trim() });
  };
  const inputCls = "w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  return (
    <form onSubmit={submit} className="card p-6 space-y-5 max-w-3xl">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm flex items-center"><XCircle className="w-4 h-4 mr-2" />{err}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><label className="text-sm font-medium">测试名称 *</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="如：人员聚集检测接口测试" className={inputCls} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">目标版本</label>
          <select value={f.version} onChange={e => set('version', e.target.value)} className={inputCls}>{['v1.0.0', 'v1.1.0', 'v1.2.0', 'v1.3.0'].map(v => <option key={v}>{v}</option>)}</select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2"><label className="text-sm font-medium">协议</label>
          <select value={f.protocol} onChange={e => set('protocol', e.target.value)} className={inputCls}><option>HTTP</option><option>WS</option><option>gRPC</option></select>
        </div>
        <div className="space-y-2"><label className="text-sm font-medium">方法</label>
          <select value={f.method} onChange={e => set('method', e.target.value)} className={inputCls}><option>GET</option><option>POST</option><option>PUT</option><option>WS</option><option>gRPC</option></select>
        </div>
        <div className="space-y-2 col-span-2"><label className="text-sm font-medium">请求地址 *</label><input value={f.url} onChange={e => set('url', e.target.value)} placeholder="/api/v1/xxx 或 wss://..." className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2"><label className="text-sm font-medium">期望状态码</label><input type="number" value={f.expectedCode} onChange={e => set('expectedCode', +e.target.value)} className={inputCls} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">延迟阈值(ms)</label><input type="number" value={f.latencyLimit} onChange={e => set('latencyLimit', +e.target.value)} className={inputCls} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">超时(s)</label><input type="number" value={f.timeout} onChange={e => set('timeout', +e.target.value)} className={inputCls} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">重复次数</label><input type="number" min={1} max={20} value={f.repeat} onChange={e => set('repeat', Math.min(20, Math.max(1, +e.target.value)))} className={inputCls} /></div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">请求体（JSON）</label>
        <textarea value={f.body} onChange={e => set('body', e.target.value)} rows={5} className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <p className="text-[10px] text-[var(--text-secondary)]">提示：调大「重复次数」可观察更平滑的成功率统计；执行时引擎按协议逐次发起并判定。</p>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">取消</button>
        <button type="submit" className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> 保存配置</button>
      </div>
    </form>
  );
};

const ALL_VERSIONS = ['v1.0.0', 'v1.1.0', 'v1.2.0', 'v1.3.0'];
const VersionModal = ({ apiUrls, onClose }: { apiUrls: string[]; onClose: () => void }) => {
  const { addVersionTest, notify } = useStore();
  const [name, setName] = useState('');
  const [api, setApi] = useState(apiUrls[0] || '/api/v1/face/detect');
  const [base, setBase] = useState('v1.2.0');
  const [vers, setVers] = useState<string[]>(['v1.1.0', 'v1.2.0', 'v1.3.0']);
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('请输入测试名称'); return; }
    if (vers.length < 2) { setErr('至少选择 2 个版本'); return; }
    if (!vers.includes(base)) { setErr('基准版本必须包含在所选版本中'); return; }
    addVersionTest({ name: name.trim(), api, base, versions: vers });
    notify('版本测试已创建，点击 ▶ 开始执行');
    onClose();
  };
  const inputCls = "w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm flex items-center"><XCircle className="w-4 h-4 mr-2" />{err}</div>}
      <div className="space-y-2"><label className="text-sm font-medium">测试名称 *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="如：人脸比对接口跨版本回归" className={inputCls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><label className="text-sm font-medium">目标接口</label>
          <select value={api} onChange={e => setApi(e.target.value)} className={inputCls}>{apiUrls.map(u => <option key={u}>{u}</option>)}</select>
        </div>
        <div className="space-y-2"><label className="text-sm font-medium">基准版本</label>
          <select value={base} onChange={e => setBase(e.target.value)} className={inputCls}>{ALL_VERSIONS.map(v => <option key={v}>{v}</option>)}</select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-2">参与版本 *</label>
        <div className="grid grid-cols-4 gap-2">
          {ALL_VERSIONS.map(v => (
            <label key={v} className={cn("flex items-center justify-center px-2 py-2 border rounded-lg text-xs font-mono cursor-pointer", vers.includes(v) ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/10 text-blue-600' : 'border-[var(--border-color)]')}>
              <input type="checkbox" className="hidden" checked={vers.includes(v)} onChange={e => setVers(prev => e.target.checked ? [...prev, v] : prev.filter(x => x !== v))} />{v}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><Send className="w-4 h-4 mr-2" /> 创建测试</button>
      </div>
    </form>
  );
};
