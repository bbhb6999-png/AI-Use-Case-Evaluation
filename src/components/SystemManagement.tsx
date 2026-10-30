import React, { useState, useMemo } from 'react';
import { 
  Users, Lock, Server, Monitor, Smartphone, ShieldCheck, Plus, Search, Edit2, Trash2,
  Power, RotateCcw, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Cpu, Key,
  UserPlus, Shield, Layout, MonitorDown, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore, Modal, Confirm, fmtNow } from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props { activeSubTab: string; }

interface User { user: string; name: string; role: string; status: 'enabled' | 'disabled'; time: string; }
interface Role { name: string; perms: string[]; builtin?: boolean; }
interface VM { id: string; name: string; spec: string; ip: string; status: 'running' | 'stopped'; cpu: number; mem: number; }
interface Desktop { id: string; user: string; spec: string; status: 'active' | 'inactive'; image: string; }
interface Terminal { id: string; name: string; type: string; ip: string; status: 'safe' | 'offline' | 'risk'; lastComm: string; }

const MODULES = ['评测管理', '数据标注', '接口评测', '资源评测', '数据处理', '结果校验', '系统管理'];

export default function SystemManagement({ activeSubTab }: Props) {
  const { notify } = useStore();
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('所有角色');

  const [users, setUsers] = useState<User[]>([
    { user: 'admin', name: '系统管理员', role: '超级管理员', status: 'enabled', time: '2026-01-01 10:00' },
    { user: 'eval_01', name: '张三', role: '评测员', status: 'enabled', time: '2026-02-15 14:20' },
    { user: 'anno_02', name: '李四', role: '标注员', status: 'disabled', time: '2026-02-20 09:30' },
  ]);
  const [roles, setRoles] = useState<Role[]>([
    { name: '超级管理员', perms: MODULES.slice(), builtin: true },
    { name: '评测员', perms: ['评测管理', '接口评测', '资源评测', '结果校验'] },
    { name: '标注员', perms: ['数据标注', '数据处理'] },
  ]);
  const [vms, setVms] = useState<VM[]>([
    { id: 'VM-001', name: 'eval-gpu-node-01', spec: '16C 64G / A100', ip: '10.20.30.11', status: 'running', cpu: 42, mem: 63 },
    { id: 'VM-002', name: 'annotate-cpu-01', spec: '8C 32G', ip: '10.20.30.12', status: 'running', cpu: 18, mem: 35 },
    { id: 'VM-003', name: 'edge-relay-01', spec: '4C 16G', ip: '10.20.30.13', status: 'stopped', cpu: 0, mem: 0 },
  ]);
  const [desktops, setDesktops] = useState<Desktop[]>([
    { id: 'CD-001', user: '张三', spec: '4C 8G / Win10', status: 'active', image: '警务通用镜像 v6' },
    { id: 'CD-002', user: '-', spec: '4C 8G / Win10', status: 'inactive', image: '标注作业镜像 v3' },
  ]);
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: 'TM-001', name: '指挥大厅大屏终端', type: '大屏', ip: '10.30.1.21', status: 'safe', lastComm: '1 分钟前' },
    { id: 'TM-002', name: '勘查现场平板-07', type: '平板', ip: '10.30.2.17', status: 'offline', lastComm: '3 小时前' },
    { id: 'TM-003', name: '笔录工作台-12', type: 'PC', ip: '10.30.3.12', status: 'risk', lastComm: '5 分钟前' },
  ]);

  const [modal, setModal] = useState<'user' | 'role' | 'vm' | 'desktop' | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void } | null>(null);

  const filteredUsers = useMemo(() => users.filter(u => {
    if (userSearch && !u.user.toLowerCase().includes(userSearch.toLowerCase()) && !u.name.includes(userSearch)) return false;
    if (userRoleFilter !== '所有角色' && u.role !== userRoleFilter) return false;
    return true;
  }), [users, userSearch, userRoleFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': case 'active': case 'safe': case 'enabled':
        return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 font-bold uppercase w-fit"><CheckCircle2 className="w-3 h-3 mr-1" /> {status === 'enabled' ? '启用' : status === 'active' ? '运行中' : status === 'safe' ? '安全' : '运行中'}</span>;
      case 'stopped': case 'inactive': case 'disabled': case 'offline':
        return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold uppercase w-fit"><XCircle className="w-3 h-3 mr-1" /> {status === 'disabled' ? '禁用' : status === 'offline' ? '离线' : '已停止'}</span>;
      default:
        return <span className="flex items-center text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 font-bold uppercase w-fit"><AlertTriangle className="w-3 h-3 mr-1" /> 风险</span>;
    }
  };

  const Actions = ({ children }: { children: React.ReactNode }) => <div className="flex items-center justify-end gap-1">{children}</div>;
  const iconBtn = "p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)] transition-colors";

  /* ---------- 1. 用户管理 ---------- */
  const renderUserMgmt = (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">用户管理</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">用户可即时创建/启停用；角色在「权限管理」中维护</p>
        </div>
        <button onClick={() => { setEditUser(null); setModal('user'); }} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20"><UserPlus className="w-4 h-4 mr-2" /> 新增用户</button>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="搜索用户名、姓名..." className="pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm w-64" />
        </div>
        <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
          <option>所有角色</option>{roles.map(r => <option key={r.name}>{r.name}</option>)}
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead><tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            <th className="px-6 py-4 font-semibold">账号</th><th className="px-6 py-4 font-semibold">姓名</th><th className="px-6 py-4 font-semibold">角色</th><th className="px-6 py-4 font-semibold">状态</th><th className="px-6 py-4 font-semibold">创建时间</th><th className="px-6 py-4 font-semibold text-right">操作</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredUsers.map(u => (
              <tr key={u.user} className="hover:bg-[var(--bg-primary)]">
                <td className="px-6 py-4 font-mono text-sm">{u.user}</td>
                <td className="px-6 py-4 text-sm font-medium">{u.name}</td>
                <td className="px-6 py-4"><span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">{u.role}</span></td>
                <td className="px-6 py-4">{getStatusBadge(u.status)}</td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{u.time}</td>
                <td className="px-6 py-4">
                  <Actions>
                    <button title="编辑" onClick={() => { setEditUser(u); setModal('user'); }} className={iconBtn}><Edit2 className="w-4 h-4 hover:text-blue-500" /></button>
                    <button title={u.status === 'enabled' ? '停用' : '启用'} onClick={() => {
                      setUsers(prev => prev.map(x => x.user === u.user ? { ...x, status: x.status === 'enabled' ? 'disabled' : 'enabled' } : x));
                      notify(`用户 ${u.name} 已${u.status === 'enabled' ? '停用' : '启用'}`, u.status === 'enabled' ? 'info' : 'success');
                    }} className={iconBtn}><Power className={cn("w-4 h-4", u.status === 'enabled' ? 'hover:text-orange-500' : 'hover:text-emerald-500')} /></button>
                    <button title="删除" disabled={u.user === 'admin'} className={cn(iconBtn, u.user === 'admin' && 'opacity-30 cursor-not-allowed')} onClick={() => u.user !== 'admin' && setConfirm({ msg: `确定删除用户 ${u.name}（${u.user}）吗？`, onOk: () => { setUsers(prev => prev.filter(x => x.user !== u.user)); notify('用户已删除', 'info'); } })}><Trash2 className="w-4 h-4 hover:text-red-500" /></button>
                  </Actions>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-[var(--text-secondary)]">无匹配用户</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ---------- 2. 权限管理 ---------- */
  const togglePerm = (role: string, mod: string) => {
    setRoles(prev => prev.map(r => r.name !== role ? r : { ...r, perms: r.perms.includes(mod) ? r.perms.filter(p => p !== mod) : [...r.perms, mod] }));
  };
  const renderPermMgmt = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">权限管理</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">勾选即时生效，控制对应角色用户可见的模块</p>
        </div>
        <button onClick={() => setModal('role')} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> 新建角色</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {roles.map(r => (
          <div key={r.name} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center"><Shield className="w-4 h-4 mr-2 text-blue-500" /><h4 className="font-bold">{r.name}</h4>{r.builtin && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)]">内置</span>}</div>
              {!r.builtin && <button onClick={() => setConfirm({ msg: `确定删除角色「${r.name}」吗？`, onOk: () => { setRoles(prev => prev.filter(x => x.name !== r.name)); notify('角色已删除', 'info'); } })} className="p-1 text-[var(--text-secondary)] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] mb-3">{users.filter(u => u.role === r.name).length} 名用户 · {r.perms.length}/{MODULES.length} 模块授权</p>
            <div className="space-y-1.5">
              {MODULES.map(m => (
                <label key={m} className="flex items-center text-sm cursor-pointer hover:bg-[var(--bg-primary)] rounded px-2 py-1">
                  <input type="checkbox" className="mr-2 accent-blue-600" checked={r.perms.includes(m)} onChange={() => togglePerm(r.name, m)} disabled={r.builtin && m === '系统管理' && r.name === '超级管理员'} />
                  <span className={r.perms.includes(m) ? '' : 'text-[var(--text-secondary)]'}>{m}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------- 3. 虚机管理 ---------- */
  const powerVm = (vm: VM, mode: 'start' | 'stop' | 'restart') => {
    if (mode === 'restart') {
      setVms(prev => prev.map(x => x.id === vm.id ? { ...x, status: 'stopped', cpu: 0, mem: 0 } : x));
      notify(`${vm.name} 正在重启…`, 'info');
      setTimeout(() => {
        setVms(prev => prev.map(x => x.id === vm.id ? { ...x, status: 'running', cpu: Math.round(15 + Math.random() * 40), mem: Math.round(25 + Math.random() * 40) } : x));
        notify(`${vm.name} 重启完成`, 'success');
      }, 1800);
      return;
    }
    setVms(prev => prev.map(x => x.id === vm.id ? { ...x, status: mode === 'start' ? 'running' : 'stopped', cpu: mode === 'start' ? Math.round(15 + Math.random() * 40) : 0, mem: mode === 'start' ? Math.round(25 + Math.random() * 40) : 0 } : x));
    notify(`${vm.name} 已${mode === 'start' ? '开机' : '关机'}`, mode === 'start' ? 'success' : 'info');
  };
  const renderVMgmt = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">虚拟化管理</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">开关机/重启真实改变实例状态，并计入「授权管理」使用量</p>
        </div>
        <button onClick={() => setModal('vm')} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> 新建虚拟机</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {vms.map(vm => (
          <div key={vm.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center"><div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mr-3"><Server className="w-4 h-4 text-blue-500" /></div>
                <div><p className="font-bold text-sm">{vm.name}</p><p className="text-[10px] text-[var(--text-secondary)]">{vm.id} · {vm.ip}</p></div></div>
              {getStatusBadge(vm.status)}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3 flex items-center"><Cpu className="w-3 h-3 mr-1" /> {vm.spec}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[['CPU', vm.cpu], ['内存', vm.mem]].map(([l, v]) => (
                <div key={l as string}>
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1"><span>{l}</span><span>{v}%</span></div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", (v as number) > 80 ? 'bg-red-400' : 'bg-blue-500')} style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => powerVm(vm, vm.status === 'running' ? 'stop' : 'start')} className={cn("flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium", vm.status === 'running' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20')}>
                <Power className="w-3.5 h-3.5 mr-1" /> {vm.status === 'running' ? '关机' : '开机'}
              </button>
              <button onClick={() => powerVm(vm, 'restart')} className="flex-1 flex items-center justify-center px-3 py-1.5 border border-[var(--border-color)] rounded-lg text-xs hover:bg-[var(--bg-primary)]"><RotateCcw className="w-3.5 h-3.5 mr-1" /> 重启</button>
              <button onClick={() => setConfirm({ msg: `确定销毁虚拟机 ${vm.name} 吗？`, onOk: () => { setVms(prev => prev.filter(x => x.id !== vm.id)); notify('虚拟机已销毁', 'info'); } })} className="px-2.5 py-1.5 border border-[var(--border-color)] rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------- 4. 云桌面 ---------- */
  const renderCloudDesktop = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">云桌面管理</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">分配/回收真实变更占用状态，占用数计入授权统计</p>
        </div>
        <button onClick={() => setModal('desktop')} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> 新分配桌面</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {desktops.map(d => (
          <div key={d.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center"><div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mr-3"><Layout className="w-4 h-4 text-purple-500" /></div>
                <div><p className="font-bold text-sm">{d.id}</p><p className="text-[10px] text-[var(--text-secondary)]">{d.spec}</p></div></div>
              {getStatusBadge(d.status)}
            </div>
            <div className="text-xs space-y-1 mb-4 text-[var(--text-secondary)]">
              <p>使用者：<span className={cn("font-medium", d.user === '-' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>{d.user}</span></p>
              <p>镜像：{d.image}</p>
            </div>
            <div className="flex gap-2">
              {d.status === 'active' ? (
                <>
                  <button onClick={() => { setDesktops(prev => prev.map(x => x.id === d.id ? { ...x, status: 'inactive', user: '-' } : x)); notify(`${d.id} 已回收`, 'info'); }} className="flex-1 flex items-center justify-center px-3 py-1.5 bg-orange-50 text-orange-600 dark:bg-orange-900/20 rounded-lg text-xs font-medium"><MonitorDown className="w-3.5 h-3.5 mr-1" /> 回收</button>
                  <button onClick={() => { setDesktops(prev => prev.map(x => x.id === d.id ? { ...x, status: 'inactive' } : x)); notify(`${d.id} 已关机`, 'info'); }} className="flex-1 flex items-center justify-center px-3 py-1.5 border border-[var(--border-color)] rounded-lg text-xs hover:bg-[var(--bg-primary)]"><Power className="w-3.5 h-3.5 mr-1" /> 关机</button>
                </>
              ) : (
                <button onClick={() => {
                  const free = users.find(u => u.status === 'enabled' && !desktops.some(x => x.user === u.name));
                  if (!free) { notify('没有可分配的空闲启用用户，请先在用户管理中添加', 'error'); return; }
                  setDesktops(prev => prev.map(x => x.id === d.id ? { ...x, status: 'active', user: free.name } : x));
                  notify(`${d.id} 已分配给 ${free.name}`, 'success');
                }} className="flex-1 flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"><Play2Icon /> 分配并启动</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------- 5. 终端管理 ---------- */
  const renderTerminal = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">终端管理</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">禁用/恢复真实改变在线状态并计入授权统计</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead><tr className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            <th className="px-6 py-4 font-semibold">终端</th><th className="px-6 py-4 font-semibold">类型</th><th className="px-6 py-4 font-semibold">IP</th><th className="px-6 py-4 font-semibold">状态</th><th className="px-6 py-4 font-semibold">最近通信</th><th className="px-6 py-4 font-semibold text-right">操作</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {terminals.map(t => (
              <tr key={t.id} className="hover:bg-[var(--bg-primary)]">
                <td className="px-6 py-4"><div className="flex items-center"><Smartphone className="w-4 h-4 mr-3 text-indigo-500" /><span className="text-sm font-medium">{t.name}</span><span className="ml-2 text-[10px] text-[var(--text-secondary)] font-mono">{t.id}</span></div></td>
                <td className="px-6 py-4 text-sm">{t.type}</td>
                <td className="px-6 py-4 text-sm font-mono text-[var(--text-secondary)]">{t.ip}</td>
                <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{t.lastComm}</td>
                <td className="px-6 py-4">
                  <Actions>
                    {t.status === 'risk' && <button onClick={() => { setTerminals(prev => prev.map(x => x.id === t.id ? { ...x, status: 'safe', lastComm: '刚刚' } : x)); notify(`${t.name} 风险处置完成，已恢复安全状态`, 'success'); }} className="px-2.5 py-1 rounded-lg text-xs bg-orange-50 text-orange-600 dark:bg-orange-900/20 hover:bg-orange-100">处置风险</button>}
                    <button onClick={() => { const on = t.status !== 'offline'; setTerminals(prev => prev.map(x => x.id === t.id ? { ...x, status: on ? 'offline' : 'safe', lastComm: on ? '刚刚' : '刚刚' } : x)); notify(`${t.name} 已${on ? '禁用（离线）' : '恢复上线'}`, on ? 'info' : 'success'); }} className={iconBtn}>
                      <Power className={cn("w-4 h-4", t.status === 'offline' ? 'hover:text-emerald-500' : 'hover:text-orange-500')} />
                    </button>
                  </Actions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ---------- 6. 授权管理：从上述状态实时推导 ---------- */
  const renderLicense = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">授权管理</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">以下用量实时来源于虚拟化 / 云桌面 / 终端 / 用户管理的真实操作</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(() => {
          const vmUsed = vms.filter(v => v.status === 'running').length;
          const vmTotal = Math.max(4, vmUsed + 1);
          const cdUsed = desktops.filter(d => d.status === 'active').length;
          const tmUsed = terminals.filter(t => t.status !== 'offline').length;
          return [
            { l: '虚拟化授权', used: vmUsed, total: vmTotal, i: Server },
            { l: '云桌面授权', used: cdUsed, total: Math.max(10, desktops.length * 5), i: Monitor },
            { l: '终端授权', used: tmUsed, total: Math.max(10, terminals.length * 4), i: Smartphone },
          ].map(s => {
            const pct = Math.round(s.used / s.total * 100);
            return (
              <div key={s.l} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center"><s.i className="w-5 h-5 text-blue-500 mr-2" /><h3 className="font-bold">{s.l}</h3></div>
                  <Key className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <p className="text-3xl font-bold">{pct}<span className="text-sm text-[var(--text-secondary)] font-normal">%</span></p>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full my-3 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", pct > 80 ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-[var(--text-secondary)]">已用 {s.used} / 总量 {s.total}</p>
              </div>
            );
          });
        })()}
      </div>
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4">平台授权信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[['授权主体', '市公安局科信支队'], ['授权版本', '旗舰版 (Enterprise)'], ['生效日期', '2026-01-01'], ['有效期至', '2028-12-31']].map(([l, v]) => (
            <div key={l} className="p-3 bg-[var(--bg-primary)] rounded-lg"><p className="text-[10px] text-[var(--text-secondary)] mb-1">{l}</p><p className="font-semibold">{v}</p></div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4 text-xs">
          <p className="text-[var(--text-secondary)]">注册用户 {users.length} 人 · 启用 {users.filter(u => u.status === 'enabled').length} 人</p>
          <button onClick={() => notify('授权信息已同步至中心服务器（模拟）', 'info')} className="flex items-center text-blue-500 hover:underline"><RotateCcw className="w-3.5 h-3.5 mr-1" /> 同步授权</button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSubTab) {
      case 'perm-mgmt': return renderPermMgmt;
      case 'v-mgmt': return renderVMgmt;
      case 'cloud-desktop': return renderCloudDesktop;
      case 'terminal': return renderTerminal;
      case 'license-mgmt': return renderLicense;
      default: return renderUserMgmt;
    }
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        <motion.div key={activeSubTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      {modal === 'user' && <Modal title={editUser ? `编辑用户 ${editUser.user}` : '新增用户'} icon={<Users className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setModal(null)}>
        <UserModal key={editUser?.user || 'new'} editUser={editUser} users={users} roles={roles} onClose={() => setModal(null)}
          onSave={(f) => {
            if (editUser) { setUsers(prev => prev.map(u => u.user === editUser.user ? { ...u, name: f.name, role: f.role } : u)); notify('用户已更新'); }
            else { setUsers(prev => [{ user: f.user, name: f.name, role: f.role, status: 'enabled', time: fmtNow() }, ...prev]); notify(`用户 ${f.name} 创建成功`); }
            setModal(null);
          }} />
      </Modal>}
      {modal === 'role' && <Modal title="新建角色" icon={<ShieldCheck className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setModal(null)}>
        <RoleModal key="role" existing={roles.map(r => r.name)} onClose={() => setModal(null)}
          onCreate={(name, perms) => { setRoles(prev => [...prev, { name, perms }]); notify(`角色「${name}」已创建`); setModal(null); }} />
      </Modal>}
      {modal === 'vm' && <Modal title="新建虚拟机" icon={<Server className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setModal(null)}>
        <VmModal key="vm" count={vms.length} onClose={() => setModal(null)}
          onCreate={(name, cpu, mem, gpu) => {
            const id = `VM-${String(vms.length + 1).padStart(3, '0')}`;
            setVms(prev => [...prev, { id, name, spec: `${cpu}C ${mem}G${gpu ? ' / A100' : ''}`, ip: `10.20.30.${20 + vms.length}`, status: 'stopped', cpu: 0, mem: 0 }]);
            notify(`虚拟机 ${name} 已创建（关机状态），点击开机即可使用`);
            setModal(null);
          }} />
      </Modal>}
      {modal === 'desktop' && <Modal title="新分配云桌面" icon={<Monitor className="w-5 h-5 mr-2 text-blue-500" />} onClose={() => setModal(null)}>
        <DesktopModal key="cd" users={users.filter(u => u.status === 'enabled')} count={desktops.length} onClose={() => setModal(null)}
          onCreate={(u, img) => {
            const id = `CD-${String(desktops.length + 1).padStart(3, '0')}`;
            setDesktops(prev => [...prev, { id, user: u.name, spec: '4C 8G / Win10', status: 'active', image: img }]);
            notify(`桌面 ${id} 已分配给 ${u.name} 并启动`);
            setModal(null);
          }} />
      </Modal>}
      <Confirm open={!!confirm} message={confirm?.msg || ''} onConfirm={() => { confirm?.onOk(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
    </div>
  );
}

function Play2Icon() {
  return <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}

/* ================= 顶层弹窗表单 ================= */
const inputCls = "w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const UserModal = ({ editUser, users, roles, onSave, onClose }: { editUser: User | null; users: User[]; roles: Role[]; onSave: (f: { user: string; name: string; role: string }) => void; onClose: () => void }) => {
  const [f, setF] = useState({ user: editUser?.user || '', name: editUser?.name || '', role: editUser?.role || roles[1]?.name || '评测员' });
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.user.trim() || !f.name.trim()) { setErr('账号与姓名必填'); return; }
    if (!editUser && users.some(u => u.user === f.user.trim())) { setErr('账号已存在'); return; }
    onSave({ user: f.user.trim(), name: f.name.trim(), role: f.role });
  };
  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{err}</div>}
      <div className="space-y-2"><label className="text-sm font-medium">账号 *</label><input value={f.user} disabled={!!editUser} onChange={e => setF({ ...f, user: e.target.value })} className={cn(inputCls, editUser && 'opacity-60')} /></div>
      <div className="space-y-2"><label className="text-sm font-medium">姓名 *</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></div>
      <div className="space-y-2"><label className="text-sm font-medium">角色</label>
        <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })} className={inputCls}>{roles.map(r => <option key={r.name}>{r.name}</option>)}</select>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">取消</button><button type="submit" className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> 保存</button></div>
    </form>
  );
};

const RoleModal = ({ existing, onCreate, onClose }: { existing: string[]; onCreate: (name: string, perms: string[]) => void; onClose: () => void }) => {
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<string[]>(['数据标注']);
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('请输入角色名称'); return; }
    if (existing.includes(name.trim())) { setErr('角色名已存在'); return; }
    onCreate(name.trim(), perms);
  };
  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{err}</div>}
      <div className="space-y-2"><label className="text-sm font-medium">角色名称 *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="如：审计员" className={inputCls} /></div>
      <div>
        <label className="text-sm font-medium block mb-2">模块权限</label>
        <div className="grid grid-cols-2 gap-2">
          {MODULES.map(m => (
            <label key={m} className="flex items-center text-sm"><input type="checkbox" className="mr-2 accent-blue-600" checked={perms.includes(m)} onChange={() => setPerms(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])} />{m}</label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">取消</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">创建角色</button></div>
    </form>
  );
};

const VmModal = ({ count, onCreate, onClose }: { count: number; onCreate: (name: string, cpu: number, mem: number, gpu: boolean) => void; onClose: () => void }) => {
  const [f, setF] = useState({ name: '', cpu: 8, mem: 32, gpu: false });
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('请输入实例名称'); return; }
    onCreate(f.name.trim(), f.cpu, f.mem, f.gpu);
  };
  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{err}</div>}
      <div className="space-y-2"><label className="text-sm font-medium">实例名称 *（第 {count + 1} 台）</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="如：eval-node-05" className={inputCls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><label className="text-sm font-medium">CPU (核)</label><input type="number" min={2} max={64} value={f.cpu} onChange={e => setF({ ...f, cpu: +e.target.value })} className={inputCls} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">内存 (GB)</label><input type="number" min={4} max={256} value={f.mem} onChange={e => setF({ ...f, mem: +e.target.value })} className={inputCls} /></div>
      </div>
      <label className="flex items-center text-sm"><input type="checkbox" checked={f.gpu} onChange={e => setF({ ...f, gpu: e.target.checked })} className="mr-2 accent-blue-600" /> 挂载 A100 GPU</label>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">取消</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">创建</button></div>
    </form>
  );
};

const DesktopModal = ({ users, count, onCreate, onClose }: { users: User[]; count: number; onCreate: (u: User, img: string) => void; onClose: () => void }) => {
  const [img, setImg] = useState('警务通用镜像 v6');
  const [userId, setUserId] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find(x => x.user === userId);
    if (!u) { setErr('请选择使用人'); return; }
    onCreate(u, img);
  };
  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{err}</div>}
      <div className="space-y-2"><label className="text-sm font-medium">镜像</label>
        <select value={img} onChange={e => setImg(e.target.value)} className={inputCls}>{['警务通用镜像 v6', '标注作业镜像 v3', '评测专用镜像 v2'].map(m => <option key={m}>{m}</option>)}</select>
      </div>
      <div className="space-y-2"><label className="text-sm font-medium">分配给 *（第 {count + 1} 台桌面）</label>
        <select value={userId} onChange={e => setUserId(e.target.value)} className={inputCls}>
          <option value="">选择启用用户…</option>
          {users.map(u => <option key={u.user} value={u.user}>{u.name}（{u.user}）</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">取消</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">分配并启动</button></div>
    </form>
  );
};

void Lock; void ArrowLeft;
