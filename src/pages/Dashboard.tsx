import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart, 
  ArrowUpRight,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Clock,
  Minus
} from 'lucide-react';
import { collection, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { exportToPDF } from '../lib/pdfExport';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ElementType;
  color: string;
}

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }: StatCardProps) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-surface p-4 md:p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">{title}</p>
        <h3 className="text-sm md:text-2xl font-bold text-foreground truncate">{value}</h3>
        <div className="flex items-center mt-1 md:mt-2">
          <span className={`text-[9px] md:text-xs font-medium flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" />}
            {change}
          </span>
        </div>
      </div>
      <div className={`p-2 md:p-3 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-4 h-4 md:w-6 md:h-6" />
      </div>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();

  const [shopSettings, setShopSettings] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let settingsDone = false;
    let itemsDone = false;
    let expensesDone = false;
    let invoicesDone = false;

    const checkLoading = () => {
      if (settingsDone && itemsDone && expensesDone && invoicesDone) {
        setIsLoading(false);
      }
    };

    // 1. Settings Snapshot
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setShopSettings(snap.data());
      }
      settingsDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      settingsDone = true;
      checkLoading();
    });

    // 2. Items Snapshot
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const itemsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(itemsData);
      itemsDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      itemsDone = true;
      checkLoading();
    });

    // 3. Expenses Snapshot
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      const expensesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(expensesData);
      expensesDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      expensesDone = true;
      checkLoading();
    });

    // 4. Invoices Snapshot
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc')), (snap) => {
      const invoicesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInvoices(invoicesData);
      invoicesDone = true;
      checkLoading();
    }, (err) => {
      console.error(err);
      invoicesDone = true;
      checkLoading();
    });

    return () => {
      unsubSettings();
      unsubItems();
      unsubExpenses();
      unsubInvoices();
    };
  }, []);

  // Derived stats
  const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  
  const grossProfit = invoices.reduce((sum, inv) => {
    const invCogs = (inv.items || []).reduce((csum: number, item: any) => {
      return csum + ((item.purchasePrice || 0) * (item.qty || 0));
    }, 0);
    const invRevenue = inv.subtotal || inv.total || 0;
    return sum + (invRevenue - invCogs);
  }, 0);

  const totalExpensesSum = expenses.reduce((sum, d) => sum + (d.amount || 0), 0);
  const netProfit = grossProfit - totalExpensesSum;

  const lowStock = items.filter((i: any) => (i.stock || 0) <= (i.minStock || 5));

  const stats = {
    totalSales,
    totalExpenses: totalExpensesSum,
    grossProfit,
    netProfit,
    itemCount: items.length,
    invoiceCount: invoices.length,
    lowStock: lowStock.slice(0, 5)
  };

  const lastInvoices = invoices.slice(0, 5);

  const downloadReport = async () => {
    await exportToPDF('dashboard-content', `dashboard_report_${Date.now()}`);
  };

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-gray-400">جاري تحميل بيانات المؤسسة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6" id="dashboard-content">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary text-right md:text-right">مرحباً بك في {shopSettings?.shopName || 'الحسام فون'}</h1>
          <p className="text-xs md:text-sm text-secondary mt-1">نظرة عامة على أداء المؤسسة اليوم</p>
        </div>
        <div className="flex gap-2 md:gap-3">
           <button 
            onClick={downloadReport}
            className="flex-1 sm:flex-none bg-surface border border-gray-100 dark:border-slate-800 text-xs md:text-sm text-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
           >
             تحميل تقرير
           </button>
           <button onClick={() => navigate('/pos')} className="flex-1 sm:flex-none btn-primary text-xs md:text-sm py-2 px-4 whitespace-nowrap">
             فاتورة جديدة +
           </button>
        </div>
      </div>

      {stats.lowStock.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-center sm:text-right">
             <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 text-red-600 rounded-full flex items-center justify-center animate-pulse shrink-0">
                <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
                <h4 className="text-sm font-black text-red-800 dark:text-red-400">تنبيه: مخزون منخفض حرج!</h4>
                <p className="text-[10px] md:text-xs text-red-600 font-bold">يوجد {stats.lowStock.length} أصناف وصلت أو تجاوزت الحد الأدنى.</p>
             </div>
          </div>
          <button 
            onClick={() => navigate('/inventory')}
            className="w-full sm:w-auto bg-red-600 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none"
          >
            عرض الأصناف المنخفضة
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          title="صافي الأرباح" 
          value={`${stats.netProfit.toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="الربح الحقيقي النهائي" 
          isPositive={stats.netProfit >= 0} 
          icon={TrendingUp}
          color="bg-green-100 dark:bg-green-950/40 text-green-700 shadow-sm"
        />
        <StatCard 
          title="إجمالي المبيعات" 
          value={`${stats.totalSales.toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="حجم الإيرادات" 
          isPositive={true} 
          icon={DollarSign}
          color="bg-primary/5 text-primary"
        />
        <StatCard 
          title="إجمالي المصروفات" 
          value={`${stats.totalExpenses.toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="التكاليف التشغيلية" 
          isPositive={false} 
          icon={TrendingDown}
          color="bg-red-50 dark:bg-red-950/30 text-red-600"
        />
        <StatCard 
          title="هامش الربح الكلي" 
          value={`${stats.grossProfit.toLocaleString()} ${shopSettings?.currency || 'ر.ي'}`} 
          change="قبل خصم المصاريف" 
          isPositive={stats.grossProfit >= 0} 
          icon={ArrowUpRight}
          color="bg-blue-50 dark:bg-blue-950/30 text-blue-600"
        />
      </div>

      {/* Financial Health Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="bg-surface rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
           <div className="p-4 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-primary flex items-center gap-2">
                 <DollarSign className="w-5 h-5" /> سجل تحليل الأداء المالي
              </h3>
              <span className="text-[10px] bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full font-bold text-gray-500 uppercase tracking-widest">Real-time Analysis</span>
           </div>
           <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                 {/* Step 1: Sales to Gross Profit */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold">1</div>
                       <p className="text-xs font-bold text-gray-400">تحليل المبيعات والمخزون</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100/50 dark:border-slate-800 space-y-3">
                       <div className="flex justify-between text-xs">
                          <span className="text-gray-500">إجمالي المبيعات</span>
                          <span className="font-bold">{stats.totalSales.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-xs text-red-500">
                          <span>تكلفة البضاعة (COGS)</span>
                          <span className="font-bold">- {(stats.totalSales - stats.grossProfit).toLocaleString()}</span>
                       </div>
                       <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-700 flex justify-between font-black text-primary">
                          <span>ربح المبيعات</span>
                          <span>{stats.grossProfit.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 {/* Icon separator for desktop */}
                 <div className="hidden md:flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-300">
                       <Minus className="w-5 h-5 rotate-90" />
                    </div>
                 </div>

                 {/* Step 2: Gross Profit to Net Profit */}
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">2</div>
                       <p className="text-xs font-bold text-gray-400">تحليل المصاريف والتشغيل</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100/50 dark:border-slate-800 space-y-3">
                       <div className="flex justify-between text-xs">
                          <span className="text-gray-500">ربح المبيعات</span>
                          <span className="font-bold">{stats.grossProfit.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-xs text-red-500">
                          <span>المصاريف والرواتب</span>
                          <span className="font-bold">- {stats.totalExpenses.toLocaleString()}</span>
                       </div>
                       <div className="pt-2 border-t border-dashed border-gray-200 dark:border-slate-700 flex justify-between font-black text-green-600">
                          <span>صافي الربح</span>
                          <span>{stats.netProfit.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-surface rounded-xl border border-gray-100 dark:border-slate-800 p-4 md:p-6 shadow-sm overflow-hidden">
            <h3 className="font-bold text-foreground mb-4 text-sm md:text-base">أصناف منخفضة المخزون</h3>
            <div className="space-y-3 md:space-y-4">
               {stats.lowStock.length > 0 ? stats.lowStock.map((item: any, idx: number) => (
                 <div key={idx} className="flex items-center justify-between py-2 md:py-3 border-b border-gray-50 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors px-1 md:px-2 rounded-lg text-foreground">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                       <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 text-red-600 flex items-center justify-center rounded-lg shrink-0">
                          <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                       </div>
                       <div className="min-w-0">
                          <p className="text-xs md:text-sm font-bold text-foreground truncate">{item.name}</p>
                          <p className="text-[9px] md:text-[10px] text-gray-500 truncate">{item.code}</p>
                       </div>
                    </div>
                    <div className="text-left shrink-0">
                       <p className="text-xs md:text-sm font-bold text-red-600">{item.stock} {item.unit}</p>
                       <p className="text-[8px] md:text-[10px] text-gray-400">متبقية</p>
                    </div>
                 </div>
               )) : (
                 <div className="py-10 text-center text-gray-400 text-sm">لا توجد أصناف منخفضة المخزون حالياً</div>
               )}
            </div>
            {stats.lowStock.length > 0 && (
              <button 
                onClick={() => navigate('/inventory')}
                className="w-full mt-4 py-2 text-[10px] md:text-xs text-primary font-medium hover:bg-primary/5 rounded-lg transition-colors border border-dashed border-primary/20"
              >
                انتقل لإدارة المخزون
              </button>
            )}
         </div>

         <div className="bg-surface rounded-xl border border-gray-100 dark:border-slate-800 p-4 md:p-6 shadow-sm overflow-hidden">
            <h3 className="font-bold text-foreground mb-4 text-sm md:text-base">آخر الفواتير</h3>
            <div className="space-y-3 md:space-y-4">
                {lastInvoices && lastInvoices.length > 0 ? lastInvoices.map((inv: any, i: number) => (
                 <div key={i} className="flex items-center gap-2 md:gap-3 py-2 border-b border-gray-50 dark:border-slate-800 last:border-0 min-w-0">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 shrink-0"></div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[10px] md:text-xs font-bold text-foreground truncate">{inv.number}</p>
                       <p className="text-[8px] md:text-[10px] text-gray-500 truncate">{new Date(inv.date).toLocaleDateString()}</p>
                    </div>
                    <p className="text-[10px] md:text-xs font-bold text-blue-600 shrink-0">{inv.total.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</p>
                 </div>
               )) : (
                 <div className="py-10 text-center text-gray-400 text-sm">لا توجد حركات مبيعات مؤخراً</div>
               )}
            </div>
            <button 
              onClick={() => navigate('/sales')}
              className="w-full mt-6 py-2 text-xs md:text-sm text-blue-700 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-colors"
            >
               عرض كافة الفواتير
            </button>
         </div>
      </div>

      {/* Developer Credit Footer */}
      <div className="pt-8 pb-4 text-center text-xs text-secondary border-t border-gray-100 dark:border-slate-800/50 mt-8">
         <p>تطوير المهندس: <span className="font-bold text-gray-700 dark:text-gray-300">مازن فارع</span></p>
      </div>
    </div>
  );
}
