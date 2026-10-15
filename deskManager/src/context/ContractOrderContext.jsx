import { createContext, useContext, useState } from 'react';

const EMPTY_FORM = {
  co_no:           '',
  contract_ref:    '',
  co_date:         '',
  delivery_date:   '',
  transport:       '0',
  other:           '0',
  basic_value:     '0',
  packing_forward: '0',
  trade_id:        '',
};

const ContractOrderContext = createContext(null);

export function ContractOrderProvider({ children }) {
  const [activeCoId, setActiveCoId] = useState(undefined);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [buyerInput, setBuyerInput] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [customerInput, setCustomerInput] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // ── Contract picker state ──
  const [contractInput, setContractInput] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  // ────────────────────────────────
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [gstSearchInput, setGstSearchInput] = useState({});
  const [shipInput, setShipInput] = useState({});
  const [coItems, setCoItems] = useState([]);

  const resetCoState = (id) => {
    setActiveCoId(id);
    setFormData({
      ...EMPTY_FORM,
      co_date: new Date().toISOString().split('T')[0]
    });
    setBuyerInput('');
    setSelectedBuyer(null);
    setCustomerInput('');
    setSelectedCustomer(null);
    setContractInput('');
    setSelectedContract(null);
    setItemSearchInput('');
    setGstSearchInput({});
    setShipInput({});
    setCoItems([]);
  };

  return (
    <ContractOrderContext.Provider value={{
      activeCoId,
      setActiveCoId,
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
      contractInput,
      setContractInput,
      selectedContract,
      setSelectedContract,
      itemSearchInput,
      setItemSearchInput,
      gstSearchInput,
      setGstSearchInput,
      shipInput,
      setShipInput,
      coItems,
      setCoItems,
      resetCoState
    }}>
      {children}
    </ContractOrderContext.Provider>
  );
}

export function useContractOrder() {
  const context = useContext(ContractOrderContext);
  if (!context) {
    throw new Error('useContractOrder must be used within a ContractOrderProvider');
  }
  return context;
}