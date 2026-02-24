'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Edit, Trash2, RefreshCw, AlertCircle, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { fetchMenuItems, fetchCategories, toggleMenuItemAvailability, deleteMenuItem, createMenuItem, updateMenuItem, createCategory, deleteCategory } from '@/lib/api';
import type { MenuItem, Category } from '@/lib/types';
import { setItemAvailability, seedAvailabilityMap, applyAvailabilityOverrides } from '@/lib/menuAvailability';

const CATEGORY_ICONS: Record<string, string> = {
    starters: '🥗', mains: '🍽️', 'main course': '🍽️', rice: '🍚', 'rice & breads': '🍚',
    desserts: '🍰', beverages: '🍹', seafood: '🦞', steaks: '🥩', pasta: '🍝',
    wine: '🍷', appetizers: '🥗', sides: '🍟',
};
function getCategoryIcon(name: string) { return CATEGORY_ICONS[name.toLowerCase()] ?? '🍴'; }

interface ItemFormData { name: string; price: string; category_id: string; type: 'veg' | 'non-veg'; image_url: string; }

function CategoryModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => Promise<void>; }) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    if (!open) return null;
    const handleSubmit = async () => {
        if (!name) return;
        setSaving(true);
        try { await onSave(name); onClose(); setName(''); } finally { setSaving(false); }
    };
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200/60 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">New Category</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sushi" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                </div>
                <div className="p-6 pt-0 flex gap-3">
                    <button onClick={onClose} className="flex-1 h-11 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={saving || !name} className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function ItemModal({ open, onClose, categories, editItem, onSave }: { open: boolean; onClose: () => void; categories: Category[]; editItem?: MenuItem | null; onSave: (data: ItemFormData) => Promise<void>; }) {
    const [form, setForm] = useState<ItemFormData>({ name: '', price: '', category_id: categories[0]?.id ?? '', type: 'veg', image_url: '' });
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (editItem) { setForm({ name: editItem.name, price: String(editItem.price), category_id: editItem.category_id, type: editItem.type, image_url: editItem.image_url ?? '' }); }
        else { setForm({ name: '', price: '', category_id: categories[0]?.id ?? '', type: 'veg', image_url: '' }); }
    }, [editItem, categories]);
    const handleSubmit = async () => {
        if (!form.name || !form.price || !form.category_id) return;
        setSaving(true);
        try { await onSave(form); onClose(); } finally { setSaving(false); }
    };
    if (!open) return null;
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-slate-200/60 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">{editItem ? 'Edit Item' : 'Add Menu Item'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Butter Chicken" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 280" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Type</label><div className="flex gap-3">{(['veg', 'non-veg'] as const).map(t => (<button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={cn('flex-1 h-10 rounded-xl text-sm font-medium border transition-all', form.type === t ? t === 'veg' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-rose-500 text-white border-rose-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>{t === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}</button>))}</div></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Image URL (Add photo link)</label><input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://images.unsplash.com/..." className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                </div>
                <div className="p-6 pt-0 flex gap-3">
                    <button onClick={onClose} className="flex-1 h-11 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={saving || !form.name || !form.price} className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {editItem ? 'Save Changes' : 'Add Item'}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function MenuManagementPage() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editItem, setEditItem] = useState<MenuItem | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setError(null);
            const [menuData, catData] = await Promise.all([fetchMenuItems(), fetchCategories()]);
            // Seed localStorage so customer menu can read availability on first visit
            seedAvailabilityMap(menuData.map(i => ({ id: i.id, available: i.available ?? true })));

            // Apply localStorage overrides so dashboard state doesn't revert if DB fails
            setItems(applyAvailabilityOverrides(menuData));
            setCategories(catData);
        } catch { setError('Could not load menu from Supabase. Check your .env credentials.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const filteredItems = items.filter(item => {
        const matchesCat = selectedCategory === 'all' || item.category_id === selectedCategory;
        return matchesCat && item.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleToggleAvailability = async (itemId: string, current: boolean) => {
        const next = !current;
        setActionLoading(itemId);
        // Optimistic local update
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, available: next } : i));
        // Persist to localStorage immediately (works even if Supabase is not set up)
        setItemAvailability(itemId, next);
        try { await toggleMenuItemAvailability(itemId, next); }
        catch { setItems(prev => prev.map(i => i.id === itemId ? { ...i, available: current } : i)); }
        setActionLoading(null);
    };

    const handleDelete = async (itemId: string) => {
        if (!confirm('Delete this menu item? This cannot be undone.')) return;
        setActionLoading(itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));
        try { await deleteMenuItem(itemId); } catch { loadData(); }
        setActionLoading(null);
    };

    const handleSaveItem = async (form: ItemFormData) => {
        const payload = { name: form.name, price: parseFloat(form.price), category_id: form.category_id, type: form.type, image_url: form.image_url || undefined };
        if (editItem) { await updateMenuItem(editItem.id, payload); } else { await createMenuItem(payload); }
        await loadData();
    };

    const handleSaveCategory = async (name: string) => {
        await createCategory(name, categories.length + 1);
        await loadData();
    };

    const categoryList = [
        { id: 'all', name: 'All Items', count: items.length, icon: '📋' },
        ...categories.map(c => ({ id: c.id, name: c.name, count: items.filter(i => i.category_id === c.id).length, icon: getCategoryIcon(c.name) })),
    ];

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="ml-3 text-slate-500">Loading menu from Supabase…</span>
        </div>
    );

    return (
        <div className="space-y-4 lg:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Menu Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your restaurant menu items and availability</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><RefreshCw className="w-4 h-4 text-slate-500" /></button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setEditItem(null); setShowModal(true); }} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow">
                        <Plus className="w-4 h-4" />Add Menu Item
                    </motion.button>
                </div>
            </div>

            {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></motion.div>}

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:w-64 flex-shrink-0">
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Categories</h3>
                        <div className="lg:space-y-1 flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
                            {categoryList.map(cat => (
                                <div key={cat.id} className="flex items-center group">
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setSelectedCategory(cat.id)} className={cn('flex-1 flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap lg:w-full', selectedCategory === cat.id ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border border-blue-200/60' : 'text-slate-600 hover:bg-slate-50')}>
                                        <span className="text-lg lg:text-base">{cat.icon}</span>
                                        <span className="flex-1 text-left hidden lg:inline">{cat.name}</span>
                                        <span className="lg:hidden">{cat.name.split(' ')[0]}</span>
                                        <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium hidden lg:inline', selectedCategory === cat.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600')}>{cat.count}</span>
                                    </motion.button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/60">
                            <motion.button onClick={() => setShowCategoryModal(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                                <Plus className="w-4 h-4" /> Add Category
                            </motion.button>
                        </div>
                    </div>
                </motion.div>

                <div className="flex-1 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="text" placeholder="Search menu items…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200/60 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all shadow-sm" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredItems.map((item, i) => {
                            const catName = item.categories?.name ?? categories.find(c => c.id === item.category_id)?.name ?? 'Unknown';
                            const isDeleting = actionLoading === item.id;
                            return (
                                <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -4 }} className={cn('bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all', item.available ? 'border-slate-200/60' : 'border-slate-200/60 opacity-60', isDeleting && 'opacity-40')}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden">
                                            {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" /> : <span className="text-2xl">{getCategoryIcon(catName)}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span title={item.type} className={cn('w-3 h-3 rounded-full border-2', item.type === 'veg' ? 'bg-emerald-500 border-emerald-600' : 'bg-rose-500 border-rose-600')} />
                                            <Switch checked={item.available ?? true} onCheckedChange={() => handleToggleAvailability(item.id, item.available ?? true)} disabled={isDeleting} />
                                        </div>
                                    </div>
                                    <h3 className="font-semibold text-slate-900 mb-1">{item.name}</h3>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">{catName}</span>
                                        <span className="text-lg font-semibold text-slate-900">₹{item.price}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setEditItem(item); setShowModal(true); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors"><Edit className="w-3.5 h-3.5" /> Edit</motion.button>
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleDelete(item.id)} disabled={isDeleting} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></motion.button>
                                    </div>
                                    {!(item.available ?? true) && <div className="mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg"><p className="text-xs text-amber-700 font-medium">Currently Unavailable</p></div>}
                                </motion.div>
                            );
                        })}
                    </div>
                    {filteredItems.length === 0 && <div className="bg-white rounded-2xl p-12 border border-slate-200/60 text-center"><p className="text-4xl mb-3">🍽️</p><p className="text-slate-500">No menu items found</p></div>}
                </div>
            </div>

            <AnimatePresence>
                {showModal && <ItemModal open={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} categories={categories} editItem={editItem} onSave={handleSaveItem} />}
                {showCategoryModal && <CategoryModal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSave={handleSaveCategory} />}
            </AnimatePresence>
        </div>
    );
}
