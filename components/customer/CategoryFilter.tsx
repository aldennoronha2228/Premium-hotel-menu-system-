'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface CategoryFilterProps { categories: string[]; activeCategory: string; onSelectCategory: (category: string) => void; }

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ categories, activeCategory, onSelectCategory }) => {
    return (
        <div className="flex gap-3 overflow-x-auto pb-2 px-4 md:px-8" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((category) => {
                const isActive = activeCategory === category;
                return (
                    <motion.button key={category} onClick={() => onSelectCategory(category)} className={`relative px-6 py-3 rounded-2xl font-medium whitespace-nowrap transition-all ${isActive ? 'text-white' : 'text-[#1B4332] bg-white/60 hover:bg-white/80'}`} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} style={{ backgroundColor: isActive ? '#1B4332' : undefined, boxShadow: isActive ? '0 8px 16px rgba(27, 67, 50, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
                        <span className="relative z-10">{category}</span>
                        {isActive && <motion.div layoutId="activeCategory" className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D5F4C 100%)' }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                    </motion.button>
                );
            })}
        </div>
    );
};
