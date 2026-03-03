'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
    ShoppingBag, History, UtensilsCrossed, QrCode,
    ChevronLeft, Bell, Search, Menu, X, LogOut, UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { GlobalSearch } from '@/components/dashboard/GlobalSearch';
import { NotificationBell } from '@/components/dashboard/NotificationBell';

const navigation = [
    { name: 'Live Orders', href: '/dashboard/orders', icon: ShoppingBag, shortName: 'Orders' },
    { name: 'Order History', href: '/dashboard/history', icon: History, shortName: 'History' },
    { name: 'Menu Management', href: '/dashboard/menu', icon: UtensilsCrossed, shortName: 'Menu' },
    { name: 'Tables & QR', href: '/dashboard/tables', icon: QrCode, shortName: 'Tables' },
    { name: 'Account Settings', href: '/dashboard/account', icon: UserCircle, shortName: 'Account' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { user, session, loading, signOut } = useAuth();

    useEffect(() => {
        if (!loading && (!session || !user)) {
            router.replace('/login');
        }
    }, [loading, session, user, router]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    if (loading || !session || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Verifying session...</p>
                </div>
            </div>
        );
    }

    const userInitial = user?.user_metadata?.full_name?.[0]
        ?? user?.email?.[0]?.toUpperCase()
        ?? 'A';

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: collapsed ? 80 : 240 }}
                className="hidden lg:block fixed left-0 top-0 h-full bg-white border-r border-slate-200/60 z-30"
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-slate-200/60">
                        <motion.div initial={false} animate={{ opacity: collapsed ? 0 : 1 }} className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">H</span>
                            </div>
                            {!collapsed && <span className="font-semibold text-slate-900">HotelPro</span>}
                        </motion.div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || (pathname === '/dashboard' && item.href === '/dashboard/orders');
                            return (
                                <Link key={item.name} href={item.href}>
                                    <motion.div
                                        whileHover={{ x: 4 }}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                            isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        <item.icon className="w-5 h-5 flex-shrink-0" />
                                        {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
                                    </motion.div>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Collapse Button */}
                    <div className="p-3 border-t border-slate-200/60">
                        <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setCollapsed(!collapsed)}
                            className="w-full h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                <ChevronLeft className="w-5 h-5 text-slate-600" />
                            </motion.div>
                        </motion.button>
                    </div>
                </div>
            </motion.aside>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <motion.div
                            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl"
                        >
                            <div className="flex flex-col h-full">
                                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200/60">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">H</span>
                                        </div>
                                        <span className="font-semibold text-slate-900">HotelPro</span>
                                    </div>
                                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                        <X className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>
                                <nav className="flex-1 px-3 py-4 space-y-1">
                                    {navigation.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                                                <div className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                                    isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                )}>
                                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                                    <span className="text-sm font-medium">{item.name}</span>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="lg:pl-60">
                <motion.div initial={false} animate={{ paddingLeft: collapsed ? 80 : 240 }} className="hidden lg:block" />

                {/* Top Navbar */}
                <header className="h-16 sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
                    <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <Menu className="w-5 h-5 text-slate-600" />
                        </button>
                        <div className="hidden md:block flex-1 max-w-md">
                            <GlobalSearch />
                        </div>
                        <div className="flex items-center gap-2 lg:gap-3">
                            <NotificationBell />
                            <div className="relative">
                                <motion.button
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowUserMenu(p => !p)}
                                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm"
                                >
                                    {user?.user_metadata?.avatar_url ? (
                                        <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full rounded-xl object-cover" />
                                    ) : userInitial}
                                </motion.button>
                                <AnimatePresence>
                                    {showUserMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                            className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/60 z-50 overflow-hidden"
                                        >
                                            <div className="px-4 py-3 border-b border-slate-100">
                                                <p className="text-xs font-semibold text-slate-900 truncate">{user?.user_metadata?.full_name ?? 'Admin'}</p>
                                                <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                                            </div>
                                            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                                                <LogOut className="w-4 h-4" />
                                                Sign Out
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 lg:p-6 pb-24 lg:pb-6">
                    {children}
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-xl border-t border-slate-200/60 z-30">
                <div className="h-full px-2 flex items-center justify-around">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.name} href={item.href} className="flex-1">
                                <motion.div
                                    whileTap={{ scale: 0.95 }}
                                    className={cn("flex flex-col items-center justify-center gap-1 py-2 transition-all", isActive ? "text-blue-600" : "text-slate-600")}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="text-[10px] font-medium">{item.shortName}</span>
                                </motion.div>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
