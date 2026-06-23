import { createContext, useContext, useState } from 'react';

const EMPTY_FORM = {
  rfq_no: '',
  rfq_date: '',
  commercial_bid_due_date: '',
  technical_bid_due_date: '',
  buyer_id: '',
  buyer_email: '',
  buyer_phone: '',
  customer_id: ''
};

const RfqContext = createContext(null);

export function RfqProvider({ children }) {
  const [activeRfqId, setActiveRfqId] = useState(undefined); // undefined = uninitialized, null = new, string = editing ID
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedItems, setSelectedItems] = useState([]);
  const [buyerInput, setBuyerInput] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const resetRfqState = (id) => {
    setActiveRfqId(id);
    setFormData(EMPTY_FORM);
    setSelectedItems([]);
    setBuyerInput('');
    setCustomerInput('');
    setTradeId('');
    setItemSearch('');
  };

  const setRfqState = (id, data) => {
    setActiveRfqId(id);
    setFormData(data.formData);
    setSelectedItems(data.selectedItems);
    setBuyerInput(data.buyerInput);
    setCustomerInput(data.customerInput);
    setTradeId(data.tradeId);
    setItemSearch(data.itemSearch || '');
  };

  return (
    <RfqContext.Provider value={{
      activeRfqId,
      setActiveRfqId,
      formData,
      setFormData,
      selectedItems,
      setSelectedItems,
      buyerInput,
      setBuyerInput,
      customerInput,
      setCustomerInput,
      tradeId,
      setTradeId,
      itemSearch,
      setItemSearch,
      resetRfqState,
      setRfqState
    }}>
      {children}
    </RfqContext.Provider>
  );
}

export function useRfq() {
  const context = useContext(RfqContext);
  if (!context) {
    throw new Error('useRfq must be used within an RfqProvider');
  }
  return context;
}
