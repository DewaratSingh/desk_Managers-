import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import BuyDeliveryNoteForm from './buy/BuyDeliveryNoteForm';
import BuyProcessDeliveryNoteForm from './buy_process/BuyProcessDeliveryNoteForm';
import SellDeliveryNoteForm from './sell/SellDeliveryNoteForm';

const isSellSide = (t) => {
  const norm = (t || '').toLowerCase().replace(/[\s_]+/g, '');
  return norm === 'sell' || norm === 'sellarc' || norm.includes('sell');
};

const isProcessSide = (t) => {
  const norm = (t || '').toLowerCase().replace(/[\s_]+/g, '');
  return norm === 'process' || norm === 'buyprocess';
};

export default function DeliveryNoteDispatcher() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || null;

  const [tradeType, setTradeType] = useState(
    location.state?.tradeType || location.state?.returnState?.tradeType || null
  );
  const [resolvedTradeId, setResolvedTradeId] = useState(queryTradeId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const determineTradeType = async () => {
      setLoading(true);
      setError(null);

      try {
        if (editingNo) {
          // Fetch existing delivery note to resolve trade_type and trade_id
          const res = await fetch(`/api/delivery-notes/${encodeURIComponent(editingNo)}`);
          if (!res.ok) throw new Error('Delivery Note not found.');
          const data = await res.json();
          if (isMounted) {
            setTradeType(data.trade_type || 'sell');
            setResolvedTradeId(data.trade_id || '');
          }
        } else if (queryTradeId) {
          // In create mode, if tradeType not in state, query items-lookup for trade_type
          if (!tradeType) {
            const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(queryTradeId)}`);
            if (!lookupRes.ok) throw new Error('Failed to load trade details.');
            const lookupData = await lookupRes.json();
            if (isMounted) {
              setTradeType(lookupData.trade_type || 'sell');
              setResolvedTradeId(queryTradeId);
            }
          }
        } else if (!location.state?.returnState) {
          throw new Error('trade_id parameter or delivery note id is required.');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to detect Delivery Note trade type.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    determineTradeType();

    return () => {
      isMounted = false;
    };
  }, [editingNo, queryTradeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin text-indigo-600" size={24} style={{ color: 'var(--theme-color)' }} />
          <p className="text-xs font-semibold text-slate-500">Preparing Delivery Note…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-md w-full space-y-4 text-center">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Unable to Open Delivery Note</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={12} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isProcessSide(tradeType)) {
    return <BuyProcessDeliveryNoteForm editingNo={editingNo} tradeId={resolvedTradeId} />;
  }

  if (isSellSide(tradeType)) {
    return <SellDeliveryNoteForm editingNo={editingNo} tradeId={resolvedTradeId} />;
  }

  // Default to Buy Delivery Note
  return <BuyDeliveryNoteForm editingNo={editingNo} tradeId={resolvedTradeId} />;
}
