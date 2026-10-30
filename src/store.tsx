/**
 * 全局数据仓库：所有模块共享同一份业务数据。
 * - 任务/接口/多版本测试的"执行"由统一的时间片引擎推进（进度、尝试记录、失败概率）
 * - 任务完成自动生成测试结果 + 资源消耗记录（跨模块可见）
 * - 报告从真实任务结果生成，可导出文件
 * - 数据持久化到 localStorage，刷新不丢
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

/* ---------------- 类型 ---------------- */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ListKey = 'apiTests' | 'protoTests';

export interface TestItem { name: string; value: string; status: 'success' | 'failed' | 'warning'; }

export interface EvalTask {
  id: string; name: string; type: string; target: string;
  status: TaskStatus; progress: number; config: string; creator: string; time: string;
  failRoll?: boolean; startedAt?: number; durationSec?: number; failReason?: string;
}

export interface TestResult {
  id: string; name: string; type: string; taskId: string; taskName: string;
  status: 'success' | 'failed' | 'warning'; generationTime: string; duration: string;
  successRate: number; failureRate: number; config: string; node: string;
  items: TestItem[]; metrics: Record<string, number>;
}

export interface TestReport {
  id: string; taskId: string; name: string; type: string; result: string; time: string;
  template: string; modules: string[]; format: string;
}

export interface ApiAttempt { code: number; latency: number; ok: boolean; time: string; }

export interface ApiTest {
  id: string; name: string; url: string; method: string; protocol: string; version: string;
  status: 'none' | 'success' | 'failed' | 'running'; progress: number;
  expectedCode: number; latencyLimit: number; timeout: number; repeat: number;
  body: string; createTime: string; attempts: ApiAttempt[]; failRate: number; resultId?: string;
}

export interface VersionTest {
  id: string; name: string; api: string; base: string; versions: string[];
  status: 'pending' | 'running' | 'success' | 'failed'; progress: number; time: string; resultId?: string;
}

export interface ResourceRecord {
  id: string; name: string; taskId: string; node: string;
  cpu: number; mem: number; gpu: number; duration: string;
  frameDrop: number; avgLatency: number; processed: number; time: string;
}

export interface Toast { id: number; msg: string; kind: 'success' | 'error' | 'info'; }

export interface StoreData {
  tasks: EvalTask[]; results: TestResult[]; reports: TestReport[];
  apiTests: ApiTest[]; protoTests: ApiTest[]; versionTests: VersionTest[]; resources: ResourceRecord[];
}

/* ---------------- 工具 ---------------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const fmtClock = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const fmtNow = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const relTime = (daysAgo = 0, hoursAgo = 0, minsAgo = 0) => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(d.getHours() - hoursAgo); d.setMinutes(d.getMinutes() - minsAgo); return fmtNow(d);
};
export const fmtDur = (secs: number) => `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(Math.floor(secs % 60))}`;
export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const DEFAULT_TASK_CFG = '{\n  "threshold": 0.85,\n  "max_iterations": 1000,\n  "retry_on_failure": true,\n  "log_level": "INFO"\n}';
export const DEFAULT_API_BODY = '{\n  "image_base64": "...",\n  "min_confidence": 0.8\n}';
export const NODES = ['GPU服务器_A100_01', 'GPU-Node-04', '边缘计算节点_05', '本机'];

const nextSeq = (items: { id: string }[], prefix: string) =>
  items.reduce((m, it) => { const n = parseInt(it.id.split('-').pop() || ''); return isNaN(n) ? m : Math.max(m, n); }, 0) + 1;

const st = (v: number, warnAbove: number, failAbove: number): TestItem['status'] =>
  v > failAbove ? 'failed' : v > warnAbove ? 'warning' : 'success';

/** 按任务类型生成一套带随机波动的真实感测试指标 */
export function genMetrics(type: string, pass: boolean): { items: TestItem[]; metrics: Record<string, number>; status: TestResult['status'] } {
  let items: TestItem[] = []; let metrics: Record<string, number> = {};
  if (type === '接口测试') {
    const avg = Math.round(rnd(95, pass ? 210 : 430));
    const maxL = Math.round(avg * rnd(1.5, pass ? 2.2 : 3.4));
    const p95 = Math.round(avg * rnd(1.3, 1.8));
    const sr = +(pass ? rnd(97, 99.9) : rnd(68, 91)).toFixed(1);
    const err = +(100 - sr).toFixed(1);
    items = [
      { name: '请求成功率', value: `${sr}%`, status: sr >= 97 ? 'success' : sr >= 85 ? 'warning' : 'failed' },
      { name: '平均响应时间', value: `${avg}ms`, status: st(avg, 300, 400) },
      { name: 'P95延迟', value: `${p95}ms`, status: st(p95, 400, 600) },
      { name: '最大延迟', value: `${maxL}ms`, status: st(maxL, 800, 1500) },
      { name: '错误率', value: `${err}%`, status: st(err, 1, 8) },
    ];
    metrics = { avgLatency: avg, maxLatency: maxL, p95, throughput: Math.round(1000 / (avg / 100)), successRate: sr, failureRate: err };
  } else if (type === '性能测试') {
    const tps = Math.round(rnd(pass ? 950 : 320, pass ? 1750 : 780));
    const users = pick([200, 500, 1000]);
    const avg = Math.round(rnd(pass ? 70 : 280, pass ? 230 : 580));
    const drop = +(pass ? rnd(0, 0.7) : rnd(1.6, 12)).toFixed(2);
    const err = +(pass ? rnd(0, 0.1) : rnd(0.6, 4.5)).toFixed(2);
    const sr = +(err >= 8 ? rnd(70, 86) : err > 1 ? rnd(88, 96) : rnd(97.5, 99.9)).toFixed(1);
    items = [
      { name: '吞吐量', value: `${tps}/s`, status: tps >= 900 ? 'success' : tps >= 600 ? 'warning' : 'failed' },
      { name: '并发用户数', value: `${users}`, status: 'success' },
      { name: '平均耗时', value: `${avg}ms`, status: st(avg, 300, 400) },
      { name: '丢帧率', value: `${drop}%`, status: st(drop, 1, 5) },
      { name: '错误率', value: `${err}%`, status: st(err, 0.5, 3) },
    ];
    metrics = { avgLatency: avg, maxLatency: Math.round(avg * rnd(1.8, 2.6)), throughput: tps, frameDrop: +drop, successRate: sr, failureRate: +err };
  } else {
    const load = +rnd(0.9, pass ? 1.5 : 2.6).toFixed(2);
    const first = +rnd(0.4, pass ? 1.0 : 1.7).toFixed(2);
    const inter = Math.round(rnd(80, pass ? 170 : 330));
    const errs = pass ? (Math.random() < 0.65 ? 0 : 1) : Math.round(rnd(3, 8));
    const compat = Math.round(pass ? 100 : rnd(86, 97));
    const sr = +(pass ? rnd(97.5, 99.9) : rnd(75, 92)).toFixed(1);
    items = [
      { name: '页面加载耗时', value: `${load}s`, status: st(load, 2, 3) },
      { name: '首屏渲染耗时', value: `${first}s`, status: st(first, 1.5, 2.5) },
      { name: '交互响应耗时', value: `${inter}ms`, status: st(inter, 200, 300) },
      { name: '资源错误数', value: `${errs}`, status: st(errs, 0, 2) },
      { name: '浏览器兼容性', value: `${compat}%`, status: compat >= 99 ? 'success' : compat >= 90 ? 'warning' : 'failed' },
    ];
    metrics = { avgLatency: inter, maxLatency: Math.round(inter * rnd(1.6, 2.4)), compat, successRate: sr, failureRate: +(100 - sr).toFixed(1) };
  }
  const status: TestResult['status'] = items.every(i => i.status === 'success') ? 'success' : items.some(i => i.status === 'failed') ? 'failed' : 'warning';
  return { items, metrics, status };
}

/** 生成一份文本报告用于下载 */
export function buildReportText(r: TestReport, task: EvalTask | undefined, result: TestResult | undefined, res: ResourceRecord | undefined) {
  const lines = [
    `# 测试报告 ${r.id}`, '',
    `- 关联任务: ${task ? `${task.name} (${task.id})` : r.taskId}`,
    `- 测试类型: ${r.type}`,
    `- 结论: ${r.result}`,
    `- 生成时间: ${r.time}`,
    `- 模板: ${r.template} | 导出格式: ${r.format.toUpperCase()}`, '',
    '## 测试项结果', '',
  ];
  if (result) {
    result.items.forEach(i => lines.push(`- ${i.name}: ${i.value} [${i.status}]`));
    lines.push('', `- 成功率: ${result.successRate}% | 失败率: ${result.failureRate}% | 平均延迟: ${result.metrics.avgLatency}ms`,
      `- 执行节点: ${result.node} | 配置: ${result.config}`);
  } else lines.push('- (无关联测试结果)');
  if (res) lines.push('', '## 资源消耗', '', `- CPU: ${res.cpu}% | 内存: ${res.mem}% | GPU: ${res.gpu}%`, `- 处理样本: ${res.processed} | 丢帧率: ${res.frameDrop}% | 时长: ${res.duration}`);
  return lines.join('\n');
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------- 种子数据 ---------------- */
function seedState(): StoreData {
  const r1 = genMetrics('UI测试', true);
  const r1b = genMetrics('UI测试', true);
  const r3 = genMetrics('性能测试', false);
  const results: TestResult[] = [
    { id: 'TR-1001', name: '人脸识别精度测试_v1.0', type: 'UI测试', taskId: 'TASK-001', taskName: '人脸识别精度测试', status: r1.status, generationTime: relTime(0, 2, 40), duration: `${r1.metrics.avgLatency}ms`, successRate: r1.metrics.successRate, failureRate: r1.metrics.failureRate, config: '标准精度配置_v1', node: 'GPU服务器_A100_01', items: r1.items, metrics: r1.metrics },
    { id: 'TR-1002', name: '人脸识别精度测试_v1.1', type: 'UI测试', taskId: 'TASK-001', taskName: '人脸识别精度测试', status: r1b.status, generationTime: relTime(0, 0, 35), duration: `${r1b.metrics.avgLatency}ms`, successRate: r1b.metrics.successRate, failureRate: r1b.metrics.failureRate, config: '高精度配置_v2', node: 'GPU服务器_A100_01', items: r1b.items, metrics: r1b.metrics },
    { id: 'TR-1003', name: '视频流并发处理评测', type: '性能测试', taskId: 'TASK-003', taskName: '视频流并发处理评测', status: 'failed', generationTime: relTime(0, 3, 5), duration: `${r3.metrics.avgLatency}ms`, successRate: r3.metrics.successRate, failureRate: r3.metrics.failureRate, config: '极限压力配置', node: '边缘计算节点_05', items: r3.items, metrics: r3.metrics },
  ];
  const tasks: EvalTask[] = [
    { id: 'TASK-004', name: '移动端UI兼容性测试', type: 'UI测试', target: 'MobileApp-v1.2', status: 'pending', progress: 0, config: DEFAULT_TASK_CFG, creator: '赵警官', time: relTime(0, 0, 15) },
    { id: 'TASK-002', name: '车辆识别接口压力测试', type: '接口测试', target: 'VehicleAPI-v1.0', status: 'running', progress: 46, failRoll: false, startedAt: Date.now() - 40000, durationSec: 6245, config: DEFAULT_TASK_CFG, creator: '李警官', time: relTime(0, 1, 15) },
    { id: 'TASK-001', name: '人脸识别精度测试', type: 'UI测试', target: 'FaceSDK-v2.1', status: 'completed', progress: 100, durationSec: 8232, config: DEFAULT_TASK_CFG, creator: '张警官', time: relTime(0, 2, 30) },
    { id: 'TASK-003', name: '视频流并发处理评测', type: '性能测试', target: 'StreamServer-v3', status: 'failed', progress: 100, failReason: '丢帧率超过阈值 (12.5%)，触发熔断', durationSec: 19244, config: DEFAULT_TASK_CFG, creator: '王警官', time: relTime(0, 3, 45) },
  ];
  const att = (code: number, latency: number, minsAgo: number): ApiAttempt =>
    ({ code, latency, ok: code === 200, time: fmtClock(new Date(Date.now() - minsAgo * 60000)) });
  const apiTests: ApiTest[] = [
    { id: 'API-001', name: '人脸检测接口功能测试', url: '/api/v1/face/detect', method: 'POST', protocol: 'HTTP', version: 'v1.2.0', status: 'success', progress: 100, expectedCode: 200, latencyLimit: 500, timeout: 30, repeat: 5, body: DEFAULT_API_BODY, createTime: relTime(0, 2, 30), attempts: [att(200, 142, 150), att(200, 118, 149), att(200, 165, 148), att(200, 131, 147), att(200, 127, 146)], failRate: 0.04, resultId: 'TR-1101' },
    { id: 'API-002', name: '车辆识别接口连通性', url: '/api/v1/vehicle/identify', method: 'GET', protocol: 'HTTP', version: 'v1.2.0', status: 'failed', progress: 100, expectedCode: 200, latencyLimit: 500, timeout: 30, repeat: 5, body: '{}', createTime: relTime(0, 1, 15), attempts: [att(200, 156, 75), att(200, 143, 74), att(502, 1830, 73), att(200, 161, 72), att(502, 2010, 71)], failRate: 0.35, resultId: 'TR-1102' },
    { id: 'API-003', name: '轨迹查询接口性能预检', url: '/api/v1/track/query', method: 'POST', protocol: 'HTTP', version: 'v1.3.0', status: 'none', progress: 0, expectedCode: 200, latencyLimit: 400, timeout: 60, repeat: 10, body: '{\n  "device_id": "CAM-0221",\n  "from": "2026-10-29 00:00"\n}', createTime: relTime(0, 3, 45), attempts: [], failRate: 0.08 },
  ];
  const protoTests: ApiTest[] = [
    { id: 'PRT-001', name: 'HTTPS加密传输测试', url: 'https://face-detect.internal/api', method: 'POST', protocol: 'HTTP', version: 'v1.2.0', status: 'success', progress: 100, expectedCode: 200, latencyLimit: 500, timeout: 30, repeat: 5, body: DEFAULT_API_BODY, createTime: relTime(1, 2, 0), attempts: [att(200, 168, 1500), att(200, 149, 1499), att(200, 175, 1498), att(200, 152, 1497), att(200, 161, 1496)], failRate: 0.05 },
    { id: 'PRT-002', name: 'WebSocket实时视频流推送', url: 'wss://stream.internal/ws/video', method: 'WS', protocol: 'WS', version: 'v1.2.0', status: 'none', progress: 0, expectedCode: 101, latencyLimit: 800, timeout: 60, repeat: 5, body: '{"channel": "video-stream"}', createTime: relTime(1, 4, 0), attempts: [], failRate: 0.12 },
    { id: 'PRT-003', name: 'gRPC特征向量检索', url: 'grpc://feature-store.internal:9090', method: 'gRPC', protocol: 'gRPC', version: 'v1.2.0', status: 'success', progress: 100, expectedCode: 0, latencyLimit: 300, timeout: 30, repeat: 5, body: '{"vector_dim": 512}', createTime: relTime(1, 6, 0), attempts: [att(0, 88, 1800), att(0, 92, 1799), att(0, 79, 1798), att(0, 97, 1797), att(0, 85, 1796)], failRate: 0.06 },
  ];
  const versionTests: VersionTest[] = [
    { id: 'VER-001', name: '人脸检测API多版本兼容性', api: '/api/v1/face/detect', base: 'v1.2.0', versions: ['v1.0.0', 'v1.1.0', 'v1.2.0', 'v1.3.0'], status: 'success', progress: 100, time: relTime(0, 5, 0), resultId: 'TR-1201' },
    { id: 'VER-002', name: '车辆识别接口升级回归', api: '/api/v1/vehicle/identify', base: 'v0.9.0', versions: ['v0.9.0', 'v1.0.0'], status: 'failed', progress: 100, time: relTime(0, 8, 0), resultId: 'TR-1202' },
  ];
  const resources: ResourceRecord[] = [
    { id: 'RES-001', name: '人脸识别精度测试', taskId: 'TASK-001', node: 'GPU服务器_A100_01', cpu: 32, mem: 45, gpu: 28, duration: '02:17:12', frameDrop: 0.42, avgLatency: 128, processed: 12860, time: relTime(0, 2, 35) },
    { id: 'RES-002', name: '车辆识别接口压力测试', taskId: 'TASK-002', node: 'GPU-Node-04', cpu: 58, mem: 63, gpu: 71, duration: '01:44:05', frameDrop: 0.15, avgLatency: 176, processed: 9420, time: relTime(0, 1, 20) },
    { id: 'RES-003', name: '视频流并发处理评测', taskId: 'TASK-003', node: '边缘计算节点_05', cpu: 54, mem: 68, gpu: 72, duration: '05:20:44', frameDrop: 1.24, avgLatency: 428, processed: 21330, time: relTime(0, 3, 50) },
  ];
  const reports: TestReport[] = [
    { id: 'REP-001', taskId: 'TASK-001', name: '人脸识别精度测试', type: 'UI测试', result: '通过', time: relTime(0, 2, 45), template: '标准模板', modules: ['测试概要', '测试结论'], format: 'pdf' },
    { id: 'REP-002', taskId: 'TASK-002', name: '车辆识别接口压力测试', type: '接口测试', result: '部分失败', time: relTime(0, 1, 30), template: '详细模板', modules: ['测试概要', '详细结果', '问题与建议'], format: 'pdf' },
    { id: 'REP-003', taskId: 'TASK-003', name: '视频流并发处理评测', type: '性能测试', result: '失败', time: relTime(0, 3, 0), template: '标准模板', modules: ['测试概要', '测试结论'], format: 'pdf' },
  ];
  // 接口/多版本执行的历史结果（保证首次进入结果校验就有对比素材）
  const vr = genMetrics('接口测试', true);
  results.push(
    { id: 'TR-1101', name: '人脸检测接口功能测试 执行报告', type: '接口测试', taskId: '', taskName: '接口评测 / 人脸检测接口功能测试', status: 'success', generationTime: relTime(0, 2, 28), duration: '137ms', successRate: 100, failureRate: 0, config: 'POST /api/v1/face/detect', node: '评测引擎-本机', items: [{ name: '请求成功率', value: '100%', status: 'success' }, { name: '平均响应时间', value: '137ms', status: 'success' }, { name: '最大延迟', value: '165ms', status: 'success' }, { name: '状态码校验', value: '200 OK', status: 'success' }, { name: '响应时间达标', value: '达标', status: 'success' }], metrics: { avgLatency: 137, maxLatency: 165, successRate: 100, failureRate: 0 } },
    { id: 'TR-1102', name: '车辆识别接口连通性 执行报告', type: '接口测试', taskId: '', taskName: '接口评测 / 车辆识别接口连通性', status: 'failed', generationTime: relTime(0, 1, 10), duration: '880ms', successRate: 60, failureRate: 40, config: 'GET /api/v1/vehicle/identify', node: '评测引擎-本机', items: [{ name: '请求成功率', value: '60%', status: 'failed' }, { name: '平均响应时间', value: '880ms', status: 'failed' }, { name: '最大延迟', value: '2010ms', status: 'failed' }, { name: '状态码校验', value: '存在非 200 响应', status: 'failed' }, { name: '响应时间达标', value: '超时', status: 'failed' }], metrics: { avgLatency: 880, maxLatency: 2010, successRate: 60, failureRate: 40 } },
    { id: 'TR-1201', name: '人脸检测API多版本兼容性 兼容性报告', type: '接口测试', taskId: '', taskName: '多版本测试 / 人脸检测API多版本兼容性', status: 'success', generationTime: relTime(0, 4, 50), duration: '96ms', successRate: 100, failureRate: 0, config: 'v1.2.0 基准', node: '评测引擎-本机', items: [{ name: '接口总数', value: '42', status: 'success' }, { name: '新增接口', value: '3', status: 'success' }, { name: '修改接口', value: '2', status: 'success' }, { name: '破坏性变更', value: '0', status: 'success' }, { name: '向后兼容率', value: '100%', status: 'success' }], metrics: { avgLatency: 96, maxLatency: 180, successRate: 100, failureRate: 0 } },
    { id: 'TR-1202', name: '车辆识别接口升级回归 兼容性报告', type: '接口测试', taskId: '', taskName: '多版本测试 / 车辆识别接口升级回归', status: 'failed', generationTime: relTime(0, 7, 50), duration: '456ms', successRate: 82, failureRate: 18, config: 'v0.9.0 基准', node: '评测引擎-本机', items: [{ name: '接口总数', value: '28', status: 'success' }, { name: '新增接口', value: '5', status: 'success' }, { name: '修改接口', value: '6', status: 'warning' }, { name: '破坏性变更', value: '2', status: 'failed' }, { name: '向后兼容率', value: '82%', status: 'warning' }], metrics: { avgLatency: 456, maxLatency: vr.metrics.maxLatency, successRate: 82, failureRate: 18 } },
  );
  return { tasks, results, reports, apiTests, protoTests, versionTests, resources };
}

/* ---------------- Context ---------------- */
const KEY = 'gga-eval-store-v2';

interface StoreCtx extends StoreData {
  toasts: Toast[];
  notify: (msg: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  addTask: (d: Partial<EvalTask>) => EvalTask;
  updateTask: (t: EvalTask) => void;
  deleteTask: (id: string) => void;
  runTask: (id: string) => void;
  stopTask: (id: string) => void;
  generateReport: (taskId: string, opts: { template: string; modules: string[]; format: string }) => TestReport | null;
  deleteReport: (id: string) => void;
  saveApiTest: (list: ListKey, t: ApiTest) => void;
  deleteApiTest: (list: ListKey, id: string) => void;
  runApiTest: (list: ListKey, id: string) => void;
  stopApiTest: (list: ListKey, id: string) => void;
  addVersionTest: (v: Partial<VersionTest>) => void;
  runVersionTest: (id: string) => void;
  stopVersionTest: (id: string) => void;
  deleteVersionTest: (id: string) => void;
  deleteResult: (id: string) => void;
  deleteResource: (id: string) => void;
}

const Ctx = createContext<StoreCtx | null>(null);
export const useStore = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

let toastSeq = 1;

const loadData = (): StoreData => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tasks && parsed.results) return parsed as StoreData;
    }
  } catch { /* ignore */ }
  return seedState();
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreData>(loadData);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 空间不足时忽略 */ }
  }, [state]);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  const notify = (msg: string, kind: Toast['kind'] = 'success') => {
    const id = toastSeq++;
    setToasts(prev => [...prev.slice(-3), { id, msg, kind }]);
    setTimeout(() => dismissToast(id), 4000);
  };

  /* ------- 执行引擎：每 850ms 推进一次所有 running 的执行 ------- */
  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      let changed = false;
      const events: Array<[string, Toast['kind']]> = [];
      let results = s.results;
      let resources = s.resources;

      const tasks = s.tasks.map(t => {
        if (t.status !== 'running') return t;
        changed = true;
        const p = t.progress + rnd(6, 16);
        if (p >= 100) {
          const pass = !t.failRoll;
          const g = genMetrics(t.type, pass);
          const secs = (t.durationSec || 3600) + Math.round((Date.now() - (t.startedAt || Date.now())) / 1000);
          const node = pick(NODES);
          const result: TestResult = {
            id: uid('TR'), name: `${t.name}_${fmtNow().slice(0, 10).replace(/-/g, '')}`, type: t.type,
            taskId: t.id, taskName: t.name, status: pass ? g.status : 'failed', generationTime: fmtNow(),
            duration: `${g.metrics.avgLatency}ms`, successRate: g.metrics.successRate, failureRate: g.metrics.failureRate,
            config: '自定义配置', node, items: g.items, metrics: g.metrics,
          };
          const rr: ResourceRecord = {
            id: uid('RES'), name: t.name, taskId: t.id, node, cpu: Math.round(rnd(18, 78)), mem: Math.round(rnd(30, 80)),
            gpu: Math.round(rnd(10, 88)), duration: fmtDur(secs), frameDrop: +(g.metrics.frameDrop ?? rnd(0, 1.2)).toFixed(2),
            avgLatency: g.metrics.avgLatency, processed: Math.round(rnd(2000, 16000)), time: fmtNow(),
          };
          results = [result, ...results];
          resources = [rr, ...resources];
          const reason = t.type === '性能测试' ? `丢帧率超过阈值 (${g.metrics.frameDrop}%)，触发熔断`
            : t.type === '接口测试' ? `请求成功率仅 ${g.metrics.successRate}%，低于阈值` : `资源错误数 ${g.items.find(i => i.name === '资源错误数')?.value ?? '-'} 超限`;
          events.push([pass ? `任务 ${t.id}《${t.name}》执行完成，已生成测试结果与资源记录` : `任务 ${t.id}《${t.name}》执行失败：${reason}`, pass ? 'success' : 'error']);
          return { ...t, status: pass ? 'completed' as const : 'failed' as const, progress: 100, failReason: pass ? undefined : reason };
        }
        return { ...t, progress: Math.round(p) };
      });

      const finalizeApi = (a: ApiTest): ApiTest => {
        const okCount = a.attempts.filter(x => x.ok).length;
        const sr = +(okCount / Math.max(1, a.attempts.length) * 100).toFixed(1);
        const avg = Math.round(a.attempts.reduce((acc, x) => acc + x.latency, 0) / Math.max(1, a.attempts.length));
        const maxL = a.attempts.reduce((m, x) => Math.max(m, x.latency), 0);
        const pass = sr >= 85;
        const items: TestItem[] = [
          { name: '请求成功率', value: `${sr}%`, status: sr >= 95 ? 'success' : sr >= 85 ? 'warning' : 'failed' },
          { name: '平均响应时间', value: `${avg}ms`, status: avg < a.latencyLimit ? 'success' : 'warning' },
          { name: '最大延迟', value: `${maxL}ms`, status: maxL < a.latencyLimit ? 'success' : maxL < a.latencyLimit * 2 ? 'warning' : 'failed' },
          { name: '状态码校验', value: okCount === a.attempts.length ? `${a.expectedCode} OK` : `存在非 ${a.expectedCode} 响应`, status: okCount === a.attempts.length ? 'success' : 'failed' },
          { name: '响应时间达标', value: avg < a.latencyLimit ? '达标' : '超时', status: avg < a.latencyLimit ? 'success' : 'failed' },
        ];
        const result: TestResult = {
          id: uid('TR'), name: `${a.name} 执行报告`, type: '接口测试', taskId: '', taskName: `接口评测 / ${a.name}`,
          status: pass ? (sr >= 99 ? 'success' : 'warning') : 'failed', generationTime: fmtNow(), duration: `${avg}ms`,
          successRate: sr, failureRate: +(100 - sr).toFixed(1), config: `${a.method} ${a.url}`, node: '评测引擎-本机', items,
          metrics: { avgLatency: avg, maxLatency: maxL, successRate: sr, failureRate: +(100 - sr).toFixed(1) },
        };
        results = [result, ...results];
        events.push([pass ? `${a.name} 执行完成：成功率 ${sr}%，已生成测试结果` : `${a.name} 执行失败：成功率仅 ${sr}%，请检查接口`, pass ? 'success' : 'error']);
        return { ...a, status: pass ? 'success' : 'failed', progress: 100, resultId: result.id };
      };

      const stepApi = (list: ApiTest[]): ApiTest[] => list.map(a => {
        if (a.status !== 'running') return a;
        changed = true;
        if (a.attempts.length >= a.repeat) return finalizeApi(a);
        const ok = Math.random() >= a.failRate;
        const att: ApiAttempt = { code: ok ? a.expectedCode : pick([429, 500, 502, 504]), latency: Math.round(ok ? rnd(85, 320) : rnd(600, 2200)), ok, time: fmtClock() };
        const attempts = [...a.attempts, att];
        return { ...a, attempts, progress: Math.round(attempts.length / Math.max(1, a.repeat) * 100) };
      });
      const apiTests = stepApi(s.apiTests);
      const protoTests = stepApi(s.protoTests);

      const versionTests = s.versionTests.map(v => {
        if (v.status !== 'running') return v;
        changed = true;
        const p = v.progress + rnd(8, 18);
        if (p >= 100) {
          const pass = Math.random() < 0.8;
          const breaking = pass ? 0 : Math.round(rnd(1, 3));
          const added = Math.round(rnd(1, 4)); const modified = Math.round(rnd(1, 5));
          const compat = +(pass ? rnd(96, 100) : rnd(70, 92)).toFixed(1);
          const items: TestItem[] = [
            { name: '接口总数', value: `${Math.round(rnd(24, 60))}`, status: 'success' },
            { name: '新增接口', value: `${added}`, status: 'success' },
            { name: '修改接口', value: `${modified}`, status: modified > 3 ? 'warning' : 'success' },
            { name: '破坏性变更', value: `${breaking}`, status: breaking ? 'failed' : 'success' },
            { name: '向后兼容率', value: `${compat}%`, status: pass ? 'success' : 'warning' },
          ];
          const result: TestResult = {
            id: uid('TR'), name: `${v.name} 兼容性报告`, type: '接口测试', taskId: '', taskName: `多版本测试 / ${v.name}`,
            status: pass ? 'success' : 'failed', generationTime: fmtNow(), duration: `${Math.round(rnd(80, 460))}ms`,
            successRate: compat, failureRate: +(100 - compat).toFixed(1), config: `${v.base} 基准`, node: '评测引擎-本机',
            items, metrics: { avgLatency: Math.round(rnd(80, 460)), maxLatency: Math.round(rnd(400, 1200)), successRate: compat, failureRate: +(100 - compat).toFixed(1) },
          };
          results = [result, ...results];
          events.push([pass ? `${v.name} 兼容性测试通过（兼容率 ${compat}%）` : `${v.name} 发现 ${breaking} 项破坏性变更，兼容性不达标`, pass ? 'success' : 'error']);
          return { ...v, status: pass ? 'success' as const : 'failed' as const, progress: 100, resultId: result.id };
        }
        return { ...v, progress: Math.round(p) };
      });

      if (changed) setState(prev => ({ ...prev, tasks, apiTests, protoTests, versionTests, results, resources }));
      events.forEach(([m, k]) => notify(m, k));
    }, 850);
    return () => clearInterval(iv);
  }, []);

  /* ------- 动作 ------- */
  const addTask = (d: Partial<EvalTask>): EvalTask => {
    const s = stateRef.current;
    const t: EvalTask = {
      id: `TASK-${String(nextSeq(s.tasks, 'TASK')).padStart(3, '0')}`, name: d.name || '未命名任务', type: d.type || 'UI测试',
      target: d.target || '-', status: 'pending', progress: 0, config: d.config || DEFAULT_TASK_CFG,
      creator: d.creator || '当前用户', time: fmtNow(),
    };
    setState(p => ({ ...p, tasks: [t, ...p.tasks] }));
    return t;
  };
  const updateTask = (t: EvalTask) => setState(p => ({ ...p, tasks: p.tasks.map(x => x.id === t.id ? { ...x, ...t } : x) }));
  const deleteTask = (id: string) => setState(p => ({
    ...p, tasks: p.tasks.filter(t => t.id !== id), results: p.results.filter(r => r.taskId !== id),
    reports: p.reports.filter(r => r.taskId !== id), resources: p.resources.filter(r => r.taskId !== id),
  }));
  const runTask = (id: string) => setState(p => ({
    ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, status: 'running', progress: 0, startedAt: Date.now(), failRoll: Math.random() < 0.15, failReason: undefined } : t),
  }));
  const stopTask = (id: string) => setState(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, status: 'pending', progress: 0 } : t) }));
  const generateReport = (taskId: string, opts: { template: string; modules: string[]; format: string }): TestReport | null => {
    const s = stateRef.current;
    const task = s.tasks.find(t => t.id === taskId); if (!task) return null;
    const res = s.results.filter(r => r.taskId === taskId).sort((a, b) => b.generationTime.localeCompare(a.generationTime))[0];
    const sr = res?.successRate ?? 95;
    const report: TestReport = {
      id: `REP-${String(nextSeq(s.reports, 'REP')).padStart(3, '0')}`, taskId, name: task.name, type: task.type,
      result: sr >= 99 ? '通过' : sr >= 90 ? '部分失败' : '失败', time: fmtNow(),
      template: opts.template, modules: opts.modules, format: opts.format,
    };
    setState(p => ({ ...p, reports: [report, ...p.reports] }));
    return report;
  };
  const deleteReport = (id: string) => setState(p => ({ ...p, reports: p.reports.filter(r => r.id !== id) }));
  const saveApiTest = (list: ListKey, t: ApiTest) => setState(p => {
    const exists = p[list].some(x => x.id === t.id);
    const next = exists ? p[list].map(x => x.id === t.id ? { ...x, ...t } : x) : [{ ...t, id: t.id || `API-${Math.floor(rnd(100, 999))}` }, ...p[list]];
    return { ...p, [list]: next };
  });
  const deleteApiTest = (list: ListKey, id: string) => setState(p => ({ ...p, [list]: p[list].filter(x => x.id !== id) }));
  const runApiTest = (list: ListKey, id: string) => setState(p => ({
    ...p, [list]: p[list].map(a => a.id === id ? { ...a, status: 'running', progress: 0, attempts: [], failRate: a.failRate ?? 0.12 } : a),
  }));
  const stopApiTest = (list: ListKey, id: string) => setState(p => ({ ...p, [list]: p[list].map(a => a.id === id ? { ...a, status: 'none', progress: 0 } : a) }));
  const addVersionTest = (v: Partial<VersionTest>) => setState(p => ({
    ...p, versionTests: [{
      id: `VER-${String(nextSeq(p.versionTests, 'VER')).padStart(3, '0')}`, name: v.name || '未命名版本测试', api: v.api || '',
      base: v.base || 'v1.0.0', versions: v.versions || [], status: 'pending', progress: 0, time: fmtNow(),
    }, ...p.versionTests],
  }));
  const runVersionTest = (id: string) => setState(p => ({ ...p, versionTests: p.versionTests.map(v => v.id === id ? { ...v, status: 'running', progress: 0 } : v) }));
  const stopVersionTest = (id: string) => setState(p => ({ ...p, versionTests: p.versionTests.map(v => v.id === id ? { ...v, status: 'pending', progress: 0 } : v) }));
  const deleteVersionTest = (id: string) => setState(p => ({ ...p, versionTests: p.versionTests.filter(v => v.id !== id) }));
  const deleteResult = (id: string) => setState(p => ({ ...p, results: p.results.filter(r => r.id !== id) }));
  const deleteResource = (id: string) => setState(p => ({ ...p, resources: p.resources.filter(r => r.id !== id) }));

  const value: StoreCtx = {
    ...state, toasts, notify, dismissToast, addTask, updateTask, deleteTask, runTask, stopTask,
    generateReport, deleteReport, saveApiTest, deleteApiTest, runApiTest, stopApiTest,
    addVersionTest, runVersionTest, stopVersionTest, deleteVersionTest, deleteResult, deleteResource,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- 通用 UI：Toast / Modal / Confirm ---------------- */
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-96 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-2xl border backdrop-blur bg-[var(--bg-secondary)] ${t.kind === 'success' ? 'border-emerald-400/50' : t.kind === 'error' ? 'border-red-400/50' : 'border-blue-400/50'}`}
          >
            {t.kind === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 shrink-0 mt-0.5" />
              : t.kind === 'error' ? <XCircle className="w-5 h-5 text-red-500 mr-3 shrink-0 mt-0.5" />
                : <Info className="w-5 h-5 text-blue-500 mr-3 shrink-0 mt-0.5" />}
            <p className="text-sm text-[var(--text-primary)] flex-1 leading-relaxed">{t.msg}</p>
            <button onClick={() => dismissToast(t.id)} className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Modal({ title, icon, onClose, children, width = 'max-w-lg' }: { title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
        className={`bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full ${width} max-h-[88vh] overflow-y-auto`}>
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-secondary)] z-10">
          <div className="flex items-center">{icon}<h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3></div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-secondary)]"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function Confirm({ open, title = '确认操作', message, confirmText = '确认删除', onConfirm, onCancel }: { open: boolean; title?: string; message: string; confirmText?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-4 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-sm hover:bg-[var(--bg-primary)]">取消</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">{confirmText}</button>
        </div>
      </motion.div>
    </div>
  );
}
