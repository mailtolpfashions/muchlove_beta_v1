import { useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Customer, Service, SubscriptionPlan, Combo } from '@/types';

export const [BillingProvider, useBilling] = createContextHook(() => {
  const [items, setItems] = useState<Service[]>([]);
  const [subs, setSubs] = useState<SubscriptionPlan[]>([]);
  const [addedCombos, setAddedCombos] = useState<Combo[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const resetBill = useCallback(() => {
    setSelectedCustomer(null);
    setItems([]);
    setSubs([]);
    setAddedCombos([]);
  }, []);

  const handleAddQuantity = useCallback((service: Service) => {
    setItems(prev => [...prev, service]);
  }, []);

  const handleSubtractQuantity = useCallback((service: Service) => {
    setItems(prev => {
      let index = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].id === service.id) { index = i; break; }
      }
      if (index > -1) {
        const newItems = [...prev];
        newItems.splice(index, 1);
        return newItems;
      }
      return prev;
    });
  }, []);

  const handleAddCombo = useCallback((combo: Combo) => {
    setAddedCombos(prev => [...prev, combo]);
  }, []);

  const handleRemoveCombo = useCallback((index: number) => {
    setAddedCombos(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    items, setItems,
    subs, setSubs,
    addedCombos, setAddedCombos,
    selectedCustomer, setSelectedCustomer,
    handleAddQuantity, handleSubtractQuantity,
    handleAddCombo, handleRemoveCombo,
    resetBill,
    completedSale, setCompletedSale,
  };
});
