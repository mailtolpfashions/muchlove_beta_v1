import { PropsWithChildren, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import * as supabaseDb from '@/utils/supabaseDb';
import { isToday } from '@/utils/format';
import { CustomerSubscription, Sale } from '@/types';

export const [DataProvider, useData] = createContextHook(() => {
  const { data: customers = [], isLoading: customersLoading, error: customersError, refetch: refetchCustomers } = useOfflineQuery(['customers'], supabaseDb.customers.getAll);
  const { data: services = [], isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useOfflineQuery(['services'], supabaseDb.services.getAll);
  const { data: subscriptions = [], isLoading: subscriptionsLoading, error: subscriptionsError, refetch: refetchSubscriptions } = useOfflineQuery(['subscriptions'], supabaseDb.subscriptions.getAll);
  const { data: sales = [], isLoading: salesLoading, error: salesError, refetch: refetchSales } = useOfflineQuery(['sales'], supabaseDb.sales.getAll);
  const { data: users = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useOfflineQuery(['users'], supabaseDb.users.getAll);
  const { data: customerSubscriptions = [], isLoading: csLoading, error: csError, refetch: refetchCS } = useOfflineQuery(['customerSubscriptions'], supabaseDb.customerSubscriptions.getAll);
  const { data: offers = [], isLoading: offersLoading, error: offersError, refetch: refetchOffers } = useOfflineQuery(['offers'], supabaseDb.offers.getAll);

  const { mutateAsync: addUser } = supabaseDb.users.useAdd();
  const { mutateAsync: updateUser } = supabaseDb.users.useUpdate();
  const { mutateAsync: deleteUser } = supabaseDb.users.useRemove();


  const { mutateAsync: addCustomer } = supabaseDb.customers.useAdd();
  const { mutateAsync: updateCustomer } = supabaseDb.customers.useUpdate();

  const { mutateAsync: addSale } = supabaseDb.sales.useAdd();

  const { mutateAsync: addService } = supabaseDb.services.useAdd();
  const { mutateAsync: updateService } = supabaseDb.services.useUpdate();
  const { mutateAsync: deleteService } = supabaseDb.services.useRemove();

  const { mutateAsync: addSubscription } = supabaseDb.subscriptions.useAdd();
  const { mutateAsync: updateSubscription } = supabaseDb.subscriptions.useUpdate();
  const { mutateAsync: deleteSubscription } = supabaseDb.subscriptions.useRemove();

  const { mutateAsync: addOffer } = supabaseDb.offers.useAdd();
  const { mutateAsync: updateOffer } = supabaseDb.offers.useUpdate();
  const { mutateAsync: deleteOffer } = supabaseDb.offers.useRemove();

  const { mutateAsync: addCustomerSubscription } = supabaseDb.customerSubscriptions.useAdd();
  const { mutateAsync: updateCustomerSubscription } = supabaseDb.customerSubscriptions.useUpdate();
  const { mutateAsync: removeCustomerSubscription } = supabaseDb.customerSubscriptions.useRemove();

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

  const dataLoading = customersLoading || servicesLoading || subscriptionsLoading || salesLoading || usersLoading || csLoading || offersLoading;
  const loadError = customersError || servicesError || subscriptionsError || salesError || usersError || csError || offersError;

  const reload = async () => {
    await Promise.all([
      refetchCustomers(),
      refetchServices(),
      refetchSubscriptions(),
      refetchSales(),
      refetchUsers(),
      refetchCS(),
      refetchOffers(),
    ]);
  };

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
    addUser,
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
    stats,
    dataLoading,
    loadError,
    reload,
  };
});
