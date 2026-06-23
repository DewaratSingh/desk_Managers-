import { createContext, useContext, useState } from 'react';

const EMPTY_FORM = {
  received_quotation_no: '',
  buyer_id: '',
  buyer_email: '',
  buyer_phone: '',
  customer_id: '',
  quotation_date: '',
  terms_and_conditions: ''
};

const ReceivedQuotationContext = createContext(null);

export function ReceivedQuotationProvider({ children }) {
  const [activeRqId, setActiveRqId] = useState(undefined); // undefined = uninitialized, null = new, string = editing ID
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedItems, setSelectedItems] = useState([]);
  const [buyerInput, setBuyerInput] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [itemInput, setItemInput] = useState('');
  const [historyItem, setHistoryItem] = useState(null);

  const resetRqState = (id) => {
    setActiveRqId(id);
    setFormData({
      ...EMPTY_FORM,
      quotation_date: new Date().toISOString().split('T')[0]
    });
    setSelectedItems([]);
    setBuyerInput('');
    setCustomerInput('');
    setItemInput('');
    setHistoryItem(null);
  };

  return (
    <ReceivedQuotationContext.Provider value={{
      activeRqId,
      setActiveRqId,
      formData,
      setFormData,
      selectedItems,
      setSelectedItems,
      buyerInput,
      setBuyerInput,
      customerInput,
      setCustomerInput,
      itemInput,
      setItemInput,
      historyItem,
      setHistoryItem,
      resetRqState
    }}>
      {children}
    </ReceivedQuotationContext.Provider>
  );
}

export function useReceivedQuotation() {
  const context = useContext(ReceivedQuotationContext);
  if (!context) {
    throw new Error('useReceivedQuotation must be used within a ReceivedQuotationProvider');
  }
  return context;
}
