import { NavLink, Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import LoginView from './pages/Login'
import Dashboard from './pages/Dashboard'
import TradeView from './pages/Trade'
import './App.css'
import PurchaseOrderForm from './form/PurchaseOrderForm'
import ReleaseOrderForm from './form/ReleaseOrderForm'
import RfqForm from './form/RfqForm'
import QuotationForm from './form/QuotationForm'
import ReceivedQuotationForm from './form/ReceivedQuotationForm'
import ReceivedPurchaseOrderForm from './form/ReceivedPurchaseOrderForm'
import DeliveryNoteForm from './form/DeliveryNoteForm'
import InvoiceForm from './form/InvoiceForm'
import PurchaseOrderView from './pages/PurchaseOrderView'
import ReleaseOrderView from './pages/ReleaseOrderView'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <div className="min-h-screen text-slate-100">
      
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginView />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/addRfq" element={<RfqForm />} />
          <Route path="/updateRfq/:id" element={<RfqForm />} />
          <Route path="/addQuotation" element={<QuotationForm />} />
          <Route path="/updateQuotation/:id" element={<QuotationForm />} />
          <Route path="/addReceivedQuotation" element={<ReceivedQuotationForm />} />
          <Route path="/updateReceivedQuotation/:id" element={<ReceivedQuotationForm />} />
          <Route path="/addPurchaseOrder" element={<PurchaseOrderForm />} />
          <Route path="/updatePurchaseOrder/:id" element={<PurchaseOrderForm />} />
          <Route path="/addReceivedPurchaseOrder" element={<ReceivedPurchaseOrderForm />} />
          <Route path="/updateReceivedPurchaseOrder/:id" element={<ReceivedPurchaseOrderForm />} />
          <Route path="/addReleaseOrder" element={<ReleaseOrderForm />} />
          <Route path="/updateReleaseOrder/:id" element={<ReleaseOrderForm />} />
          <Route path="/addDeliveryNote" element={<DeliveryNoteForm />} />
          <Route path="/updateDeliveryNote/:id" element={<DeliveryNoteForm />} />
          <Route path="/addInvoice" element={<InvoiceForm />} />
          <Route path="/updateInvoice/:id" element={<InvoiceForm />} />
          <Route path="/order/:po_no" element={<PurchaseOrderView />} />
          <Route path="/release-order/:ro_no" element={<ReleaseOrderView />} />
          <Route path="/trade/:tradeid" element={<TradeView />} />
        </Route>

        <Route
          path="*"
          element={
            <main className="min-h-[calc(100vh-72px)] p-6 text-slate-100">
              <div className="mx-auto max-w-4xl rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-xl shadow-slate-950/20">
                <h1 className="text-4xl font-semibold text-white">Page not found</h1>
                <p className="mt-4 text-slate-300">
                  The page you are looking for does not exist. Use the navigation above to return to a valid route.
                </p>
              </div>
            </main>
          }
        />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
    </div>
  )
}

export default App
