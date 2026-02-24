'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Download, QrCode, Trash2, Minus, Check, FolderOpen, Save, X, ZoomIn, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { getTables, setTables as setSharedTables, type Table } from '@/data/sharedData';

const MENU_CUSTOMER_PATH = process.env.NEXT_PUBLIC_MENU_CUSTOMER_PATH ?? '/customer';

function getTableMenuUrl(baseUrl: string, tableId: string) {
    return `${baseUrl}${MENU_CUSTOMER_PATH}?table=${encodeURIComponent(tableId)}`;
}

interface Wall { id: string; x: number; y: number; width: number; height: number; orientation: 'horizontal' | 'vertical' }
interface Desk { id: string; x: number; y: number; width: number; height: number }
interface FloorPlan { id: string; name: string; tables: Table[]; walls: Wall[]; desks: Desk[] }

function QRPreviewModal({ table, onClose, baseUrl }: { table: Table; onClose: () => void; baseUrl: string }) {
    const url = getTableMenuUrl(baseUrl, table.id);
    const downloadQR = useCallback(() => {
        const canvas = document.getElementById(`qr-preview-${table.id}`) as HTMLCanvasElement;
        if (!canvas) return;
        const SIZE = 512, PADDING = 48, HEADER = 64, FOOTER = 72;
        const totalH = SIZE + PADDING * 2 + HEADER + FOOTER;
        const out = document.createElement('canvas');
        out.width = SIZE + PADDING * 2; out.height = totalH;
        const ctx = out.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.roundRect(0, 0, out.width, out.height, 24); ctx.fill();
        const grad = ctx.createLinearGradient(0, 0, out.width, 0);
        grad.addColorStop(0, '#2563eb'); grad.addColorStop(1, '#4f46e5');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(0, 0, out.width, HEADER, [24, 24, 0, 0]); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Table ${table.id}`, out.width / 2, HEADER / 2 + 10);
        ctx.drawImage(canvas, PADDING, HEADER + PADDING, SIZE, SIZE);
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, HEADER + PADDING + SIZE + PADDING, out.width, FOOTER);
        ctx.fillStyle = '#64748b'; ctx.font = '15px system-ui, sans-serif';
        ctx.fillText('Scan to order • Pay at counter', out.width / 2, HEADER + PADDING + SIZE + PADDING + FOOTER / 2 - 4);
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(url.slice(0, 55) + (url.length > 55 ? '…' : ''), out.width / 2, HEADER + PADDING + SIZE + PADDING + FOOTER / 2 + 16);
        const link = document.createElement('a'); link.download = `qr-${table.id}.png`; link.href = out.toDataURL('image/png'); link.click();
    }, [table, url]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                    <div><h3 className="text-white font-bold text-lg">Table {table.id}</h3><p className="text-blue-200 text-xs mt-0.5">{table.seats} seats</p></div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5 text-white" /></button>
                </div>
                <div className="p-8 flex flex-col items-center">
                    <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-100">
                        <QRCodeCanvas id={`qr-preview-${table.id}`} value={url} size={240} level="H" includeMargin={false} bgColor="#ffffff" fgColor="#1e293b" />
                    </div>
                    <p className="mt-4 text-xs text-slate-400 text-center break-all px-2">{url}</p>
                    <div className="flex gap-3 mt-6 w-full">
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigator.clipboard?.writeText(url)} className="flex-1 flex items-center justify-center gap-2 h-11 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                            <Share2 className="w-4 h-4" />Copy URL
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={downloadQR} className="flex-1 flex items-center justify-center gap-2 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25">
                            <Download className="w-4 h-4" />Download PNG
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

function QRCard({ table, onPreview, baseUrl }: { table: Table; onPreview: (t: Table) => void; baseUrl: string }) {
    const url = getTableMenuUrl(baseUrl, table.id);
    const canvasId = `qr-grid-${table.id}`;
    const downloadQR = (e: React.MouseEvent) => {
        e.stopPropagation();
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return;
        const SIZE = 400, PAD = 32, HDR = 52, FTR = 56, W = SIZE + PAD * 2, H = SIZE + PAD * 2 + HDR + FTR;
        const out = document.createElement('canvas'); out.width = W; out.height = H;
        const ctx = out.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 20); ctx.fill();
        const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2563eb'); g.addColorStop(1, '#4f46e5');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, W, HDR, [20, 20, 0, 0]); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Table ${table.id}`, W / 2, HDR / 2 + 8);
        ctx.drawImage(canvas, PAD, HDR + PAD, SIZE, SIZE);
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, HDR + PAD + SIZE + PAD, W, FTR);
        ctx.fillStyle = '#64748b'; ctx.font = '13px system-ui'; ctx.fillText('Scan to order', W / 2, HDR + PAD + SIZE + PAD + FTR / 2 + 5);
        const a = document.createElement('a'); a.download = `qr-${table.id}.png`; a.href = out.toDataURL('image/png'); a.click();
    };
    return (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -6 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl transition-all overflow-hidden group cursor-pointer" onClick={() => onPreview(table)}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                <span className="text-white font-bold text-sm">Table {table.id}</span>
                <span className="text-blue-200 text-xs">{table.seats} seats</span>
            </div>
            <div className="p-5 flex flex-col items-center">
                <div className="p-3 bg-white rounded-xl shadow-inner border border-slate-100 group-hover:shadow-lg transition-all">
                    <QRCodeCanvas id={canvasId} value={url || 'https://placeholder.com'} size={160} level="H" includeMargin={false} bgColor="#ffffff" fgColor="#1e293b" />
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                    <span className={cn('w-2 h-2 rounded-full', table.status === 'available' ? 'bg-emerald-500' : table.status === 'busy' ? 'bg-rose-500' : 'bg-amber-500')} />
                    <span className="text-xs text-slate-500 capitalize">{table.status}</span>
                </div>
            </div>
            <div className="px-4 pb-4 flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={e => { e.stopPropagation(); onPreview(table); }} className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-medium transition-colors">
                    <ZoomIn className="w-3.5 h-3.5" />Preview
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={downloadQR} className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-medium shadow-md shadow-blue-500/25 transition-all">
                    <Download className="w-3.5 h-3.5" />Download
                </motion.button>
            </div>
        </motion.div>
    );
}

const statusConfig = {
    available: { color: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-700' },
    busy: { color: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-700' },
    reserved: { color: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700' },
};

function DraggableTable({ table, onUpdate }: { table: Table; onUpdate: (id: string, x: number, y: number) => void }) {
    const cfg = statusConfig[table.status];
    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => onUpdate(table.id, Math.max(0, table.x + info.offset.x), Math.max(0, table.y + info.offset.y))}
            onPanEnd={(_, info) => {
                // Failsafe for if simple drag offset math breaks on zoomed Windows monitors
                const newX = Math.max(0, table.x + info.offset.x);
                const newY = Math.max(0, table.y + info.offset.y);
                onUpdate(table.id, newX, newY);
            }}
            animate={{ x: table.x, y: table.y }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileDrag={{ scale: 1.1, zIndex: 50, opacity: 0.8 }}
            style={{ position: 'absolute', left: 0, top: 0, cursor: 'grab' }}
            className={cn('w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center shadow-lg transition-colors', cfg.color, cfg.border, cfg.text)}
        >
            <span className="text-xs font-bold pointer-events-none">{table.id}</span>
            <span className="text-[10px] opacity-70 pointer-events-none">{table.seats}🪑</span>
        </motion.div>
    );
}

function DraggableWall({ wall, onDelete, onUpdate }: { wall: Wall; onDelete: (id: string) => void; onUpdate: (id: string, x: number, y: number) => void }) {
    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => onUpdate(wall.id, Math.max(0, wall.x + info.offset.x), Math.max(0, wall.y + info.offset.y))}
            onPanEnd={(_, info) => onUpdate(wall.id, Math.max(0, wall.x + info.offset.x), Math.max(0, wall.y + info.offset.y))}
            animate={{ x: wall.x, y: wall.y }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
            whileDrag={{ zIndex: 50, opacity: 0.8 }}
            style={{ position: 'absolute', left: 0, top: 0, width: wall.width, height: wall.height, cursor: 'grab' }}
            className="bg-slate-700 hover:bg-slate-600 transition-colors group"
            onClick={e => { if (e.shiftKey) onDelete(wall.id); }}
        >
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Trash2 className="w-3 h-3 text-white" />
            </div>
        </motion.div>
    );
}

function DraggableDesk({ desk, onDelete, onUpdate }: { desk: Desk; onDelete: (id: string) => void; onUpdate: (id: string, x: number, y: number) => void }) {
    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => onUpdate(desk.id, Math.max(0, desk.x + info.offset.x), Math.max(0, desk.y + info.offset.y))}
            onPanEnd={(_, info) => onUpdate(desk.id, Math.max(0, desk.x + info.offset.x), Math.max(0, desk.y + info.offset.y))}
            animate={{ x: desk.x, y: desk.y }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
            whileDrag={{ zIndex: 50, opacity: 0.8 }}
            style={{ position: 'absolute', left: 0, top: 0, width: desk.width, height: desk.height, cursor: 'grab' }}
            className="bg-blue-100 border-2 border-blue-400 rounded-lg flex items-center justify-center group transition-colors"
            onClick={e => { if (e.shiftKey) onDelete(desk.id); }}
        >
            <span className="text-xs text-blue-700 font-medium pointer-events-none">DESK</span>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Trash2 className="w-3 h-3 text-blue-600" />
            </div>
        </motion.div>
    );
}

function FloorPlanEditor({ tables, setTables, walls, setWalls, desks, setDesks }: {
    tables: Table[]; setTables: React.Dispatch<React.SetStateAction<Table[]>>;
    walls: Wall[]; setWalls: React.Dispatch<React.SetStateAction<Wall[]>>;
    desks: Desk[]; setDesks: React.Dispatch<React.SetStateAction<Desk[]>>;
}) {
    const updateTable = (id: string, x: number, y: number) => setTables(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
    const updateWall = (id: string, x: number, y: number) => setWalls(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
    const updateDesk = (id: string, x: number, y: number) => setDesks(prev => prev.map(d => d.id === id ? { ...d, x, y } : d));

    return (
        <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl overflow-hidden" style={{ height: 600, backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {walls.map(w => <DraggableWall key={w.id} wall={w} onUpdate={updateWall} onDelete={id => setWalls(prev => prev.filter(x => x.id !== id))} />)}
            {desks.map(d => <DraggableDesk key={d.id} desk={d} onUpdate={updateDesk} onDelete={id => setDesks(prev => prev.filter(x => x.id !== id))} />)}
            {tables.map(t => <DraggableTable key={t.id} table={t} onUpdate={updateTable} />)}
        </div>
    );
}

export default function TablesQRCodesPage() {
    const [tables, setTables] = useState<Table[]>([]);
    const [walls, setWalls] = useState<Wall[]>([]);
    const [desks, setDesks] = useState<Desk[]>([]);
    const [viewMode, setViewMode] = useState<'floor' | 'qr'>('qr');
    const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [showSaveMsg, setShowSaveMsg] = useState(false);
    const [previewTable, setPreviewTable] = useState<Table | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    // baseUrl is computed client-side only to avoid SSR/hydration mismatch
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        setBaseUrl(process.env.NEXT_PUBLIC_MENU_BASE_URL ?? window.location.origin);

        let initialTablesData: Table[] | null = null;
        let initialFloorPlans: FloorPlan[] = [];

        try {
            const savedTables = localStorage.getItem('hotelmenu_floorplan_tables');
            if (savedTables) initialTablesData = JSON.parse(savedTables);

            const savedWalls = localStorage.getItem('hotelmenu_walls');
            if (savedWalls) setWalls(JSON.parse(savedWalls));

            const savedDesks = localStorage.getItem('hotelmenu_desks');
            if (savedDesks) setDesks(JSON.parse(savedDesks));

            const savedPlans = localStorage.getItem('hotelmenu_floorPlans');
            if (savedPlans) initialFloorPlans = JSON.parse(savedPlans);
        } catch (error) {
            console.error("Failed to load from localStorage:", error);
            // Fallback to default if parsing fails
        }

        const resolvedTables = initialTablesData || getTables();
        setTables(resolvedTables);

        // Ensure there's at least one floor plan if none were loaded or parsing failed
        if (initialFloorPlans.length === 0) {
            setFloorPlans([{ id: '1', name: 'Default Layout', tables: resolvedTables, walls: [], desks: [] }]);
        } else {
            setFloorPlans(initialFloorPlans);
        }
        setIsLoaded(true);
    }, []);

    // Autosave whenever the floor plan components change, but ONLY after initial load
    useEffect(() => {
        if (!isLoaded) return;
        setSharedTables(tables);
        // Explicitly write tables to localStorage ourselves to absolutely guarantee it saves
        localStorage.setItem('hotelmenu_floorplan_tables', JSON.stringify(tables));
        localStorage.setItem('hotelmenu_walls', JSON.stringify(walls));
        localStorage.setItem('hotelmenu_desks', JSON.stringify(desks));
        localStorage.setItem('hotelmenu_floorPlans', JSON.stringify(floorPlans));
    }, [tables, walls, desks, floorPlans, isLoaded]);

    const addTable = () => { const newT: Table = { id: `T-${String(tables.length + 1).padStart(2, '0')}`, name: `Table ${tables.length + 1}`, seats: 4, x: 100, y: 100, status: 'available' }; setTables([...tables, newT]); setHasChanges(true); };
    const removeTable = () => {
        if (tables.length > 0) {
            const newTables = tables.slice(0, -1);
            setTables(newTables);
            setHasChanges(true);
            // Force immediate save for delete specifically
            localStorage.setItem('hotelmenu_floorplan_tables', JSON.stringify(newTables));
            setSharedTables(newTables);
        }
    };
    const addWall = () => { setWalls([...walls, { id: `W-${walls.length + 1}`, x: 50, y: 50, width: 200, height: 8, orientation: 'horizontal' }]); setHasChanges(true); };
    const addDesk = () => { setDesks([...desks, { id: `D-${desks.length + 1}`, x: 150, y: 150, width: 80, height: 120 }]); setHasChanges(true); };
    const saveLayout = () => { setFloorPlans(prev => [...prev, { id: `plan-${Date.now()}`, name: `Layout ${prev.length + 1}`, tables, walls, desks }]); setHasChanges(false); setShowSaveMsg(true); setTimeout(() => setShowSaveMsg(false), 2000); };
    const loadFloorPlan = (plan: FloorPlan) => { setTables(plan.tables); setWalls(plan.walls); setDesks(plan.desks); setHasChanges(false); };

    const downloadAllQRs = async () => {
        for (let i = 0; i < tables.length; i++) {
            const t = tables[i];
            const canvas = document.getElementById(`qr-grid-${t.id}`) as HTMLCanvasElement;
            if (!canvas) continue;
            const SIZE = 400, PAD = 32, HDR = 52, FTR = 56, W = SIZE + PAD * 2, H = SIZE + PAD * 2 + HDR + FTR;
            const out = document.createElement('canvas'); out.width = W; out.height = H;
            const ctx = out.getContext('2d')!;
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 20); ctx.fill();
            const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2563eb'); g.addColorStop(1, '#4f46e5');
            ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, W, HDR, [20, 20, 0, 0]); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`Table ${t.id}`, W / 2, HDR / 2 + 8);
            ctx.drawImage(canvas, PAD, HDR + PAD, SIZE, SIZE);
            ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, HDR + PAD + SIZE + PAD, W, FTR);
            ctx.fillStyle = '#64748b'; ctx.font = '13px system-ui'; ctx.fillText('Scan to order', W / 2, HDR + PAD + SIZE + PAD + FTR / 2 + 5);
            const a = document.createElement('a'); a.download = `qr-${t.id}.png`; a.href = out.toDataURL('image/png'); a.click();
            if (i < tables.length - 1) await new Promise(r => setTimeout(r, 200));
        }
    };

    const filteredTables = tables.filter(t => t.id.toLowerCase().includes(searchQuery.toLowerCase()) || t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="relative">
            <div className="space-y-4 lg:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                            Tables & QR Codes
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Engine v2</span>
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Generate and download QR codes for every table</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-200/60 w-full sm:w-auto">
                        {[{ key: 'qr', label: 'QR Codes', icon: <QrCode className="w-4 h-4" /> }, { key: 'floor', label: 'Floor Plan', icon: <span className="text-sm">📐</span> }].map(({ key, label, icon }) => (
                            <button key={key} onClick={() => setViewMode(key as 'qr' | 'floor')} className={cn('flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 sm:flex-initial', viewMode === key ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-600 hover:bg-slate-50')}>{icon}<span className="hidden sm:inline">{label}</span></button>
                        ))}
                    </div>
                </div>

                {viewMode === 'qr' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="relative flex-1">
                                <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Search tables…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500 flex-shrink-0">
                                <span><strong className="text-slate-900">{tables.length}</strong> tables</span>
                                <span className="text-slate-300">|</span>
                                <span><strong className="text-emerald-600">{tables.filter(t => t.status === 'available').length}</strong> free · <strong className="text-rose-600">{tables.filter(t => t.status === 'busy').length}</strong> busy</span>
                            </div>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={downloadAllQRs} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow whitespace-nowrap">
                                <Download className="w-4 h-4" />Download All
                            </motion.button>
                        </div>
                        {filteredTables.length === 0 ? (
                            <div className="bg-white rounded-2xl p-16 border border-slate-200/60 text-center"><QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No tables found</p></div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {filteredTables.map((table, i) => (
                                    <motion.div key={table.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                                        <QRCard table={table} onPreview={setPreviewTable} baseUrl={baseUrl} />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                            <QrCode className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div><span className="font-medium">QR codes link to: </span><code className="text-xs bg-blue-100 px-1.5 py-0.5 rounded font-mono">{baseUrl}{MENU_CUSTOMER_PATH}?table=T-XX</code><span className="ml-2 text-blue-500 text-xs">Set <code className="font-mono">NEXT_PUBLIC_MENU_BASE_URL</code> in .env.local for production</span></div>
                        </div>
                    </motion.div>
                )}

                {viewMode === 'floor' && (
                    <>
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-slate-500 font-medium">Tables:</span>
                                        <div className="flex items-center gap-2">
                                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={removeTable} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><Minus className="w-4 h-4 text-slate-600" /></motion.button>
                                            <span className="text-2xl font-semibold text-slate-900 w-12 text-center">{tables.length}</span>
                                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={addTable} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"><Plus className="w-4 h-4 text-slate-600" /></motion.button>
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 hidden lg:block" />
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addWall} className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-sm font-medium transition-colors border border-orange-200"><div className="w-4 h-4 bg-orange-500 rounded-sm" />Add Wall</motion.button>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addDesk} className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors border border-blue-200"><div className="w-4 h-4 bg-blue-500 rounded-sm" />Add Desk</motion.button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <AnimatePresence mode="wait">
                                        {showSaveMsg ? (
                                            <motion.div key="saved" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium"><Check className="w-4 h-4" />Saved!</motion.div>
                                        ) : hasChanges ? (
                                            <div className="flex items-center gap-2 px-3 py-2 text-amber-700 text-sm"><div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />Unsaved changes</div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium"><Check className="w-4 h-4" />All saved</div>
                                        )}
                                    </AnimatePresence>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={saveLayout} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-500/25 transition-all"><Save className="w-4 h-4" />Save Layout</motion.button>
                                    <div className="relative group">
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-medium transition-colors border border-amber-200"><FolderOpen className="w-4 h-4" />Load ({floorPlans.length})</motion.button>
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200/60 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                            <div className="p-2 space-y-1">{floorPlans.map(plan => <button key={plan.id} onClick={() => loadFloorPlan(plan)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors">{plan.name}</button>)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-4 lg:p-6 border border-slate-200/60 shadow-sm">
                            <FloorPlanEditor
                                tables={tables} setTables={updater => { setTables(updater); setHasChanges(true); }}
                                walls={walls} setWalls={updater => { setWalls(updater); setHasChanges(true); }}
                                desks={desks} setDesks={updater => { setDesks(updater); setHasChanges(true); }}
                            />
                            <p className="mt-4 text-sm text-slate-400">💡 <span className="font-medium">Drag</span> to move • <span className="font-medium">Shift + Click</span> to delete walls/desks</p>
                        </motion.div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {previewTable && <QRPreviewModal table={previewTable} onClose={() => setPreviewTable(null)} baseUrl={baseUrl} />}
            </AnimatePresence>
        </div>
    );
}
