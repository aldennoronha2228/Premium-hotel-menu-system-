'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Plus, Minus } from 'lucide-react';

interface QuantitySelectorProps { quantity: number; onIncrease: () => void; onDecrease: () => void; }

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({ quantity, onIncrease, onDecrease }) => {
    return (
        <div className="flex items-center gap-3 bg-[#FAF8F5] rounded-2xl p-1">
            <motion.button onClick={onDecrease} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#1B4332] hover:bg-[#1B4332] hover:text-white transition-colors shadow-sm" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Minus className="w-4 h-4" /></motion.button>
            <motion.span key={quantity} initial={{ scale: 1.2, color: '#D4AF37' }} animate={{ scale: 1, color: '#1B4332' }} className="min-w-[2rem] text-center font-bold text-lg">{quantity}</motion.span>
            <motion.button onClick={onIncrease} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#1B4332] hover:bg-[#1B4332] hover:text-white transition-colors shadow-sm" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Plus className="w-4 h-4" /></motion.button>
        </div>
    );
};
