import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw, ShoppingCart, Package, X, Check, Tag } from 'lucide-react';
import { toast } from 'react-toastify';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function ProcessPurchaseOrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryQuotationNo = searchParams.get('quotation_no');
  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [nextPpoNo, setNextPpoNo] = useState('');

  // Stock picker modal state
  const [openStockPickerItemIdx, setOpenStockPickerItemIdx] = useState(null);
  const [stockList, setStockList] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockAllocations, setStockAllocations] = useState({});

  // Header State
  const [formData, setFormData] = useState({
    po_no: '',
    quotation_no: queryQuotationNo || '',
    trade_id: queryTradeId || '',
    po_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    shipping_address: '',
    transport: 0,
    packing_forward: 0,
    gst: 0,
    other: 0
  });

  const [vendorData, setVendorData] = useState(null);
  const [partyData, setPartyData] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, [editingNo, queryQuotationNo, queryTradeId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (editingNo) {
        // Edit mode
        const res = await fetch(`/api/po-process/${encodeURIComponent(editingNo)}`);
        if (!res.ok) throw new Error('Process Purchase Order not found');
        const data = await res.json();

        setFormData({
          po_no: data.po_no,
          quotation_no: data.quotation_no || '',
          trade_id: data.trade_id || '',
          po_date: data.po_date ? data.po_date.split('T')[0] : '',
          delivery_date: data.delivery_date ? data.delivery_date.split('T')[0] : '',
          shipping_address: data.shipping_address || '',
          transport: data.transport || 0,
          packing_forward: data.packing_forward || 0,
          gst: data.gst || 0,
          other: data.other || 0
        });

        // Enrich items with availability stock info
        const enrichedItems = await Promise.all((data.items || []).map(async (it) => {
          let availQty = 0;
          try {
            const availRes = await fetch(`/api/inventory/item/${encodeURIComponent(it.item_code)}/availability`);
            if (availRes.ok) {
              const invData = await availRes.json();
              availQty = invData.available_qty;
            }
          } catch (e) {
            console.error(e);
          }
          return {
            ...it,
            avail_stock: availQty,
            linked_inventory_id: it.linked_inventory_id || null,
            linked_trace_item_id: it.linked_trace_item_id || null
          };
        }));

        setItems(enrichedItems);
      } else {
        // Create mode: fetch next PO number
        const nextRes = await fetch('/api/po-process/next-no');
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          setNextPpoNo(nextData.nextNo);
        }

        // Fetch PRQ details to autofill if quotation_no provided
        if (queryQuotationNo) {
          const prqRes = await fetch(`/api/process-quotations/${encodeURIComponent(queryQuotationNo)}`);
          if (prqRes.ok) {
            const prq = await prqRes.json();
            setVendorData({
              name: prq.buyer_name,
              email: prq.buyer_email,
              phone: prq.buyer_phone
            });
            setPartyData({
              code: prq.customer_id,
              name: prq.customer_name,
              address: prq.customer_address
            });
            setFormData(prev => ({
              ...prev,
              quotation_no: prq.received_quotation_no,
              trade_id: queryTradeId || prq.trade_id,
              shipping_address: prq.customer_address || ''
            }));

            // Process items from PRQ
            const loadedItems = await Promise.all((prq.items || []).map(async (it) => {
              let availQty = 0;
              try {
                const availRes = await fetch(`/api/inventory/item/${encodeURIComponent(it.item_code)}/availability`);
                if (availRes.ok) {
                  const invData = await availRes.json();
                  availQty = invData.available_qty;
                }
              } catch (e) {
                console.error(e);
              }
              return {
                item_code: it.item_code,
                description: it.description || '',
                drawing_number: it.drawing_number || '',
                process_name: it.process_name || '',
                expected_output_code: it.expected_output_code || it.item_code,
                quantity: it.quantity || 1,
                unit_price: it.unit_price || 0,
                gst_rate: 0,
                avail_stock: availQty,
                linked_inventory_id: null,
                linked_trace_item_id: null
              };
            }));

            setItems(loadedItems);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to initialize Process Purchase Order form');
    } finally {
      setIsLoading(false);
    }
  };

  const openStockPicker = async (index) => {
    const targetItem = items[index];
    setOpenStockPickerItemIdx(index);
    setStockLoading(true);
    setStockList([]);
    setStockAllocations({});

    try {
      const res = await fetch(`/api/inventory?q=${encodeURIComponent(targetItem.item_code)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter(inv => inv.item_code === targetItem.item_code && inv.quantity > 0);
        setStockList(filtered.length > 0 ? filtered : data);
      }
    } catch (err) {
      console.error('Error fetching inventory stock for item:', err);
    } finally {
      setStockLoading(false);
    }
  };

  const handleSelectStockRow = (invRow, allocQty) => {
    if (openStockPickerItemIdx === null) return;
    const qty = parseInt(allocQty, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }
    if (qty > invRow.quantity) {
      alert(`Cannot select more than available quantity of ${invRow.quantity}.`);
      return;
    }

    setItems(prev => prev.map((it, idx) => {
      if (idx === openStockPickerItemIdx) {
        return {
          ...it,
          quantity: qty,
          linked_inventory_id: invRow.id,
          linked_trace_item_id: invRow.trace_item_id || invRow.p_item_id || null,
          inv_details: {
            location: invRow.location,
            rack: invRow.rack,
            shelf_number: invRow.shelf_number,
            status: invRow.trace_status || invRow.status
          }
        };
      }
      return it;
    }));

    setOpenStockPickerItemIdx(null);
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      return { ...it, [field]: value };
    }));
  };

  const calculateBasicTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0), 0);
  };

  const calculateGstTotal = () => {
    return items.reduce((sum, item) => {
      const basic = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
      const gstRate = parseFloat(item.gst_rate) || 0;
      return sum + (basic * (gstRate / 100));
    }, 0) + (parseFloat(formData.gst) || 0);
  };

  const calculateGrandTotal = () => {
    const basic = calculateBasicTotal();
    const gstTotal = calculateGstTotal();
    const transport = parseFloat(formData.transport) || 0;
    const packing = parseFloat(formData.packing_forward) || 0;
    const other = parseFloat(formData.other) || 0;
    return basic + gstTotal + transport + packing + other;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.delivery_date) {
      setError('Date of Delivery is required.');
      return;
    }

    if (!formData.shipping_address.trim()) {
      setError('Shipping / Delivery Address is required.');
      return;
    }

    // MANDATORY Source Item Stock Validation
    for (const item of items) {
      if (!item.linked_inventory_id) {
        setError(`Mandatory: You must select and link inventory stock for source item ${item.item_code}. Source item must be present in inventory.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        po_no: editingNo ? editingNo : formData.po_no,
        quotation_no: formData.quotation_no,
        trade_id: formData.trade_id,
        po_date: formData.po_date,
        delivery_date: formData.delivery_date,
        shipping_address: formData.shipping_address,
        basic_value: calculateBasicTotal(),
        gst: calculateGstTotal(),
        transport: parseFloat(formData.transport) || 0,
        packing_forward: parseFloat(formData.packing_forward) || 0,
        other: parseFloat(formData.other) || 0,
        items: items.map(it => ({
          item_code: it.item_code,
          process_name: it.process_name,
          expected_output_code: it.expected_output_code || it.item_code,
          quantity: parseInt(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          gst_rate: parseFloat(it.gst_rate) || 0,
          linked_inventory_id: it.linked_inventory_id,
          linked_trace_item_id: it.linked_trace_item_id
        }))
      };

      const url = editingNo ? `/api/po-process/${encodeURIComponent(editingNo)}` : '/api/po-process';
      const method = editingNo ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save Process Purchase Order');
      }

      toast.success(`Process Purchase Order ${editingNo ? 'updated' : 'created'} successfully!`);
      if (formData.trade_id) {
        navigate(`/trade/${encodeURIComponent(formData.trade_id)}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error saving Process Purchase Order');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-2">
        <RefreshCw className="animate-spin text-amber-600" size={24} />
        <p className="text-xs font-semibold text-slate-500">Loading Process Purchase Order details…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 flex items-center justify-center">
      <div className="max-w-5xl w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 space-y-6">
        
        {/* Header */}
        <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-950 m-0 flex items-center gap-2">
              <ShoppingCart size={22} className="text-amber-600" />
              {editingNo ? 'Modify Process Purchase Order' : 'Create Process Purchase Order'}
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Raise a Purchase Order for manufacturing process items. <b className="text-amber-700">Source items must be present in Inventory stock.</b>
            </p>
          </div>
          <button
            type="button"
            onClick={() => formData.trade_id ? navigate(`/trade/${formData.trade_id}`) : navigate('/dashboard')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors self-start sm:self-center"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs font-bold text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Header Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>PO Number</label>
              <input
                type="text"
                disabled={!!editingNo}
                placeholder={nextPpoNo ? `e.g. PPO-XXXX (Leave blank for ${nextPpoNo})` : "Enter PO No..."}
                value={formData.po_no}
                onChange={(e) => setFormData(prev => ({ ...prev, po_no: e.target.value }))}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                {editingNo ? 'PO No cannot be changed.' : 'Leave blank for auto-generated number.'}
              </p>
            </div>

            <div>
              <label className={labelCls}>PO Date <b className="text-red-500">*</b></label>
              <input
                type="date"
                required
                value={formData.po_date}
                onChange={(e) => setFormData(prev => ({ ...prev, po_date: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Delivery Date <b className="text-red-500">*</b></label>
              <input
                type="date"
                required
                value={formData.delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Ref Trade ID</label>
              <input
                type="text"
                disabled
                value={formData.trade_id}
                className={`${inputCls} font-mono font-bold text-slate-700`}
              />
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <label className={labelCls}>Delivery / Shipping Address <b className="text-red-500">*</b></label>
            <textarea
              rows={2}
              required
              placeholder="Enter complete shipping and delivery address..."
              value={formData.shipping_address}
              onChange={(e) => setFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Vendor & Customer Summary Cards */}
          {(vendorData || partyData) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vendorData && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Process Vendor</span>
                  <div className="text-xs font-bold text-slate-900">{vendorData.name}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{vendorData.email} &bull; {vendorData.phone}</div>
                </div>
              )}
              {partyData && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Party / Customer</span>
                  <div className="text-xs font-bold text-slate-900">[{partyData.code}] {partyData.name}</div>
                  <div className="text-[10px] text-slate-500 font-semibold truncate">{partyData.address}</div>
                </div>
              )}
            </div>
          )}

          {/* Process PO Line Items */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                Process Items &amp; Inventory Trace Allocation ({items.length})
              </h2>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl p-4 transition-colors space-y-3 ${
                    item.linked_inventory_id 
                      ? 'bg-emerald-50/20 border-emerald-300' 
                      : 'bg-amber-50/10 border-amber-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded border bg-slate-100 border-slate-200 text-slate-900">
                          Source Item: {item.item_code}
                        </span>
                        {item.avail_stock > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 border border-emerald-300 text-emerald-800">
                            <Package size={10} /> Stock Available: {item.avail_stock}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 border border-rose-300 text-rose-800">
                            <AlertCircle size={10} /> Stock Missing
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-1">{item.description}</p>
                    </div>

                    {/* Inventory Trace Stock Link Button */}
                    <button
                      type="button"
                      onClick={() => openStockPicker(idx)}
                      className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 ${
                        item.linked_inventory_id 
                          ? 'bg-emerald-700 text-white hover:bg-emerald-800' 
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      <Package size={14} />
                      {item.linked_inventory_id 
                        ? `Allocated Stock TR-${item.linked_trace_item_id || 'Item'}` 
                        : 'Select Trace / Inventory Stock'}
                    </button>
                  </div>

                  {/* Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Process Name</label>
                      <input
                        type="text"
                        value={item.process_name || ''}
                        onChange={(e) => handleItemChange(idx, 'process_name', e.target.value)}
                        placeholder="e.g. Anodizing"
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Output Code</label>
                      <input
                        type="text"
                        value={item.expected_output_code || ''}
                        onChange={(e) => handleItemChange(idx, 'expected_output_code', e.target.value)}
                        placeholder={`Same as ${item.item_code}`}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Quantity <b className="text-red-500">*</b></label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-slate-800 text-right focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Price / Pc (₹) <b className="text-red-500">*</b></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-slate-800 text-right focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">GST Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.gst_rate}
                        onChange={(e) => handleItemChange(idx, 'gst_rate', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-slate-800 text-right focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-center py-6 text-slate-400 text-xs font-semibold">No items loaded from Process Quotation.</p>
              )}
            </div>
          </div>

          {/* Charges & Financial Totals */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Charges &amp; Totals</span>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Transport</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.transport}
                  onChange={(e) => setFormData(prev => ({ ...prev, transport: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Packing &amp; Forwarding</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.packing_forward}
                  onChange={(e) => setFormData(prev => ({ ...prev, packing_forward: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Additional GST</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.gst}
                  onChange={(e) => setFormData(prev => ({ ...prev, gst: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Other Charges</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.other}
                  onChange={(e) => setFormData(prev => ({ ...prev, other: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div className="flex flex-col bg-white border border-slate-200 rounded p-2.5">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Items Basic Total</span>
                <span className="text-base font-bold text-slate-800 mt-0.5">
                  ₹{calculateBasicTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex flex-col bg-amber-50 border border-amber-200 rounded p-2.5">
                <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-widest">Grand Total PO Value</span>
                <span className="text-base font-black text-amber-900 mt-0.5">
                  ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => formData.trade_id ? navigate(`/trade/${formData.trade_id}`) : navigate('/dashboard')}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              {isSaving ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : 'Save Process Purchase Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Stock Selection Modal */}
      {openStockPickerItemIdx !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Package size={18} className="text-amber-600" />
                  Select Source Item Stock from Inventory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                  Source Item Code: <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{items[openStockPickerItemIdx].item_code}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenStockPickerItemIdx(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {stockLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold animate-pulse flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-amber-600" />
                Loading inventory stock...
              </div>
            ) : stockList.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <AlertCircle size={24} className="mx-auto text-amber-500" />
                <p className="m-0 font-bold text-slate-800">No active inventory stock found for source item {items[openStockPickerItemIdx].item_code}.</p>
                <p className="text-[11px] text-slate-400 font-normal">Please add stock in Inventory before creating a Process PO for this item.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-3.5 py-2.5">Item Code</th>
                      <th className="px-3.5 py-2.5">Location</th>
                      <th className="px-3.5 py-2.5 text-right">Available Qty</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right w-28">Select Qty</th>
                      <th className="px-3.5 py-2.5 text-center w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-800">
                    {stockList.map((inv) => {
                      const st = inv.trace_status || inv.status || 'active';
                      const allocQty = stockAllocations[inv.id] !== undefined ? stockAllocations[inv.id] : items[openStockPickerItemIdx].quantity;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                            {inv.item_code}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-slate-900">{inv.location || '—'}</div>
                            {(inv.rack || inv.shelf_number) && (
                              <div className="text-[10px] text-slate-500">
                                {inv.rack && `Rack: ${inv.rack}`} {inv.rack && inv.shelf_number && '|'} {inv.shelf_number && `Shelf: ${inv.shelf_number}`}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                            {inv.quantity || 0}
                          </td>
                          <td className="px-3.5 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {st}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <input
                              type="number"
                              min="1"
                              max={inv.quantity}
                              value={allocQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setStockAllocations(prev => ({ ...prev, [inv.id]: val }));
                              }}
                              className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                            />
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSelectStockRow(inv, allocQty)}
                              disabled={allocQty <= 0 || allocQty > inv.quantity}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                            >
                              Select Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenStockPickerItemIdx(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
