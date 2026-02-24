import { supabase } from './supabase';
import type { Order, MenuItem, Category, DashboardOrder } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── ORDERS ─────────────────────────────────────────────────────────────────

/** Fetch all active orders (new/preparing/done) */
export async function fetchActiveOrders(): Promise<DashboardOrder[]> {
    const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .in('status', ['new', 'preparing', 'done'])
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapOrder);
}

/** Fetch order history (paid/cancelled) */
export async function fetchOrderHistory(limit = 50): Promise<DashboardOrder[]> {
    const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .in('status', ['paid', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []).map(mapOrder);
}

/** Update order status */
export async function updateOrderStatus(
    orderId: string,
    status: Order['status']
): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
    if (error) throw error;
}

/** Delete an order */
export async function deleteOrder(orderId: string): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
    if (error) throw error;
}

/** Subscribe to real-time order changes */
export function subscribeToOrders(
    onChange: (orders: DashboardOrder[]) => void
): RealtimeChannel {
    const channelId = `orders-rt-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            async () => {
                try {
                    const orders = await fetchActiveOrders();
                    onChange(orders);
                } catch (err) {
                    console.error('Real-time fetch error:', err);
                }
            }
        )
        .subscribe();
    return channel;
}

// ─── MENU ITEMS ─────────────────────────────────────────────────────────────

/** Fetch all menu items with their category */
export async function fetchMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
        .from('menu_items')
        .select(`*, categories (id, name)`)
        .order('name');

    if (error) throw error;
    return data || [];
}

/** Toggle menu item availability */
export async function toggleMenuItemAvailability(
    itemId: string,
    available: boolean
): Promise<void> {
    const { error } = await supabase
        .from('menu_items')
        .update({ available })
        .eq('id', itemId);
    if (error) throw error;
}

/** Delete a menu item */
export async function deleteMenuItem(itemId: string): Promise<void> {
    const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId);
    if (error) throw error;
}

/** Create a menu item */
export async function createMenuItem(item: {
    name: string;
    price: number;
    category_id: string;
    type: 'veg' | 'non-veg';
    image_url?: string;
}): Promise<MenuItem> {
    const { data, error } = await supabase
        .from('menu_items')
        .insert([{ ...item, available: true }])
        .select(`*, categories (id, name)`)
        .single();

    if (error) throw error;
    return data;
}

/** Update a menu item */
export async function updateMenuItem(
    itemId: string,
    updates: Partial<{ name: string; price: number; category_id: string; type: 'veg' | 'non-veg'; image_url: string }>
): Promise<void> {
    const { error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', itemId);
    if (error) throw error;
}

// ─── CATEGORIES ─────────────────────────────────────────────────────────────

/** Fetch all categories ordered by display_order */
export async function fetchCategories(): Promise<Category[]> {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order');

    if (error) throw error;
    return data || [];
}

/** Create a new category */
export async function createCategory(name: string, displayOrder: number = 0): Promise<Category> {
    const { data, error } = await supabase
        .from('categories')
        .insert([{ name, display_order: displayOrder }])
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

/** Update a category */
export async function updateCategory(id: string, name: string): Promise<void> {
    const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id);

    if (error) throw error;
}

/** Delete a category */
export async function deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function mapOrder(raw: any): DashboardOrder {
    const items = (raw.order_items || []).map((oi: any) => ({
        id: oi.id,
        name: oi.item_name,
        quantity: oi.quantity,
        price: oi.item_price,
    }));

    return {
        id: raw.id,
        daily_order_number: raw.daily_order_number,
        table: raw.table_number,
        items,
        status: raw.status,
        total: raw.total,
        time: formatTimeAgo(raw.created_at),
        created_at: raw.created_at,
    };
}

function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}
