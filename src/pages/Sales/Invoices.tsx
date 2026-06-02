import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Receipt, Search, Calendar, User, DollarSign, RefreshCw } from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  total: number;
  status: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubInvoices = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[];
      setInvoices(list);
      setIsLoading(false);
    });

    const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
      const doc = snapshot.docs.find(d => d.id === 'shop');
      if (doc) setShopSettings(doc.data());
    });

    return () => {
      unsubInvoices();
      unsubSettings();
    };
  }, []);

  const filteredInvoices = invoices.filter(inv => 
    (inv.number && inv.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (inv.customer && inv.customer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-gray-400">جاري تحميل سجل الفواتير...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 text-right" dir="rtl">
      {/* الترويسة وبحث */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" /> سجل الفواتير والمبيعات
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">إدارة واستعراض فواتير العملاء الحالية</p>
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
          <input 
            type="text" 
            placeholder="ابحث برقم الفاتورة أو اسم العميل..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 text-xs pr-9 pl-3 py-2.5 rounded-lg border border-gray-100 dark:border-slate-700 outline-none focus:border-blue-500 text-right"
          />
        </div>
      </div>

      {/* جدول الفواتير المبسط المتوافق مع الجوال */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 font-bold border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">العميل</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">الإجمالي</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {filteredInvoices.length > 0 ? filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-700 dark:text-gray-300">{inv.number}</td>
                  <td className="p-3 text-slate-600 dark:text-gray-400 font-medium">{inv.customer || 'عميل نقدي'}</td>
                  <td className="p-3 text-gray-400">{inv.date ? new Date(inv.date).toLocaleDateString('ar-YE') : '-'}</td>
                  <td className="p-3 font-black text-blue-600">{(inv.total || 0).toLocaleString()} {shopSettings?.currency || 'ر.ي'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inv.status === 'paid' ? 'مدفوعة' : 'آجل'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 font-medium">لا توجد فواتير مطابقة للبحث</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* التذييل */}
      <div className="pt-4 text-center text-[10px] text-gray-400 border-t border-gray-100 dark:border-slate-800/60">
        <p>{shopSettings?.shopName || 'الحسام فون'} - إدارة المبيعات الذكية</p>
      </div>
    </div>
  );
}
