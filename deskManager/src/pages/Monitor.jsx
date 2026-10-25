import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Server,
  Cpu,
  HardDrive,
  Clock,
  RotateCw,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  Copy,
  ExternalLink,
  Layers,
  ArrowUpRight,
  Info,
  TrendingUp,
  Trash2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { toast } from 'react-toastify';

// Custom Tooltip for RAM History Area Chart
const RamTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const pt = payload[0].payload;
    return (
      <div className="bg-slate-900/95 text-slate-100 border border-slate-700 px-3 py-2 rounded-lg shadow-xl text-xs space-y-1 font-sans">
        <p className="font-semibold text-slate-400 font-mono text-[11px]">{pt.time}</p>
        <p className="text-emerald-400 font-bold flex items-center justify-between gap-4">
          <span>RAM Utilization:</span>
          <span>{pt.percent}%</span>
        </p>
        <p className="text-slate-300 font-medium flex items-center justify-between gap-4">
          <span>Volume:</span>
          <span>{pt.usedGb} GB / {pt.totalGb} GB</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function Monitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5); // in seconds, 0 = off
  const [lastUpdated, setLastUpdated] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  // Frontend-only state for RAM usage history graph
  const [ramHistory, setRamHistory] = useState([]);

  // Logs modal state
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [logsData, setLogsData] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('out'); // 'out' | 'err'

  const logsEndRef = useRef(null);

  const fetchPM2Data = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/monitor/pm2');
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());

      // Append data point to local RAM time-series history
      if (json.system) {
        const timeLabel = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const pct = parseFloat(json.system.memory_usage_percent) || 0;
        const usedGb = parseFloat(((json.system.used_memory_bytes || 0) / (1024 ** 3)).toFixed(2));
        const totalGb = parseFloat(((json.system.total_memory_bytes || 0) / (1024 ** 3)).toFixed(2));

        setRamHistory((prev) => {
          const next = [
            ...prev,
            {
              time: timeLabel,
              percent: pct,
              usedGb,
              totalGb,
            },
          ];
          // Sliding window: keep up to 40 latest data points
          return next.slice(-40);
        });
      }
    } catch (err) {
      console.error('Error fetching PM2 monitoring data:', err);
      if (isManual) {
        toast.error('Failed to fetch PM2 status. Please verify the backend is running.');
      }
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPM2Data();
  }, [fetchPM2Data]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchPM2Data(false);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchPM2Data]);

  // Fetch process logs
  const fetchLogs = async (processIdentifier) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/monitor/pm2/${processIdentifier}/logs`);
      if (!res.ok) throw new Error('Failed to load logs');
      const json = await res.json();
      setLogsData(json);
    } catch (err) {
      toast.error(`Unable to load logs: ${err.message}`);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenLogs = (proc) => {
    setSelectedProcess(proc);
    setLogsData(null);
    fetchLogs(proc.pm_id);
  };

  const handleProcessAction = async (processId, action) => {
    setActionLoading((prev) => ({ ...prev, [processId]: action }));
    try {
      const res = await fetch(`/api/monitor/pm2/${processId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(result.message || `Process ${action} succeeded`);
        await fetchPM2Data(false);
        if (selectedProcess && selectedProcess.pm_id === processId) {
          fetchLogs(processId);
        }
      } else {
        toast.error(result.error || `Failed to ${action} process`);
      }
    } catch (err) {
      toast.error(`Error executing action: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [processId]: null }));
    }
  };

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.info(`${label} to clipboard!`);
  };

  const processes = data?.processes || [];
  const system = data?.system || {};
  const onlineCount = processes.filter((p) => p.status === 'online').length;
  const stoppedCount = processes.filter((p) => p.status !== 'online').length;

  // Graph metrics calculation
  const currentRamPct =
    ramHistory.length > 0
      ? ramHistory[ramHistory.length - 1].percent
      : parseFloat(system.memory_usage_percent) || 0;
  const peakRamPct =
    ramHistory.length > 0 ? Math.max(...ramHistory.map((h) => h.percent)) : currentRamPct;
  const minRamPct =
    ramHistory.length > 0 ? Math.min(...ramHistory.map((h) => h.percent)) : currentRamPct;
  const avgRamPct =
    ramHistory.length > 0
      ? (ramHistory.reduce((acc, h) => acc + h.percent, 0) / ramHistory.length).toFixed(1)
      : currentRamPct;

  return (
    <div className="flex-1 p-6 bg-[var(--bg-app)] text-slate-900 min-h-screen transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--theme-primary)] text-white shadow-md relative">
              <Activity size={24} />
              {data?.pm2_installed && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 m-0 tracking-tight">System Monitor</h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  PM2 Live
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Live performance telemetry, process state, and daemon logs for Node.js microservices.
              </p>
            </div>
          </div>

          {/* Controls: Refresh interval & Manual Trigger */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 bg-[var(--bg-form)] border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold">Auto:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value={2}>2s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={0}>Off</option>
              </select>
            </div>

            <button
              onClick={() => fetchPM2Data(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-[var(--bg-form)] hover:bg-slate-200 border border-slate-300 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RotateCw size={14} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {lastUpdated && (
              <span className="text-[11px] text-slate-400 font-medium hidden md:inline-block">
                Last: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Telemetry Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: PM2 Services */}
          <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-4 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PM2 Services</span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                <Layers size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{processes.length}</span>
              <span className="text-xs font-semibold text-slate-500">managed</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={13} /> {onlineCount} Online
              </span>
              {stoppedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertTriangle size={13} /> {stoppedCount} Stopped
                </span>
              )}
            </div>
          </div>

          {/* Card 2: CPU Info */}
          <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-4 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CPU Info</span>
              <div className="p-2 rounded-lg bg-violet-50 text-violet-600 border border-violet-200">
                <Cpu size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{system.cpu_count || '--'}</span>
              <span className="text-xs font-semibold text-slate-500">Logical Cores</span>
            </div>
            <p className="mt-3 text-xs text-slate-500 truncate font-medium" title={system.cpu_model}>
              {system.cpu_model || 'Intel/AMD Processor'}
            </p>
          </div>

          {/* Card 3: Memory Usage */}
          <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-4 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System RAM</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                <HardDrive size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{system.memory_usage_percent || 0}%</span>
                <span className="text-xs font-semibold text-slate-500">used</span>
              </div>
              <span className="text-[11px] font-bold text-slate-600">
                {system.used_memory_formatted} / {system.total_memory_formatted}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  Number(system.memory_usage_percent) > 85
                    ? 'bg-red-500'
                    : Number(system.memory_usage_percent) > 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(Number(system.memory_usage_percent) || 0, 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Host System */}
          <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-4 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Host & Uptime</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <Server size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900 truncate" title={system.hostname}>
                {system.hostname || 'Localhost'}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                Uptime: {system.system_uptime_formatted || '--'}
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                Node {system.node_version}
              </span>
            </div>
          </div>

        </div>

        {/* Real-time System RAM Usage History Graph */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-5 shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                <TrendingUp size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 m-0">Live RAM Usage History</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time memory curve recorded in browser state (rolling window of last 40 samples).
                </p>
              </div>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 font-bold text-slate-700">
                Current: <span className="text-emerald-600 font-extrabold">{currentRamPct}%</span>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 font-bold text-slate-700">
                Peak: <span className="text-rose-600 font-extrabold">{peakRamPct}%</span>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 font-bold text-slate-700">
                Min: <span className="text-blue-600 font-extrabold">{minRamPct}%</span>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 font-bold text-slate-700">
                Avg: <span className="text-violet-600 font-extrabold">{avgRamPct}%</span>
              </span>
              {ramHistory.length > 0 && (
                <button
                  onClick={() => setRamHistory([])}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded transition-colors cursor-pointer hover:bg-slate-200"
                  title="Clear in-memory graph points"
                >
                  <Trash2 size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Chart area */}
          <div className="h-64 w-full">
            {ramHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <RotateCw size={20} className="animate-spin text-emerald-500" />
                <span>Waiting for telemetry updates to plot graph...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={ramHistory}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.6} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<RamTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="percent"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#ramGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* PM2 Processes Section */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                <Terminal size={16} />
              </div>
              <h2 className="text-base font-bold text-slate-800 m-0">Managed PM2 Processes</h2>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {processes.length}
              </span>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Click &quot;Logs&quot; to inspect real-time output
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <RotateCw size={24} className="animate-spin text-[var(--theme-secondary)]" />
              <p className="text-sm font-semibold">Reading PM2 process telemetry...</p>
            </div>
          ) : processes.length === 0 ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">No Active PM2 Processes Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  PM2 is running, but no applications have been started yet. Launch your backend on port 5000 using the command below:
                </p>
              </div>

              <div className="max-w-lg mx-auto bg-slate-900 text-emerald-400 rounded-lg p-3 font-mono text-xs flex items-center justify-between border border-slate-800 shadow-inner">
                <span>cd backend &amp;&amp; pm2 start index.js --name deskmanager-backend</span>
                <button
                  onClick={() => copyToClipboard('cd backend && pm2 start index.js --name deskmanager-backend', 'Command copied')}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy command"
                >
                  <Copy size={14} />
                </button>
              </div>

              <button
                onClick={() => fetchPM2Data(true)}
                className="px-4 py-2 text-xs font-bold text-white rounded-lg transition-all cursor-pointer shadow-xs"
                style={{ backgroundColor: 'var(--theme-secondary)' }}
              >
                Check Again
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Process</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">PID</th>
                    <th className="py-3 px-4">CPU</th>
                    <th className="py-3 px-4">Memory</th>
                    <th className="py-3 px-4">Uptime</th>
                    <th className="py-3 px-4">Restarts</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {processes.map((proc) => {
                    const isOnline = proc.status === 'online';
                    const isActing = actionLoading[proc.pm_id];

                    return (
                      <tr
                        key={proc.pm_id}
                        className="hover:bg-slate-50/80 transition-colors duration-150 group"
                      >
                        {/* Process Name & ID */}
                        <td className="py-3 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              #{proc.pm_id}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">
                                {proc.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {proc.exec_mode} | Node {proc.node_version}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              isOnline
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : proc.status === 'errored'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`}
                            />
                            {proc.status}
                          </span>
                        </td>

                        {/* PID */}
                        <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                          {proc.pid || '-'}
                        </td>

                        {/* CPU */}
                        <td className="py-3 px-4 font-bold">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`${
                                proc.cpu > 50
                                  ? 'text-red-600'
                                  : proc.cpu > 20
                                  ? 'text-amber-600'
                                  : 'text-slate-700'
                              }`}
                            >
                              {proc.cpu}%
                            </span>
                          </div>
                        </td>

                        {/* Memory */}
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <div className="flex flex-col">
                            <span className="font-bold">{proc.memory_mb} MB</span>
                            <span className="text-[10px] text-slate-400">
                              {proc.memory_formatted}
                            </span>
                          </div>
                        </td>

                        {/* Uptime */}
                        <td className="py-3 px-4 font-medium text-slate-600">
                          {proc.uptime_formatted}
                        </td>

                        {/* Restarts */}
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                              proc.restarts > 5
                                ? 'bg-red-100 text-red-700'
                                : proc.restarts > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {proc.restarts}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenLogs(proc)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                              title="View stdout / stderr logs"
                            >
                              <Terminal size={12} />
                              Logs
                            </button>

                            <button
                              onClick={() => handleProcessAction(proc.pm_id, isOnline ? 'restart' : 'start')}
                              disabled={Boolean(isActing)}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              title={isOnline ? 'Restart process' : 'Start process'}
                            >
                              <RotateCw
                                size={12}
                                className={isActing ? 'animate-spin' : ''}
                              />
                              {isOnline ? 'Restart' : 'Start'}
                            </button>

                            {isOnline && (
                              <button
                                onClick={() => handleProcessAction(proc.pm_id, 'stop')}
                                disabled={Boolean(isActing)}
                                className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                title="Stop process"
                              >
                                <Square size={12} />
                                Stop
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Helpful Info Banner */}
        <div className="p-4 bg-slate-100/80 border border-slate-300 rounded-xl text-slate-600 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-slate-500 shrink-0" />
            <span>
              Telemetry is read directly from PM2 daemon via <code>pm2 jlist</code>. RAM history graph tracks live memory over time entirely in frontend memory.
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
            Backend Port: 5000
          </span>
        </div>

      </div>

      {/* Logs Modal */}
      {selectedProcess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-emerald-400">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Logs: {selectedProcess.name}
                    <span className="font-mono text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      ID: #{selectedProcess.pm_id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate max-w-md">
                    {activeLogTab === 'out' ? logsData?.out_log_path : logsData?.err_log_path}
                  </p>
                </div>
              </div>

              {/* Tab Selector & Close */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-800 p-0.5 rounded-lg flex items-center text-xs">
                  <button
                    onClick={() => setActiveLogTab('out')}
                    className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      activeLogTab === 'out'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    stdout
                  </button>
                  <button
                    onClick={() => setActiveLogTab('err')}
                    className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      activeLogTab === 'err'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    stderr
                  </button>
                </div>

                <button
                  onClick={() => fetchLogs(selectedProcess.pm_id)}
                  disabled={logsLoading}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Reload logs"
                >
                  <RotateCw size={16} className={logsLoading ? 'animate-spin text-emerald-400' : ''} />
                </button>

                <button
                  onClick={() => {
                    const content = activeLogTab === 'out' ? logsData?.out_logs : logsData?.err_logs;
                    if (content) copyToClipboard(content, 'Logs copied');
                  }}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Copy logs to clipboard"
                >
                  <Copy size={16} />
                </button>

                <button
                  onClick={() => setSelectedProcess(null)}
                  className="px-2.5 py-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body: Console Stream */}
            <div className="flex-1 p-4 bg-slate-950 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[60vh] select-text">
              {logsLoading && !logsData ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RotateCw size={18} className="animate-spin text-emerald-400" />
                  <span>Streaming latest logs...</span>
                </div>
              ) : (
                <pre className={`whitespace-pre-wrap break-all ${activeLogTab === 'err' ? 'text-rose-400' : 'text-slate-300'}`}>
                  {(activeLogTab === 'out' ? logsData?.out_logs : logsData?.err_logs) ||
                    'No logs recorded yet for this process.'}
                </pre>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-[11px] text-slate-400">
              <span>Showing last 80 log lines</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleProcessAction(selectedProcess.pm_id, 'restart')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded cursor-pointer transition-colors"
                >
                  Restart Process
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
