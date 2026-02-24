'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Ban } from 'lucide-react';
import type { MenuItem } from '@/context/CartContext';

interface MenuItemCardProps {
    item: MenuItem;
    available?: boolean;          // defaults to true
    onAddToCart?: (item: MenuItem) => void;   // undefined = unavailable
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
    item,
    available = true,
    onAddToCart,
}) => {
    const isAvailable = available && !!onAddToCart;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: isAvailable ? 1 : 0.72, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: isAvailable ? -8 : 0 }}
            transition={{ duration: 0.3 }}
            className={`bg-white rounded-3xl overflow-hidden shadow-md border transition-all ${isAvailable
                    ? 'border-gray-100 hover:shadow-xl cursor-default'
                    : 'border-red-100 grayscale-[30%]'
                }`}
        >
            {/* Image */}
            <div className="relative h-48 overflow-hidden">
                <img
                    src={item.image}
                    alt={item.name}
                    className={`w-full h-full object-cover transition-all duration-500 ${isAvailable ? 'group-hover:scale-110' : 'blur-[1px] brightness-75'
                        }`}
                />

                {/* Price badge */}
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                    <span className="text-[#1B4332] font-bold text-sm">${item.price.toFixed(2)}</span>
                </div>

                {/* Out of Stock overlay */}
                {!isAvailable && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="bg-red-600/90 backdrop-blur-sm text-white px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                            <Ban className="w-4 h-4" />
                            <span className="font-bold text-sm tracking-wide">Out of Stock</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                <div className="flex items-start justify-between mb-1">
                    <h3 className={`font-bold text-lg leading-tight ${isAvailable ? 'text-[#1B4332]' : 'text-gray-400'}`}>
                        {item.name}
                    </h3>
                </div>
                <p className={`text-sm leading-relaxed mb-4 line-clamp-2 ${isAvailable ? 'text-gray-600' : 'text-gray-400'}`}>
                    {item.description}
                </p>
                <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${isAvailable
                            ? 'text-[#1B4332] bg-[#1B4332]/10 border-[#1B4332]/20'
                            : 'text-gray-400 bg-gray-100 border-gray-200'
                        }`}>
                        {item.category}
                    </span>

                    {isAvailable ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onAddToCart!(item)}
                            className="flex items-center gap-2 bg-gradient-to-r from-[#1B4332] to-[#2D5F4C] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                        >
                            <ShoppingCart className="w-4 h-4" />
                            Add to Cart
                        </motion.button>
                    ) : (
                        <span className="flex items-center gap-1.5 text-red-400 text-xs font-semibold px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                            <Ban className="w-3.5 h-3.5" />
                            Unavailable
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
