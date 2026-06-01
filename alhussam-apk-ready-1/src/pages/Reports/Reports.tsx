import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  ShoppingCart,
  Download,
  Calendar,
  Filter,
  FileText,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { logActivity } from '../../lib/activity';
import { AnimatePresence } from 'motion/react';
import { exportToPDF } from '../../lib/pdfExport';

export default function Reports() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);

  useEffect(() => {
    const ensureSettingsDefaults = (data: any) => {
      if (!data) return data;
      const logo = "https://i.imgur.com/gK9Jd74.png";
      const name = "متجر الحسام فون";
      const phone = "784707050 - 778915055";
      const address = "صنعاء - مذبح - جوار فندق ضواحي صنعاء";
      const notes = "صيانة وبموجة هواتف\nبيع جوالات - صيانة برمجة - اكسسوارات - ادوات تجميل - نسخ الافلام والمسلسلات - طباعة\nشكراً لتعاملكم معنا! البضاعة المباعة لا ترد ولا تستبدل بعد 24 ساعة.";
      
      return {
        ...data,
        shopName: !data.shopName || data.shopName === "الحسام فون" ? name : data.shopName,
        shopPhone: !data.shopPhone || data.shopPhone === "77XXXXXXX" ? phone : data.shopPhone,
        shopAddress: !data.shopAddress || data.shopAddress === "صنعاء، اليمن" ? address : data.shopAddress,
        receiptNotes: !data.receiptNotes || (data.receiptNotes.includes("البضاعة المباعة لا ترد ولا تستبدل") && !data.receiptNotes.includes("صيانة وبموجة")) ? notes : data.receiptNotes,
        logoUrl: !data.logoUrl || data.logoUrl.includes("placeholder") ? logo : data.logoUrl,
        primaryColor: '#541919',
        secondaryColor: '#B3803E'
      };
    };

    // Listen for settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setShopSettings(ensureSettingsDefaults(snap.data()));
      }
    });

    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc')), (snap) => {
      setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    setLoading(false);
    return () => { 
      unsubSettings();
      unsubInvoices(); 
      unsubItems(); 
    };
  }, []);

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      await logActivity('حذف فاتورة من التقارير', invoiceToDelete.id, 'invoices', { number: invoiceToDelete.number });
      setInvoiceToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invoices/${invoiceToDelete.id}`);
    }
  };

  const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalItems = items.length;
  const lowStockItems = items.filter(i => i.stock <= (i.minStock || 5)).length;

  const currentYear = new Date().getFullYear();
  const monthlySales = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthTotal = invoices.reduce((sum, inv) => {
      const invDate = new Date(inv.date);
      if (invDate.getFullYear() === currentYear && (invDate.getMonth() + 1) === month) {
        return sum + (inv.total || 0);
      }
      return sum;
    }, 0);
    return {
      monthIndex: i,
      monthName: [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ][i],
      total: monthTotal
    };
  });

  const exportGeneralReport = () => {
    const reportData = [
      ["العنوان", "القيمة"],
      ["إجمالي المبيعات", totalSales],
      ["عدد المنتجات", totalItems],
      ["منتجات منخفضة المخزون", lowStockItems],
      ["تاريخ التقرير", new Date().toLocaleString()]
    ];
    
    let csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + reportData.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `general_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logActivity('تصدير تقرير عام CSV');
  };

  const exportMonthlyReport = () => {
    const reportData = [
      ["الشهر", `إجمالي المبيعات (${shopSettings?.currency || 'ر.ي'})`],
      ...monthlySales.map(m => [m.monthName, m.total])
    ];
    
    let csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + reportData.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `monthly_sales_report_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logActivity('تصدير تقرير مبيعات شهري CSV', currentYear.toString(), 'reports');
  };

  const downloadFullPDF = async () => {
    await exportToPDF('reports-content', `full_report_${Date.now()}`);
  };

  return (
    <div className="space-y-6" id="reports-content">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-primary">التقارير التحليلية</h1>
          <p className="text-sm text-secondary mt-1">نظام {shopSettings?.shopName || 'الحسام فون'} - تقارير الأداء العام</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={downloadFullPDF}
            className="btn-primary bg-secondary hover:bg-secondary/90"
          >
            <Download className="w-4 h-4" /> تحميل PDF شامل
          </button>
          <button 
            onClick={exportGeneralReport}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/5 text-primary rounded-xl">
                 <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs text-gray-400 font-bold uppercase">إجمالي المبيعات</p>
                 <h2 className="text-xl font-black text-primary">{totalSales.toLocaleString()} <span className="text-xs">{shopSettings?.currency || 'ر.ي'}</span></h2>
              </div>
           </div>
           <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '70%' }}></div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
                 <Package className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs text-gray-400 font-bold uppercase">المخزون المتوفر</p>
                 <h2 className="text-xl font-black text-primary">{totalItems} <span className="text-xs">صنف</span></h2>
              </div>
           </div>
           <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
              {lowStockItems} أصناف تحت الحد الحرج
           </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-accent/10 text-accent rounded-xl">
                 <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs text-gray-400 font-bold uppercase">إجمالي العمليات</p>
                 <h2 className="text-xl font-black text-primary">{invoices.length} <span className="text-xs">فاتورة</span></h2>
              </div>
           </div>
           <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> نمو في المبيعات
           </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
               <FileText className="w-5 h-5 text-primary" />
               سجل المبيعات اليومي
            </h3>
            <div className="flex gap-2">
               <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
                  <Calendar className="w-4 h-4 text-gray-400" />
               </button>
               <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
                  <Filter className="w-4 h-4 text-gray-400" />
               </button>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-right">
               <thead className="bg-gray-50/50">
                  <tr>
                     <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">رقم الفاتورة</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">التاريخ</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">الإجمالي</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">الحالة</th>
                     <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-left">إجراءات</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {invoices.slice(0, 10).map((inv) => (
                    <tr key={inv.id} className="hover:bg-background/50 transition-colors">
                       <td className="px-6 py-4 text-sm font-bold text-primary">{inv.number}</td>
                       <td className="px-6 py-4 text-xs text-gray-400">{new Date(inv.date).toLocaleString()}</td>
                       <td className="px-6 py-4 text-sm font-bold text-primary font-mono">{inv.total.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</td>
                       <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">مكتملة</span>
                       </td>
                       <td className="px-6 py-4 text-left">
                          <button 
                            onClick={() => setInvoiceToDelete(inv)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="حذف الفاتورة"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-green-500" />
               تقرير المبيعات الشهري ({currentYear})
            </h3>
            <button 
              onClick={exportMonthlyReport}
              className="flex items-center gap-2 text-xs font-bold text-primary hover:text-secondary transition-colors"
            >
               <Download className="w-4 h-4" />
               تصدير التقرير الشهري
            </button>
         </div>
         <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
               {monthlySales.map((month) => (
                  <div key={month.monthName} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center text-center">
                     <p className="text-[10px] font-bold text-gray-400 mb-1">{month.monthName}</p>
                     <p className="text-sm font-black text-primary font-mono">{month.total.toLocaleString()}</p>
                     <p className="text-[9px] text-gray-400 mt-1">{shopSettings?.currency || 'ر.ي'}</p>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {invoiceToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">تأكيد حذف الفاتورة</h3>
              <p className="text-sm text-secondary mb-6 text-right">
                هل أنت متأكد من حذف الفاتورة رقم <span className="font-bold text-primary">"{invoiceToDelete.number}"</span>؟ سيتم إزالتها نهائياً من السجلات.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteInvoice}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  حذف السجل
                </button>
                <button 
                  onClick={() => setInvoiceToDelete(null)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
