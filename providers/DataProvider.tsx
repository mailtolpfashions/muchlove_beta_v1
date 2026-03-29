import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import * as supabaseDb from '@/utils/supabaseDb';
import { isToday } from '@/utils/format';
import { CustomerSubscription, Sale, SalonConfig, DEFAULT_SALON_CONFIG } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { enqueueSale } from '@/utils/offlineQueue';
import { generateId } from '@/utils/hash';
import { sendSaleShadow } from '@/utils/saleShadow';
import { supabase } from '@/lib/supabase';
import {
  enqueueMutation,
  getPendingMutations,
  MutationEntity,
  MutationOperation,
} from '@/utils/offlineMutationQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
  /**
   * Extract (or generate) the entity ID from the input.
   * Called ONCE — the returned value is the single source of truth for the
   * entity ID used in the queue, the payload, and the optimistic cache update.
   */
  getEntityId: (input: TInput) => string;
  /**
   * Build the DB-format payload for the offline queue (snake_case).
   * Receives the already-resolved `entityId` as the second argument so
   * implementations never need to call `generateId()` again.
   */
  buildPayload?: (input: TInput, entityId: string) => Record<string, any>;
  /**
   * Apply an optimistic cache update. Receives the same `entityId` so the
   * optimistic record and the queued mutation always share the same ID.
   */
  applyOptimistic?: (input: TInput, entityId: string) => void;
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
        // Generate the entity ID exactly once, then thread it through every
        // downstream call so queue entry, payload, and cache are all in sync.
        const entityId = opts.getEntityId(input);
        const payload = opts.buildPayload?.(input, entityId);
        await enqueueMutation(
          generateId('MUT'),
          opts.entity,
          opts.operation,
          entityId,
          payload,
        );
        opts.applyOptimistic?.(input, entityId);
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

  // ── Offline Sales Toggle (admin-controlled) ─────────────────────────────
  const [offlineSalesEnabled, setOfflineSalesEnabled] = useState<boolean | null>(null);

  // Load from AsyncStorage on mount, then fetch from Supabase, then subscribe to Realtime
  // Only run on native — on web the admin panel doesn't need this mobile-only setting
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      // 1. Instant restore from cache
      try {
        const cached = await AsyncStorage.getItem('@app_setting:offline_sales_enabled');
        if (cached !== null) setOfflineSalesEnabled(JSON.parse(cached));
      } catch { /* best effort */ }

      // 2. Fetch latest from Supabase
      try {
        const value = await supabaseDb.appSettings.get('offline_sales_enabled');
        if (value !== null) {
          setOfflineSalesEnabled(value === true);
          await AsyncStorage.setItem('@app_setting:offline_sales_enabled', JSON.stringify(value === true));
        } else {
          // Setting not found in DB (fresh setup) — default to disabled
          setOfflineSalesEnabled(false);
        }
      } catch { /* offline — use cached */ }

      // 3. Subscribe to Realtime for instant updates
      channel = supabase
        .channel('app-settings-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.offline_sales_enabled' },
          (payload) => {
            const newValue = (payload.new as any)?.value === true;
            setOfflineSalesEnabled(newValue);
            AsyncStorage.setItem('@app_setting:offline_sales_enabled', JSON.stringify(newValue)).catch(() => {});
          },
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  /** Toggle offline sales (admin only) */
  const setOfflineSalesToggle = useCallback(async (enabled: boolean) => {
    setOfflineSalesEnabled(enabled);
    await AsyncStorage.setItem('@app_setting:offline_sales_enabled', JSON.stringify(enabled));
    await supabaseDb.appSettings.set('offline_sales_enabled', enabled, user?.id);
  }, [user?.id]);

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

  // Gate all queries on auth — prevents 401 storm on web before login
  const qEnabled = { enabled: !!user };

  const { data: customers = [], isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useOfflineQuery(['customers'], supabaseDb.customers.getAll, qEnabled);
  const { data: services = [], isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useOfflineQuery(['services'], supabaseDb.services.getAll, qEnabled);
  const { data: subscriptions = [], isLoading: subscriptionsLoading, error: subscriptionsError, refetch: refetchSubscriptions } = useOfflineQuery(['subscriptions'], supabaseDb.subscriptions.getAll, qEnabled);
  // ── Sales — useInfiniteQuery for cursor-based pagination ─────────────────
  // `sales` stays as a flat array so all existing consumers are unchanged.
  // Use `fetchMoreSales` / `hasMoreSales` in the sales-list screen for
  // load-more behaviour. Realtime invalidation on ['sales'] still works.
  const {
    data: salesPages,
    isLoading: salesLoading,
    error: salesError,
    fetchNextPage: fetchMoreSales,
    hasNextPage: hasMoreSales,
    isFetchingNextPage: isFetchingMoreSales,
    refetch: refetchSales,
  } = useInfiniteQuery({
    queryKey: ['sales'],
    queryFn: ({ pageParam }) =>
      supabaseDb.sales.getPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!user,
  });
  const sales: import('@/types').Sale[] = useMemo(
    () => salesPages?.pages.flatMap((p) => p.data) ?? [],
    [salesPages],
  );
  const { data: users = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useOfflineQuery(['users'], supabaseDb.users.getAll, qEnabled);
  const { data: customerSubscriptions = [], isLoading: csLoading, error: csError, refetch: refetchCS } = useOfflineQuery(['customerSubscriptions'], supabaseDb.customerSubscriptions.getAll, qEnabled);
  const { data: offers = [], isLoading: offersLoading, error: offersError, refetch: refetchOffers } = useOfflineQuery(['offers'], supabaseDb.offers.getAll, qEnabled);
  const { data: combos = [], isLoading: combosLoading, error: combosError, refetch: refetchCombos } = useOfflineQuery(['combos'], supabaseDb.combos.getAll, qEnabled);
  const { data: expenseCategories = [], isLoading: expCatLoading, error: expCatError, refetch: refetchExpCat } = useOfflineQuery(['expenseCategories'], supabaseDb.expenseCategories.getAll, qEnabled);
  const { data: allExpenses = [], isLoading: expensesLoading, error: expensesError, refetch: refetchExpenses } = useOfflineQuery(['expenses'], supabaseDb.expenses.getAll, qEnabled);

  // ── Attendance & HR ───────────────────────────────────────────────────
  const { data: attendance = [], isLoading: attendanceLoading, error: attendanceError, refetch: refetchAttendance } = useOfflineQuery(['attendance'], supabaseDb.attendanceDb.getAll, qEnabled);
  const { data: leaveRequests = [], isLoading: leaveRequestsLoading, error: leaveRequestsError, refetch: refetchLeaveRequests } = useOfflineQuery(['leaveRequests'], supabaseDb.leaveRequestsDb.getAll, qEnabled);
  const { data: permissionRequests = [], isLoading: permissionRequestsLoading, error: permissionRequestsError, refetch: refetchPermissionRequests } = useOfflineQuery(['permissionRequests'], supabaseDb.permissionRequestsDb.getAll, qEnabled);
  const { data: employeeSalaries = [], isLoading: salariesLoading, error: salariesError, refetch: refetchSalaries } = useOfflineQuery(['employeeSalaries'], supabaseDb.employeeSalariesDb.getAll, qEnabled);

  // ── Salon Config ──────────────────────────────────────────────────────
  const { data: salonConfigRaw, refetch: refetchSalonConfig } = useOfflineQuery(
    ['salonConfig'],
    async () => {
      const cfg = await supabaseDb.salonConfigDb.get();
      return cfg ? [cfg] : []; // wrap in array for useOfflineQuery compatibility
    },
    qEnabled,
  );
  const salonConfig: SalonConfig = useMemo(() => {
    const cfg = salonConfigRaw?.[0];
    if (cfg) return cfg;
    return { id: '', updatedAt: '', ...DEFAULT_SALON_CONFIG };
  }, [salonConfigRaw]);

  const { mutateAsync: _updateSalonConfig } = supabaseDb.salonConfigDb.useUpdate();
  const updateSalonConfig = useCallback(async (config: Partial<Omit<SalonConfig, 'id' | 'updatedAt'>>) => {
    await _updateSalonConfig({ ...config, id: salonConfig.id });
  }, [_updateSalonConfig, salonConfig.id]);

  const { mutateAsync: addAttendance } = supabaseDb.attendanceDb.useAdd();
  const { mutateAsync: updateAttendance } = supabaseDb.attendanceDb.useUpdate();
  const { mutateAsync: deleteAttendance } = supabaseDb.attendanceDb.useRemove();
  const { mutateAsync: addLeaveRequest } = supabaseDb.leaveRequestsDb.useAdd();
  const { mutateAsync: updateLeaveRequest } = supabaseDb.leaveRequestsDb.useUpdate();
  const { mutateAsync: deleteLeaveRequest } = supabaseDb.leaveRequestsDb.useRemove();
  const { mutateAsync: addPermissionRequest } = supabaseDb.permissionRequestsDb.useAdd();
  const { mutateAsync: updatePermissionRequest } = supabaseDb.permissionRequestsDb.useUpdate();
  const { mutateAsync: deletePermissionRequest } = supabaseDb.permissionRequestsDb.useRemove();
  const { mutateAsync: addEmployeeSalary } = supabaseDb.employeeSalariesDb.useAdd();
  const { mutateAsync: updateEmployeeSalary } = supabaseDb.employeeSalariesDb.useUpdate();
  const { mutateAsync: deleteEmployeeSalary } = supabaseDb.employeeSalariesDb.useRemove();

  const { mutateAsync: updateUser } = supabaseDb.users.useUpdate();
  const { mutateAsync: deleteUser } = supabaseDb.users.useRemove();

  // ── Expense Categories ─────────────────────────────────────────────────
  const { mutateAsync: addExpenseCategory } = supabaseDb.expenseCategories.useAdd();
  const { mutateAsync: deleteExpenseCategory } = supabaseDb.expenseCategories.useRemove();

  // ── Expenses ─────────────────────────────────────────────────────────
  const { mutateAsync: _addExpense } = supabaseDb.expenses.useAdd();
  const { mutateAsync: updateExpense } = supabaseDb.expenses.useUpdate();
  const { mutateAsync: deleteExpense } = supabaseDb.expenses.useRemove();

  const addExpense = useCallback(async (expense: { categoryId: string; categoryName: string; amount: number; description: string; expenseDate: string }) => {
    return _addExpense({
      ...expense,
      createdBy: user?.id ?? '',
      createdByName: user?.name ?? '',
    });
  }, [_addExpense, user?.id, user?.name]);

  // ── Customers (offline-aware) ───────────────────────────────────────────

  const { mutateAsync: _addCustomer } = supabaseDb.customers.useAdd();
  const { mutateAsync: _updateCustomer } = supabaseDb.customers.useUpdate();

  const addCustomer = useCallback(
    createOfflineMutation({
      entity: 'customers',
      operation: 'add',
      mutationFn: _addCustomer,
      getEntityId: (c: any) => c.id || generateId('CUST'),
      buildPayload: (c: any, entityId: string) => ({
        id: entityId,
        name: c.name,
        age: c.age,
        mobile: c.mobile,
        alt_number: c.altNumber,
        location: c.location,
        is_student: c.isStudent ?? false,
        visit_count: 0,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (c: any, entityId: string) => {
        optimisticAdd(queryClient, ['customers'], {
          id: entityId,
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
    // If offline sales are disabled by admin (or not yet loaded) and we're offline, refuse to queue
    if (isOffline && offlineSalesEnabled !== true) {
      throw new Error('Offline sales are disabled. Please connect to the internet.');
    }

    let saleId: string;
    let saleTotal: number;
    let paymentMethod: 'cash' | 'gpay';

    try {
      const result = await _addSale(sale);
      saleId = result?.id || sale.id;
      saleTotal = sale.total ?? 0;
      paymentMethod = sale.payment_method ?? 'cash';

      // Fire-and-forget sale shadow for fraud detection (only when offline sales are enabled)
      if (user?.id && offlineSalesEnabled === true) {
        sendSaleShadow(saleId, user.id, saleTotal, paymentMethod).catch(() => {});
      }

      return result;
    } catch (error: any) {
      if (isNetworkError(error)) {
        const offlineId = generateId('SAL');
        const entry = await enqueueSale(offlineId, sale);
        saleId = offlineId;
        saleTotal = sale.total ?? 0;
        paymentMethod = sale.payment_method ?? 'cash';

        // Fire-and-forget shadow (only when offline sales are enabled)
        if (user?.id && offlineSalesEnabled === true) {
          sendSaleShadow(saleId, user.id, saleTotal, paymentMethod).catch(() => {});
        }

        return {
          ...sale,
          id: offlineId,
          created_at: entry.offlineCreatedAt,
          _offline: true,
        };
      }
      throw error;
    }
  }, [_addSale, user?.id, isOffline, offlineSalesEnabled]);

  // ── Services (offline-aware) ────────────────────────────────────────────

  const { mutateAsync: _addService } = supabaseDb.services.useAdd();
  const { mutateAsync: _updateService } = supabaseDb.services.useUpdate();
  const { mutateAsync: _deleteService } = supabaseDb.services.useRemove();

  const addService = useCallback(
    createOfflineMutation({
      entity: 'services',
      operation: 'add',
      mutationFn: _addService,
      getEntityId: (s: any) => s.id || generateId('SVC'),
      buildPayload: (s: any, entityId: string) => ({
        id: entityId,
        name: s.name,
        code: s.code,
        price: s.price,
        kind: s.kind,
        mrp: s.mrp,
        offer_price: s.offerPrice,
        payment_method: s.paymentMethod,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (s: any, entityId: string) => {
        optimisticAdd(queryClient, ['services'], {
          id: entityId,
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
      getEntityId: (p: any) => p.id || generateId('PLAN'),
      buildPayload: (p: any, entityId: string) => ({
        id: entityId,
        name: p.name,
        duration_months: p.durationMonths,
        price: p.price,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (p: any, entityId: string) => {
        optimisticAdd(queryClient, ['subscriptions'], {
          id: entityId,
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
      getEntityId: (o: any) => o.id || generateId('OFR'),
      buildPayload: (o: any, entityId: string) => ({
        id: entityId,
        name: o.name,
        percent: o.percent,
        visit_count: o.visitCount,
        start_date: o.startDate,
        end_date: o.endDate,
        applies_to: o.appliesTo,
        student_only: o.studentOnly,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (o: any, entityId: string) => {
        optimisticAdd(queryClient, ['offers'], {
          id: entityId,
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
      getEntityId: (c: any) => c.id || generateId('CMB'),
      buildPayload: (c: any, entityId: string) => ({
        id: entityId,
        name: c.name,
        combo_price: c.comboPrice,
        items: c.items,
        created_at: new Date().toISOString(),
      }),
      applyOptimistic: (c: any, entityId: string) => {
        optimisticAdd(queryClient, ['combos'], {
          id: entityId,
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
      getEntityId: (cs: any) => cs.id || generateId('CSUB'),
      buildPayload: (cs: any, entityId: string) => ({
        id: entityId,
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
      applyOptimistic: (cs: any, entityId: string) => {
        optimisticAdd(queryClient, ['customerSubscriptions'], {
          id: entityId,
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

  const dataLoading = customersLoading || servicesLoading || subscriptionsLoading || salesLoading || usersLoading || csLoading || offersLoading || combosLoading || expCatLoading || expensesLoading || attendanceLoading || leaveRequestsLoading || permissionRequestsLoading || salariesLoading;
  const loadError = customersError || servicesError || subscriptionsError || salesError || usersError || csError || offersError || combosError || expCatError || expensesError || attendanceError || leaveRequestsError || permissionRequestsError || salariesError;

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
      refetchExpCat(),
      refetchExpenses(),
      refetchAttendance(),
      refetchLeaveRequests(),
      refetchPermissionRequests(),
      refetchSalaries(),
      refetchSalonConfig(),
    ]);
  }, [refetchCustomers, refetchServices, refetchSubscriptions, refetchSales, refetchUsers, refetchCS, refetchOffers, refetchCombos, refetchExpCat, refetchExpenses, refetchAttendance, refetchLeaveRequests, refetchPermissionRequests, refetchSalaries, refetchSalonConfig]);

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
    fetchMoreSales,
    hasMoreSales,
    isFetchingMoreSales,
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
    // Expenses
    expenseCategories,
    allExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseCategory,
    deleteExpenseCategory,
    // Offline support
    isOffline,
    isPendingSync,
    pendingOps,
    refreshPendingOps,
    // Offline sales toggle
    offlineSalesEnabled,
    setOfflineSalesToggle,
    // Attendance & HR
    attendance,
    leaveRequests,
    permissionRequests,
    employeeSalaries,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    addLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    addPermissionRequest,
    updatePermissionRequest,
    deletePermissionRequest,
    addEmployeeSalary,
    updateEmployeeSalary,
    deleteEmployeeSalary,
    // Salon Config
    salonConfig,
    updateSalonConfig,
  };
});
