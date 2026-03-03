/**
 * lib/submitOrder.ts  (hardened)
 * --------------------------------
 * SECURITY changes vs original:
 *  1. All incoming data is validated with validateOrderPayload() before any
 *     DB write occurs — prevents injection and oversized payloads.
 *  2. An explicit cap on item count (50) and quantity-per-item (99) stops
 *     abuse that could inflate DB storage or crash the POS.
 *  3. Total amount is cross-checked against item prices so the client cannot
 *     send a manipulated (lower) total to the server.
 *  4. Orphan cleanup on partial failure is retained.
 *  5. Security events are logged.
 */

import { supabaseCustomer as supabase } from '@/lib/supabase';
import { validateOrderPayload } from '@/lib/validate';
import { securityLog } from '@/lib/logger';
import { env } from '@/lib/env';
import type { CartItem } from '@/context/CartContext';

export interface SubmitOrderResult {
    orderId: string;
    dailyOrderNumber: number;
}

export async function submitOrderToSupabase(
    cartItems: CartItem[],
    tableId: string,
    total: number
): Promise<SubmitOrderResult> {
    const restaurantId = env.restaurantId;

    // ── Step 1: Validate all inputs before touching the database ─────────────
    const validation = validateOrderPayload({
        tableId,
        restaurantId,
        items: cartItems.map(i => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
        })),
        total,
    });

    if (!validation.ok) {
        securityLog.warn('INPUT_VALIDATION_FAILED', { context: 'submitOrder', error: validation.error });
        throw new Error(`Invalid order data: ${validation.error}`);
    }

    const payload = validation.data!;

    // ── Step 2: Insert the order row ──────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
            restaurant_id: payload.restaurantId,
            table_number: payload.tableId,
            total: payload.total,
            status: 'new',
        }])
        .select('id, daily_order_number')
        .single();

    if (orderError || !order) {
        securityLog.error('ORDER_SUBMITTED', { ok: false, message: orderError?.message });
        throw new Error(orderError?.message ?? 'Failed to create order');
    }

    // ── Step 3: Insert order_items rows ───────────────────────────────────────
    const orderItems = payload.items.map((item) => ({
        order_id: order.id,
        menu_item_id: null,   // customer menu uses static data — no FK required
        item_name: item.name.slice(0, 200),   // enforce DB column length
        item_price: item.price,
        quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

    if (itemsError) {
        // Orphan cleanup: delete the parent order row
        await supabase.from('orders').delete().eq('id', order.id);
        securityLog.error('ORDER_SUBMITTED', { ok: false, orderId: order.id, message: itemsError.message });
        throw new Error(itemsError.message);
    }

    securityLog.info('ORDER_SUBMITTED', { ok: true, orderId: order.id, table: payload.tableId, total: payload.total });

    return {
        orderId: order.id,
        dailyOrderNumber: order.daily_order_number ?? 0,
    };
}
