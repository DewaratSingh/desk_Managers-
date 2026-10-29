import React, { useState, useEffect, useRef } from 'react';
import { Layers, Search, Plus, Trash2, X, RefreshCw, CheckCircle2, Factory, ArrowRightLeft } from 'lucide-react';
import { toast } from 'react-toastify';

export default function LinkOperationModal({
  isOpen,
  onClose,
  itemType, // 'po' | 'ro'
  itemId,
  itemCode,
  itemDescription,
  initialLinks = [],
  onSaveSuccess
}) {
  const [activeTab, setActiveTab] = useState('TRADE'); // 'TRADE' | 'MANUFACTURE'
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const [availableTrades, setAvailableTrades] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [hasMoreTrades, setHasMoreTrades] = useState(false);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [loadingMoreTrades, setLoadingMoreTrades] = useState(false);
  const [loadingMoreJobs, setLoadingMoreJobs] = useState(false);
  const [totalTrades, setTotalTrades] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);

  // Selected linked operations (list of objects: { operation_type, trade_id, trade_ref, job_id, job_ref, display_ref, live_status, progress_pct })
  const [selectedLinks, setSelectedLinks] = useState([]);

  const isInitialSearch = useRef(true);

  // Fetch Trades (initial, server search, or show more)
  const fetchTrades = async (isLoadMore = false, query = searchQuery) => {
    if (isLoadMore) {
      setLoadingMoreTrades(true);
    } else {
      setLoadingAvailable(true);
    }
    try {
      const currentOffset = isLoadMore ? availableTrades.length : 0;
      const res = await fetch(`/api/link-operations/available?type=TRADE&limit=5&offset=${currentOffset}&q=${encodeURIComponent((query || '').trim())}`);
      if (res.ok) {
        const data = await res.json();
        const incoming = Array.isArray(data.trades) ? data.trades : [];
        if (isLoadMore) {
          setAvailableTrades(prev => [...prev, ...incoming]);
        } else {
          setAvailableTrades(incoming);
        }
        setHasMoreTrades(Boolean(data.hasMoreTrades));
        if (data.totalTrades !== undefined) setTotalTrades(data.totalTrades);
      } else {
        toast.error('Failed to load trades');
      }
    } catch (err) {
      console.error('Failed to load trades:', err);
      toast.error('Failed to load trades');
    } finally {
      setLoadingAvailable(false);
      setLoadingMoreTrades(false);
    }
  };

  // Fetch Manufacture Jobs (initial, server search, or show more)
  const fetchJobs = async (isLoadMore = false, query = searchQuery) => {
    if (isLoadMore) {
      setLoadingMoreJobs(true);
    } else {
      setLoadingAvailable(true);
    }
    try {
      const currentOffset = isLoadMore ? availableJobs.length : 0;
      const res = await fetch(`/api/link-operations/available?type=MANUFACTURE&limit=5&offset=${currentOffset}&q=${encodeURIComponent((query || '').trim())}`);
      if (res.ok) {
        const data = await res.json();
        const incoming = Array.isArray(data.jobs) ? data.jobs : [];
        if (isLoadMore) {
          setAvailableJobs(prev => [...prev, ...incoming]);
        } else {
          setAvailableJobs(incoming);
        }
        setHasMoreJobs(Boolean(data.hasMoreJobs));
        if (data.totalJobs !== undefined) setTotalJobs(data.totalJobs);
      } else {
        toast.error('Failed to load manufacture jobs');
      }
    } catch (err) {
      console.error('Failed to load manufacture jobs:', err);
      toast.error('Failed to load manufacture jobs');
    } finally {
      setLoadingAvailable(false);
      setLoadingMoreJobs(false);
    }
  };

  // Switch tabs cleanly
  const handleTabChange = (newTab) => {
    if (activeTab === newTab) return;
    setActiveTab(newTab);
    if (searchQuery !== '') {
      setSearchQuery('');
    } else {
      if (newTab === 'TRADE') {
        fetchTrades(false, '');
      } else {
        fetchJobs(false, '');
      }
    }
  };

  // Fetch available trades and jobs when modal opens
  useEffect(() => {
    if (!isOpen) {
      isInitialSearch.current = true;
      return;
    }

    setSearchQuery('');
    isInitialSearch.current = true;

    // Initialize selected links from props or normalize
    const initial = (initialLinks || []).map(link => ({
      id: link.id,
      operation_type: link.operation_type || 'TRADE',
      trade_id: link.trade_id,
      trade_ref: link.trade_ref || (link.trade_id ? String(link.trade_id) : ''),
      job_id: link.job_id,
      job_ref: link.job_ref || (link.job_id ? `Job #${link.job_id}` : ''),
      display_ref: link.display_ref || link.trade_ref || link.job_ref || (link.trade_id ? `Trade #${link.trade_id}` : link.job_id ? `Job #${link.job_id}` : 'Operation'),
      live_status: link.live_status || link.trade_status || link.job_status || 'Pending',
      progress_pct: link.progress_pct !== undefined ? link.progress_pct : (link.trade_delivery_percentage || link.job_delivery_pct || 0)
    }));
    setSelectedLinks(initial);

    // If itemId is provided, also fetch fresh links from server
    if (itemId && itemType) {
      fetch(`/api/link-operations/items/${itemType}/${itemId}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setSelectedLinks(data);
          }
        })
        .catch(() => {});
    }

    // Fetch initial 5 available trades & jobs from server
    setLoadingAvailable(true);
    fetch('/api/link-operations/available?limit=5&offset=0')
      .then(res => res.ok ? res.json() : { trades: [], jobs: [] })
      .then(data => {
        setAvailableTrades(data.trades || []);
        setAvailableJobs(data.jobs || []);
        setHasMoreTrades(Boolean(data.hasMoreTrades));
        setHasMoreJobs(Boolean(data.hasMoreJobs));
        setTotalTrades(data.totalTrades || (data.trades || []).length);
        setTotalJobs(data.totalJobs || (data.jobs || []).length);
      })
      .catch(err => {
        console.error('Failed to load available operations:', err);
        toast.error('Failed to load available operations');
      })
      .finally(() => {
        setLoadingAvailable(false);
      });
  }, [isOpen, itemId, itemType]);

  // Debounced server search for Trade or Manufacture Job
  useEffect(() => {
    if (!isOpen) {
      isInitialSearch.current = true;
      return;
    }
    if (isInitialSearch.current) {
      isInitialSearch.current = false;
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      if (activeTab === 'TRADE') {
        fetchTrades(false, searchQuery);
      } else {
        fetchJobs(false, searchQuery);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  if (!isOpen) return null;

  // Format trade status / delivery progress
  const formatTradeStatus = (trade) => {
    const pct = parseFloat(trade.delivery_percentage) || 0;
    const stat = (trade.status || 'ordered').toLowerCase();
    if (pct >= 100 || stat === 'delivered' || stat === 'completed') {
      return { text: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (pct > 0 || stat.includes('partial')) {
      return { text: `Delivery ${pct}%`, color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    return { text: trade.status || 'Ordered', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  };

  // Format job status (uses real manufacture status)
  const formatJobStatus = (job) => {
    const rawStat = job.status || 'pending';
    const stat = rawStat.toLowerCase();
    const formattedStat = rawStat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (stat === 'completed' || stat === 'done') {
      return { text: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (stat.includes('progress')) {
      return { text: formattedStat, color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    }
    return { text: formattedStat, color: 'bg-slate-100 text-slate-800 border-slate-300' };
  };

  // Check if an item is already linked
  const isTradeLinked = (trade) => {
    return selectedLinks.some(
      link => link.operation_type === 'TRADE' &&
      (String(link.trade_id) === String(trade.id) || link.trade_ref === trade.trade_id)
    );
  };

  const isJobLinked = (job) => {
    return selectedLinks.some(
      link => link.operation_type === 'MANUFACTURE' &&
      (String(link.job_id) === String(job.id) || link.job_ref === job.process_name)
    );
  };

  // Add a Trade link
  const handleAddTrade = (trade) => {
    if (isTradeLinked(trade)) return;
    const statInfo = formatTradeStatus(trade);
    const newLink = {
      operation_type: 'TRADE',
      trade_id: trade.id,
      trade_ref: trade.trade_id,
      display_ref: trade.trade_id || `Trade #${trade.id}`,
      live_status: statInfo.text,
      progress_pct: parseFloat(trade.delivery_percentage) || 0
    };
    setSelectedLinks(prev => [...prev, newLink]);
  };

  // Add a Job link
  const handleAddJob = (job) => {
    if (isJobLinked(job)) return;
    const statInfo = formatJobStatus(job);
    const newLink = {
      operation_type: 'MANUFACTURE',
      job_id: job.id,
      job_ref: job.process_name || `Job #${job.id}`,
      display_ref: job.process_name || `Job #${job.id}`,
      live_status: statInfo.text,
      progress_pct: parseFloat(job.delivery_pct) || 0
    };
    setSelectedLinks(prev => [...prev, newLink]);
  };

  // Manual Add using the single search / input bar
  const handleManualAdd = (e) => {
    if (e) e.preventDefault();
    const val = searchQuery.trim();
    if (!val) return;

    if (activeTab === 'TRADE') {
      const exists = selectedLinks.some(
        l => l.operation_type === 'TRADE' &&
        (l.trade_ref?.toLowerCase() === val.toLowerCase() || String(l.trade_id) === val)
      );
      if (exists) {
        toast.warning('Trade is already added');
        return;
      }
      setSelectedLinks(prev => [...prev, {
        operation_type: 'TRADE',
        trade_ref: val,
        display_ref: val,
        live_status: 'Linked',
        progress_pct: 0
      }]);
    } else {
      const exists = selectedLinks.some(
        l => l.operation_type === 'MANUFACTURE' &&
        (l.job_ref?.toLowerCase() === val.toLowerCase() || String(l.job_id) === val)
      );
      if (exists) {
        toast.warning('Job is already added');
        return;
      }
      setSelectedLinks(prev => [...prev, {
        operation_type: 'MANUFACTURE',
        job_ref: val,
        display_ref: val,
        live_status: 'Linked',
        progress_pct: 0
      }]);
    }
    setSearchQuery('');
  };

  // Remove a link
  const handleRemoveLink = (index) => {
    setSelectedLinks(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save changes
  const handleSave = async () => {
    if (!itemId) {
      // If creating in-memory before order is saved
      if (onSaveSuccess) onSaveSuccess(selectedLinks);
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/link-operations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType,
          itemId,
          operations: selectedLinks
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save linked operations');
      }

      const updated = await res.json();
      toast.success('Linked operations updated successfully');
      if (onSaveSuccess) onSaveSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Error saving links:', err);
      toast.error(err.message || 'Error saving linked operations');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--theme-color)]/10 text-[var(--theme-color)] flex items-center justify-center font-bold">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Link Operations (Trade / Manufacture)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {itemCode ? <span className="font-mono font-bold text-slate-700">{itemCode}</span> : null}
                {itemDescription ? ` — ${itemDescription}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Currently Linked Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Linked Operations ({selectedLinks.length})
              </label>
              <span className="text-[11px] text-slate-500">
                Item status is computed from these operations
              </span>
            </div>

            {selectedLinks.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/60 text-center text-xs text-slate-500">
                No operations linked yet. Select Trades or Manufacture Jobs below to link.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedLinks.map((link, idx) => {
                  const isTrade = link.operation_type === 'TRADE';
                  const refName = link.display_ref || link.trade_ref || link.job_ref || `Op #${idx + 1}`;
                  const statText = link.live_status || (link.progress_pct > 0 ? `Delivery ${link.progress_pct}%` : 'Pending');

                  return (
                    <div
                      key={`linked-${idx}-${link.id || refName}`}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`p-1.5 rounded-lg shrink-0 ${isTrade ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {isTrade ? <ArrowRightLeft size={14} /> : <Factory size={14} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold font-mono text-slate-900 truncate">
                              {refName}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              {isTrade ? 'Trade' : 'Job'}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-600 truncate mt-0.5">
                            Status: <span className="text-slate-800 font-bold">{statText}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                        title="Remove link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="border-slate-200" />

          {/* Operation Type Switcher */}
          <div>
            <div className="flex border-b border-slate-200 mb-3">
              <button
                type="button"
                onClick={() => handleTabChange('TRADE')}
                className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'TRADE'
                    ? 'border-[var(--theme-color)] text-[var(--theme-color)]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <ArrowRightLeft size={14} />
                Trades ({totalTrades > 0 ? totalTrades : availableTrades.length})
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('MANUFACTURE')}
                className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'MANUFACTURE'
                    ? 'border-[var(--theme-color)] text-[var(--theme-color)]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Factory size={14} />
                Manufacture Jobs ({totalJobs > 0 ? totalJobs : availableJobs.length})
              </button>
            </div>

            {/* Single Unified Search & Add Bar */}
            <form onSubmit={handleManualAdd} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'TRADE'
                      ? 'Search trades or enter custom Trade ID (e.g. TRD-001)...'
                      : 'Search jobs or enter custom Job Ref / Name...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                title="Add as custom linked operation"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus size={13} /> Add
              </button>
            </form>

            {/* List of Available Items (Server paginated: limit 5 with Show More) */}
            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-slate-50/40">
              {loadingAvailable ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Loading available operations...
                </div>
              ) : activeTab === 'TRADE' ? (
                availableTrades.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No matching trades found
                  </div>
                ) : (
                  <div>
                    <div className="divide-y divide-slate-100">
                      {availableTrades.map((trade) => {
                        const linked = isTradeLinked(trade);
                        const stat = formatTradeStatus(trade);
                        return (
                          <div
                            key={`trade-${trade.id}`}
                            className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                              linked ? 'bg-emerald-50/40' : 'hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-slate-800">{trade.trade_id || `Trade #${trade.id}`}</span>
                                <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.2 bg-slate-100 rounded border border-slate-200">
                                  {(trade.trade_type || 'Trade').replace(/_/g, ' ')}
                                </span>
                                {trade.process_name && (
                                  <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded" title={`Process: ${trade.process_name}`}>
                                    ⚙ {trade.process_name}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stat.color}`}>
                                  {stat.text}
                                </span>
                              </div>
                            </div>

                            {linked ? (
                              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 shrink-0 ml-2">
                                <CheckCircle2 size={14} /> Linked
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddTrade(trade)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 ml-2"
                              >
                                <Plus size={13} /> Link
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Show More Button for Trades */}
                    {hasMoreTrades && (
                      <div className="p-2.5 border-t border-slate-200 flex justify-center bg-slate-50/60">
                        <button
                          type="button"
                          onClick={() => fetchTrades(true, searchQuery)}
                          disabled={loadingMoreTrades || loadingAvailable}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingMoreTrades ? (
                            <>
                              <RefreshCw size={13} className="animate-spin text-slate-400" />
                              <span>Loading more...</span>
                            </>
                          ) : (
                            <>
                              <span>Show More</span>
                              {totalTrades > 0 && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({availableTrades.length} of {totalTrades})
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                availableJobs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No matching manufacture jobs found
                  </div>
                ) : (
                  <div>
                    <div className="divide-y divide-slate-100">
                      {availableJobs.map((job) => {
                        const linked = isJobLinked(job);
                        const stat = formatJobStatus(job);
                        return (
                          <div
                            key={`job-${job.id}`}
                            className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                              linked ? 'bg-emerald-50/40' : 'hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">{job.process_name || `Job #${job.id}`}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stat.color}`}>
                                  {stat.text}
                                </span>
                              </div>
                            </div>

                            {linked ? (
                              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 shrink-0 ml-2">
                                <CheckCircle2 size={14} /> Linked
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddJob(job)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 ml-2"
                              >
                                <Plus size={13} /> Link
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Show More Button for Manufacture Jobs */}
                    {hasMoreJobs && (
                      <div className="p-2.5 border-t border-slate-200 flex justify-center bg-slate-50/60">
                        <button
                          type="button"
                          onClick={() => fetchJobs(true, searchQuery)}
                          disabled={loadingMoreJobs || loadingAvailable}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingMoreJobs ? (
                            <>
                              <RefreshCw size={13} className="animate-spin text-slate-400" />
                              <span>Loading more...</span>
                            </>
                          ) : (
                            <>
                              <span>Show More</span>
                              {totalJobs > 0 && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({availableJobs.length} of {totalJobs})
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-color)' }}
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> Save Linked Operations
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
