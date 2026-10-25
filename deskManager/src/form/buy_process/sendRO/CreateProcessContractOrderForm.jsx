import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FileText, ArrowLeft, Layers, Package, RefreshCw, Trash2, Building2, User, Truck, Box, DollarSign, Search, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../../../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../../../components/TargetItemSelectorModal';

export default function CreateProcessContractOrderForm({ isContractOrder = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isContractOrderMode = Boolean(
    isContractOrder ||
    location.pathname.startsWith('/addProcessContractOrder') ||
    searchParams.get('mode') === 'contract'
  );

  const queryTradeId = searchParams.get('trade_id');
  const queryRqId = searchParams.get('received_q_id') || searchParams.get('rq_id') || searchParams.get('number') || searchParams.get('rq_process_id');
  const queryRecQtnNo = searchParams.get('received_quotation_no') || searchParams.get('quotation_no');
  const queryContractId = searchParams.get('contract_id') || searchParams.get('arc_id');

  // Header State
  const [poNo, setPoNo] = useState('');
  const [dateOfStart, setDateOfStart] = useState(new Date().toISOString().split('T')[0]);
  const [dateOfEnd, setDateOfEnd] = useState('');
  const [message, setMessage] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [receivedQId, setReceivedQId] = useState('');

  // Linked Received Quotation / Process RQ Search State
  const [rqSearchInput, setRqSearchInput] = useState('');
  const [rqSuggestions, setRqSuggestions] = useState([]);
  const [showRqDropdown, setShowRqDropdown] = useState(false);
  const [linkedRqLabel, setLinkedRqLabel] = useState('');
  const rqRef = useRef(null);

  // Contract Reference (ARC) Search State (for Buy Process Contract Order Mode)
  const [contractInput, setContractInput] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractSuggestions, setContractSuggestions] = useState([]);
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [contractNotFound, setContractNotFound] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractItemsCount, setContractItemsCount] = useState(0);
  const contractRef = useRef(null);

  // Item Code Search State (within selected ARC contract for Buy Process)
  const [contractItems, setContractItems] = useState([]);
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef(null);

  // Seller Search State (Compulsory)
  const [seller, setSeller] = useState('');
  const [sellerInput, setSellerInput] = useState('');
  const [sellerSuggestions, setSellerSuggestions] = useState([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const sellerRef = useRef(null);

  // Party Search State (Compulsory)
  const [party, setParty] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partyRef = useRef(null);

  // Source & Target Items
  const [sourceItems, setSourceItems] = useState([]); // Array of { item_code, description, trace_item_id, qty, available_qty }
  const [targetItems, setTargetItems] = useState([]); // Array of { item_code, description, qty, price }

  // Financial Summary State & Search-based GST (just like Sell PO)
  const [gstType, setGstType] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [summaryGstInput, setSummaryGstInput] = useState('');
  const [summaryGstSuggestions, setSummaryGstSuggestions] = useState([]);
  const [showSummaryGstDropdown, setShowSummaryGstDropdown] = useState(false);
  const summaryGstRef = useRef(null);
  const summaryGstTimeoutRef = useRef(null);

  // Per-target-item GST search state (keyed by target item index)
  const [targetGstSearchInput, setTargetGstSearchInput] = useState({});
  const [targetGstDropdownOpen, setTargetGstDropdownOpen] = useState({});
  const [targetGstSuggestions, setTargetGstSuggestions] = useState({});
  const targetGstRefs = useRef({});
  const targetGstTimeoutRefs = useRef({});

  const [transport, setTransport] = useState('0');
  const [packingForward, setPackingForward] = useState('0');
  const [other, setOther] = useState('0');

  // Modals
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fetch next PO Number
  useEffect(() => {
    const endpoint = isContractOrderMode ? '/api/process-ro/next-no' : '/api/process-po/next-no';
    fetch(endpoint)
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (isContractOrderMode && data.ro_no) {
          setPoNo(data.ro_no);
        } else if (data.po_no) {
          setPoNo(data.po_no);
        }
      })
      .catch(console.error);
  }, [isContractOrderMode]);

  // State for restricting inventory trace modal to source items defined in RQ
  const [rqSourceItemCodes, setRqSourceItemCodes] = useState([]);
  const [jobIds, setJobIds] = useState([]);

  // Populate form fields from a Process RQ record object
  const populateFromProcessRq = (rq) => {
    if (!rq) return;
    if (rq.id) setReceivedQId(String(rq.id));
    if (rq.number) {
      setLinkedRqLabel(rq.number);
      setRqSearchInput(rq.number);
    }
    if (rq.seller || rq.party_name) {
      const s = rq.seller || rq.party_name;
      setSeller(s);
      setSellerInput(s);
    }
    if (rq.party || rq.customer_name) {
      const p = rq.party || rq.customer_name;
      setParty(p);
      setPartyInput(p);
    }
    if (rq.message) {
      setMessage(rq.message);
    }
    if (rq.job_ids) {
      setJobIds(Array.isArray(rq.job_ids) ? rq.job_ids : []);
    }
    // Collect all source and target items from all jobs
    let allSourceItems = [];
    let allTargetItems = [];
    
    if (Array.isArray(rq.jobs) && rq.jobs.length > 0) {
      rq.jobs.forEach(job => {
        if (Array.isArray(job.source_items)) {
          allSourceItems = [...allSourceItems, ...job.source_items];
        }
        if (Array.isArray(job.target_items)) {
          const targetItemsWithProcessName = job.target_items.map(t => ({ ...t, process_name: job.process_name || '' }));
          allTargetItems = [...allTargetItems, ...targetItemsWithProcessName];
        }
      });
    }

    if (allSourceItems.length > 0) {
      const allowedCodes = allSourceItems.map(s => s.item_code).filter(Boolean);
      setRqSourceItemCodes(allowedCodes);
    } else {
      setRqSourceItemCodes([]);
    }
    // Do NOT auto-populate source items; user selects trace items from inventory modal
    setSourceItems([]);

    if (allTargetItems.length > 0) {
      setTargetItems(allTargetItems.map(t => ({
        item_code: t.item_code,
        description: t.description || '',
        qty: String(t.qty || 1),
        price: String(t.price || 0),
        process_name: t.process_name || ''
      })));
    } else {
      setTargetItems([]);
    }
  };

  // Populate form fields from a Buy Process Received Quotation record object
  const populateFromProcessReceivedQuotation = (prq) => {
    if (!prq) return;
    if (prq.id) setReceivedQId(String(prq.id));
    const qtnNo = prq.quotation_number || prq.quotation_no || prq.received_quotation_no;
    if (qtnNo) {
      setLinkedRqLabel(qtnNo);
      setRqSearchInput(qtnNo);
    }
    // In Buy Process, Customer/Supplier is the Processor Vendor (Seller), Buyer is our Party (Client)
    if (prq.customer_name) {
      setSeller(prq.customer_name);
      setSellerInput(prq.customer_name);
    } else if (prq.customer_code) {
      setSeller(prq.customer_code);
      setSellerInput(prq.customer_code);
    }
    if (prq.buyer_name) {
      setParty(prq.buyer_name);
      setPartyInput(prq.buyer_name);
    }
    if (prq.quotation_date) {
      setDateOfStart(prq.quotation_date.split('T')[0]);
    }
    if (prq.commercial_bid_due_date) {
      setDateOfEnd(prq.commercial_bid_due_date.split('T')[0]);
    } else if (prq.technical_bid_due_date) {
      setDateOfEnd(prq.technical_bid_due_date.split('T')[0]);
    }

    const items = Array.isArray(prq.items) ? prq.items : [];
    if (items.length > 0) {
      const procNames = [...new Set(items.map(i => i.process_name).filter(Boolean))].join(', ');
      if (procNames) {
        setMessage(procNames);
      }

      // Auto-fill Target Items
      setTargetItems(items.map(t => ({
        item_code: t.item_code,
        description: t.description || '',
        qty: String(t.quantity || 1),
        price: String(t.price || 0),
        process_name: t.process_name || ''
      })));

      // Allow trace selection for these source item codes, but do NOT autofill sourceItems
      const itemCodes = items.map(s => s.item_code).filter(Boolean);
      setRqSourceItemCodes(itemCodes);
      setSourceItems([]);
    } else {
      setSourceItems([]);
    }
  };

  // Populate form fields from a Received Quotation record object
  const populateFromReceivedQuotation = (rq) => {
    if (!rq) return;
    if (rq.received_quotation_no) {
      setLinkedRqLabel(rq.received_quotation_no);
      setRqSearchInput(rq.received_quotation_no);
    }
    if (rq.buyer_name) {
      setSeller(rq.buyer_name);
      setSellerInput(rq.buyer_name);
    }
    if (rq.customer_name) {
      setParty(rq.customer_name);
      setPartyInput(rq.customer_name);
    }
    if (Array.isArray(rq.items) && rq.items.length > 0) {
      setTargetItems(rq.items.map(t => ({
        item_code: t.item_code,
        description: t.description || '',
        qty: String(t.quantity || 1),
        price: String(t.unit_price || 0),
        process_name: t.process_name || ''
      })));

      // Also set allowed source item codes to same codes, but do NOT autofill sourceItems
      const itemCodes = rq.items.map(s => s.item_code).filter(Boolean);
      setRqSourceItemCodes(itemCodes);
      setSourceItems([]);
    } else {
      setSourceItems([]);
    }
  };

  // Initial Pre-fill Logic from Query Params (trade_id, received_q_id, number, received_quotation_no)
  useEffect(() => {
    if (isContractOrderMode) return;

    const qtnIdentifier = queryRqId || queryRecQtnNo;

    if (qtnIdentifier) {
      fetch(`/api/process-received-quotations/${encodeURIComponent(qtnIdentifier)}`)
        .then(r => r.ok ? r.json() : null)
        .then(prqData => {
          if (prqData) {
            populateFromProcessReceivedQuotation(prqData);
            return null;
          }
          return fetch(`/api/rq-process/${encodeURIComponent(qtnIdentifier)}`).then(r => r.ok ? r.json() : null);
        })
        .then(rqData => {
          if (rqData) {
            populateFromProcessRq(rqData);
            return null;
          }
          return fetch(`/api/received-quotations/${encodeURIComponent(qtnIdentifier)}`).then(r => r.ok ? r.json() : null);
        })
        .then(recData => {
          if (recData) populateFromReceivedQuotation(recData);
        })
        .catch(console.error);
    }

    if (queryTradeId) {
      fetch(`/api/trades/${encodeURIComponent(queryTradeId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(tradeData => {
          if (tradeData) {
            const docs = tradeData.documents || [];
            const procRecDoc = docs.find(d => d.type?.toUpperCase() === 'PROCESS_RECEIVED_QUOTATION');
            const prDoc = docs.find(d => d.type?.toUpperCase() === 'PR' || d.type?.toUpperCase() === 'RQ_PROCESS');
            const recDoc = docs.find(d => d.type?.toUpperCase() === 'RECEIVED_QUOTATION');

            if (procRecDoc && procRecDoc.id) {
              fetch(`/api/process-received-quotations/${encodeURIComponent(procRecDoc.id)}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => data && populateFromProcessReceivedQuotation(data))
                .catch(console.error);
            } else if (prDoc && prDoc.id) {
              fetch(`/api/rq-process/${encodeURIComponent(prDoc.id)}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => data && populateFromProcessRq(data))
                .catch(console.error);
            } else if (recDoc && recDoc.id) {
              fetch(`/api/received-quotations/${encodeURIComponent(recDoc.id)}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => data && populateFromReceivedQuotation(data))
                .catch(console.error);
            } else {
              if (tradeData.buyer_name) { setSeller(tradeData.buyer_name); setSellerInput(tradeData.buyer_name); }
              if (tradeData.customer_name) { setParty(tradeData.customer_name); setPartyInput(tradeData.customer_name); }
            }
          }
        })
        .catch(console.error);
    }
  }, [queryRqId, queryRecQtnNo, queryTradeId]);

  // Select an ARC Contract and auto-fill Seller, Party, Shipping Address & Load Items Catalog
  const selectContract = async (contract) => {
    if (!contract) return;
    setSelectedContract(contract);
    const label = contract.company_name ? `${contract.company_name} (ARC-${contract.id})` : `ARC-${contract.id}`;
    setContractInput(label);
    setShowContractDropdown(false);
    setContractNotFound(false);

    // Auto-fill Seller / Processor
    const sName = contract.buyer_name || contract.company_name || '';
    if (sName) {
      setSeller(sName);
      setSellerInput(sName);
    }

    // Auto-fill Party / Customer
    const pName = contract.party_name || '';
    if (pName) {
      setParty(pName);
      setPartyInput(pName);
    }

    // Auto-fill Shipping Address from party_address
    if (contract.party_address) {
      setShippingAddress(contract.party_address);
    }

    // Fetch process items for this contract
    try {
      setContractLoading(true);
      const res = await fetch(`/api/contracts/${contract.id}/process-items?limit=100`);
      if (res.ok) {
        const items = await res.json();
        const list = Array.isArray(items) ? items : [];
        setContractItems(list);
        setContractItemsCount(list.length);
        if (list.length > 0) {
          toast.success(`ARC-${contract.id} linked: ${list.length} item(s) available. Search item code to add target item.`);
        } else {
          toast.info('Selected ARC contract has no process items registered.');
        }
      }
    } catch (err) {
      console.error('Error fetching process items:', err);
      toast.error('Failed to load process items for contract');
    } finally {
      setContractLoading(false);
    }

    // Target items are added via item code search, not all at once
    setTargetItems([]);
    setSourceItems([]);
    setRqSourceItemCodes([]);
  };

  const clearContract = () => {
    setSelectedContract(null);
    setContractInput('');
    setContractSuggestions([]);
    setContractNotFound(false);
    setContractItems([]);
    setContractItemsCount(0);
    setItemSearchInput('');
    setItemSuggestions([]);
    setShowItemDropdown(false);
    setTargetItems([]);
    setSourceItems([]);
    setSeller('');
    setSellerInput('');
    setParty('');
    setPartyInput('');
    setShippingAddress('');
    setMessage('');
  };

  // Debounced search for items within the selected ARC contract
  useEffect(() => {
    if (!isContractOrderMode) return;
    const trimmed = itemSearchInput.trim();
    if (!trimmed) {
      if (selectedContract && contractItems.length > 0) {
        setItemSuggestions(contractItems.slice(0, 15));
      } else {
        setItemSuggestions([]);
      }
      return;
    }

    const lower = trimmed.toLowerCase();
    const filtered = contractItems.filter(i =>
      (i.item_code || '').toLowerCase().includes(lower) ||
      (i.description || '').toLowerCase().includes(lower) ||
      (i.processname || '').toLowerCase().includes(lower) ||
      (i.drawing_number || '').toLowerCase().includes(lower)
    ).slice(0, 15);

    setItemSuggestions(filtered);
    setShowItemDropdown(true);
  }, [itemSearchInput, contractItems, selectedContract, isContractOrderMode]);

  const handleItemSearchFocus = () => {
    if (!selectedContract) {
      toast.info('Please search and select an ARC contract first.');
      return;
    }
    if (contractItems.length > 0) {
      const trimmed = itemSearchInput.trim().toLowerCase();
      if (!trimmed) {
        setItemSuggestions(contractItems.slice(0, 15));
      } else {
        const filtered = contractItems.filter(i =>
          (i.item_code || '').toLowerCase().includes(trimmed) ||
          (i.description || '').toLowerCase().includes(trimmed) ||
          (i.processname || '').toLowerCase().includes(trimmed) ||
          (i.drawing_number || '').toLowerCase().includes(trimmed)
        ).slice(0, 15);
        setItemSuggestions(filtered);
      }
      setShowItemDropdown(true);
    }
  };

  const addItemFromArc = (item) => {
    if (!item) return;

    // Check if duplicate
    const alreadyExists = targetItems.some(
      t => t.item_code === item.item_code && (t.process_name || '') === (item.processname || '')
    );
    if (alreadyExists) {
      toast.warn(`Item ${item.item_code} (${item.processname || 'Standard'}) is already added.`);
      setShowItemDropdown(false);
      return;
    }

    // Auto-fill other fields if empty
    if (selectedContract) {
      const sName = selectedContract.buyer_name || selectedContract.company_name || '';
      if (sName && !seller) {
        setSeller(sName);
        setSellerInput(sName);
      }
      const pName = selectedContract.party_name || '';
      if (pName && !party) {
        setParty(pName);
        setPartyInput(pName);
      }
      if (selectedContract.party_address && !shippingAddress) {
        setShippingAddress(selectedContract.party_address);
      }
    }

    if (item.processname && !message) {
      setMessage(item.processname);
    }

    // Auto-fill target item
    const newTarget = {
      item_code: item.item_code || '',
      description: item.description || '',
      drawing_number: item.drawing_number || '',
      process_name: item.processname || '',
      qty: '1', // editable quantity
      price: String(item.price !== undefined && item.price !== null ? item.price : 0), // auto-filled price
      gst_type: '',
      gst_rate: ''
    };

    setTargetItems(prev => [...prev, newTarget]);
    setItemSearchInput('');
    setShowItemDropdown(false);
    toast.success(`Target item ${item.item_code} added with ARC rate ₹${item.price || 0}`);
  };

  const addAllItemsFromArc = () => {
    if (!contractItems || contractItems.length === 0) return;
    const existingKeys = new Set(targetItems.map(t => `${t.item_code}__${t.process_name || ''}`));
    const itemsToAdd = contractItems.filter(it => !existingKeys.has(`${it.item_code}__${it.processname || ''}`));

    if (itemsToAdd.length === 0) {
      toast.info('All items from this ARC contract are already added.');
      return;
    }

    // Auto-fill other fields if not set
    if (selectedContract) {
      const sName = selectedContract.buyer_name || selectedContract.company_name || '';
      if (sName && !seller) { setSeller(sName); setSellerInput(sName); }
      const pName = selectedContract.party_name || '';
      if (pName && !party) { setParty(pName); setPartyInput(pName); }
      if (selectedContract.party_address && !shippingAddress) setShippingAddress(selectedContract.party_address);
    }

    const mapped = itemsToAdd.map(it => ({
      item_code: it.item_code || '',
      description: it.description || '',
      drawing_number: it.drawing_number || '',
      process_name: it.processname || '',
      qty: '1',
      price: String(it.price !== undefined && it.price !== null ? it.price : 0),
      gst_type: '',
      gst_rate: ''
    }));

    setTargetItems(prev => [...prev, ...mapped]);
    toast.success(`Added ${mapped.length} target item(s) from ARC contract`);
  };

  // Debounced search for contracts of type 'buy process'
  useEffect(() => {
    if (!isContractOrderMode) return;
    const trimmed = contractInput.trim();
    if (!trimmed) {
      setContractSuggestions([]);
      setShowContractDropdown(false);
      setContractNotFound(false);
      return;
    }
    if (selectedContract && (
      selectedContract.company_name === contractInput ||
      `ARC-${selectedContract.id}` === contractInput ||
      contractInput.includes(`ARC-${selectedContract.id}`)
    )) {
      setShowContractDropdown(false);
      return;
    }

    setContractLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/contracts?type=buy process&q=${encodeURIComponent(trimmed)}&limit=10`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          setContractSuggestions(list);
          setContractNotFound(list.length === 0);
          setShowContractDropdown(true);
        })
        .catch(err => {
          console.error('Error fetching contracts:', err);
          setContractSuggestions([]);
          setContractNotFound(true);
        })
        .finally(() => setContractLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [contractInput, selectedContract, isContractOrderMode]);

  const handleContractFocus = () => {
    if (contractSuggestions.length > 0) {
      setShowContractDropdown(true);
    } else if (!contractInput.trim()) {
      setContractLoading(true);
      fetch('/api/contracts?type=buy process&limit=10')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          setContractSuggestions(list);
          setShowContractDropdown(list.length > 0);
        })
        .catch(console.error)
        .finally(() => setContractLoading(false));
    } else {
      setShowContractDropdown(true);
    }
  };

  // Initial Pre-fill for ARC Contract if queryContractId is present
  useEffect(() => {
    if (!isContractOrderMode || !queryContractId) return;
    fetch(`/api/contracts/${encodeURIComponent(queryContractId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) selectContract(data);
      })
      .catch(console.error);
  }, [isContractOrderMode, queryContractId]);

  // Debounced Linked Process RQ / Received Quotation Lookup
  useEffect(() => {
    const trimmed = rqSearchInput.trim();
    if (!trimmed) {
      setRqSuggestions([]);
      setShowRqDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      Promise.all([
        fetch(`/api/process-received-quotations?q=${encodeURIComponent(trimmed)}&limit=5`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/rq-process').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/received-quotations?q=${encodeURIComponent(trimmed)}&limit=5`).then(r => r.ok ? r.json() : []).catch(() => [])
      ]).then(([prqList, rqList, recList]) => {
        const filteredPrq = (Array.isArray(prqList) ? prqList : []).map(r => ({
          ...r,
          _type: 'PROCESS_RECEIVED_QUOTATION',
          label: r.quotation_number,
          seller: r.customer_name,
          party: r.buyer_name
        }));

        const filteredRq = (Array.isArray(rqList) ? rqList : []).filter(r =>
          (r.number && r.number.toLowerCase().includes(trimmed.toLowerCase())) ||
          (r.party_name && r.party_name.toLowerCase().includes(trimmed.toLowerCase())) ||
          (r.customer_name && r.customer_name.toLowerCase().includes(trimmed.toLowerCase()))
        ).map(r => ({ ...r, _type: 'PROCESS_RQ', label: r.number, seller: r.party_name, party: r.customer_name }));

        const filteredRec = (Array.isArray(recList) ? recList : []).map(r => ({
          ...r,
          _type: 'RECEIVED_QUOTATION',
          label: r.received_quotation_no,
          seller: r.buyer_name,
          party: r.customer_name
        }));

        setRqSuggestions([...filteredPrq, ...filteredRq, ...filteredRec]);
        setShowRqDropdown(true);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [rqSearchInput]);

  // Debounced Seller Lookup
  useEffect(() => {
    const trimmed = sellerInput.trim();
    if (!trimmed) {
      setSellerSuggestions([]);
      setShowSellerDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/buyers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) setSellerSuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [sellerInput]);

  // Debounced Party Lookup
  useEffect(() => {
    const trimmed = partyInput.trim();
    if (!trimmed) {
      setPartySuggestions([]);
      setShowPartyDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) setPartySuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [partyInput]);

  // Outside click to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rqRef.current && !rqRef.current.contains(e.target)) {
        setShowRqDropdown(false);
      }
      if (contractRef.current && !contractRef.current.contains(e.target)) {
        setShowContractDropdown(false);
      }
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target)) {
        setShowItemDropdown(false);
      }
      if (sellerRef.current && !sellerRef.current.contains(e.target)) {
        setShowSellerDropdown(false);
      }
      if (partyRef.current && !partyRef.current.contains(e.target)) {
        setShowPartyDropdown(false);
      }
      if (summaryGstRef.current && !summaryGstRef.current.contains(e.target)) {
        setShowSummaryGstDropdown(false);
      }
      Object.keys(targetGstRefs.current).forEach(key => {
        const ref = targetGstRefs.current[key];
        if (ref && !ref.contains(e.target)) {
          setTargetGstDropdownOpen(prev => ({ ...prev, [key]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Summary GST Search Suggestions On-Demand Fetcher
  const fetchSummaryGstSuggestions = (val) => {
    if (summaryGstTimeoutRef.current) {
      clearTimeout(summaryGstTimeoutRef.current);
    }
    const isSelectedFormat = /^[A-Z0-9\s+]+\s*\(\d+(\.\d+)?%\)$/i.test(val);
    if (isSelectedFormat) {
      return;
    }
    summaryGstTimeoutRef.current = setTimeout(() => {
      fetch(`/api/gst-rates?q=${encodeURIComponent(val)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setSummaryGstSuggestions(Array.isArray(data) ? data : []);
        })
        .catch(console.error);
    }, 200);
  };

  const handleSummaryGstSearch = (value) => {
    setSummaryGstInput(value);
    setGstType('');
    setGstRate('');
    setShowSummaryGstDropdown(true);
    fetchSummaryGstSuggestions(value);
  };

  const selectSummaryGst = (gst) => {
    setGstType(gst.type);
    setGstRate(String(gst.rate));
    setSummaryGstInput(`${gst.type} (${gst.rate}%)`);
    setShowSummaryGstDropdown(false);
  };

  const clearSummaryGst = () => {
    setGstType('');
    setGstRate('');
    setSummaryGstInput('');
    setShowSummaryGstDropdown(false);
  };

  // Target Item GST Search Suggestions On-Demand Fetcher
  const fetchTargetGstSuggestions = (idx, val) => {
    if (targetGstTimeoutRefs.current[idx]) {
      clearTimeout(targetGstTimeoutRefs.current[idx]);
    }
    const isSelectedFormat = /^[A-Z0-9\s+]+\s*\(\d+(\.\d+)?%\)$/i.test(val);
    if (isSelectedFormat) {
      return;
    }
    targetGstTimeoutRefs.current[idx] = setTimeout(() => {
      fetch(`/api/gst-rates?q=${encodeURIComponent(val)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setTargetGstSuggestions(prev => ({ ...prev, [idx]: Array.isArray(data) ? data : [] }));
        })
        .catch(console.error);
    }, 200);
  };

  const handleTargetGstSearch = (idx, value) => {
    setTargetGstSearchInput(prev => ({ ...prev, [idx]: value }));
    setTargetItems(prev => prev.map((t, i) => i === idx ? { ...t, gst_type: '', gst_rate: '' } : t));
    setTargetGstDropdownOpen(prev => ({ ...prev, [idx]: true }));
    fetchTargetGstSuggestions(idx, value);
  };

  const selectTargetItemGst = (idx, gst) => {
    setTargetItems(prev => prev.map((t, i) =>
      i === idx ? { ...t, gst_type: gst.type, gst_rate: String(gst.rate) } : t
    ));
    setTargetGstSearchInput(prev => ({ ...prev, [idx]: `${gst.type} (${gst.rate}%)` }));
    setTargetGstDropdownOpen(prev => ({ ...prev, [idx]: false }));
  };

  const clearTargetItemGst = (idx) => {
    setTargetItems(prev => prev.map((t, i) =>
      i === idx ? { ...t, gst_type: '', gst_rate: '' } : t
    ));
    setTargetGstSearchInput(prev => ({ ...prev, [idx]: '' }));
    setTargetGstDropdownOpen(prev => ({ ...prev, [idx]: false }));
  };

  const updateTargetItem = (index, field, value) => {
    setTargetItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // Handlers for Source Items Selection
  const handleApplySourceSelections = (selectionsArray) => {
    if (!Array.isArray(selectionsArray) || selectionsArray.length === 0) return;

    const newSourceItems = selectionsArray.map(st => ({
      item_code: st.item_code || '',
      description: st.description || '',
      trace_item_id: st.trace_id || st.trace_item_id || null,
      qty: st.Qty !== undefined && st.Qty !== null ? String(st.Qty) : '1',
      available_qty: st.available_qty || ''
    }));

    setSourceItems(newSourceItems);
    setIsSourceModalOpen(false);
    toast.success(`Selected ${newSourceItems.length} source trace item(s)`);
  };

  const handleRemoveSourceItem = (index) => {
    setSourceItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Handlers for Target Items Selection
  const handleApplyTargetSelection = (targetObj) => {
    setTargetItems(prev => [
      ...prev,
      {
        item_code: targetObj.item_code,
        description: targetObj.description || '',
        qty: targetObj.qty !== undefined ? String(targetObj.qty) : '1',
        price: targetObj.price !== undefined ? String(targetObj.price) : '0',
        gst_type: '',
        gst_rate: ''
      }
    ]);

    setIsTargetModalOpen(false);
    toast.success(`Added Target Item ${targetObj.item_code}`);
  };

  const handleRemoveTargetItem = (index) => {
    setTargetItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Financial Calculations
  const calcItemBasic = (item) => (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
  const calcItemGst = (item) => {
    const itemRate = parseFloat(item.gst_rate);
    const effectiveRate = !isNaN(itemRate) && item.gst_rate !== '' ? itemRate : (parseFloat(gstRate) || 0);
    return (calcItemBasic(item) * effectiveRate) / 100;
  };
  const calcItemTotal = (item) => calcItemBasic(item) + calcItemGst(item);

  const calcTargetBasicTotal = () => {
    return targetItems.reduce((sum, item) => sum + calcItemBasic(item), 0);
  };

  const calcGstAmount = () => {
    return targetItems.reduce((sum, item) => sum + calcItemGst(item), 0);
  };

  const calcGrandTotal = () => {
    return (
      calcTargetBasicTotal() +
      calcGstAmount() +
      (parseFloat(transport) || 0) +
      (parseFloat(packingForward) || 0) +
      (parseFloat(other) || 0)
    );
  };

  // Submit Process PO Form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!poNo || !poNo.trim()) {
      toast.error(isContractOrderMode ? 'Process RO Number is required' : 'Process PO Number is required');
      return;
    }

    if (!seller || !seller.trim()) {
      toast.error('Seller / Processor Vendor is required');
      return;
    }

    if (!party || !party.trim()) {
      toast.error('Party / Client Customer is required');
      return;
    }

    let finalSourceItems = sourceItems;
    let finalTargetItems = targetItems;

    if (finalSourceItems.length === 0) {
      toast.error('Please select at least one source trace item from inventory');
      return;
    }

    if (finalTargetItems.length === 0) {
      toast.error('Please enter at least one target output product in the table');
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = isContractOrderMode ? '/api/process-ro' : '/api/process-po';
      const payload = {
        ro_no: poNo.trim(),
        po_no: poNo.trim(),
        date_of_start: dateOfStart,
        date_of_end: dateOfEnd || null,
        received_q_id: isContractOrderMode ? null : (receivedQId || queryRqId || null),
        trade_id: isContractOrderMode ? null : (queryTradeId || null),
        contract_id: isContractOrderMode && selectedContract ? selectedContract.id : null,
        contract_ref: isContractOrderMode && selectedContract
          ? (selectedContract.company_name || `ARC-${selectedContract.id}`)
          : null,
        trade_type: 'BUY_PROCESS',
        seller: seller.trim(),
        party: party.trim(),
        gst_type: gstType || null,
        gst_rate: parseFloat(gstRate) || 0,
        gst: calcGstAmount(),
        transport: parseFloat(transport) || 0,
        packing_forward: parseFloat(packingForward) || 0,
        other: parseFloat(other) || 0,
        basic_value: calcTargetBasicTotal(),
        delivery_date: dateOfEnd || null,
        shipping_address: shippingAddress || null,
        message: message || null,
        job_ids: jobIds,
        source_items: finalSourceItems,
        target_items: finalTargetItems.map(t => {
          const itemRate = parseFloat(t.gst_rate);
          const effectiveRate = !isNaN(itemRate) && t.gst_rate !== '' ? itemRate : (parseFloat(gstRate) || 0);
          const effectiveType = t.gst_type || gstType || null;
          return {
            ...t,
            qty: parseFloat(t.qty) || 0,
            price: parseFloat(t.price) || 0,
            gst_type: effectiveType,
            gst_rate: effectiveRate
          };
        })
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const displayNo = data.ro_no || data.po_no || '';
        toast.success(
          isContractOrderMode
            ? `Buy Process Contract Order ${displayNo} created successfully!`
            : `Process Purchase Order ${displayNo} created successfully!`
        );
        const destTradeId = data.trade_id || queryTradeId;
        navigate(destTradeId ? `/trade/${encodeURIComponent(destTradeId)}` : '/dashboard');
      } else {
        const errData = await res.json();
        toast.error(errData.error || (isContractOrderMode ? 'Failed to create Contract Order' : 'Failed to create Process Purchase Order'));
      }
    } catch (err) {
      console.error(err);
      toast.error(isContractOrderMode ? 'Error creating Contract Order' : 'Error creating Process Purchase Order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-300 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: 'var(--theme-color)' }}>
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {isContractOrderMode ? 'Buy Process Contract Order' : 'Create Process Purchase Order'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {isContractOrderMode
                  ? 'Raise a direct Process Contract Order for processing raw materials into target products with auto-registered trade.'
                  : 'Raise an official Process PO for processing raw materials into target items with pricing, vendor details & tax structure.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/dashboard')}
            className="px-3.5 py-2  bg-[white] border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft size={15} /> Back
          </button>
        </div>

        {/* FORM CONTAINER CARD */}
        <div className="border border-slate-300 rounded-3xl  bg-[white] p-6 shadow-sm space-y-6">

          {/* LINKED RECEIVED QUOTATION / PROCESS RQ BANNER & SELECTOR OR CONTRACT ORDER BADGE */}
          {isContractOrderMode ? (
            <div
              className="border rounded-2xl p-5 space-y-4 shadow-2xs"
              style={{
                backgroundColor: 'rgba(217, 119, 6, 0.03)',
                borderColor: 'rgba(217, 119, 6, 0.25)'
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
                    <FileText size={13} className="text-amber-600" /> Buy Process Contract Order Workflow
                  </span>
                  <p className="text-xs text-slate-600 font-medium m-0">
                    Process RO No &rarr; Search ARC Contract &rarr; Search Item Code in ARC to auto-fill Seller, Party &amp; Target Products.
                  </p>
                </div>
                {selectedContract && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg w-fit">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span>Linked: <strong>{selectedContract.company_name || `ARC-${selectedContract.id}`}</strong></span>
                    <span className="text-emerald-300">|</span>
                    <span className="text-[10px] font-mono text-emerald-700">ARC-{selectedContract.id}</span>
                    {contractItems.length > 0 && (
                      <>
                        <span className="text-emerald-300">|</span>
                        <span className="text-[10px] text-blue-700 font-bold">{contractItems.length} catalog items</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* The 3 Sequential Setup Fields: 1. Process No -> 2. Search Arc -> 3. Search Item Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Process RO No */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black inline-flex items-center justify-center">1</span>
                    Process RO No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRO-0001"
                    value={poNo}
                    onChange={(e) => setPoNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>

                {/* 2. Search for ARC */}
                <div ref={contractRef} className="relative">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black inline-flex items-center justify-center">2</span>
                    Search for ARC <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search ARC (Company, Party, ID)..."
                      value={contractInput}
                      onChange={(e) => {
                        setContractInput(e.target.value);
                        setShowContractDropdown(true);
                      }}
                      onFocus={handleContractFocus}
                      className="w-full pl-8 pr-8 py-2 bg-[white] border border-amber-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs text-slate-800 placeholder-slate-400"
                      autoComplete="off"
                    />
                    <Search size={14} className="absolute left-2.5 top-2.5 text-amber-600" />
                    {selectedContract && (
                      <button
                        type="button"
                        onClick={clearContract}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Clear ARC Contract"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown for ARC contracts */}
                  {showContractDropdown && (
                    <div className="absolute left-0 z-50 w-full sm:w-96 mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto text-xs divide-y divide-slate-100">
                      {contractLoading ? (
                        <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw size={13} className="animate-spin text-amber-600" /> Loading contracts...
                        </div>
                      ) : contractSuggestions.length > 0 ? (
                        contractSuggestions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectContract(c);
                            }}
                            className="w-full text-left p-3 hover:bg-amber-50/60 transition-colors cursor-pointer flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate">
                                {c.company_name || 'Unnamed Company'}
                              </span>
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 rounded border border-amber-300 shrink-0">
                                {c.type || 'buy process'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="font-mono font-bold text-slate-600">ARC-{c.id}</span>
                              {c.buyer_name && (
                                <>
                                  <span>&bull;</span>
                                  <span>Processor: <strong className="text-slate-700">{c.buyer_name}</strong></span>
                                </>
                              )}
                              {c.party_name && (
                                <>
                                  <span>&bull;</span>
                                  <span>Party: <strong className="text-slate-700">{c.party_name}</strong></span>
                                </>
                              )}
                            </div>
                          </button>
                        ))
                      ) : contractNotFound ? (
                        <div className="p-3 text-slate-500 text-center flex items-center justify-center gap-1.5">
                          <AlertCircle size={14} className="text-amber-500 shrink-0" />
                          <span>No &apos;buy process&apos; contracts found matching &quot;{contractInput}&quot;</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* 3. Search for Item Code in ARC */}
                <div ref={itemSearchRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black inline-flex items-center justify-center">3</span>
                      Search Item Code (in ARC)
                    </label>
                    {selectedContract && contractItems.length > 0 && (
                      <button
                        type="button"
                        onClick={addAllItemsFromArc}
                        className="text-[10px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                        title="Add all process items from this ARC contract"
                      >
                        + Add All ({contractItems.length})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={
                        !selectedContract
                          ? 'Select ARC contract first...'
                          : `Search item code in ARC (${contractItems.length} items)...`
                      }
                      disabled={!selectedContract}
                      value={itemSearchInput}
                      onChange={(e) => {
                        setItemSearchInput(e.target.value);
                        setShowItemDropdown(true);
                      }}
                      onFocus={handleItemSearchFocus}
                      className="w-full pl-8 pr-8 py-2 bg-[white] border border-emerald-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs text-slate-800 placeholder-slate-400 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                      autoComplete="off"
                    />
                    <Search size={14} className="absolute left-2.5 top-2.5 text-emerald-600" />
                    {itemSearchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setItemSearchInput('');
                          setShowItemDropdown(false);
                        }}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown for Item Code search results */}
                  {showItemDropdown && selectedContract && (
                    <div className="absolute right-0 z-50 w-full sm:w-96 mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto text-xs divide-y divide-slate-100">
                      {itemSuggestions.length > 0 ? (
                        itemSuggestions.map((item) => (
                          <button
                            key={item.id ? `${item.item_code}-${item.id}` : item.item_code}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addItemFromArc(item);
                            }}
                            className="w-full text-left p-3 hover:bg-emerald-50/60 transition-colors cursor-pointer flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs text-slate-900">{item.item_code}</span>
                                {item.processname && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 rounded border border-violet-200">
                                    {item.processname}
                                  </span>
                                )}
                              </div>
                              {item.price != null && (
                                <span className="font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  ₹{parseFloat(item.price).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {item.description || item.long_description || '—'}
                              {item.drawing_number && (
                                <span className="text-slate-400 font-mono"> &bull; DWG: {item.drawing_number}</span>
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                          No items found matching &quot;{itemSearchInput}&quot; in ARC contract
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
          <div
            className="border rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs"
            style={{
              backgroundColor: 'rgba(217, 53, 45, 0.03)',
              borderColor: 'rgba(217, 53, 45, 0.2)'
            }}
          >
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--theme-color)' }}>
                <FileText size={12} style={{ color: 'var(--theme-color)' }} /> Linked Received Quotation / Process RQ
              </span>
              <p className="text-xs text-slate-600 font-semibold m-0">
                {linkedRqLabel ? (
                  <span className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg w-fit mt-1">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Pre-filled from Received Quotation: {linkedRqLabel}
                  </span>
                ) : (
                  'Select a Received Quotation or Process RQ to automatically load Seller, Party, and items.'
                )}
              </p>
            </div>

            <div ref={rqRef} className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search Received Quotation / Process RQ..."
                value={rqSearchInput}
                onChange={(e) => {
                  setRqSearchInput(e.target.value);
                  setShowRqDropdown(true);
                }}
                onFocus={() => {
                  if (rqSearchInput.trim()) setShowRqDropdown(true);
                }}
                className="w-full pl-8 pr-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] shadow-2xs"
                autoComplete="off"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />

              {showRqDropdown && rqSuggestions.length > 0 && (
                <div className="absolute right-0 z-50 w-full sm:w-80 mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto text-xs">
                  {rqSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (item._type === 'PROCESS_RECEIVED_QUOTATION') {
                          populateFromProcessReceivedQuotation(item);
                        } else if (item._type === 'PROCESS_RQ') {
                          populateFromProcessRq(item);
                        } else {
                          populateFromReceivedQuotation(item);
                        }
                        setShowRqDropdown(false);
                        toast.success(`Loaded details from ${item.label}`);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{item.label}</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          item._type === 'PROCESS_RECEIVED_QUOTATION'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : item._type === 'PROCESS_RQ'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {item._type === 'PROCESS_RECEIVED_QUOTATION'
                            ? 'Process Received Quotation'
                            : item._type === 'PROCESS_RQ'
                              ? 'Process RQ'
                              : 'Rec Quotation'}
                        </span>
                      </div>
                      {(item.seller || item.party) && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          Seller: {item.seller || '—'} &bull; Party: {item.party || '—'}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* BASIC HEADER METADATA SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              
              {/* Process PO No (shown here in normal mode; in contract order mode it is in workflow step 1 above) */}
              {!isContractOrderMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Process PO No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PPO-0001"
                    value={poNo}
                    onChange={(e) => setPoNo(e.target.value)}
                    className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>
              )}

              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateOfStart}
                  onChange={(e) => setDateOfStart(e.target.value)}
                  className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={dateOfEnd}
                  onChange={(e) => setDateOfEnd(e.target.value)}
                  className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Process Note / Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process Instruction / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Precision machining & polishing"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Seller / Processor Vendor (COMPULSORY - Pre-filled from Received Quotation) */}
              <div ref={sellerRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <User size={12} className="text-slate-500" /> Seller / Processor Vendor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Search seller vendor..."
                  value={sellerInput}
                  onChange={(e) => {
                    setSellerInput(e.target.value);
                    setSeller(e.target.value);
                    setShowSellerDropdown(true);
                  }}
                  onFocus={() => {
                    if (sellerInput.trim()) setShowSellerDropdown(true);
                  }}
                  className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  autoComplete="off"
                />
                {showSellerDropdown && sellerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1  bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                    {sellerSuggestions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSellerInput(b.name);
                          setSeller(b.name);
                          setShowSellerDropdown(false);
                        }}
                        onClick={() => {
                          setSellerInput(b.name);
                          setSeller(b.name);
                          setShowSellerDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-slate-900">{b.name}</div>
                        {(b.email || b.phone) && (
                          <div className="text-[10px] text-slate-500">{b.email} &bull; {b.phone}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Party / Client Customer (COMPULSORY - Pre-filled from Received Quotation) */}
              <div ref={partyRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Building2 size={12} className="text-slate-500" /> Party / Client Customer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Search party client..."
                  value={partyInput}
                  onChange={(e) => {
                    setPartyInput(e.target.value);
                    setParty(e.target.value);
                    setShowPartyDropdown(true);
                  }}
                  onFocus={() => {
                    if (partyInput.trim()) setShowPartyDropdown(true);
                  }}
                  className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  autoComplete="off"
                />
                {showPartyDropdown && partySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1  bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                    {partySuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPartyInput(c.name);
                          setParty(c.name);
                          setShowPartyDropdown(false);
                        }}
                        onClick={() => {
                          setPartyInput(c.name);
                          setParty(c.name);
                          setShowPartyDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.address && (
                          <div className="text-[10px] text-slate-500 truncate">{c.address}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Shipping Address (Optional) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Shipping Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Factory site address or delivery location"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

            </div>

            {/* 1. SOURCE ITEMS SECTION */}
            <div className="border border-amber-200 rounded-2xl bg-amber-50/30 p-5 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-amber-600" />
                  <div>
                    <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider m-0">
                      Source Raw Materials ({sourceItems.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 m-0 font-medium">Select trace items from inventory to process</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSourceModalOpen(true)}
                  className="px-3 py-1.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  <Layers size={13} /> Select Source Trace Items
                </button>
              </div>

              {sourceItems.length > 0 ? (
                <div className="space-y-2">
                  {sourceItems.map((src, idx) => (
                    <div key={idx} className=" bg-[white] border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="space-y-0.5 flex-1">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>{src.item_code}</span>
                          {src.trace_item_id && (
                            <span className="text-[9px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                              TR-{src.trace_item_id}
                            </span>
                          )}
                        </div>
                        {src.description && <div className="text-[10px] text-slate-500 truncate">{src.description}</div>}
                        {src.available_qty && <div className="text-[10px] text-slate-400 font-mono">Available Stock: {src.available_qty}</div>}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Qty:</span>
                          <span className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg shadow-2xs">
                            {src.qty || 0}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSourceItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                          title="Remove Source Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-amber-300/80 rounded-xl  bg-[white] text-slate-400 text-xs font-medium">
                  No Source Items selected. Click "Select Source Trace Items" to pick stock items to process.
                </div>
              )}
            </div>

            {/* 2. TARGET ITEMS SECTION */}
            <div className="border border-emerald-200 rounded-2xl bg-emerald-50/30 p-5 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-emerald-600" />
                  <div>
                    <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider m-0">
                      Target Output Products ({targetItems.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 m-0 font-medium">Add target output product catalog items, quantity & pricing</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(true)}
                  className="px-3 py-1.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  <Package size={13} /> Add Target Item
                </button>
              </div>

              {targetItems.length > 0 ? (
                <div className="space-y-3">
                  {targetItems.map((tgt, idx) => {
                    const itemQty = parseFloat(tgt.qty) || 0;
                    const itemPrice = parseFloat(tgt.price) || 0;
                    const itemBasic = itemQty * itemPrice;
                    const itemGst = calcItemGst(tgt);
                    const itemTotal = itemBasic + itemGst;

                    return (
                      <div key={idx} className="bg-[white] border border-emerald-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="space-y-0.5 flex-1">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span>{tgt.item_code}</span>
                              {tgt.process_name && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                                  {tgt.process_name}
                                </span>
                              )}
                            </div>
                            {tgt.description && <div className="text-[10px] text-slate-500 truncate">{tgt.description}</div>}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 font-bold block uppercase">Total</span>
                              <span className="text-xs font-mono font-black text-emerald-950">₹{itemTotal.toFixed(2)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTargetItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                              title="Remove Target Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Editable Qty, Unit Price, GST Rate Search, Item Total */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Qty *</label>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={tgt.qty}
                              onChange={(e) => updateTargetItem(idx, 'qty', e.target.value)}
                              className="w-full px-2.5 py-1.5 font-bold text-xs text-slate-800 bg-[white] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Unit Price (₹) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tgt.price}
                              onChange={(e) => updateTargetItem(idx, 'price', e.target.value)}
                              className="w-full px-2.5 py-1.5 font-bold text-xs text-slate-800 bg-[white] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]"
                            />
                          </div>

                          {/* GST Rate search for Target Item */}
                          <div
                            className="relative"
                            style={{ zIndex: targetGstDropdownOpen[idx] ? 100 : 'auto' }}
                            ref={el => targetGstRefs.current[idx] = el}
                          >
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">GST Rate</label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={gstType ? `Inherit: ${gstType} (${gstRate}%)` : "e.g. GST 18"}
                                value={targetGstSearchInput[idx] ?? (tgt.gst_type ? `${tgt.gst_type} (${tgt.gst_rate}%)` : '')}
                                onChange={(e) => handleTargetGstSearch(idx, e.target.value)}
                                onFocus={() => {
                                  setTargetGstDropdownOpen(prev => ({ ...prev, [idx]: true }));
                                  fetchTargetGstSuggestions(idx, targetGstSearchInput[idx] || '');
                                }}
                                className="w-full pl-2.5 pr-6 py-1.5 text-xs text-slate-800 bg-[white] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)] font-medium"
                                autoComplete="off"
                              />
                              {tgt.gst_type && (
                                <button
                                  type="button"
                                  onClick={() => clearTargetItemGst(idx)}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {targetGstDropdownOpen[idx] && (targetGstSuggestions[idx] || []).length > 0 && (
                              <div
                                className="absolute z-50 left-0 right-0 mt-1 bg-[white] border border-slate-300 rounded-lg shadow-xl max-h-44 overflow-y-auto"
                                style={{ backgroundColor: '#ffffff', opacity: 1 }}
                              >
                                {(targetGstSuggestions[idx] || []).map(g => (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => selectTargetItemGst(idx, g)}
                                    className="w-full text-left px-2.5 py-1.5 bg-[white] hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer block"
                                    style={{ backgroundColor: '#ffffff' }}
                                  >
                                    <span className="font-bold text-xs text-slate-900">{g.type}</span>
                                    <span className="text-[10px] text-slate-500 ml-1.5">({g.rate}%)</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Item Total (₹)</label>
                            <div className="px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                              ₹{itemTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-emerald-300/80 rounded-xl bg-[white] text-slate-500 text-xs font-medium space-y-1">
                  <p className="font-bold text-slate-700 m-0">No Target Items added yet.</p>
                  <p className="text-[11px] text-slate-400 m-0">
                    {isContractOrderMode
                      ? selectedContract
                        ? 'Search an item code from the ARC contract in step 3 above to add target output products with agreed rates.'
                        : 'Select an ARC contract in step 2 above, then search item code to add target products.'
                      : 'Click "Add Target Item" to select target product code, quantity & price.'}
                  </p>
                </div>
              )}
            </div>

            {/* 3. FINANCIAL SUMMARY & TAXES / CHARGES SECTION */}
            <div className="border border-slate-300 rounded-2xl bg-slate-50 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <DollarSign size={18} className="text-slate-700" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider m-0">
                  Financial Summary & Charges (PO Card)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                
                {/* Basic Value */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Basic Value (₹)
                  </label>
                  <div className="px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800">
                    ₹{calcTargetBasicTotal().toFixed(2)}
                  </div>
                </div>

                {/* GST Rate (Search-based autocomplete) */}
                <div
                  className="relative"
                  style={{ zIndex: showSummaryGstDropdown ? 100 : 'auto' }}
                  ref={summaryGstRef}
                >
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GST Rate
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. GST 18"
                      value={summaryGstInput || (gstType ? `${gstType} (${gstRate}%)` : '')}
                      onChange={(e) => handleSummaryGstSearch(e.target.value)}
                      onFocus={() => {
                        setShowSummaryGstDropdown(true);
                        fetchSummaryGstSuggestions(summaryGstInput || '');
                      }}
                      className="w-full pl-3 pr-7 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                      autoComplete="off"
                    />
                    {gstType && (
                      <button
                        type="button"
                        onClick={clearSummaryGst}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {showSummaryGstDropdown && summaryGstSuggestions.length > 0 && (
                    <div
                      className="absolute z-50 left-0 right-0 mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                      style={{ backgroundColor: '#ffffff', opacity: 1 }}
                    >
                      {summaryGstSuggestions.map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => selectSummaryGst(g)}
                          className="w-full text-left px-3 py-2 bg-[white] hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer block"
                          style={{ backgroundColor: '#ffffff' }}
                        >
                          <span className="font-bold text-xs text-slate-900">{g.type}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({g.rate}%)</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    GST Amount: ₹{calcGstAmount().toFixed(2)}
                  </div>
                </div>

                {/* Transport Charges */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Transport (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

                {/* Packing & Forwarding */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Packing/Forwarding (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packingForward}
                    onChange={(e) => setPackingForward(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

                {/* Other Charges */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Other Charges (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

              </div>

              {/* Grand Total Callout */}
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <div className="w-full sm:w-auto p-4 rounded-2xl text-white shadow-md flex items-center gap-4 justify-between sm:justify-end" style={{ backgroundColor: 'var(--theme-color)' }}>
                  <div>
                    <span className="text-[10px] uppercase font-black text-white/80 tracking-wider block">
                      Grand Total PO Amount
                    </span>
                    <span className="text-2xl font-black font-mono tracking-tight">
                      ₹{calcGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM ACTIONS */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/dashboard')}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.target.style.filter = 'none'}
              >
                {isSaving ? (
                  <><RefreshCw size={15} className="animate-spin" /> {isContractOrderMode ? 'Creating Contract Order...' : 'Creating Process PO...'}</>
                ) : (
                  isContractOrderMode ? 'Create Process Contract Order' : 'Create Process Purchase Order'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* SOURCE ITEM SELECTOR MODAL */}
      <InventoryTraceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onApply={handleApplySourceSelections}
        initialSelections={sourceItems}
        apiEndpoint="/api/process-po/trace-items"
      />

      {/* TARGET ITEM SELECTOR MODAL */}
      <TargetItemSelectorModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onApply={handleApplyTargetSelection}
        initialTargetItem={{}}
      />
    </div>
  );
}
