import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  CheckSquare,
  Square,
  FileText
} from 'lucide-react';

const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const EMPTY_FORM = {
  invoice_no: '',
  invoice_date: '',
  delivery_note_no: '',
  po_no: '',
  ro_no: '',
  dispatch_doc_no: '',
  dispatch_through: '',
  motor_vehicle_no: ''
};

export default function InvoiceView({
  invoices = [],
  onAddInvoice,
  onUpdateInvoice,
  isLoading,
  fetchMoreData,
  searchResource,
  onCancel
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode]   = useState('list');
  const [formData, setFormData]   = useState(EMPTY_FORM);
  const [editingNo, setEditingNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!location.state) return;

    const { prefillPoNo, prefillRoNo, prefillDnNo, editInvoiceNo } = location.state;

    if (prefillDnNo) {
      const fetchAndPrefill = async () => {
        try {
          const savedToken = localStorage.getItem('dm_token');
          const headers = { 'Authorization': `Bearer ${savedToken}` };
          const res = await fetch(`${API_BASE_URL}/delivery-notes?search=${encodeURIComponent(prefillDnNo)}&limit=5`, { headers });
          if (res.ok) {
            const data = await res.json();
            const matchedDn = data.find(dn => dn.delivery_note_no === prefillDnNo);
            if (matchedDn) {
              setEditingNo(null);
              setLinkType('dn');
              setFormData({
                ...EMPTY_FORM,
                invoice_date: new Date().toISOString().slice(0, 10),
                delivery_note_no: matchedDn.delivery_note_no
              });
              setDnInput(matchedDn.delivery_note_no);
              setSelectedDn(matchedDn);
              
              if (Array.isArray(matchedDn.items)) {
                setInvItems(matchedDn.items.map(i => ({
                  item_code: i.item_code,
                  description: i.description || '',
                  drawing_number: i.drawing_number || '',
                  quantity: i.quantity || 1,
                  rate_per_piece: i.rate_per_piece || '0.00',
                  shipping_address: i.shipping_address || '',
                  delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                  checked: true
                })));
              }
              setViewMode('form');
            } else {
              alert(`Delivery Note ${prefillDnNo} was not found.`);
            }
          }
        } catch (err) {
          console.error('Error prefilling DN in Invoice View:', err);
        }
      };
      fetchAndPrefill();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (prefillPoNo) {
      const fetchAndPrefill = async () => {
        try {
          const savedToken = localStorage.getItem('dm_token');
          const headers = { 'Authorization': `Bearer ${savedToken}` };
          const res = await fetch(`${API_BASE_URL}/delivery-notes?search=${encodeURIComponent(prefillPoNo)}&limit=5`, { headers });
          let matchedDn = null;
          if (res.ok) {
            const data = await res.json();
            matchedDn = data.find(dn => dn.po_no === prefillPoNo);
          }
          if (matchedDn) {
            setEditingNo(null);
            setLinkType('dn');
            setFormData({
              ...EMPTY_FORM,
              invoice_date: new Date().toISOString().slice(0, 10),
              delivery_note_no: matchedDn.delivery_note_no
            });
            setDnInput(matchedDn.delivery_note_no);
            setSelectedDn(matchedDn);
            
            if (Array.isArray(matchedDn.items)) {
              setInvItems(matchedDn.items.map(i => ({
                item_code: i.item_code,
                description: i.description || '',
                drawing_number: i.drawing_number || '',
                quantity: i.quantity || 1,
                rate_per_piece: i.rate_per_piece || '0.00',
                shipping_address: i.shipping_address || '',
                delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                checked: true
              })));
            }
            setViewMode('form');
          } else {
            // Fetch PO directly
            const poRes = await fetch(`${API_BASE_URL}/purchase-orders?search=${encodeURIComponent(prefillPoNo)}&limit=5`, { headers });
            if (poRes.ok) {
              const poData = await poRes.json();
              const matchedPo = poData.find(p => p.po_no === prefillPoNo);
              if (matchedPo) {
                setEditingNo(null);
                setLinkType('po');
                setFormData({
                  ...EMPTY_FORM,
                  invoice_date: new Date().toISOString().slice(0, 10),
                  po_no: matchedPo.po_no
                });
                setPoInput(matchedPo.po_no);
                setSelectedPo(matchedPo);
                if (Array.isArray(matchedPo.items)) {
                  setInvItems(matchedPo.items.map(i => ({
                    item_code: i.item_code,
                    description: i.description || '',
                    drawing_number: i.drawing_number || '',
                    quantity: i.quantity || 1,
                    rate_per_piece: i.unit_price || '0.00',
                    shipping_address: i.shipping_address || '',
                    delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                    checked: true
                  })));
                }
                setViewMode('form');
              } else {
                alert(`No Purchase Order ${prefillPoNo} was found.`);
              }
            }
          }
        } catch (err) {
          console.error('Error prefilling PO in Invoice View:', err);
        }
      };
      fetchAndPrefill();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (prefillRoNo) {
      const fetchAndPrefill = async () => {
        try {
          const savedToken = localStorage.getItem('dm_token');
          const headers = { 'Authorization': `Bearer ${savedToken}` };
          const res = await fetch(`${API_BASE_URL}/delivery-notes?search=${encodeURIComponent(prefillRoNo)}&limit=5`, { headers });
          let matchedDn = null;
          if (res.ok) {
            const data = await res.json();
            matchedDn = data.find(dn => dn.ro_no === prefillRoNo);
          }
          if (matchedDn) {
            setEditingNo(null);
            setLinkType('dn');
            setFormData({
              ...EMPTY_FORM,
              invoice_date: new Date().toISOString().slice(0, 10),
              delivery_note_no: matchedDn.delivery_note_no
            });
            setDnInput(matchedDn.delivery_note_no);
            setSelectedDn(matchedDn);
            
            if (Array.isArray(matchedDn.items)) {
              setInvItems(matchedDn.items.map(i => ({
                item_code: i.item_code,
                description: i.description || '',
                drawing_number: i.drawing_number || '',
                quantity: i.quantity || 1,
                rate_per_piece: i.rate_per_piece || '0.00',
                shipping_address: i.shipping_address || '',
                delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                checked: true
              })));
            }
            setViewMode('form');
          } else {
            // Fetch RO directly
            const roRes = await fetch(`${API_BASE_URL}/release-orders?search=${encodeURIComponent(prefillRoNo)}&limit=5`, { headers });
            if (roRes.ok) {
              const roData = await roRes.json();
              const matchedRo = roData.find(r => r.ro_no === prefillRoNo);
              if (matchedRo) {
                setEditingNo(null);
                setLinkType('ro');
                setFormData({
                  ...EMPTY_FORM,
                  invoice_date: new Date().toISOString().slice(0, 10),
                  ro_no: matchedRo.ro_no
                });
                setRoInput(matchedRo.ro_no);
                setSelectedRo(matchedRo);
                if (Array.isArray(matchedRo.items)) {
                  setInvItems(matchedRo.items.map(i => ({
                    item_code: i.item_code,
                    description: i.description || '',
                    drawing_number: i.drawing_number || '',
                    quantity: i.quantity || 1,
                    rate_per_piece: i.unit_price || '0.00',
                    shipping_address: i.shipping_address || '',
                    delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                    checked: true
                  })));
                }
                setViewMode('form');
              } else {
                alert(`No Release Order ${prefillRoNo} was found.`);
              }
            }
          }
        } catch (err) {
          console.error('Error prefilling RO in Invoice View:', err);
        }
      };
      fetchAndPrefill();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (editInvoiceNo) {
      const inv = invoices.find(i => i.invoice_no === editInvoiceNo);
      if (inv) {
        handleEditClick(inv);
      } else {
        const fetchAndEdit = async () => {
          try {
            const savedToken = localStorage.getItem('dm_token');
            const headers = { 'Authorization': `Bearer ${savedToken}` };
            const res = await fetch(`${API_BASE_URL}/invoices?search=${encodeURIComponent(editInvoiceNo)}&limit=5`, { headers });
            if (res.ok) {
              const data = await res.json();
              const matched = data.find(i => i.invoice_no === editInvoiceNo);
              if (matched) {
                handleEditClick(matched);
              }
            }
          } catch (err) {
            console.error('Error fetching Invoice for edit:', err);
          }
        };
        fetchAndEdit();
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, invoices]);

  // Autocomplete links states
  const [linkType, setLinkType] = useState('dn'); // 'dn' | 'po' | 'ro'
  
  const [dnInput, setDnInput]           = useState('');
  const [dnSuggestions, setDnSuggestions] = useState([]);
  const [showDnDropdown, setShowDnDropdown] = useState(false);
  const [selectedDn, setSelectedDn]     = useState(null);
  const dnRef = useRef(null);

  const [poInput, setPoInput] = useState('');
  const [poSuggestions, setPoSuggestions] = useState([]);
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const poRef = useRef(null);

  const [roInput, setRoInput] = useState('');
  const [roSuggestions, setRoSuggestions] = useState([]);
  const [showRoDropdown, setShowRoDropdown] = useState(false);
  const [selectedRo, setSelectedRo] = useState(null);
  const roRef = useRef(null);

  // Items pulled from the linked document
  const [invItems, setInvItems] = useState([]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dnRef.current && !dnRef.current.contains(e.target)) {
        setShowDnDropdown(false);
      }
      if (poRef.current && !poRef.current.contains(e.target)) {
        setShowPoDropdown(false);
      }
      if (roRef.current && !roRef.current.contains(e.target)) {
        setShowRoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search delivery notes as user types
  const handleDnSearch = async (val) => {
    setDnInput(val);
    setFormData(prev => ({ ...prev, delivery_note_no: val, po_no: '', ro_no: '' }));
    setSelectedDn(null);
    setInvItems([]);

    if (!val.trim()) {
      setDnSuggestions([]);
      setShowDnDropdown(false);
      return;
    }

    try {
      const token = localStorage.getItem('dm_token');
      const res = await fetch(
        `${API_BASE_URL}/delivery-notes?search=${encodeURIComponent(val)}&limit=6`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setDnSuggestions(Array.isArray(data) ? data : []);
      setShowDnDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Select a DN suggestion — populate items
  const selectDn = (dn) => {
    setDnInput(dn.delivery_note_no);
    setFormData(prev => ({ ...prev, delivery_note_no: dn.delivery_note_no, po_no: '', ro_no: '' }));
    setSelectedDn(dn);
    setShowDnDropdown(false);

    if (Array.isArray(dn.items)) {
      setInvItems(
        dn.items.map(i => ({
          item_code:     i.item_code,
          description:   i.description   || '',
          drawing_number:i.drawing_number || '',
          quantity:      i.quantity       || 1,
          rate_per_piece:i.rate_per_piece || '0.00',
          shipping_address: i.shipping_address || '',
          delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
          checked:       true
        }))
      );
    }
  };

  // Search POs as user types
  const handlePoSearch = async (val) => {
    setPoInput(val);
    setFormData(prev => ({ ...prev, po_no: val, delivery_note_no: '', ro_no: '' }));
    setSelectedPo(null);
    setInvItems([]);

    if (!val.trim()) {
      setPoSuggestions([]);
      setShowPoDropdown(false);
      return;
    }

    try {
      const token = localStorage.getItem('dm_token');
      const res = await fetch(
        `${API_BASE_URL}/purchase-orders?search=${encodeURIComponent(val)}&limit=6`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setPoSuggestions(Array.isArray(data) ? data : []);
      setShowPoDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Select PO — populate items
  const selectPo = (po) => {
    setPoInput(po.po_no);
    setFormData(prev => ({ ...prev, po_no: po.po_no, delivery_note_no: '', ro_no: '' }));
    setSelectedPo(po);
    setShowPoDropdown(false);

    if (Array.isArray(po.items)) {
      setInvItems(
        po.items.map(i => ({
          item_code:     i.item_code,
          description:   i.description   || '',
          drawing_number:i.drawing_number || '',
          quantity:      i.quantity       || 1,
          rate_per_piece:i.unit_price     || '0.00',
          shipping_address: i.shipping_address || '',
          delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
          checked:       true
        }))
      );
    }
  };

  // Search ROs as user types
  const handleRoSearch = async (val) => {
    setRoInput(val);
    setFormData(prev => ({ ...prev, ro_no: val, delivery_note_no: '', po_no: '' }));
    setSelectedRo(null);
    setInvItems([]);

    if (!val.trim()) {
      setRoSuggestions([]);
      setShowRoDropdown(false);
      return;
    }

    try {
      const token = localStorage.getItem('dm_token');
      const res = await fetch(
        `${API_BASE_URL}/release-orders?search=${encodeURIComponent(val)}&limit=6`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setRoSuggestions(Array.isArray(data) ? data : []);
      setShowRoDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Select RO — populate items
  const selectRo = (ro) => {
    setRoInput(ro.ro_no);
    setFormData(prev => ({ ...prev, ro_no: ro.ro_no, delivery_note_no: '', po_no: '' }));
    setSelectedRo(ro);
    setShowRoDropdown(false);

    if (Array.isArray(ro.items)) {
      setInvItems(
        ro.items.map(i => ({
          item_code:     i.item_code,
          description:   i.description   || '',
          drawing_number:i.drawing_number || '',
          quantity:      i.quantity       || 1,
          rate_per_piece:i.unit_price     || '0.00',
          shipping_address: i.shipping_address || '',
          delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
          checked:       true
        }))
      );
    }
  };

  const handleOpenAddForm = () => {
    setEditingNo(null);
    setFormData({ ...EMPTY_FORM, invoice_date: new Date().toISOString().slice(0, 10) });
    setDnInput('');
    setPoInput('');
    setRoInput('');
    setSelectedDn(null);
    setSelectedPo(null);
    setSelectedRo(null);
    setInvItems([]);
    setLinkType('dn');
    setViewMode('form');
  };

  const handleEditClick = (inv) => {
    setEditingNo(inv.invoice_no);
    const initialLinkType = inv.delivery_note_no ? 'dn' : inv.po_no ? 'po' : inv.ro_no ? 'ro' : 'dn';
    setLinkType(initialLinkType);
    setFormData({
      invoice_no:       inv.invoice_no,
      invoice_date:     inv.invoice_date     ? inv.invoice_date.slice(0, 10)     : '',
      delivery_note_no: inv.delivery_note_no || '',
      po_no:            inv.po_no || '',
      ro_no:            inv.ro_no || '',
      dispatch_doc_no:  inv.dispatch_doc_no  || '',
      dispatch_through: inv.dispatch_through || '',
      motor_vehicle_no: inv.motor_vehicle_no || ''
    });
    setDnInput(inv.delivery_note_no || '');
    setPoInput(inv.po_no || '');
    setRoInput(inv.ro_no || '');
    setSelectedDn(null);
    setSelectedPo(null);
    setSelectedRo(null);
    setInvItems(
      (inv.items || []).map(i => ({
        item_code:     i.item_code,
        description:   i.description    || '',
        drawing_number:i.drawing_number || '',
        quantity:      i.quantity       || 1,
        rate_per_piece:i.rate_per_piece || '0.00',
        shipping_address: i.shipping_address || '',
        delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
        checked:       true
      }))
    );
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingNo(null);
    setFormData(EMPTY_FORM);
    setDnInput('');
    setPoInput('');
    setRoInput('');
    setSelectedDn(null);
    setSelectedPo(null);
    setSelectedRo(null);
    setInvItems([]);
    setLinkType('dn');
    if (onCancel) {
      onCancel(() => setViewMode('list'));
    } else {
      setViewMode('list');
    }
  };

  const toggleItemChecked = (item_code) => {
    setInvItems(prev =>
      prev.map(i => (i.item_code === item_code ? { ...i, checked: !i.checked } : i))
    );
  };

  const handleItemQtyChange = (item_code, val) => {
    setInvItems(prev =>
      prev.map(i => (i.item_code === item_code ? { ...i, quantity: val } : i))
    );
  };

  const handleItemRateChange = (item_code, val) => {
    setInvItems(prev =>
      prev.map(i => (i.item_code === item_code ? { ...i, rate_per_piece: val } : i))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedItems = invItems.filter(i => i.checked);
    if (selectedItems.length === 0) {
      alert('Please select at least one item.');
      return;
    }

    const payload = {
      ...formData,
      items: selectedItems.map(i => ({
        item_code:     i.item_code,
        quantity:      parseInt(i.quantity),
        rate_per_piece:parseFloat(i.rate_per_piece),
        shipping_address: i.shipping_address || null,
        delivery_date: i.delivery_date || null
      }))
    };

    if (editingNo) {
      const success = await onUpdateInvoice(editingNo, payload);
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddInvoice(payload);
      if (success) handleBackToDirectory();
    }
  };

  // Debounced list search
  useEffect(() => {
    if (searchResource) {
      const t = setTimeout(() => searchResource('invoices', searchQuery), 300);
      return () => clearTimeout(t);
    }
  }, [searchQuery, searchResource]);

  const fmtDate = (d) => {
    if (!d) return '—';
    if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      const p = d.substring(0, 10).split('-');
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB');
  };

  const setField = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Gross invoice value of selected items
  const subtotal = invItems
    .filter(i => i.checked)
    .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate_per_piece) || 0), 0);

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">

      {/* ================================================================
          LIST VIEW
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Invoices</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Generate and manage invoices linked to delivery notes.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} /> New Invoice
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by invoice no., DN no., customer or item code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Invoice Directory ({invoices.length})
              </span>
            </div>

            {invoices.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No Invoices found. Click "New Invoice" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <div
                    key={inv.invoice_no}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {inv.invoice_no}
                        </span>
                        {inv.delivery_note_no && (
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            DN: {inv.delivery_note_no}
                          </span>
                        )}
                        {inv.customer_id && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            Cust: {inv.customer_name || inv.customer_id}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span>Date: {fmtDate(inv.invoice_date)}</span>
                        <span>•</span>
                        <span>Items: {inv.item_count ?? (Array.isArray(inv.items) ? inv.items.length : 0)}</span>
                        {inv.dispatch_through && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <FileText size={12} /> {inv.dispatch_through}
                            </span>
                          </>
                        )}
                      </div>
                      {inv.buyer_name && (
                        <p className="text-xs text-slate-400 font-semibold">
                          Buyer: {inv.buyer_name} ({inv.buyer_email || '—'})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditClick(inv)}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <Link
                        to={`/invoice/${encodeURIComponent(inv.invoice_no)}`}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 justify-center"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {invoices.length >= 20 && invoices.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('invoices', invoices.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More Invoices
                </button>
              </div>
            )}
          </div>
        </div>

      ) : (
        /* ================================================================
            FORM VIEW
           ================================================================ */
        <div className="space-y-6">
          {/* Header */}
          <div className="pb-4 border-b border-slate-200">
            <button
              type="button"
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} /> Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingNo ? 'Modify Invoice' : 'Create Invoice'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingNo
                ? 'Update the invoice details and item quantities.'
                : 'Create an Invoice by linking it to a Delivery Note.'}
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Row 1: Invoice No. + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Invoice No. <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    value={formData.invoice_no}
                    onChange={setField('invoice_no')}
                    placeholder="Enter Invoice Number"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Invoice Date <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.invoice_date}
                    onChange={setField('invoice_date')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Dispatch fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Dispatch Doc No. <span className="text-slate-400 normal-case font-semibold">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.dispatch_doc_no}
                    onChange={setField('dispatch_doc_no')}
                    placeholder="e.g. LR-12345"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Dispatch Through
                  </label>
                  <input
                    type="text"
                    value={formData.dispatch_through}
                    onChange={setField('dispatch_through')}
                    placeholder="e.g. DTDC, BlueDart"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Motor Vehicle No.
                  </label>
                  <input
                    type="text"
                    value={formData.motor_vehicle_no}
                    onChange={setField('motor_vehicle_no')}
                    placeholder="e.g. HR 26 AB 1234"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Link Invoice Selector */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                  Link Invoice To <b className="text-red-500">*</b>
                </label>
                <div className="flex gap-2 mb-4">
                  {[
                    { id: 'dn', label: 'Delivery Note' },
                    { id: 'po', label: 'Purchase Order' },
                    { id: 'ro', label: 'Release Order' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!!editingNo}
                      onClick={() => {
                        setLinkType(opt.id);
                        setFormData(prev => ({ ...prev, delivery_note_no: '', po_no: '', ro_no: '' }));
                        setDnInput('');
                        setPoInput('');
                        setRoInput('');
                        setSelectedDn(null);
                        setSelectedPo(null);
                        setSelectedRo(null);
                        setInvItems([]);
                      }}
                      className={`px-4 py-2 text-sm font-bold rounded-lg border-2 transition-all cursor-pointer ${
                        linkType === opt.id
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {linkType === 'dn' && (
                <div ref={dnRef} className="relative">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Link to Delivery Note <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    placeholder="Search Delivery Note by number or customer..."
                    value={dnInput}
                    onChange={(e) => handleDnSearch(e.target.value)}
                    onFocus={() => dnInput.trim() && setShowDnDropdown(true)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    autoComplete="off"
                  />
                  {showDnDropdown && dnSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {dnSuggestions.map((dn) => (
                        <button
                          key={dn.delivery_note_no}
                          type="button"
                          onClick={() => selectDn(dn)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <div className="font-bold text-sm text-slate-900">{dn.delivery_note_no}</div>
                            {(dn.po_no || dn.ro_no) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {dn.po_no ? `PO: ${dn.po_no}` : `RO: ${dn.ro_no}`}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {dn.customer_name || dn.customer_id || '—'} &bull;{' '}
                            {Array.isArray(dn.items) ? dn.items.length : 0} item(s) &bull;{' '}
                            {fmtDate(dn.delivery_date)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {linkType === 'po' && (
                <div ref={poRef} className="relative">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Link to Purchase Order <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    placeholder="Search Purchase Order by number..."
                    value={poInput}
                    onChange={(e) => handlePoSearch(e.target.value)}
                    onFocus={() => poInput.trim() && setShowPoDropdown(true)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    autoComplete="off"
                  />
                  {showPoDropdown && poSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {poSuggestions.map((po) => (
                        <button
                          key={po.po_no}
                          type="button"
                          onClick={() => selectPo(po)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <div className="font-bold text-sm text-slate-900">{po.po_no}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Items: {po.items?.length || 0} &bull; Cust: {po.customer_id || '—'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {linkType === 'ro' && (
                <div ref={roRef} className="relative">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Link to Release Order <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    placeholder="Search Release Order by number..."
                    value={roInput}
                    onChange={(e) => handleRoSearch(e.target.value)}
                    onFocus={() => roInput.trim() && setShowRoDropdown(true)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    autoComplete="off"
                  />
                  {showRoDropdown && roSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {roSuggestions.map((ro) => (
                        <button
                          key={ro.ro_no}
                          type="button"
                          onClick={() => selectRo(ro)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="flex justify-between items-center">
                            <div className="font-bold text-sm text-slate-900">{ro.ro_no}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Items: {ro.items?.length || 0} &bull; Cust: {ro.customer_id || '—'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected DN info card */}
              {selectedDn && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm text-slate-600">
                  <div className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-1.5 mb-1.5">
                    Delivery Note Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><b>DN No:</b> {selectedDn.delivery_note_no}</div>
                    <div><b>Date:</b> {fmtDate(selectedDn.delivery_date)}</div>
                    <div><b>Customer:</b> {selectedDn.customer_name || selectedDn.customer_id || '—'}</div>
                    <div><b>Order Ref:</b> {selectedDn.po_no ? `PO: ${selectedDn.po_no}` : selectedDn.ro_no ? `RO: ${selectedDn.ro_no}` : '—'}</div>
                  </div>
                </div>
              )}

              {/* Selected PO info card */}
              {selectedPo && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm text-slate-600">
                  <div className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-1.5 mb-1.5">
                    Purchase Order Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><b>PO No:</b> {selectedPo.po_no}</div>
                    <div><b>Date:</b> {fmtDate(selectedPo.po_date)}</div>
                    <div><b>Customer:</b> {selectedPo.customer_name || selectedPo.customer_id || '—'}</div>
                    {selectedPo.contract_ref && <div><b>Contract Ref:</b> {selectedPo.contract_ref}</div>}
                  </div>
                </div>
              )}

              {/* Selected RO info card */}
              {selectedRo && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm text-slate-600">
                  <div className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-1.5 mb-1.5">
                    Release Order Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><b>RO No:</b> {selectedRo.ro_no}</div>
                    <div><b>Date:</b> {fmtDate(selectedRo.ro_date)}</div>
                    <div><b>Customer:</b> {selectedRo.customer_name || selectedRo.customer_id || '—'}</div>
                    {selectedRo.contract_ref && <div><b>Contract Ref:</b> {selectedRo.contract_ref}</div>}
                  </div>
                </div>
              )}

              {/* Items List */}
              {invItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-visible">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center rounded-t-xl">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                      Items to Invoice
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = invItems.every(i => i.checked);
                        setInvItems(prev => prev.map(i => ({ ...i, checked: !allChecked })));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                    >
                      {invItems.every(i => i.checked) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50/50">
                    {invItems.map((item) => (
                      <div
                        key={item.item_code}
                        className={`border-2 rounded-xl transition-all duration-200 overflow-visible ${
                          item.checked
                            ? 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md'
                            : 'bg-slate-50/75 border-slate-100 opacity-60 hover:opacity-100 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className={`flex flex-col sm:flex-row sm:items-center px-5 py-4 gap-4 transition-colors ${item.checked ? 'bg-blue-50/10' : ''}`}>
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleItemChecked(item.item_code)}
                            className="text-blue-600 focus:outline-none shrink-0"
                          >
                            {item.checked
                              ? <CheckSquare size={22} />
                              : <Square size={22} className="text-slate-400" />}
                          </button>

                          {/* Details */}
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm text-blue-700">
                                {item.item_code}
                              </span>
                              {item.drawing_number && (
                                <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                  DRW: {item.drawing_number}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                            )}
                            {(item.shipping_address || item.delivery_date) && (
                              <div className="mt-2 text-xs border-t border-slate-100 pt-2 space-y-1">
                                {item.shipping_address && (
                                  <div className="text-slate-600">
                                    <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wider block">Target Shipping Address</span>
                                    <span className="font-medium whitespace-pre-wrap">{item.shipping_address}</span>
                                  </div>
                                )}
                                {item.delivery_date && (
                                  <div className="text-slate-600 flex items-center gap-1.5 mt-1">
                                    <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wider">Target Delivery:</span>
                                    <span className="font-bold text-slate-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[10px]">{fmtDate(item.delivery_date)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Inputs */}
                          <div className="flex flex-wrap gap-4 shrink-0">
                            <div className="flex flex-col items-end">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                disabled={!item.checked}
                                value={item.quantity}
                                onChange={(e) => handleItemQtyChange(item.item_code, e.target.value)}
                                className="w-20 px-2.5 py-1 text-right font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            </div>
                            <div className="flex flex-col items-end">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                Rate (₹)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={!item.checked}
                                value={item.rate_per_piece}
                                onChange={(e) => handleItemRateChange(item.item_code, e.target.value)}
                                className="w-28 px-2.5 py-1 text-right font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoice Summary Banner */}
              {invItems.filter(i => i.checked).length > 0 && (
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5">
                  <div className="font-bold text-slate-700 uppercase text-xs tracking-wider border-b border-slate-200 pb-2 mb-4">
                    Invoice Summary
                  </div>
                  <div className="flex flex-wrap gap-6 items-center">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                        Items Selected
                      </span>
                      <span className="text-xl font-black text-slate-800">
                        {invItems.filter(i => i.checked).length}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center bg-blue-50/50 border border-blue-100 rounded-lg p-3 ml-auto">
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">
                        Gross Invoice Value
                      </span>
                      <span className="text-xl font-black text-blue-800 mt-1">
                        ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleBackToDirectory}
                  className="px-6 py-4 border-2 border-slate-200 hover:border-slate-300 rounded-lg font-bold text-base uppercase text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    editingNo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : editingNo ? (
                    <><RefreshCw size={18} /> Update Invoice</>
                  ) : (
                    <><Plus size={18} /> Save Invoice</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
