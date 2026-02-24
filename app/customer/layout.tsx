'use client';

import { CartProvider } from '@/context/CartContext';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
    return (
        <CartProvider>
            {children}
        </CartProvider>
    );
}
