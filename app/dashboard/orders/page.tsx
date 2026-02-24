'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, Plus, Trash2, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTables, menuItems, type Table } from '@/data/sharedData';
import { fetchActiveOrders, updateOrderStatus, deleteOrder, subscribeToOrders } from '@/lib/api';
import type { DashboardOrder } from '@/lib/types';

const statusConfig = {
    new: { label: 'New Order', color: 'bg-blue-500', ring: 'ring-blue-500/20', text: 'text-blue-700', bg: 'bg-blue-50' },
    preparing: { label: 'Preparing', color: 'bg-amber-500', ring: 'ring-amber-500/20', text: 'text-amber-700', bg: 'bg-amber-50' },
    done: { label: 'Ready', color: 'bg-emerald-500', ring: 'ring-emerald-500/20', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    paid: { label: 'Paid', color: 'bg-slate-500', ring: 'ring-slate-500/20', text: 'text-slate-700', bg: 'bg-slate-50' },
    cancelled: { label: 'Cancelled', color: 'bg-rose-500', ring: 'ring-rose-500/20', text: 'text-rose-700', bg: 'bg-rose-50' },
};

const tableStatusConfig = {
    available: { color: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600' },
    busy: { color: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-700' },
    reserved: { color: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700' },
};

export default function LiveOrdersPage() {
    const [orders, setOrders] = useState<DashboardOrder[]>([]);
    const [floorTables, setFloorTables] = useState<Table[]>([]);
    const [addingToOrder, setAddingToOrder] = useState<string | null>(null);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => { setFloorTables(getTables()); }, []);

    const loadOrders = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchActiveOrders();
            setOrders(data);
        } catch (err: any) {
            setError('Could not connect to database. Check your .env Supabase credentials.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOrders();
        const channel = subscribeToOrders(setOrders);
        return () => { channel.unsubscribe(); };
    }, [loadOrders]);

    // Automatically sync table status based on active orders
    useEffect(() => {
        if (!orders) return;

        const activeTableIds = new Set(
            orders
                .filter(o => ['new', 'preparing', 'done'].includes(o.status))
                .map(o => o.table)
        );

        import('@/data/sharedData').then(({ getTables, setTables }) => {
            const currentTables = getTables();
            let changed = false;
            const updatedTables = currentTables.map(t => {
                // Check if the table ID or Name matches the order's table field
                const hasActiveOrder = activeTableIds.has(t.id) || activeTableIds.has(t.name) || activeTableIds.has(t.id.replace('T-', ''));
                const targetStatus = hasActiveOrder ? 'busy' : 'available';

                if (t.status !== targetStatus) {
                    changed = true;
                    return { ...t, status: targetStatus as 'available' | 'busy' | 'reserved' };
                }
                return t;
            });

            if (changed) {
                setTables(updatedTables);
                setFloorTables(updatedTables);
            }
        });
    }, [orders]);

    const handleStatusChange = async (orderId: string, status: DashboardOrder['status']) => {
        setActionLoading(orderId);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        try { await updateOrderStatus(orderId, status); }
        catch { loadOrders(); }
        setActionLoading(null);
    };

    const handleDeleteOrder = async (orderId: string) => {
        setActionLoading(orderId);
        setOrders(prev => prev.filter(o => o.id !== orderId));
        try { await deleteOrder(orderId); }
        catch { loadOrders(); }
        setActionLoading(null);
    };

    const addItemToOrder = (orderId: string, menuItem: typeof menuItems[0]) => {
        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;
            const existing = order.items.findIndex(i => i.name === menuItem.name);
            if (existing !== -1) {
                const newItems = [...order.items];
                newItems[existing] = { ...newItems[existing], quantity: newItems[existing].quantity + 1 };
                return { ...order, items: newItems };
            }
            return { ...order, items: [...order.items, { id: `${menuItem.id}-${Date.now()}`, name: menuItem.name, quantity: 1, price: menuItem.price }] };
        }));
        setAddingToOrder(null);
        setSearchQuery('');
    };

    const removeItem = (orderId: string, itemId: string) => {
        setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;
            const newItems = order.items.filter(i => i.id !== itemId);
            if (newItems.length === 0) return order;
            return { ...order, items: newItems };
        }));
    };

    const filteredMenuItems = menuItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const activeOrders = orders.filter(o => ['new', 'preparing', 'done'].includes(o.status));
    const busyTables = floorTables.filter(t => t.status === 'busy').length;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <RefreshCw className="w-8 h-8 text-blue-500" />
            </motion.div>
            <span className="ml-3 text-slate-500">Loading orders from Supabase…</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Live Orders</h1>
                    <p className="text-sm text-slate-500 mt-1">Monitor active orders and restaurant floor status</p>
                </div>
                <button onClick={loadOrders} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
                </motion.div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {[
                    { label: 'Active Orders', value: activeOrders.length.toString(), icon: '📦' },
                    { label: 'Tables Occupied', value: `${busyTables}/${floorTables.length}`, icon: '🪑' },
                    { label: 'New Orders', value: orders.filter(o => o.status === 'new').length.toString(), icon: '⏱️' },
                    { label: 'Ready to Serve', value: orders.filter(o => o.status === 'done').length.toString(), icon: '✅' },
                ].map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ y: -4 }} className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs lg:text-sm text-slate-500">{stat.label}</p>
                                <p className="text-xl lg:text-2xl font-semibold text-slate-900 mt-1">{stat.value}</p>
                            </div>
                            <span className="text-xl lg:text-2xl">{stat.icon}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-4 lg:p-6 border border-slate-200/60 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                        <h2 className="text-base lg:text-lg font-semibold text-slate-900">Floor Overview</h2>
                        <div className="flex items-center gap-3 lg:gap-4 text-xs">
                            {Object.entries(tableStatusConfig).map(([key, cfg]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <div className={cn('w-3 h-3 rounded border', cfg.color, cfg.border)} />
                                    <span className="text-slate-600 capitalize">{key}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-2 lg:p-4 overflow-auto" style={{ height: 400, backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        {floorTables.map(table => {
                            const config = tableStatusConfig[table.status];
                            const isSelected = selectedTableId === table.id;
                            const tableOrder = activeOrders.find(o => o.table === table.id || o.table === table.name || o.table === table.id.replace('T-', ''));

                            return (
                                <div key={table.id} style={{ position: 'absolute', left: table.x * 0.7, top: table.y * 0.7 }} className="relative z-10">
                                    <motion.div onClick={() => setSelectedTableId(isSelected ? null : table.id)} whileHover={{ scale: 1.1 }} className={cn('w-12 h-12 lg:w-16 lg:h-16 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all shadow-sm relative', config.color, config.border, config.text, isSelected && 'ring-4 ring-blue-500/30')}>
                                        <span className="text-[10px] lg:text-xs font-semibold">{table.id}</span>
                                        <span className="text-[8px] lg:text-[10px] opacity-70">{table.seats}</span>
                                    </motion.div>

                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/60 p-3 z-50 pointer-events-none"
                                            >
                                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/95 border-l border-t border-slate-200/60 rotate-45" />
                                                <div className="relative z-10">
                                                    <h4 className="text-xs font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">Table {table.id} Orders</h4>
                                                    {tableOrder && tableOrder.items.length > 0 ? (
                                                        <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                                                            {tableOrder.items.map(item => (
                                                                <li key={item.id} className="text-[10px] flex justify-between">
                                                                    <span className="text-slate-600 truncate mr-2">{item.name}</span>
                                                                    <span className="font-semibold text-slate-900">x{item.quantity}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-400 italic">No active orders</p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                <div className="space-y-4">
                    <h2 className="text-base lg:text-lg font-semibold text-slate-900">
                        Active Orders
                        {activeOrders.length > 0 && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{activeOrders.length}</span>}
                    </h2>
                    {activeOrders.length === 0 && !loading && (
                        <div className="bg-white rounded-2xl p-12 border border-slate-200/60 text-center">
                            <p className="text-4xl mb-3">🎉</p>
                            <p className="text-slate-500 font-medium">No active orders right now</p>
                            <p className="text-slate-400 text-sm mt-1">Orders placed by customers will appear here live</p>
                        </div>
                    )}
                    <div className="space-y-3 max-h-[500px] lg:max-h-[580px] overflow-y-auto pr-2">
                        {activeOrders.map((order, i) => {
                            const config = statusConfig[order.status];
                            const total = order.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
                            const isUpdating = actionLoading === order.id;
                            return (
                                <motion.div key={order.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className={cn('bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all', isUpdating && 'opacity-60')}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">#{order.daily_order_number ?? order.id.slice(-4)}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-slate-900">Table {order.table}</h3>
                                                    <motion.span animate={{ scale: order.status === 'new' ? [1, 1.1, 1] : 1 }} transition={{ repeat: order.status === 'new' ? Infinity : 0, duration: 2 }} className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium', config.bg, config.text)}>{config.label}</motion.span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3 h-3" />{order.time}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteOrder(order.id)} disabled={isUpdating} className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors text-slate-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        {order.items.map(item => (
                                            <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between group">
                                                <span className="text-sm text-slate-700">{item.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-slate-900">×{item.quantity}</span>
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeItem(order.id, item.id)} className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-50 hover:bg-rose-100 opacity-0 group-hover:opacity-100 transition-all">
                                                        <X className="w-3.5 h-3.5 text-rose-600" />
                                                    </motion.button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setAddingToOrder(order.id)} className="w-full flex items-center justify-center gap-2 py-2 mb-4 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
                                        <Plus className="w-4 h-4" />Add Item
                                    </motion.button>
                                    <div className="pt-4 border-t border-slate-200/60">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-slate-600">Total</span>
                                            <span className="text-xl font-bold text-slate-900">${total.toFixed(2)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {order.status === 'new' && <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleStatusChange(order.id, 'preparing')} disabled={isUpdating} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all disabled:opacity-50">Start Preparing</motion.button>}
                                            {order.status === 'preparing' && <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleStatusChange(order.id, 'done')} disabled={isUpdating} className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50">Mark as Ready</motion.button>}
                                            {order.status === 'done' && <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleStatusChange(order.id, 'paid')} disabled={isUpdating} className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50">Mark as Paid ✓</motion.button>}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {addingToOrder && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAddingToOrder(null)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                            <div className="p-6 border-b border-slate-200/60">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-semibold text-slate-900">Add Item to Order</h3>
                                    <button onClick={() => setAddingToOrder(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input type="text" placeholder="Search menu items…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200/60 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all" />
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredMenuItems.map(item => (
                                        <motion.button key={item.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => addItemToOrder(addingToOrder, item)} className="bg-slate-50 hover:bg-blue-50 border border-slate-200/60 hover:border-blue-300 rounded-xl p-3 text-left transition-all group">
                                            <div className="flex items-start gap-3">
                                                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200">
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-slate-900 text-sm mb-0.5 truncate group-hover:text-blue-600 transition-colors">{item.name}</h4>
                                                    <p className="text-xs text-slate-500 mb-2 line-clamp-1">{item.description}</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-slate-900">${item.price.toFixed(2)}</span>
                                                        <span className="text-xs px-2 py-0.5 bg-slate-200 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-600 rounded-md transition-colors">{item.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                                {filteredMenuItems.length === 0 && <div className="text-center py-12"><p className="text-slate-500">No menu items found</p></div>}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
