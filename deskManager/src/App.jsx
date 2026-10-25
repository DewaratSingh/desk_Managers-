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
import CreatePurchaseOrderForm from './form/Sell/RecivedPO/CreatePurchaseOrderForm'
import UpdatePurchaseOrderForm from './form/Sell/RecivedPO/UpdatePurchaseOrderForm'
import CreateReleaseOrderForm from './form/Sell/RecivedRO/CreateReleaseOrderForm'
import UpdateReleaseOrderForm from './form/Sell/RecivedRO/UpdateReleaseOrderForm'
import CreateRfqForm from './form/Sell/RecivedQ(RFQ)/CreateRfqForm'
import CreateProcessRfqForm from './form/sell_process/CreateProcessRfqForm'
import UpdateProcessRfqForm from './form/sell_process/UpdateProcessRfqForm'
import {
  CreateProcessReceivedQuotationForm,
  UpdateProcessReceivedQuotationForm,
  ProcessRqForm,
  CreateProcessPurchaseOrderForm,
  UpdateProcessPurchaseOrderForm,
  CreateProcessContractOrderForm,
  UpdateProcessContractOrderForm
} from './form/buy_process'
// process forms imported from ./form/buy_process
// buy_process forms handled above
import UpdateRfqForm from './form/Sell/RecivedQ(RFQ)/UpdateRfqForm'
import CreateQuotationForm from './form/Sell/SendQuotation/CreateQuotationForm'
import UpdateQuotationForm from './form/Sell/SendQuotation/UpdateQuotationForm'
import CreateReceivedQuotationForm from './form/Buy/ReceivedQuotation/CreateReceivedQuotationForm'
import UpdateReceivedQuotationForm from './form/Buy/ReceivedQuotation/UpdateReceivedQuotationForm'
import CreateReceivedPurchaseOrderForm from './form/Buy/sendPO/CreateReceivedPurchaseOrderForm'
import UpdateReceivedPurchaseOrderForm from './form/Buy/sendPO/UpdateReceivedPurchaseOrderForm'
import CreateContractOrderForm from './form/Buy/sendRO/CreateContractOrderForm'
import UpdateContractOrderForm from './form/Buy/sendRO/UpdateContractOrderForm'
// ProcessRqForm from buy_process
// ProcessPoForm replaced by CreateProcessPurchaseOrderForm
import DeliveryNoteForm from './form/DeliveryNoteForm'
import SellStockForm from './form/Sell/SellStockForm'
import InvoiceForm from './form/InvoiceForm'
import PurchaseOrderView from './pages/PurchaseOrderView'
import ReleaseOrderView from './pages/ReleaseOrderView'
import ProtectedRoute from './components/ProtectedRoute'
import TraceHistory from './pages/TraceHistory'
import DeliveryHistory from './pages/DeliveryHistory'
import Layout from './layout/Layout'
import AddCustomerView from './pages/AddCustomer'
import AddBuyerView from './pages/AddBuyer'
import AddItemView from './pages/AddItem'
import InventoryView from './pages/Inventory'
import ArcView from './pages/Arc'
import GstCategoryView from './pages/GstCategory'
import ManufactureList from './pages/ManufactureList'
import ProcessPoList from './pages/ProcessPoList'
import Backup from './pages/Backup'
import Monitor from './pages/Monitor'
import Settings from './pages/Settings'
import UnderConstruction from './pages/UnderConstruction'

function App() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300">
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LoginView />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/signup" element={<SignupView />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/addPurchaseOrder" element={<CreatePurchaseOrderForm />} />
            <Route path="/updatePurchaseOrder/:id" element={<UpdatePurchaseOrderForm />} />
            <Route path="/addReceivedPurchaseOrder" element={<CreateReceivedPurchaseOrderForm />} />
            <Route path="/updateReceivedPurchaseOrder/:id" element={<UpdateReceivedPurchaseOrderForm />} />
            <Route path="/addContractOrder" element={<CreateContractOrderForm />} />
            <Route path="/updateContractOrder/:id" element={<UpdateContractOrderForm />} />
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
            <Route path="/inventory/trace-history/:id" element={<TraceHistory />} />
            <Route path="/delivery/history/:id" element={<DeliveryHistory />} />
            <Route path="/inventory/sell" element={<SellStockForm />} />
            <Route path="/manufacture" element={<ManufactureList />} />
            <Route path="/manufactures" element={<ManufactureList />} />
            <Route path="/addProcessRq" element={<CreateProcessReceivedQuotationForm />} />
            <Route path="/process-rq" element={<CreateProcessReceivedQuotationForm />} />
            <Route path="/updateProcessRq/:id" element={<UpdateProcessReceivedQuotationForm />} />
            <Route path="/arc" element={<ArcView />} />
            <Route path="/gst-category" element={<GstCategoryView />} />
            <Route path="/users" element={<AddUserView />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/under-construction" element={<UnderConstruction />} />
          </Route>
          <Route path="/construction" element={<UnderConstruction />} />
          <Route path="/addRfq" element={<CreateRfqForm />} />
          <Route path="/addProcessRfq" element={<CreateProcessRfqForm />} />
          <Route path="/updateProcessRfq/:id" element={<UpdateProcessRfqForm />} />
          <Route path="/addProcessReceivedQuotation" element={<CreateProcessReceivedQuotationForm />} />
          <Route path="/updateProcessReceivedQuotation/:id" element={<UpdateProcessReceivedQuotationForm />} />
          <Route path="/updateRfq/:id" element={<UpdateRfqForm />} />
          <Route path="/addQuotation" element={<CreateQuotationForm />} />
          <Route path="/updateQuotation/:id" element={<UpdateQuotationForm />} />
          <Route path="/addReleaseOrder" element={<CreateReleaseOrderForm />} />
          <Route path="/updateReleaseOrder/*" element={<UpdateReleaseOrderForm />} />
          <Route path="/addReceivedQuotation" element={<CreateReceivedQuotationForm />} />
          <Route path="/updateReceivedQuotation/:id" element={<UpdateReceivedQuotationForm />} />
          <Route path="/addProcessPurchaseOrder" element={<CreateProcessPurchaseOrderForm />} />
          <Route path="/updateProcessPurchaseOrder/:id" element={<UpdateProcessPurchaseOrderForm />} />
          <Route path="/addProcessContractOrder" element={<CreateProcessContractOrderForm />} />
          <Route path="/updateProcessContractOrder/:id" element={<UpdateProcessContractOrderForm />} />
          <Route path="/updateProcessContractOrder/*" element={<UpdateProcessContractOrderForm />} />
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
