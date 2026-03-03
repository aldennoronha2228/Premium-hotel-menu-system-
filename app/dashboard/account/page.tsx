'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    User, Mail, Shield, Lock, ShieldAlert, Loader2,
    Trash2, Plus, UserPlus, ShieldCheck, Key
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface AdminUser {
    email: string;
    is_active: boolean;
    created_at: string;
}

export default function AccountPage() {
    const { user } = useAuth();

    // ─── Protected Management State ───────────────────────────────────────────
    /**
     * "State Management" is how we keep track of what is happening in the app.
     * Here, 'isUnlocked' tells the app IF the admin management list should be shown.
     */
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [gatePassword, setGatePassword] = useState('');
    const [gateLoading, setGateLoading] = useState(false);
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [addingAdmin, setAddingAdmin] = useState(false);
    const [showGate, setShowGate] = useState(false);

    // ─── Fetch Admins (Privileged) ───────────────────────────────────────────
    const fetchAdmins = async (key: string) => {
        console.log('[AccountPage] fetchAdmins start. Key length:', key.length);
        setLoadingAdmins(true);
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'GET',
                headers: { 'x-admin-key': key }
            });

            console.log('[AccountPage] fetch status:', res.status, res.ok);

            const text = await res.text();
            let data: any;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error('[AccountPage] JSON parse failed. Body:', text.slice(0, 100));
                throw new Error('Server returned invalid response. Check console.');
            }

            if (!res.ok) {
                console.warn('[AccountPage] fetch error:', data.error);
                throw new Error(data.error || 'Failed to fetch admins');
            }

            console.log('[AccountPage] fetch success. Admin count:', data.length);
            setAdmins(data);
            setIsUnlocked(true);
            setShowGate(false);
            toast.success('Admin management unlocked');
        } catch (err: any) {
            console.error('[AccountPage] fetchAdmins catch:', err);
            toast.error(err.message);
            setIsUnlocked(false);
        } finally {
            setLoadingAdmins(false);
        }
    };

    const handleGateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setGateLoading(true);
        await fetchAdmins(gatePassword);
        setGateLoading(false);
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingAdmin(true);
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': gatePassword
                },
                body: JSON.stringify({ email: newAdminEmail, action: 'add' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(data.message);
            setNewAdminEmail('');
            fetchAdmins(gatePassword);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setAddingAdmin(false);
        }
    };

    const handleRemoveAdmin = async (email: string) => {
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': gatePassword
                },
                body: JSON.stringify({ email, action: 'remove' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(data.message);
            fetchAdmins(gatePassword);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Settings</h1>
                <p className="text-slate-500 text-sm mt-1">Manage your profile and dashboard permissions.</p>
            </header>

            {/* Profile Overview Card */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden p-6 lg:p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-blue-500/20">
                        {user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-xl font-bold text-slate-900">{user?.user_metadata?.full_name || 'Admin User'}</h2>
                        <div className="flex items-center justify-center md:justify-start gap-2 mt-1.5 text-slate-500 text-sm">
                            <Mail className="w-4 h-4" />
                            {user?.email}
                        </div>
                        <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Active Admin
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Management Protection Gate */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                            <Key className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 leading-tight">Admin Management</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Control who can access the dashboard</p>
                        </div>
                    </div>
                    {!isUnlocked ? (
                        <button
                            onClick={() => setShowGate(true)}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-4"
                        >
                            Open Management
                        </button>
                    ) : (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] uppercase font-bold tracking-wider">
                            Unlocked
                        </span>
                    )}
                </div>

                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {!isUnlocked ? (
                            showGate ? (
                                <motion.div
                                    key="gate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="max-w-md mx-auto py-8 text-center"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-amber-50 mx-auto flex items-center justify-center mb-4">
                                        <Lock className="w-8 h-8 text-amber-500" />
                                    </div>
                                    <h4 className="font-bold text-slate-900">Privileged Access Required</h4>
                                    <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                                        Managing administrators requires a master access key.<br />Please enter it to reveal the controls.
                                    </p>
                                    <form onSubmit={handleGateSubmit} className="space-y-3">
                                        <input
                                            type="password"
                                            value={gatePassword}
                                            onChange={e => setGatePassword(e.target.value)}
                                            placeholder="Enter Admin Access Key"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30 transition-all font-mono"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={gateLoading}
                                            className="w-full h-11 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {gateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock Controls'}
                                        </button>
                                        <button onClick={() => setShowGate(false)} type="button" className="text-xs text-slate-500 hover:text-slate-900">Cancel</button>
                                    </form>
                                </motion.div>
                            ) : (
                                <div key="inactive" className="py-12 text-center opacity-40">
                                    <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                    <p className="text-sm font-medium text-slate-500 italic">Management controls are currently locked.</p>
                                </div>
                            )
                        ) : (
                            <motion.div
                                key="controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="space-y-6"
                            >
                                {/* Add Admin Form */}
                                <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-1">
                                            <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="email"
                                                value={newAdminEmail}
                                                onChange={e => setNewAdminEmail(e.target.value)}
                                                placeholder="Enter new admin email (e.g., manager@hotel.com)"
                                                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30"
                                            />
                                        </div>
                                        <button
                                            onClick={handleAddAdmin}
                                            disabled={addingAdmin || !newAdminEmail}
                                            className="h-11 px-6 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            Add Admin
                                        </button>
                                    </div>
                                </div>

                                {/* Admins Table */}
                                <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Admin Email</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {admins.map((admin) => (
                                                <tr key={admin.email} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="px-4 py-4 font-medium text-slate-900">{admin.email}</td>
                                                    <td className="px-4 py-4">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                            admin.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500 italic"
                                                        )}>
                                                            {admin.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            onClick={() => handleRemoveAdmin(admin.email)}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors group"
                                                            title="Deactivate Admin"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
