import { Metadata } from 'next';
import { CartProvider } from '@/context/CartContext';

export const metadata: Metadata = {
    title: 'MENU',
    description: 'Digital Restaurant Menu',
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
    return (
        <CartProvider>
            {children}
        </CartProvider>
    );
}
