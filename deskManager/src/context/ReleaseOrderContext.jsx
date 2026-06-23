import { createContext, useContext, useState } from 'react';

const EMPTY_FORM = {
  ro_no:           '',
  contract_ref:    '',
  ro_date:         '',
  delivery_date:   '',
  transport:       '0',
  other:           '0',
  basic_value:     '0',
  packing_forward: '0',
  trade_id:        '',
};

const ReleaseOrderContext = createContext(null);

export function ReleaseOrderProvider({ children }) {
  const [activeRoId, setActiveRoId] = useState(undefined); // undefined = uninitialized, null = new, string = editing ID
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [buyerInput, setBuyerInput] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [customerInput, setCustomerInput] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [gstSearchInput, setGstSearchInput] = useState({});
  const [shipInput, setShipInput] = useState({});
  const [roItems, setRoItems] = useState([]);

  const resetRoState = (id) => {
    setActiveRoId(id);
    setFormData({
      ...EMPTY_FORM,
      ro_date: new Date().toISOString().split('T')[0]
    });
    setBuyerInput('');
    setSelectedBuyer(null);
    setCustomerInput('');
    setSelectedCustomer(null);
    setItemSearchInput('');
    setGstSearchInput({});
    setShipInput({});
    setRoItems([]);
  };

  return (
    <ReleaseOrderContext.Provider value={{
      activeRoId,
      setActiveRoId,
      formData,
      setFormData,
      buyerInput,
      setBuyerInput,
      selectedBuyer,
      setSelectedBuyer,
      customerInput,
      setCustomerInput,
      selectedCustomer,
      setSelectedCustomer,
      itemSearchInput,
      setItemSearchInput,
      gstSearchInput,
      setGstSearchInput,
      shipInput,
      setShipInput,
      roItems,
      setRoItems,
      resetRoState
    }}>
      {children}
    </ReleaseOrderContext.Provider>
  );
}

export function useReleaseOrder() {
  const context = useContext(ReleaseOrderContext);
  if (!context) {
    throw new Error('useReleaseOrder must be used within a ReleaseOrderProvider');
  }
  return context;
}
