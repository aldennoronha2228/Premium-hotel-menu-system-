import { supabaseCustomer as supabase } from '@/lib/supabase';
import type { CartItem } from '@/context/CartContext';

export interface SubmitOrderResult {
    orderId: string;
    dailyOrderNumber: number;
}

/**
 * Submits an order to the Supabase `orders` + `order_items` tables,
 * exactly matching the schema the Vite dashboard (localhost:5173) reads from.
 */
export async function submitOrderToSupabase(
    cartItems: CartItem[],
    tableId: string,
    total: number
): Promise<SubmitOrderResult> {
    const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? 'rest001';

    // 1. Insert the order row
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
            restaurant_id: restaurantId,
            table_number: tableId || 'Walk-in',
            total,
            status: 'new',
        }])
        .select('id, daily_order_number')
        .single();

    if (orderError || !order) {
        throw new Error(orderError?.message ?? 'Failed to create order');
    }

    // 2. Insert order_items rows
    const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        menu_item_id: null,          // customer menu uses local items, no FK required
        item_name: item.name,
        item_price: item.price,
        quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

    if (itemsError) {
        // Order row was created — clean up to avoid orphan
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(itemsError.message);
    }

    return {
        orderId: order.id,
        dailyOrderNumber: order.daily_order_number ?? 0,
    };
}
