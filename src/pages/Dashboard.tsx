import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Invoice { id: string; total: number; number: string; date: string; status: string; }
interface Item { id: string; name: string; code: string; stock: number; minStock: number; unit: string; }
interface Expense { id: string; amount: number; }

export default function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc')), (snap) => {
      setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
    });
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Item[]);
    });
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[]);
    });
    const unsubSettings = onSnapshot(collection(db, 'settings'), (snap) => {
      const doc = snap.docs.find(d => d.id === 'shop');
      if (doc) setShopSettings(doc.data());
      setIsLoading(false);
    });
    return () => { unsubInvoices(); unsubItems(); unsubExpenses(); unsubSettings(); };
  }, []);

  const totalSales = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
  const grossProfit = totalSales * 0.15;
  const netProfit = grossProfit - totalExpenses;
  const lowStock = items.filter(i => (i.stock || 0) <= (i.minStock || 5));

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-gray-400">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-right" dir="rtl">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">مرحباً بك في {shopSettings?.shopName || 'الحسام فون'}</h1>
          <p className="text-xs text-gray-500 mt-1">نظرة عامة على أداء المؤسسة اليوم</p>
        </div>
        <button onClick={() => navigate('/pos')} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700">
          فاتورة جديدة +
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 p-4 rounded-xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-xs font-bold text-red-700">تنبيه حرج: يوجد {lowStock.length} أصناف منخفضة المخزون!</p>
          </div>
          <button onClick={() => navigate('/inventory')} className="bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded-lg">عرض الأصناف</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-950 text-green-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] text-gray-400">صافي الأرباح</p>
              <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white mt-1">{netProfit.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] text-gray-400">إجمالي المبيعات</p>
              <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white mt-1">{totalSales.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-950 text-red-600 rounded-lg"><TrendingDown className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] text-gray-400">إجمالي المصروفات</p>
              <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white mt-1">{totalExpenses.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-950 text-yellow-600 rounded-lg"><ArrowUpRight className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] text-gray-400">هامش الربح الكلي</p>
              <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white mt-1">{grossProfit.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-700 dark:text-white border-b pb-2">سجل تحليل الأداء المالي</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-gray-300">
          <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg space-y-1.5">
            <p className="font-bold text-blue-600">1. المبيعات والمخزون</p>
            <div className="flex justify-between"><span>إجمالي المبيعات:</span><span className="font-bold">{totalSales.toLocaleString()}</span></div>
            <div className="flex justify-between text-red-500"><span>تكلفة البضاعة التقريبية:</span><span className="font-bold">- {(totalSales - grossProfit).toLocaleString()}</span></div>
            <div className="flex justify-between font-bold border-t pt-1 text-slate-700 dark:text-white"><span>ربح المبيعات:</span><span>{grossProfit.toLocaleString()}</span></div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg space-y-1.5">
            <p className="font-bold text-green-600">2. المصاريف والتشغيل</p>
            <div className="flex justify-between"><span>ربح المبيعات:</span><span className="font-bold">{grossProfit.toLocaleString()}</span></div>
            <div className="flex justify-between text-red-500"><span>المصاريف التشغيلية:</span><span className="font-bold">- {totalExpenses.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold border-t pt-1 text-green-600"><span>صافي الربح النهائي:</span><span>{netProfit.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      <div className="pt-6 text-center text-[11px] text-gray-400 border-t border-gray-100 dark:border-slate-800">
         <p>تطوير المهندس: <span className="font-bold text-slate-600 dark:text-gray-300">مازن فارع</span></p>
      </div>
    </div>
  );
}
