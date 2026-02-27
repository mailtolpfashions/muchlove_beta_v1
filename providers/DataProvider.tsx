import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQueryClient } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import * as supabaseDb from '@/utils/supabaseDb';
import { isToday } from '@/utils/format';
import { CustomerSubscription, Sale } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { enqueueSale } from '@/utils/offlineQueue';
import { generateId } from '@/utils/hash';
import {
  enqueueMutation,
  getPendingMutations,
  getPendingMutationCount,
  MutationEntity,
  MutationOperation,
  OfflineMutation,
} from '@/utils/offlineMutationQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Check if an error is a network/connectivity error */
function isNetworkError(error: any): boolean {
  const msg = error?.message ?? '';
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('Network') ||
    msg.includes('Failed') ||
    error?.code === 'NETWORK_ERROR' ||
    !globalThis.navigator?.onLine
  );
}

/** Apply an optimistic add to the TanStack Query cache */
function optimisticAdd<T extends { id: string }>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string[],
  newItem: T,
) {
  queryClient.setQueryData<T[]>(queryKey, (old = []) => [...old, newItem]);
}

/** Apply an optimistic update to the TanStack Query cache */
function optimisticUpdate<T extends { id: string }>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string[],
  updatedItem: T,
) {
  queryClient.setQueryData<T[]>(queryKey, (old = []) =>
    old.map(item => (item.id === updatedItem.id ? updatedItem : item)),
  );
}

/** Apply an optimistic delete to the TanStack Query cache */
function optimisticDelete<T extends { id: string }>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string[],
  id: string,
) {
  queryClient.setQueryData<T[]>(queryKey, (old = []) =>
    old.filter(item => item.id !== id),
  );
}

// ── Offline-aware CRUD wrapper ──────────────────────────────────────────────

/**
 * Wraps a mutation function with offline fallback. If the mutation fails due
 * to a network error, the operation is queued for later sync and the local
 * cache is updated optimistically.
 */
function createOfflineMutation<TInput, TResult>(opts: {
  entity: MutationEntity;
  operation: MutationOperation;
  /** The online mutation function */
  mutationFn: (input: TInput) => Promise<TResult>;
  /** Extract the entity ID from the input */
  getEntityId: (input: TInput) => string;
  /** Build the DB-format payload for the queue (snake_case) */
  buildPayload?: (input: TInput) => Record<string, any>;
  /** Apply optimistic update to the local cache */
  applyOptimistic?: (input: TInput) => void;
  /** Refetch from server after successful online mutation */
  refetch?: () => Promise<any>;
}) {
  return async (input: TInput): Promise<TResult | any> => {
    try {
      const result = await opts.mutationFn(input);
      if (opts.refetch) await opts.refetch();
      return result;
    } catch (error: any) {
      if (isNetworkError(error)) {
        const entityId = opts.getEntityId(input);
        const payload = opts.buildPayload?.(input);
        await enqueueMutation(
          generateId(),
          opts.entity,
          opts.operation,
          entityId,
          payload,
        );
        // Apply optimistic update to local cache
        opts.applyOptimistic?.(input);
        return { _offline: true, id: entityId } as any;
      }
      throw error;
    }
  };
}

export const [DataProvider, useData] = createContextHook(() => {
  const { isAdmin, user } = useAuth();
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();
  const isOffline = netInfo.isConnected === false;

  // Pending mutation tracking for UI indicators
  const [pendingOps, setPendingOps] = useState<Map<string, MutationOperation>>(new Map());

  // Refresh pending ops for UI indicators
  const refreshPendingOps = useCallback(async () => {
    const pending = await getPendingMutations();
    const ops = new Map<string, MutationOperation>();
    for (const m of pending) {
      ops.set(`${m.entity}:${m.entityId}`, m.operation);
    }
    setPendingOps(ops);
  }, []);

  // Check if an entity is pending sync
  const isPendingSync = useCallback(
    (entity: MutationEntity, entityId: string): MutationOperation | undefined => {
      return pendingOps.get(`${entity}:${entityId}`);
    },
    [pendingOps],
  );

  // Load pending ops on mount
  useEffect(() => {
    refreshPendingOps();
  }, [refreshPendingOps]);

  // Live-sync: auto-refetch queries when any table changes in Supabase.
  // Also sends local push notifications to admin devices when other users record sales.
  useRealtimeSync({ currentUserId: user?.id, isAdmin });

  const { data: customers = [], isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useOfflineQuery(['customers'], supabaseDb.customers.getAll);
  const { data: services = [], isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useOfflineQuery(['services'], supabaseDb.services.getAll);
  const { data: subscriptions = [], isLoading: subscriptionsLoading, error: subscriptionsError, refetch: refetchSubscriptions } = useOfflineQuery(['subscriptions'], supabaseDb.subscriptions.getAll);
  const { data: sales = [], isLoading: salesLoading, error: salesError, refetch: refetchSales } = useOfflineQuery(['sales'], supabaseDb.sales.getAll);
  const { data: users = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useOfflineQuery(['users'], supabaseDb.users.getAll);
  const { data: customerSubscriptions = [], isLoading: csLoading, error: csError, refetch: refetchCS } = useOfflineQuery(['customerSubscriptions'], supabaseDb.customerSubscriptions.getAll);
  const { data: offers = [], isLoading: offersLoading, error: offersError, refetch: refetchOffers } = useOfflineQuery(['offers'], supabaseDb.offers.getAll);
  const { data: combos = [], isLoading: combosLoading, error: combosError, refetch: refetchCombos } = useOfflineQuery(['combos'], supabaseDb.combos.getAll);

  const { mutateAsync: updateUser } = supabaseDb.users.useUpdate();
  const { mutateAsync: deleteUser } = supabaseDb.users.useRemove();

  // ── Customers (offline-aware) ───────────────────────────────────────────

  const { mutateAsync: _addCustomer } = supabaseDb.customers.useAdd();
  const { mutateAsync: _updateCustomer } = supabaseDb.customers.useUpdate();

  const addCustomer = useCallback(
    createOfflineMutation({
      entity: 'customers',
      operation: 'add',
      mutationFn: _addCustomer,
      getEntityId: (c: any) => c.id || generateId(),
      buildPayload: (c: any) => ({
        id: c.id || generateId(),
        name: c.name,
        age: c.age,
        mobile: c.mobile,
        alt_number: c.altNumber,
        location: c.location,
        is_student: c.isStudent ?? false,
        visit_count: 0,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (c: any) => {
        const id = c.id || generateId();
        optimisticAdd(queryClient, ['customers'], {
          id,
          name: c.name,
          age: c.age,
          mobile: c.mobile,
          altNumber: c.altNumber,
          location: c.location,
          isStudent: c.isStudent ?? false,
          visitCount: 0,
          createdAt: new Date().toISOString(),
          _offline: true,
        });
        refreshPendingOps();
      },
      refetch: refetchCustomers,
    }),
    [_addCustomer, queryClient, refetchCustomers, refreshPendingOps],
  );

  const updateCustomer = useCallback(
    createOfflineMutation({
      entity: 'customers',
      operation: 'update',
      mutationFn: _updateCustomer,
      getEntityId: (c: any) => c.id,
      buildPayload: (c: any) => ({
        name: c.name,
        age: c.age,
        mobile: c.mobile,
        alt_number: c.altNumber,
        location: c.location,
        is_student: c.isStudent,
        visit_count: c.visitCount,
      }),
      applyOptimistic: (c: any) => {
        optimisticUpdate(queryClient, ['customers'], { ...c, _offline: true });
        refreshPendingOps();
      },
      refetch: refetchCustomers,
    }),
    [_updateCustomer, queryClient, refetchCustomers, refreshPendingOps],
  );

  // ── Sales (existing offline logic) ──────────────────────────────────────

  const { mutateAsync: _addSale } = supabaseDb.sales.useAdd();

  const addSale = useCallback(async (sale: any) => {
    try {
      const result = await _addSale(sale);
      return result;
    } catch (error: any) {
      if (isNetworkError(error)) {
        const offlineId = generateId();
        const entry = await enqueueSale(offlineId, sale);
        return {
          ...sale,
          id: offlineId,
          created_at: entry.offlineCreatedAt,
          _offline: true,
        };
      }
      throw error;
    }
  }, [_addSale]);

  // ── Services (offline-aware) ────────────────────────────────────────────

  const { mutateAsync: _addService } = supabaseDb.services.useAdd();
  const { mutateAsync: _updateService } = supabaseDb.services.useUpdate();
  const { mutateAsync: _deleteService } = supabaseDb.services.useRemove();

  const addService = useCallback(
    createOfflineMutation({
      entity: 'services',
      operation: 'add',
      mutationFn: _addService,
      getEntityId: (s: any) => s.id || generateId(),
      buildPayload: (s: any) => ({
        id: s.id || generateId(),
        name: s.name,
        code: s.code,
        price: s.price,
        kind: s.kind,
        mrp: s.mrp,
        offer_price: s.offerPrice,
        payment_method: s.paymentMethod,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (s: any) => {
        const id = s.id || generateId();
        optimisticAdd(queryClient, ['services'], {
          id,
          name: s.name,
          code: s.code,
          price: s.price,
          kind: s.kind ?? 'service',
          mrp: s.mrp,
          offerPrice: s.offerPrice,
          createdAt: new Date().toISOString(),
          paymentMethod: s.paymentMethod,
          _offline: true,
        });
        refreshPendingOps();
      },
      refetch: refetchServices,
    }),
    [_addService, queryClient, refetchServices, refreshPendingOps],
  );

  const updateService = useCallback(
    createOfflineMutation({
      entity: 'services',
      operation: 'update',
      mutationFn: _updateService,
      getEntityId: (s: any) => s.id,
      buildPayload: (s: any) => ({
        name: s.name,
        code: s.code,
        price: s.price,
        kind: s.kind,
        mrp: s.mrp,
        offer_price: s.offerPrice,
        payment_method: s.paymentMethod,
      }),
      applyOptimistic: (s: any) => {
        optimisticUpdate(queryClient, ['services'], { ...s, _offline: true });
        refreshPendingOps();
      },
      refetch: refetchServices,
    }),
    [_updateService, queryClient, refetchServices, refreshPendingOps],
  );

  const deleteService = useCallback(
    createOfflineMutation({
      entity: 'services',
      operation: 'delete',
      mutationFn: _deleteService,
      getEntityId: (id: any) => id,
      applyOptimistic: (id: any) => {
        optimisticDelete(queryClient, ['services'], id);
        refreshPendingOps();
      },
      refetch: refetchServices,
    }),
    [_deleteService, queryClient, refetchServices, refreshPendingOps],
  );

  // ── Subscriptions (offline-aware) ───────────────────────────────────────

  const { mutateAsync: _addSubscription } = supabaseDb.subscriptions.useAdd();
  const { mutateAsync: _updateSubscription } = supabaseDb.subscriptions.useUpdate();
  const { mutateAsync: _deleteSubscription } = supabaseDb.subscriptions.useRemove();

  const addSubscription = useCallback(
    createOfflineMutation({
      entity: 'subscriptions',
      operation: 'add',
      mutationFn: _addSubscription,
      getEntityId: (p: any) => p.id || generateId(),
      buildPayload: (p: any) => ({
        id: p.id || generateId(),
        name: p.name,
        duration_months: p.durationMonths,
        price: p.price,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (p: any) => {
        const id = p.id || generateId();
        optimisticAdd(queryClient, ['subscriptions'], {
          id,
          name: p.name,
          durationMonths: p.durationMonths,
          price: p.price,
          createdAt: new Date().toISOString(),
          _offline: true,
        });
        refreshPendingOps();
      },
      refetch: refetchSubscriptions,
    }),
    [_addSubscription, queryClient, refetchSubscriptions, refreshPendingOps],
  );

  const updateSubscription = useCallback(
    createOfflineMutation({
      entity: 'subscriptions',
      operation: 'update',
      mutationFn: _updateSubscription,
      getEntityId: (p: any) => p.id,
      buildPayload: (p: any) => ({
        name: p.name,
        duration_months: p.durationMonths,
        price: p.price,
      }),
      applyOptimistic: (p: any) => {
        optimisticUpdate(queryClient, ['subscriptions'], { ...p, _offline: true });
        refreshPendingOps();
      },
      refetch: refetchSubscriptions,
    }),
    [_updateSubscription, queryClient, refetchSubscriptions, refreshPendingOps],
  );

  const deleteSubscription = useCallback(
    createOfflineMutation({
      entity: 'subscriptions',
      operation: 'delete',
      mutationFn: _deleteSubscription,
      getEntityId: (id: any) => id,
      applyOptimistic: (id: any) => {
        optimisticDelete(queryClient, ['subscriptions'], id);
        refreshPendingOps();
      },
      refetch: refetchSubscriptions,
    }),
    [_deleteSubscription, queryClient, refetchSubscriptions, refreshPendingOps],
  );

  // ── Offers (offline-aware) ──────────────────────────────────────────────

  const { mutateAsync: _addOffer } = supabaseDb.offers.useAdd();
  const { mutateAsync: _updateOffer } = supabaseDb.offers.useUpdate();
  const { mutateAsync: _deleteOffer } = supabaseDb.offers.useRemove();

  const addOffer = useCallback(
    createOfflineMutation({
      entity: 'offers',
      operation: 'add',
      mutationFn: _addOffer,
      getEntityId: (o: any) => o.id || generateId(),
      buildPayload: (o: any) => ({
        id: o.id || generateId(),
        name: o.name,
        percent: o.percent,
        visit_count: o.visitCount,
        start_date: o.startDate,
        end_date: o.endDate,
        applies_to: o.appliesTo,
        student_only: o.studentOnly,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (o: any) => {
        const id = o.id || generateId();
        optimisticAdd(queryClient, ['offers'], {
          id,
          name: o.name,
          percent: o.percent,
          visitCount: o.visitCount,
          startDate: o.startDate,
          endDate: o.endDate,
          appliesTo: o.appliesTo ?? 'both',
          studentOnly: o.studentOnly ?? false,
          createdAt: new Date().toISOString(),
          _offline: true,
        });
        refreshPendingOps();
      },
      refetch: refetchOffers,
    }),
    [_addOffer, queryClient, refetchOffers, refreshPendingOps],
  );

  const updateOffer = useCallback(
    createOfflineMutation({
      entity: 'offers',
      operation: 'update',
      mutationFn: _updateOffer,
      getEntityId: (o: any) => o.id,
      buildPayload: (o: any) => ({
        name: o.name,
        percent: o.percent,
        visit_count: o.visitCount,
        start_date: o.startDate,
        end_date: o.endDate,
        applies_to: o.appliesTo,
        student_only: o.studentOnly,
      }),
      applyOptimistic: (o: any) => {
        optimisticUpdate(queryClient, ['offers'], { ...o, _offline: true });
        refreshPendingOps();
      },
      refetch: refetchOffers,
    }),
    [_updateOffer, queryClient, refetchOffers, refreshPendingOps],
  );

  const deleteOffer = useCallback(
    createOfflineMutation({
      entity: 'offers',
      operation: 'delete',
      mutationFn: _deleteOffer,
      getEntityId: (id: any) => id,
      applyOptimistic: (id: any) => {
        optimisticDelete(queryClient, ['offers'], id);
        refreshPendingOps();
      },
      refetch: refetchOffers,
    }),
    [_deleteOffer, queryClient, refetchOffers, refreshPendingOps],
  );

  // ── Combos (offline-aware) ──────────────────────────────────────────────

  const { mutateAsync: _addCombo } = supabaseDb.combos.useAdd();
  const { mutateAsync: _updateCombo } = supabaseDb.combos.useUpdate();
  const { mutateAsync: _deleteCombo } = supabaseDb.combos.useRemove();

  const addCombo = useCallback(
    createOfflineMutation({
      entity: 'combos',
      operation: 'add',
      mutationFn: _addCombo,
      getEntityId: (c: any) => c.id || generateId(),
      buildPayload: (c: any) => ({
        id: c.id || generateId(),
        name: c.name,
        combo_price: c.comboPrice,
        items: c.items,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (c: any) => {
        const id = c.id || generateId();
        optimisticAdd(queryClient, ['combos'], {
          id,
          name: c.name,
          comboPrice: c.comboPrice,
          items: c.items ?? [],
          createdAt: new Date().toISOString(),
          _offline: true,
        });
        refreshPendingOps();
      },
      refetch: refetchCombos,
    }),
    [_addCombo, queryClient, refetchCombos, refreshPendingOps],
  );

  const updateCombo = useCallback(
    createOfflineMutation({
      entity: 'combos',
      operation: 'update',
      mutationFn: _updateCombo,
      getEntityId: (c: any) => c.id,
      buildPayload: (c: any) => ({
        name: c.name,
        combo_price: c.comboPrice,
        items: c.items,
      }),
      applyOptimistic: (c: any) => {
        optimisticUpdate(queryClient, ['combos'], { ...c, _offline: true });
        refreshPendingOps();
      },
      refetch: refetchCombos,
    }),
    [_updateCombo, queryClient, refetchCombos, refreshPendingOps],
  );

  const deleteCombo = useCallback(
    createOfflineMutation({
      entity: 'combos',
      operation: 'delete',
      mutationFn: _deleteCombo,
      getEntityId: (id: any) => id,
      applyOptimistic: (id: any) => {
        optimisticDelete(queryClient, ['combos'], id);
        refreshPendingOps();
      },
      refetch: refetchCombos,
    }),
    [_deleteCombo, queryClient, refetchCombos, refreshPendingOps],
  );

  // ── Customer Subscriptions (offline-aware) ──────────────────────────────

  const { mutateAsync: _addCustomerSubscription } = supabaseDb.customerSubscriptions.useAdd();
  const { mutateAsync: _updateCustomerSubscription } = supabaseDb.customerSubscriptions.useUpdate();
  const { mutateAsync: _removeCustomerSubscription } = supabaseDb.customerSubscriptions.useRemove();

  const addCustomerSubscription = useCallback(
    createOfflineMutation({
      entity: 'customerSubscriptions',
      operation: 'add',
      mutationFn: _addCustomerSubscription,
      getEntityId: (cs: any) => cs.id || generateId(),
      buildPayload: (cs: any) => ({
        id: cs.id || generateId(),
        customer_id: cs.customerId,
        customer_name: cs.customerName,
        plan_id: cs.planId,
        plan_name: cs.planName,
        plan_duration_months: cs.planDurationMonths,
        plan_price: cs.planPrice,
        status: cs.status ?? 'active',
        start_date: cs.startDate ?? new Date().toISOString(),
        assigned_by_user_id: cs.assignedByUserId,
        assigned_by_name: cs.assignedByName,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (cs: any) => {
        const id = cs.id || generateId();
        optimisticAdd(queryClient, ['customerSubscriptions'], {
          id,
          ...cs,
          createdAt: new Date().toISOString(),
          _offline: true,
        });
        refreshPendingOps();
      },
      refetch: refetchCS,
    }),
    [_addCustomerSubscription, queryClient, refetchCS, refreshPendingOps],
  );

  const updateCustomerSubscription = useCallback(
    createOfflineMutation({
      entity: 'customerSubscriptions',
      operation: 'update',
      mutationFn: _updateCustomerSubscription,
      getEntityId: (cs: any) => cs.id,
      buildPayload: (cs: any) => ({
        status: cs.status,
      }),
      applyOptimistic: (cs: any) => {
        optimisticUpdate(queryClient, ['customerSubscriptions'], { ...cs, _offline: true });
        refreshPendingOps();
      },
      refetch: refetchCS,
    }),
    [_updateCustomerSubscription, queryClient, refetchCS, refreshPendingOps],
  );

  const removeCustomerSubscription = useCallback(
    createOfflineMutation({
      entity: 'customerSubscriptions',
      operation: 'delete',
      mutationFn: _removeCustomerSubscription,
      getEntityId: (id: any) => id,
      applyOptimistic: (id: any) => {
        optimisticDelete(queryClient, ['customerSubscriptions'], id);
        refreshPendingOps();
      },
      refetch: refetchCS,
    }),
    [_removeCustomerSubscription, queryClient, refetchCS, refreshPendingOps],
  );

  const stats = useMemo(() => {
    const todaySales = sales.filter((s: Sale) => isToday(s.createdAt));
    return {
      totalSalesAmount: sales.reduce((sum: number, s: Sale) => sum + s.total, 0),
      totalSalesCount: sales.length,
      todaySalesTotal: todaySales.reduce((sum: number, s: Sale) => sum + s.total, 0),
      todaySalesCount: todaySales.length,
      totalCustomers: customers.length,
      activeSubscriptions: customerSubscriptions.filter((cs: CustomerSubscription) => cs.status === 'active').length,
    };
  }, [sales, customers, customerSubscriptions]);

  const dataLoading = customersLoading || servicesLoading || subscriptionsLoading || salesLoading || usersLoading || csLoading || offersLoading || combosLoading;
  const loadError = customersError || servicesError || subscriptionsError || salesError || usersError || csError || offersError || combosError;

  const reload = useCallback(async () => {
    await Promise.all([
      refetchCustomers(),
      refetchServices(),
      refetchSubscriptions(),
      refetchSales(),
      refetchUsers(),
      refetchCS(),
      refetchOffers(),
      refetchCombos(),
    ]);
  }, [refetchCustomers, refetchServices, refetchSubscriptions, refetchSales, refetchUsers, refetchCS, refetchOffers, refetchCombos]);

  return {
    customers,
    customersLoading,
    customersError,
    addCustomer,
    updateCustomer,
    services,
    servicesLoading,
    servicesError,
    addService,
    updateService,
    deleteService,
    subscriptions,
    subscriptionsLoading,
    subscriptionsError,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    sales,
    salesLoading,
    salesError,
    addSale,
    users,
    usersLoading,
    usersError,
    updateUser,
    deleteUser,
    customerSubscriptions,
    csLoading,
    csError,
    addCustomerSubscription,
    updateCustomerSubscription,
    removeCustomerSubscription,
    offers,
    offersLoading,
    offersError,
    addOffer,
    updateOffer,
    deleteOffer,
    combos,
    combosLoading,
    combosError,
    addCombo,
    updateCombo,
    deleteCombo,
    stats,
    dataLoading,
    loadError,
    reload,
    // Offline support
    isOffline,
    isPendingSync,
    pendingOps,
    refreshPendingOps,
  };
});
