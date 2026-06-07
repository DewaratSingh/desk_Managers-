import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import AddCustomerView from './components/AddCustomerView';
import AddBuyerView from './components/AddBuyerView';
import AddItemView from './components/AddItemView';
import RFQView from './components/RFQView';
import RFQDetailView from './components/RFQDetailView';
import QuotationDetailView from './components/QuotationDetailView';
import AddQuotationView from './components/AddQuotationView';
import ReceivedQuotationView from './components/ReceivedQuotationView';
import ReceivedQuotationDetailView from './components/ReceivedQuotationDetailView';
import PurchaseOrderView from './components/PurchaseOrderView';
import PurchaseOrderDetailView from './components/PurchaseOrderDetailView';
import LoginView from './components/LoginView';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Auth state
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // true on first mount (session check)
  const [authError, setAuthError] = useState(null);

  // Data lists
  const [customers, setCustomers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [items, setItems] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [receivedQuotations, setReceivedQuotations] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // General States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forceFormOpen, setForceFormOpen] = useState(null); // 'customer', 'buyer', 'item' or null

  // ============================================================================
  // AUTH LIFECYCLE
  // ============================================================================

  // On mount: check localStorage for a saved session and verify it against server
  useEffect(() => {
    const savedToken = localStorage.getItem('dm_token');
    const savedUser = localStorage.getItem('dm_user');

    if (savedToken && savedUser) {
      // Optimistically restore session, then verify
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      verifyToken(savedToken);
    } else {
      setAuthLoading(false); // No saved session — show login immediately
    }
  }, []);

  const verifyToken = async (tkn) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${tkn}` }
      });
      if (!res.ok) {
        // Session is no longer valid (server restarted, etc.) — force re-login
        clearSession();
      }
    } catch {
      // Network error — keep optimistic session rather than forcing logout
    } finally {
      setAuthLoading(false);
    }
  };

  const clearSession = () => {
    localStorage.removeItem('dm_token');
    localStorage.removeItem('dm_user');
    setToken(null);
    setUser(null);
    setCustomers([]);
    setBuyers([]);
    setItems([]);
    setRfqs([]);
    setQuotations([]);
    setReceivedQuotations([]);
    setPurchaseOrders([]);
  };

  const handleLogin = async (username, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Login failed. Please check your credentials.');
        return;
      }

      // Persist session to localStorage
      localStorage.setItem('dm_token', data.token);
      localStorage.setItem('dm_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch {
      setAuthError('Cannot reach the server. Please ensure the backend is running on port 5000.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setActiveTab('dashboard');
    triggerToast('You have been signed out.', 'info');
  };

  // Helper: returns Authorization header object whenever token is available
  const authHeaders = () =>
    token ? { 'Authorization': `Bearer ${token}` } : {};

  // ============================================================================
  // DATA FETCHING (only when authenticated)
  // ============================================================================

  useEffect(() => {
    if (token) {
      fetchAllData(token);
    }
  }, [token]);

  const triggerToast = (message, type = 'success') => {
    toast[type](message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: "colored",
    });
  };

  const fetchAllData = async (tkn) => {
    const activeToken = tkn || token;
    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${activeToken}` };
      const [custRes, buyerRes, itemRes, rfqRes, quotationRes, receivedQuotationRes, poRes] = await Promise.all([
        fetch(`${API_BASE_URL}/customers?limit=20&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/buyers?limit=20&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/items?limit=20&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/rfqs?limit=20&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/quotations?limit=20&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/received-quotations?limit=20&offset=0`, { headers }),
        fetch(`${API_BASE_URL}/purchase-orders?limit=20&offset=0`, { headers }),
      ]);

      if (
        custRes.status === 401 ||
        buyerRes.status === 401 ||
        itemRes.status === 401 ||
        rfqRes.status === 401 ||
        quotationRes.status === 401 ||
        receivedQuotationRes.status === 401 ||
        poRes.status === 401
      ) {
        clearSession();
        return;
      }

      if (!custRes.ok || !buyerRes.ok || !itemRes.ok || !rfqRes.ok || !quotationRes.ok || !receivedQuotationRes.ok || !poRes.ok) {
        throw new Error('Some API requests failed');
      }

      setCustomers(await custRes.json());
      setBuyers(await buyerRes.json());
      setItems(await itemRes.json());
      setRfqs(await rfqRes.json());
      setQuotations(await quotationRes.json());
      setReceivedQuotations(await receivedQuotationRes.json());
      setPurchaseOrders(await poRes.json());
    } catch (err) {
      console.error('Error fetching data:', err.message);
      setError('Unable to connect to the API. Please verify the backend service is running on port 5000.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMoreData = async (resource, offset, searchQuery = '') => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const url = `${API_BASE_URL}/${resource}?limit=20&offset=${offset}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to load more data');
      const newData = await res.json();
      
      if (resource === 'customers') setCustomers(prev => [...prev, ...newData]);
      else if (resource === 'buyers') setBuyers(prev => [...prev, ...newData]);
      else if (resource === 'items') setItems(prev => [...prev, ...newData]);
      else if (resource === 'rfqs') setRfqs(prev => [...prev, ...newData]);
      else if (resource === 'quotations') setQuotations(prev => [...prev, ...newData]);
      else if (resource === 'received-quotations') setReceivedQuotations(prev => [...prev, ...newData]);
      else if (resource === 'purchase-orders') setPurchaseOrders(prev => [...prev, ...newData]);
      
      return newData;
    } catch (err) {
      triggerToast(err.message, 'error');
      return [];
    }
  };

  const searchResource = async (resource, searchQuery) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const url = `${API_BASE_URL}/${resource}?limit=20&offset=0${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      if (resource === 'customers') setCustomers(data);
      else if (resource === 'buyers') setBuyers(data);
      else if (resource === 'items') setItems(data);
      else if (resource === 'rfqs') setRfqs(data);
      else if (resource === 'quotations') setQuotations(data);
      else if (resource === 'received-quotations') setReceivedQuotations(data);
      else if (resource === 'purchase-orders') setPurchaseOrders(data);
      
      return data;
    } catch (err) {
      triggerToast(err.message, 'error');
      return [];
    }
  };

  // ============================================================================
  // CUSTOMER HANDLERS
  // ============================================================================

  const handleAddCustomer = async (customerData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(customerData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add customer');

      setCustomers((prev) => [data, ...prev]);
      triggerToast('Customer successfully added!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCustomer = async (id, customerData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(customerData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update customer');

      setCustomers((prev) => prev.map((c) => (c.id === id ? data : c)));
      triggerToast('Customer details successfully updated!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer record?')) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete customer');

      setCustomers((prev) => prev.filter((c) => c.id !== id));
      triggerToast('Customer record deleted.', 'success');
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // BUYER HANDLERS
  // ============================================================================

  const handleAddBuyer = async (buyerData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/buyers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(buyerData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add buyer');

      setBuyers((prev) => [data, ...prev]);
      triggerToast('Buyer successfully registered!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBuyer = async (id, buyerData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/buyers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(buyerData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update buyer');

      setBuyers((prev) => prev.map((b) => (b.id === id ? data : b)));
      triggerToast('Buyer details updated!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBuyer = async (id) => {
    if (!window.confirm('Delete this buyer record permanently?')) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/buyers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete buyer');

      setBuyers((prev) => prev.filter((b) => b.id !== id));
      triggerToast('Buyer account removed.', 'success');
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // ITEM HANDLERS
  // ============================================================================

  const handleAddItem = async (itemData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(itemData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');

      setItems((prev) => [data, ...prev]);
      triggerToast('Item added to catalog!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItem = async (item_code, itemData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/items/${item_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(itemData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update item');

      setItems((prev) => prev.map((i) => (i.item_code === item_code ? data : i)));
      triggerToast('Item details updated successfully!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (item_code) => {
    if (!window.confirm('Remove this item from the catalog?')) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/items/${item_code}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete item');

      setItems((prev) => prev.filter((i) => i.item_code !== item_code));
      triggerToast('Item deleted from catalog.', 'success');
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RFQ HANDLERS
  // ============================================================================

  const handleAddRFQ = async (rfqData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/rfqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(rfqData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add RFQ');
      setRfqs((prev) => [data, ...prev]);
      triggerToast('RFQ successfully saved!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRFQ = async (rfq_no, rfqData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/rfqs/${rfq_no}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(rfqData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update RFQ');
      setRfqs((prev) => prev.map((r) => (r.rfq_no === rfq_no ? data : r)));
      triggerToast('RFQ updated successfully!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RECEIVED QUOTATION HANDLERS
  // ============================================================================

  const handleAddReceivedQuotation = async (quotationData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/received-quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(quotationData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add received quotation');
      setReceivedQuotations((prev) => [data, ...prev]);
      triggerToast('Received quotation successfully saved!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateReceivedQuotation = async (received_quotation_no, quotationData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/received-quotations/${received_quotation_no}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(quotationData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update received quotation');
      setReceivedQuotations((prev) => prev.map((q) => (q.received_quotation_no === received_quotation_no ? data : q)));
      triggerToast('Received quotation updated successfully!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // QUOTATION HANDLERS
  // ============================================================================

  const handleAddQuotation = async (quotationData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(quotationData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add quotation');
      setQuotations((prev) => [data, ...prev]);
      triggerToast('Quotation successfully saved!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuotation = async (quotation_no, quotationData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotation_no}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(quotationData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update quotation');
      setQuotations((prev) => prev.map((q) => (q.quotation_no === quotation_no ? data : q)));
      triggerToast('Quotation updated successfully!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // PURCHASE ORDER HANDLERS
  // ============================================================================

  const handleAddPurchaseOrder = async (poData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(poData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add purchase order');
      setPurchaseOrders((prev) => [data, ...prev]);
      triggerToast('Purchase Order successfully saved!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePurchaseOrder = async (po_no, poData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${po_no}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(poData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update purchase order');
      setPurchaseOrders((prev) => prev.map((po) => (po.po_no === po_no ? data : po)));
      triggerToast('Purchase Order updated successfully!', 'success');
      return true;
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePurchaseOrder = async (po_no) => {
    if (!window.confirm('Remove this Purchase Order permanently?')) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${po_no}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete purchase order');
      setPurchaseOrders((prev) => prev.filter((po) => po.po_no !== po_no));
      triggerToast('Purchase Order deleted successfully.', 'success');
    } catch (err) {
      setError(err.message);
      triggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'add-customer':
        return (
          <AddCustomerView
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            forceFormOpen={forceFormOpen === 'customer'}
            onClearForceFormOpen={() => setForceFormOpen(null)}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      case 'add-buyer':
        return (
          <AddBuyerView
            buyers={buyers}
            onAddBuyer={handleAddBuyer}
            onUpdateBuyer={handleUpdateBuyer}
            onDeleteBuyer={handleDeleteBuyer}
            forceFormOpen={forceFormOpen === 'buyer'}
            onClearForceFormOpen={() => setForceFormOpen(null)}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      case 'add-item':
        return (
          <AddItemView
            items={items}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            forceFormOpen={forceFormOpen === 'item'}
            onClearForceFormOpen={() => setForceFormOpen(null)}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      case 'rfq':
        return (
          <RFQView
            rfqs={rfqs}
            buyers={buyers}
            customers={customers}
            items={items}
            onAddRFQ={handleAddRFQ}
            onUpdateRFQ={handleUpdateRFQ}
            onNavigateAndOpenForm={(tab, type) => {
              setActiveTab(tab);
              setForceFormOpen(type);
            }}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      case 'quotation':
        return (
          <AddQuotationView
            rfqs={rfqs}
            quotations={quotations}
            onAddQuotation={handleAddQuotation}
            onUpdateQuotation={handleUpdateQuotation}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      case 'received-quotation':
        return (
          <ReceivedQuotationView
            buyers={buyers}
            items={items}
            receivedQuotations={receivedQuotations}
            onAddReceivedQuotation={handleAddReceivedQuotation}
            onUpdateReceivedQuotation={handleUpdateReceivedQuotation}
            onNavigateAndOpenForm={(tab, type) => {
              setActiveTab(tab);
              setForceFormOpen(type);
            }}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      case 'purchase-order':
        return (
          <PurchaseOrderView
            quotations={quotations}
            purchaseOrders={purchaseOrders}
            onAddPurchaseOrder={handleAddPurchaseOrder}
            onUpdatePurchaseOrder={handleUpdatePurchaseOrder}
            onDeletePurchaseOrder={handleDeletePurchaseOrder}
            isLoading={isLoading}
            error={error}
            fetchMoreData={fetchMoreData}
            searchResource={searchResource}
          />
        );
      default:
        return <DashboardView />;
    }
  };

  // ── Full-screen loading splash (only during initial session verification) ──
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-10 w-10 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-slate-500 font-bold text-sm tracking-wide">Loading DeskManager…</p>
        </div>
      </div>
    );
  }

  // ── Route Guard: show Login if no token ──
  if (!token) {
    return (
      <>
        <LoginView
          onLogin={handleLogin}
          isLoading={authLoading}
          error={authError}
        />
        <ToastContainer />
      </>
    );
  }

  // ── Authenticated workspace ──
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <div className="flex flex-col lg:flex-row min-h-screen w-screen bg-[#f1f5f9] text-slate-900 overflow-hidden">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                user={user}
                onLogout={handleLogout}
              />

              <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
                {renderActiveView()}
              </main>
            </div>
          } />
          <Route path="/rfq/:rfq_no" element={
            <RFQDetailView
              rfqs={rfqs}
              buyers={buyers}
              customers={customers}
              items={items}
            />
          } />
          <Route path="/quotation/:quotation_no" element={
            <QuotationDetailView
              quotations={quotations}
              rfqs={rfqs}
              customers={customers}
              buyers={buyers}
            />
          } />
          <Route path="/received-quotation/:received_quotation_no" element={
            <ReceivedQuotationDetailView
              receivedQuotations={receivedQuotations}
              buyers={buyers}
            />
          } />
          <Route path="/purchase-order/:po_no" element={
            <PurchaseOrderDetailView
              purchaseOrders={purchaseOrders}
              quotations={quotations}
              rfqs={rfqs}
              customers={customers}
              buyers={buyers}
            />
          } />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    );
}
