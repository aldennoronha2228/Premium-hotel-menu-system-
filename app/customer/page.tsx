'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, ChevronUp, Receipt, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import type { MenuItem as CartMenuItem } from '@/context/CartContext';
import { CategoryFilter } from '@/components/customer/CategoryFilter';
import { MenuItemCard } from '@/components/customer/MenuItemCard';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { applyAvailabilityOverrides, seedAvailabilityMap } from '@/lib/menuAvailability';

// Fallback static items in case Supabase isn't set up yet
import { menuItems as staticItems, categories as staticCategories } from '@/data/menuData';

// Supabase item shape → CartMenuItem shape
interface SupabaseItem {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    available: boolean;
    categories: { name: string } | null;
    // we store description in the static list but Supabase may not have it yet
}

function toCartItem(s: SupabaseItem, fallback?: CartMenuItem): CartMenuItem & { available: boolean } {
    return {
        id: s.id,
        name: s.name,
        description: fallback?.description ?? '',
        price: s.price,
        image: s.image_url ?? fallback?.image ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        category: s.categories?.name ?? fallback?.category ?? 'Other',
        available: s.available ?? true,
    };
}

function CustomerMenuContent() {
    const [activeCategory, setActiveCategory] = useState('All');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [menuItems, setMenuItems] = useState<(CartMenuItem & { available: boolean })[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToCart, setIsCartOpen, totalItems } = useCart();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tableId = searchParams.get('table');

    // Fetch live menu from Supabase; fall back to static data if not configured
    useEffect(() => {
        let cancelled = false;

        async function loadMenu() {
            try {
                const { data: items, error: itemsErr } = await supabase
                    .from('menu_items')
                    .select('*, categories(name)')
                    .order('name');

                const { data: cats, error: catsErr } = await supabase
                    .from('categories')
                    .select('name')
                    .order('display_order');

                if (itemsErr || catsErr || !items || !cats) throw new Error('fetch failed');

                if (cancelled) return;

                // Enrich with static descriptions/images where Supabase row has none
                const enriched = items.map((s: SupabaseItem) => {
                    const fallback = staticItems.find(
                        si => si.name.toLowerCase() === s.name.toLowerCase()
                    );
                    return toCartItem(s, fallback);
                });

                // Seed localStorage so overrides are initialised from Supabase state
                seedAvailabilityMap(enriched.map(i => ({ id: i.id, available: i.available })));
                // Apply any manual overrides saved by the dashboard
                setMenuItems(applyAvailabilityOverrides(enriched));
                setCategories(['All', ...cats.map((c: { name: string }) => c.name)]);
            } catch {
                // Supabase not available — use static fallback + localStorage overrides
                if (cancelled) return;
                const base = staticItems.map(i => ({ ...i, available: true }));
                setMenuItems(applyAvailabilityOverrides(base));
                setCategories(staticCategories);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadMenu();
        return () => { cancelled = true; };
    }, []);

    // Subscribe to real-time availability changes
    useEffect(() => {
        const channel = supabase
            .channel('menu-items-rt')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu_items' },
                (payload) => {
                    const updated = payload.new as any;
                    setMenuItems(prev =>
                        prev.map(item =>
                            item.id === updated.id
                                ? { ...item, available: updated.available }
                                : item
                        )
                    );
                    // Keep localStorage in sync with Supabase real-time changes
                    import('@/lib/menuAvailability').then(m =>
                        m.setItemAvailability(updated.id, updated.available)
                    );
                })
            .subscribe();
        return () => { channel.unsubscribe(); };
    }, []);

    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const filteredItems = activeCategory === 'All'
        ? menuItems
        : menuItems.filter(item => item.category === activeCategory);

    return (
        <div className="min-h-screen bg-[#FAF8F5]">
            {/* Header */}
            <motion.header initial={{ y: -100 }} animate={{ y: 0 }} className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                            <h1 className="text-3xl md:text-4xl font-bold text-[#1B4332]">Grandeur <span className="text-[#D4AF37]">Hotel</span></h1>
                            <p className="text-sm text-gray-600 mt-1">{tableId ? `Table ${tableId} · Fine Dining Experience` : 'Fine Dining Experience'}</p>
                        </motion.div>
                        <div className="flex items-center gap-3">
                            <motion.button onClick={() => router.push('/customer/order-history')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-white text-[#1B4332] p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-200" title="Order History">
                                <Receipt className="w-6 h-6" />
                            </motion.button>
                            <motion.button onClick={() => setIsCartOpen(true)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative bg-gradient-to-r from-[#1B4332] to-[#2D5F4C] text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                                <ShoppingCart className="w-6 h-6" />
                                <AnimatePresence>
                                    {totalItems > 0 && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -top-2 -right-2 bg-[#D4AF37] text-[#1B4332] w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
                                            {totalItems}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Hero */}
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="relative h-64 md:h-80 overflow-hidden">
                <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80" alt="Restaurant interior" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center text-center">
                    <div>
                        <motion.h2 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="text-4xl md:text-5xl font-bold text-white mb-4">Culinary Excellence</motion.h2>
                        <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="text-white/90 text-lg md:text-xl">Discover our exquisite menu crafted by world-class chefs</motion.p>
                    </div>
                </div>
            </motion.section>

            {/* Category strip */}
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="sticky top-[88px] z-20 bg-[#FAF8F5] py-6 border-b border-gray-200/50">
                <CategoryFilter categories={categories} activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
            </motion.div>

            {/* Items grid */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-28 gap-4">
                        <Loader2 className="w-10 h-10 text-[#1B4332] animate-spin" />
                        <p className="text-gray-500 text-sm">Loading menu…</p>
                    </div>
                ) : (
                    <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map(item => (
                                <MenuItemCard
                                    key={item.id}
                                    item={item}
                                    available={item.available}
                                    onAddToCart={item.available ? addToCart : undefined}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
                {!loading && filteredItems.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                        <p className="text-gray-500 text-xl">No items in this category</p>
                    </motion.div>
                )}
            </main>

            <CartDrawer tableId={tableId ?? ''} />

            {/* Scroll to top */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} onClick={scrollToTop} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="fixed bottom-6 right-6 w-14 h-14 bg-[#D4AF37] text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:shadow-xl transition-all">
                        <ChevronUp className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Mobile cart fab */}
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
                <motion.button onClick={() => setIsCartOpen(true)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gradient-to-r from-[#1B4332] to-[#2D5F4C] text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5" /><span className="font-bold">View Cart</span>
                    {totalItems > 0 && <span className="bg-[#D4AF37] text-[#1B4332] px-3 py-1 rounded-full text-sm font-bold">{totalItems}</span>}
                </motion.button>
            </motion.div>
        </div>
    );
}

export default function CustomerMenuPage() {
    return <Suspense><CustomerMenuContent /></Suspense>;
}
