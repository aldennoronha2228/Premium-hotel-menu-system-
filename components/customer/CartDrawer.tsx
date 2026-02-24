'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { QuantitySelector } from '@/components/customer/QuantitySelector';
import { useRouter } from 'next/navigation';

export const CartDrawer: React.FC<{ tableId?: string }> = ({ tableId = '' }) => {
    const { cart, isCartOpen, setIsCartOpen, totalPrice, updateQuantity, removeFromCart } = useCart();
    const router = useRouter();

    const handleCheckout = () => {
        setIsCartOpen(false);
        const url = tableId ? `/customer/order-summary?table=${encodeURIComponent(tableId)}` : '/customer/order-summary';
        router.push(url);
    };

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
                        <div className="bg-gradient-to-r from-[#1B4332] to-[#2D5F4C] p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3"><ShoppingBag className="w-6 h-6" /><h2 className="text-2xl font-bold">Your Cart</h2></div>
                                <motion.button onClick={() => setIsCartOpen(false)} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"><X className="w-5 h-5" /></motion.button>
                            </div>
                            <p className="text-white/80 text-sm">{cart.length} {cart.length === 1 ? 'item' : 'items'} in cart</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <AnimatePresence mode="popLayout">
                                {cart.length === 0 ? (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-12">
                                        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" /><p className="text-gray-500 text-lg">Your cart is empty</p><p className="text-gray-400 text-sm mt-2">Add items to get started</p>
                                    </motion.div>
                                ) : (
                                    cart.map((item) => (
                                        <motion.div key={item.id} layout initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="bg-[#FAF8F5] rounded-2xl p-4 relative">
                                            <div className="flex gap-4">
                                                <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-[#1B4332] mb-1">{item.name}</h3>
                                                    <p className="text-[#D4AF37] font-semibold mb-2">${item.price.toFixed(2)}</p>
                                                    <QuantitySelector quantity={item.quantity} onIncrease={() => updateQuantity(item.id, item.quantity + 1)} onDecrease={() => updateQuantity(item.id, item.quantity - 1)} />
                                                </div>
                                                <motion.button onClick={() => removeFromCart(item.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                    <Trash2 className="w-4 h-4 text-red-500 hover:text-white" />
                                                </motion.button>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-[#1B4332]/10 flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Subtotal:</span><span className="font-bold text-[#1B4332]">${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                        {cart.length > 0 && (
                            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="border-t border-gray-200 p-6 space-y-4 bg-white">
                                <div className="flex justify-between items-center text-lg">
                                    <span className="font-semibold text-gray-700">Total:</span>
                                    <motion.span key={totalPrice} initial={{ scale: 1.2, color: '#D4AF37' }} animate={{ scale: 1, color: '#1B4332' }} className="font-bold text-2xl">${totalPrice.toFixed(2)}</motion.span>
                                </div>
                                <motion.button onClick={handleCheckout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-gradient-to-r from-[#D4AF37] to-[#E8C96F] text-[#1B4332] py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                                    Proceed to Checkout
                                </motion.button>
                            </motion.div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
