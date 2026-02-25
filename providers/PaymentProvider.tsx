import React, { useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { UpiData } from '@/types';
import * as supabaseDb from '@/utils/supabaseDb';
import { generateId } from '@/utils/hash';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';

export const [PaymentProvider, usePayment] = createContextHook(() => {
  const {
    data: upiList = [],
    isLoading: upiLoading,
    error: upiError,
    refetch: reloadUpi,
  } = useOfflineQuery<UpiData[]>(['upiConfigs'], supabaseDb.upiConfigs.getAll);

  const { mutateAsync: addUpiMutate } = supabaseDb.upiConfigs.useAdd();
  const { mutateAsync: updateUpiMutate } = supabaseDb.upiConfigs.useUpdate();
  const { mutateAsync: removeUpiMutate } = supabaseDb.upiConfigs.useRemove();

  const addUpi = useCallback(
    async (data: Omit<UpiData, 'id'>) => {
      const upi: UpiData = {
        ...data,
        id: generateId(),
      };
      await addUpiMutate(upi);
      reloadUpi();
      return upi;
    },
    [reloadUpi, addUpiMutate]
  );

  const updateUpi = useCallback(
    async (data: UpiData) => {
      await updateUpiMutate(data);
      reloadUpi();
    },
    [reloadUpi, updateUpiMutate]
  );

  const removeUpi = useCallback(
    async (id: string) => {
      await removeUpiMutate(id);
      reloadUpi();
    },
    [reloadUpi, removeUpiMutate]
  );

  return {
    upiList,
    upiLoading,
    upiError: upiError ? "Couldn't load UPI data. Check connection." : null,
    reloadUpi,
    addUpi,
    updateUpi,
    removeUpi,
  };
});
