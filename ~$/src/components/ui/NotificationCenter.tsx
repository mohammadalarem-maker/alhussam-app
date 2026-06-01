import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  X, 
  ChevronRight,
  Package,
  ExternalLink
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  code: string;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for all items and filter client-side for low stock
    // Alternatively, use query if minStock is a fixed value, but since it's per item:
    const unsub = onSnapshot(collection(db, 'items'), (snap) => {
      const allItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const filtered = allItems.filter(item => (item.stock || 0) <= (item.minStock || 0));
      setLowStockItems(filtered);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasNotifications = lowStockItems.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
          isOpen ? 'bg-secondary text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}
      >
        <Bell className={`w-5 h-5 ${hasNotifications && !isOpen ? 'animate-pulse' : ''}`} />
        {hasNotifications && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-sm">
            {lowStockItems.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[60] overflow-hidden"
          >
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-primary flex items-center gap-2">
                 <Bell className="w-4 h-4 text-secondary" />
                 التنبيهات النظامية
              </h3>
              <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
                {lowStockItems.length} تنبيه
              </span>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {lowStockItems.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                     <Package className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-400">لا توجد تنبيهات حالياً. المخزون سليم!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {lowStockItems.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => { navigate('/inventory'); setIsOpen(false); }}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-3 text-right">
                        <div className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                           <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-black text-gray-800 line-clamp-1">{item.name}</p>
                          <p className="text-[10px] text-red-600 font-bold">
                            المخزون حرج: {item.stock} فقط (الحد: {item.minStock})
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[9px] text-gray-400 font-mono">CODE: {item.code}</span>
                            <span className="text-[9px] text-secondary font-bold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                               الإجراء <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lowStockItems.length > 0 && (
              <button 
                onClick={() => { navigate('/inventory'); setIsOpen(false); }}
                className="w-full p-3 bg-primary text-white text-xs font-black hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
              >
                إدارة كافة الأصناف المنخفضة
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
