import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import AddCustomerView from './components/AddCustomerView';
import AddBuyerView from './components/AddBuyerView';
import AddItemView from './components/AddItemView';
import RFQView from './components/RFQView';
import RFQDetailView from './components/RFQDetailView';
import AddQuotationView from './components/AddQuotationView';
import LoginView from './components/LoginView';
import ToastContainer from './components/Toast';

const API_BASE_URL = 'http://localhost:5000/api';

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

  // General States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

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
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const handleRemoveToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchAllData = async (tkn) => {
    const activeToken = tkn || token;
    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${activeToken}` };
      const [custRes, buyerRes, itemRes, rfqRes, quotationRes] = await Promise.all([
        fetch(`${API_BASE_URL}/customers`, { headers }),
        fetch(`${API_BASE_URL}/buyers`, { headers }),
        fetch(`${API_BASE_URL}/items`, { headers }),
        fetch(`${API_BASE_URL}/rfqs`, { headers }),
        fetch(`${API_BASE_URL}/quotations`, { headers }),
      ]);

      if (
        custRes.status === 401 ||
        buyerRes.status === 401 ||
        itemRes.status === 401 ||
        rfqRes.status === 401 ||
        quotationRes.status === 401
      ) {
        clearSession();
        return;
      }

      if (!custRes.ok || !buyerRes.ok || !itemRes.ok || !rfqRes.ok || !quotationRes.ok) {
        throw new Error('Some API requests failed');
      }

      setCustomers(await custRes.json());
      setBuyers(await buyerRes.json());
      setItems(await itemRes.json());
      setRfqs(await rfqRes.json());
      setQuotations(await quotationRes.json());
    } catch (err) {
      console.error('Error fetching data:', err.message);
      setError('Unable to connect to the API. Please verify the backend service is running on port 5000.');
    } finally {
      setIsLoading(false);
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
            isLoading={isLoading}
            error={error}
          />
        );
      case 'add-buyer':
        return (
          <AddBuyerView
            buyers={buyers}
            onAddBuyer={handleAddBuyer}
            onUpdateBuyer={handleUpdateBuyer}
            onDeleteBuyer={handleDeleteBuyer}
            isLoading={isLoading}
            error={error}
          />
        );
      case 'add-item':
        return (
          <AddItemView
            items={items}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            isLoading={isLoading}
            error={error}
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
            isLoading={isLoading}
            error={error}
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
        <ToastContainer toasts={toasts} onClose={handleRemoveToast} />
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

              <ToastContainer toasts={toasts} onClose={handleRemoveToast} />
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
        </Routes>
      </BrowserRouter>
    );
}
