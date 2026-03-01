import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  User,
  Customer,
  Service,
  SubscriptionPlan,
  Sale,
  SaleItem,
  SubscriptionSaleItem,
  CustomerSubscription,
  Offer,
  UpiData,
  Combo,
  ComboItem,
  ExpenseCategory,
  Expense,
} from '@/types';
import { generateId } from '@/utils/hash';

// Row Mappers (DB snake_case -> App camelCase)
// These functions remain the same...
function mapUser(r: Record<string, unknown>): User { return { id: r.id as string, email: r.email as string, name: r.name as string, role: r.role as User['role'], approved: (r.approved as boolean) ?? false, createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapCustomer(r: Record<string, unknown>): Customer { return { id: r.id as string, name: r.name as string, age: (r.age as string) ?? '', mobile: r.mobile as string, altNumber: (r.alt_number as string) ?? '', location: (r.location as string) ?? '', isStudent: (r.is_student as boolean) ?? false, visitCount: (r.visit_count as number) ?? 0, createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapService(r: Record<string, unknown>): Service { return { id: r.id as string, name: r.name as string, code: r.code as string, price: Number(r.price), kind: ((r.kind as string) ?? 'service') as Service['kind'], mrp: r.mrp != null ? Number(r.mrp) : undefined, offerPrice: r.offer_price != null ? Number(r.offer_price) : undefined, createdAt: (r.created_at as string) ?? new Date().toISOString(), paymentMethod: r.payment_method as Service['paymentMethod'] }; }
function mapSubscriptionPlan(r: Record<string, unknown>): SubscriptionPlan { return { id: r.id as string, name: r.name as string, durationMonths: Number(r.duration_months), price: Number(r.price), createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapCustomerSubscription(r: Record<string, unknown>): CustomerSubscription { return { id: r.id as string, customerId: r.customer_id as string, customerName: r.customer_name as string, planId: r.plan_id as string, planName: r.plan_name as string, planDurationMonths: Number(r.plan_duration_months), planPrice: Number(r.plan_price), status: r.status as CustomerSubscription['status'], startDate: r.start_date as string, assignedByUserId: r.assigned_by_user_id as string, assignedByName: r.assigned_by_name as string, createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapOffer(r: Record<string, unknown>): Offer { return { id: r.id as string, name: r.name as string, percent: Number(r.percent), visitCount: r.visit_count != null ? Number(r.visit_count) : undefined, startDate: r.start_date as string | undefined, endDate: r.end_date as string | undefined, appliesTo: (r.applies_to as Offer['appliesTo']) || 'both', studentOnly: !!r.student_only, createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapUpiData(r: Record<string, unknown>): UpiData { return { id: r.id as string, upiId: r.upi_id as string, payeeName: r.payee_name as string }; }
function mapComboItem(r: Record<string, unknown>): ComboItem { return { id: r.id as string, serviceId: r.service_id as string, serviceName: r.service_name as string, serviceKind: (r.service_kind as ComboItem['serviceKind']) ?? 'service', originalPrice: Number(r.original_price) }; }
function mapExpenseCategory(r: Record<string, unknown>): ExpenseCategory { return { id: r.id as string, name: r.name as string, createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapExpense(r: Record<string, unknown>): Expense { return { id: r.id as string, categoryId: (r.category_id as string) ?? null, categoryName: r.category_name as string, amount: Number(r.amount), description: (r.description as string) ?? '', expenseDate: r.expense_date as string, createdBy: (r.created_by as string) ?? '', createdByName: (r.created_by_name as string) ?? '', createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapSaleRow(r: Record<string, unknown>): Omit<Sale, 'items' | 'subscriptionItems'> { return { id: r.id as string, customerId: r.customer_id as string, customerName: r.customer_name as string, employeeId: r.employee_id as string, employeeName: r.employee_name as string, type: r.type as Sale['type'], paymentMethod: r.payment_method as Sale['paymentMethod'], subtotal: Number(r.subtotal), discountPercent: Number(r.discount_percent) ?? 0, discountAmount: Number(r.discount_amount) ?? 0, total: Number(r.total), createdAt: (r.created_at as string) ?? new Date().toISOString() }; }
function mapSaleItem(r: Record<string, unknown>): SaleItem {
  const item: SaleItem = {
    id: r.id as string,
    itemId: r.service_id as string,
    itemName: r.service_name as string,
    itemCode: r.service_code as string,
    price: Number(r.price),
    quantity: Number(r.quantity),
    kind: ((r.kind as string) ?? 'service') as SaleItem['kind'],
  };
  if (r.original_price != null) item.originalPrice = Number(r.original_price);
  (item as any).serviceName = item.itemName;
  return item;
}
function mapSubscriptionSaleItem(r: Record<string, unknown>): SubscriptionSaleItem { return { id: r.id as string, planId: r.plan_id as string, planName: r.plan_name as string, price: Number(r.price), discountedPrice: Number(r.discounted_price) }; }

// --- API Handlers with Mutation Hooks ---

export const users = {
  getAll: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapUser);
  },
  findByEmail: async (email: string): Promise<User | undefined> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (error) throw error;
    return data ? mapUser(data) : undefined;
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (user: Pick<User, 'id' | 'name' | 'role'> & { approved?: boolean }) => {
        const updateData: Record<string, any> = {
          name: user.name,
          role: user.role,
        };
        if (user.approved !== undefined) {
          updateData.approved = user.approved;
        }
        const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['users'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['users'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export const customers = {
  getAll: async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapCustomer);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (customer: Omit<Customer, 'id' | 'createdAt' | 'visitCount'>) => {
        if (!customer) return null;
        const newCustomer = {
          id: generateId(),
          created_at: new Date().toISOString(),
          name: customer.name,
          age: customer.age,
          mobile: customer.mobile,
          location: customer.location,
          visit_count: 0,
          alt_number: customer.altNumber,
          is_student: customer.isStudent ?? false
        };
        const { data, error } = await supabase.from('customers').insert(newCustomer).select().single();
        if (error) throw error;
        return mapCustomer(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customers'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (customer: Customer) => {
        if (!customer) return;
        const { error } = await supabase.from('customers').update({ name: customer.name, age: customer.age, mobile: customer.mobile, alt_number: customer.altNumber, location: customer.location, is_student: customer.isStudent, visit_count: customer.visitCount }).eq('id', customer.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customers'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export const services = {
  getAll: async (): Promise<Service[]> => {
    const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapService);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (service: Omit<Service, 'id' | 'createdAt'>) => {
        const newService = {
          id: generateId(),
          created_at: new Date().toISOString(),
          name: service.name,
          code: service.code,
          price: service.price,
          kind: service.kind,
          mrp: service.mrp,
          offer_price: service.offerPrice,
          payment_method: service.paymentMethod,
        };
        const { data, error } = await supabase.from('services').insert(newService).select().single();
        if (error) throw error;
        return mapService(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['services'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (service: Service) => {
        const serviceToUpdate = {
          name: service.name,
          code: service.code,
          price: service.price,
          kind: service.kind,
          mrp: service.mrp,
          offer_price: service.offerPrice,
          payment_method: service.paymentMethod
        };
        const { error } = await supabase.from('services').update(serviceToUpdate).eq('id', service.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['services'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('services').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['services'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export const subscriptions = {
  getAll: async (): Promise<SubscriptionPlan[]> => {
    const { data, error } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapSubscriptionPlan);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (plan: Omit<SubscriptionPlan, 'id' | 'createdAt'>) => {
        const newPlan = {
          id: generateId(),
          created_at: new Date().toISOString(),
          name: plan.name,
          price: plan.price,
          duration_months: plan.durationMonths
        };
        const { data, error } = await supabase.from('subscription_plans').insert(newPlan).select().single();
        if (error) throw error;
        return mapSubscriptionPlan(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (plan: SubscriptionPlan) => {
        const { error } = await supabase.from('subscription_plans').update({ name: plan.name, duration_months: plan.durationMonths, price: plan.price }).eq('id', plan.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export const sales = {
  getAll: async (): Promise<Sale[]> => {
    const { data: salesData, error: salesError } = await supabase.from('sales').select('*').order('created_at', { ascending: true });
    if (salesError) throw salesError;
    const saleIds = salesData.map(s => s.id);
    const { data: items, error: itemsError } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
    if (itemsError) throw itemsError;
    const { data: subItems, error: subItemsError } = await supabase.from('subscription_sale_items').select('*').in('sale_id', saleIds);
    if (subItemsError) throw subItemsError;
    const itemsBySale = items.reduce<Record<string, SaleItem[]>>((acc, row) => {
      const saleId = row.sale_id as string;
      if (!acc[saleId]) acc[saleId] = [];
      acc[saleId].push(mapSaleItem(row));
      return acc;
    }, {});
    const subItemsBySale = subItems.reduce<Record<string, SubscriptionSaleItem[]>>((acc, row) => {
      const saleId = row.sale_id as string;
      if (!acc[saleId]) acc[saleId] = [];
      acc[saleId].push(mapSubscriptionSaleItem(row));
      return acc;
    }, {});
    return salesData.map(row => ({ ...mapSaleRow(row), items: itemsBySale[row.id] ?? [], subscriptionItems: subItemsBySale[row.id] ?? [] }));
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (sale: any) => {
        const { items, subscription_items, ...saleData } = sale;
        const newSaleId = generateId();

        const saleToInsert = {
          ...saleData,
          id: newSaleId,
          created_at: new Date().toISOString()
        };

        const { error: saleError } = await supabase.from('sales').insert(saleToInsert);
        if (saleError) throw saleError;

        // Increment customer visit count (only if valid customer)
        if (saleToInsert.customer_id) {
          const { data: customerData, error: customerFetchError } = await supabase
            .from('customers')
            .select('visit_count')
            .eq('id', saleToInsert.customer_id)
            .single();

          if (!customerFetchError && customerData) {
            await supabase
              .from('customers')
              .update({ visit_count: (customerData.visit_count || 0) + 1 })
              .eq('id', saleToInsert.customer_id);
          }
        }

        if (items && items.length > 0) {
          const saleItemsToInsert = items.map((item: any) => ({
            id: generateId(),
            sale_id: newSaleId,
            service_id: item.itemId,
            service_name: item.itemName,
            service_code: item.itemCode,
            price: item.price,
            original_price: item.originalPrice ?? null,
            quantity: item.quantity,
            kind: item.kind,
          }));
          const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsToInsert);
          if (itemsError) throw itemsError;
        }

        if (subscription_items && subscription_items.length > 0) {
          const subItemsToInsert = subscription_items.map((item: any) => ({ ...item, sale_id: newSaleId }));
          const { error: subItemsError } = await supabase.from('subscription_sale_items').insert(subItemsToInsert);
          if (subItemsError) throw subItemsError;

          // Fetch plan durations
          const planIds = subscription_items.map((item: any) => item.plan_id);
          const { data: plans, error: plansError } = await supabase
            .from('subscription_plans')
            .select('id, duration_months')
            .in('id', planIds);

          if (plansError) throw plansError;

          const planDurations = plans.reduce<Record<string, number>>((acc, plan) => {
            acc[plan.id] = plan.duration_months;
            return acc;
          }, {});

          const customerSubscriptionsToInsert = subscription_items.map((item: any) => ({
            id: generateId(),
            customer_id: saleToInsert.customer_id,
            customer_name: saleToInsert.customer_name,
            plan_id: item.plan_id,
            plan_name: item.plan_name,
            plan_duration_months: planDurations[item.plan_id],
            plan_price: item.price,
            status: 'active',
            start_date: new Date().toISOString(),
            assigned_by_user_id: saleToInsert.employee_id,
            assigned_by_name: saleToInsert.employee_name,
            created_at: new Date().toISOString(),
          }));

          const { error: csError } = await supabase.from('customer_subscriptions').insert(customerSubscriptionsToInsert);
          if (csError) throw csError;
        }

        return { ...saleToInsert, items, subscription_items };
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['sales'] });
        await queryClient.invalidateQueries({ queryKey: ['customers'] });
        await queryClient.invalidateQueries({ queryKey: ['customerSubscriptions'] });
        if (onSuccess) await onSuccess();
      }
    });
  }
};

export const customerSubscriptions = {
  getAll: async (): Promise<CustomerSubscription[]> => {
    const { data, error } = await supabase.from('customer_subscriptions').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapCustomerSubscription);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (subscription: Omit<CustomerSubscription, 'id' | 'createdAt'>) => {
        const newSubscription = {
          ...subscription,
          id: generateId(),
          created_at: new Date().toISOString(),
          customer_id: subscription.customerId,
          customer_name: subscription.customerName,
          plan_id: subscription.planId,
          plan_name: subscription.planName,
          plan_duration_months: subscription.planDurationMonths,
          plan_price: subscription.planPrice,
          assigned_by_user_id: subscription.assignedByUserId,
          assigned_by_name: subscription.assignedByName,
          start_date: subscription.startDate
        };
        const { data, error } = await supabase.from('customer_subscriptions').insert(newSubscription).select().single();
        if (error) throw error;
        return mapCustomerSubscription(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customerSubscriptions'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (subscription: CustomerSubscription) => {
        const { error } = await supabase.from('customer_subscriptions').update({ status: subscription.status }).eq('id', subscription.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customerSubscriptions'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('customer_subscriptions').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['customerSubscriptions'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export const offers = {
  getAll: async (): Promise<Offer[]> => {
    const { data, error } = await supabase.from('offers').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapOffer);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (offer: Omit<Offer, 'id' | 'createdAt'>) => {
        const newOffer = {
          id: generateId(),
          created_at: new Date().toISOString(),
          name: offer.name,
          percent: offer.percent,
          visit_count: offer.visitCount,
          start_date: offer.startDate,
          end_date: offer.endDate,
          applies_to: offer.appliesTo || 'both',
          student_only: offer.studentOnly || false,
        };
        const { data, error } = await supabase.from('offers').insert(newOffer).select().single();
        if (error) throw error;
        return mapOffer(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['offers'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (offer: Offer) => {
        const { error } = await supabase.from('offers').update({ name: offer.name, percent: offer.percent, visit_count: offer.visitCount, start_date: offer.startDate, end_date: offer.endDate, applies_to: offer.appliesTo || 'both', student_only: offer.studentOnly || false }).eq('id', offer.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['offers'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('offers').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['offers'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export const upiConfigs = {
  getAll: async (): Promise<UpiData[]> => {
    const { data, error } = await supabase.from('upi_configs').select('*').order('id');
    if (error) throw error;
    return data.map(mapUpiData);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (upi: UpiData) => {
        const { error } = await supabase.from('upi_configs').insert({ id: upi.id, upi_id: upi.upiId, payee_name: upi.payeeName });
        if (error) throw error;
        return upi;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['upiConfigs'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (upi: UpiData) => {
        const { error } = await supabase.from('upi_configs').update({ upi_id: upi.upiId, payee_name: upi.payeeName }).eq('id', upi.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['upiConfigs'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('upi_configs').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['upiConfigs'] }); if (onSuccess) await onSuccess(); }
    });
  },
};


export const combos = {
  getAll: async (): Promise<Combo[]> => {
    const { data: comboRows, error: comboError } = await supabase.from('combos').select('*').order('created_at', { ascending: true });
    if (comboError) throw comboError;
    if (!comboRows || comboRows.length === 0) return [];
    const comboIds = comboRows.map(c => c.id);
    const { data: itemRows, error: itemError } = await supabase.from('combo_items').select('*').in('combo_id', comboIds);
    if (itemError) throw itemError;
    const itemsByCombo = (itemRows ?? []).reduce<Record<string, ComboItem[]>>((acc, row) => {
      const cid = row.combo_id as string;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(mapComboItem(row));
      return acc;
    }, {});
    return comboRows.map(r => ({ id: r.id as string, name: r.name as string, comboPrice: Number(r.combo_price), items: itemsByCombo[r.id] ?? [], createdAt: (r.created_at as string) ?? new Date().toISOString() }));
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (combo: Omit<Combo, 'id' | 'createdAt'>) => {
        const comboId = generateId();
        const { error: comboErr } = await supabase.from('combos').insert({ id: comboId, name: combo.name, combo_price: combo.comboPrice, created_at: new Date().toISOString() });
        if (comboErr) throw comboErr;
        if (combo.items.length > 0) {
          const rows = combo.items.map(item => ({ id: generateId(), combo_id: comboId, service_id: item.serviceId, service_name: item.serviceName, service_kind: item.serviceKind, original_price: item.originalPrice }));
          const { error: itemErr } = await supabase.from('combo_items').insert(rows);
          if (itemErr) throw itemErr;
        }
        return { id: comboId, name: combo.name, comboPrice: combo.comboPrice, items: combo.items, createdAt: new Date().toISOString() } as Combo;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['combos'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (combo: Combo) => {
        const { error: comboErr } = await supabase.from('combos').update({ name: combo.name, combo_price: combo.comboPrice }).eq('id', combo.id);
        if (comboErr) throw comboErr;
        // Delete existing items and re-insert
        await supabase.from('combo_items').delete().eq('combo_id', combo.id);
        if (combo.items.length > 0) {
          const rows = combo.items.map(item => ({ id: item.id || generateId(), combo_id: combo.id, service_id: item.serviceId, service_name: item.serviceName, service_kind: item.serviceKind, original_price: item.originalPrice }));
          const { error: itemErr } = await supabase.from('combo_items').insert(rows);
          if (itemErr) throw itemErr;
        }
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['combos'] }); if (onSuccess) await onSuccess(); }
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('combos').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['combos'] }); if (onSuccess) await onSuccess(); }
    });
  },
};

export async function seedSupabaseIfNeeded(): Promise<void> {
  // Users are now created via Supabase Auth sign-up (profiles table auto-populated by trigger).
  // Only seed services and subscription plans if they don't exist yet.
  const { data: existingServices } = await supabase.from('services').select('id').limit(1);
  if (existingServices && existingServices.length > 0) return;

  const defaultServices = [
    { id: generateId(), name: 'Haircut', code: 'HC001', price: 300, kind: 'service', created_at: new Date().toISOString() },
    { id: generateId(), name: 'Hair Color', code: 'HC002', price: 1500, kind: 'service', created_at: new Date().toISOString() },
  ];
  await supabase.from('services').insert(defaultServices);

  const defaultPlans = [
    { id: generateId(), name: 'Trial Plan', duration_months: 1, price: 0, created_at: new Date().toISOString() },
    { id: generateId(), name: '6 Months Plan', duration_months: 6, price: 600, created_at: new Date().toISOString() },
  ];
  await supabase.from('subscription_plans').insert(defaultPlans);
}

// ── Expense Categories ─────────────────────────────────────────────────

export const expenseCategories = {
  getAll: async (): Promise<ExpenseCategory[]> => {
    const { data, error } = await supabase.from('expense_categories').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(mapExpenseCategory);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (name: string) => {
        const { data, error } = await supabase.from('expense_categories').insert({ name: name.trim() }).select().single();
        if (error) throw error;
        return mapExpenseCategory(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['expenseCategories'] }); if (onSuccess) await onSuccess(); },
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('expense_categories').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['expenseCategories'] }); if (onSuccess) await onSuccess(); },
    });
  },
};

// ── Expenses ──────────────────────────────────────────────────────────

export const expenses = {
  getAll: async (): Promise<Expense[]> => {
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    if (error) throw error;
    return data.map(mapExpense);
  },
  useAdd: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (expense: { categoryId: string; categoryName: string; amount: number; description: string; expenseDate: string; createdBy: string; createdByName: string }) => {
        const row = {
          category_id: expense.categoryId,
          category_name: expense.categoryName,
          amount: expense.amount,
          description: expense.description,
          expense_date: expense.expenseDate,
          created_by: expense.createdBy,
          created_by_name: expense.createdByName,
        };
        const { data, error } = await supabase.from('expenses').insert(row).select().single();
        if (error) throw error;
        return mapExpense(data);
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['expenses'] }); if (onSuccess) await onSuccess(); },
    });
  },
  useUpdate: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (expense: { id: string; categoryId: string; categoryName: string; amount: number; description: string; expenseDate: string }) => {
        const { error } = await supabase.from('expenses').update({
          category_id: expense.categoryId,
          category_name: expense.categoryName,
          amount: expense.amount,
          description: expense.description,
          expense_date: expense.expenseDate,
        }).eq('id', expense.id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['expenses'] }); if (onSuccess) await onSuccess(); },
    });
  },
  useRemove: (onSuccess?: () => void | Promise<void>) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['expenses'] }); if (onSuccess) await onSuccess(); },
    });
  },
};

// ── App Settings ─────────────────────────────────────────────────────────

export const appSettings = {
  /** Get a single setting value by key */
  get: async (key: string): Promise<any> => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  },
  /** Upsert a setting (admin only) */
  set: async (key: string, value: any, userId?: string): Promise<void> => {
    const { error } = await supabase.from('app_settings').upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: userId ?? null },
      { onConflict: 'key' },
    );
    if (error) throw error;
  },
};
