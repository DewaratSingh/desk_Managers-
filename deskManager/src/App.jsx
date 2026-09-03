import { NavLink, Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import HomeView from './pages/Home'
import SignupView from './pages/Signup'
import LoginView from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddUserView from './pages/AddUser'
import TradeView from './pages/Trade'
import './App.css'
import PurchaseOrderForm from './form/PurchaseOrderForm'
import ReleaseOrderForm from './form/ReleaseOrderForm'
import RfqForm from './form/RfqForm'
import QuotationForm from './form/QuotationForm'
import ReceivedQuotationForm from './form/ReceivedQuotationForm'
import ReceivedPurchaseOrderForm from './form/ReceivedPurchaseOrderForm'
import DeliveryNoteForm from './form/DeliveryNoteForm'
import SellStockForm from './form/SellStockForm'
import InvoiceForm from './form/InvoiceForm'
import PurchaseOrderView from './pages/PurchaseOrderView'
import ReleaseOrderView from './pages/ReleaseOrderView'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AddCustomerView from './pages/AddCustomer'
import AddBuyerView from './pages/AddBuyer'
import AddItemView from './pages/AddItem'
import InventoryView from './pages/Inventory'
import ArcView from './pages/Arc'
import GstCategoryView from './pages/GstCategory'
import ManufactureList from './pages/ManufactureList'
import ManufactureForm from './form/ManufactureForm'

function App() {
  return (
    <div className="min-h-screen text-slate-100">
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomeView />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/signup" element={<SignupView />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/addPurchaseOrder" element={<PurchaseOrderForm />} />
            <Route path="/updatePurchaseOrder/:id" element={<PurchaseOrderForm />} />
            <Route path="/addReceivedPurchaseOrder" element={<ReceivedPurchaseOrderForm />} />
            <Route path="/updateReceivedPurchaseOrder/:id" element={<ReceivedPurchaseOrderForm />} />
            <Route path="/addDeliveryNote" element={<DeliveryNoteForm />} />
            <Route path="/updateDeliveryNote/:id" element={<DeliveryNoteForm />} />
            <Route path="/addInvoice" element={<InvoiceForm />} />
            <Route path="/updateInvoice/:id" element={<InvoiceForm />} />
            <Route path="/order" element={<Dashboard activeTab="purchase-order" />} />
            <Route path="/order/:po_no" element={<PurchaseOrderView />} />
            <Route path="/release-order/*" element={<ReleaseOrderView />} />
            <Route path="/trade/:tradeid" element={<TradeView />} />
            <Route path="/trade/:tradeid/:deliveryId" element={<TradeView />} />
            <Route path="/party" element={<AddCustomerView />} />
            <Route path="/buyer" element={<AddBuyerView />} />
            <Route path="/item" element={<AddItemView />} />
            <Route path="/inventory" element={<InventoryView />} />
            <Route path="/inventory/sell" element={<SellStockForm />} />
            <Route path="/inventory/manufacture" element={<ManufactureForm />} />
            <Route path="/manufactures" element={<ManufactureList />} />
            <Route path="/arc" element={<ArcView />} />
            <Route path="/gst-category" element={<GstCategoryView />} />
            <Route path="/users" element={<AddUserView />} />
          </Route>
          <Route path="/addRfq" element={<RfqForm />} />
          <Route path="/updateRfq/:id" element={<RfqForm />} />
          <Route path="/addQuotation" element={<QuotationForm />} />
          <Route path="/updateQuotation/:id" element={<QuotationForm />} />
          <Route path="/addReleaseOrder" element={<ReleaseOrderForm />} />
          <Route path="/updateReleaseOrder/*" element={<ReleaseOrderForm />} />
          <Route path="/addReceivedQuotation" element={<ReceivedQuotationForm />} />
          <Route path="/updateReceivedQuotation/:id" element={<ReceivedQuotationForm />} />
          <Route path="/party/form" element={<AddCustomerView />} />
          <Route path="/buyer/form" element={<AddBuyerView />} />
          <Route path="/item/form" element={<AddItemView />} />
          <Route path="/gst-category/form" element={<GstCategoryView />} />
          <Route path="/arc/form" element={<ArcView />} />
          <Route path="/inventory/form" element={<InventoryView />} />
          <Route path="/users/form" element={<AddUserView />} />
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
