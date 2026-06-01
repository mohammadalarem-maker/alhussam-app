import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Filter, 
  ArrowRightLeft,
  Calendar,
  Download,
  AlertCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronRight,
  BookOpen,
  X,
  CheckCircle,
  Clock,
  Printer
} from 'lucide-react';
import { collection, onSnapshot, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { useTranslation } from '../../lib/translations';

interface Transaction {
  id: string;
  number: string;
  date: string;
  description: string;
  type: 'sale' | 'expense' | 'debt' | 'manual';
  debit: number;
  credit: number;
  reference?: string;
}

interface MonthlySummary {
  year: number;
  month: number;
  monthKey: string;
  sales: number;
  expenses: number;
  debtsAdded: number;
  totalDebit: number;
  totalCredit: number;
  netProfit: number;
  transactions: Transaction[];
}

interface YearSummary {
  year: number;
  sales: number;
  expenses: number;
  totalDebit: number;
  totalCredit: number;
  netProfit: number;
  transactions: Transaction[];
}

export default function Journal() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [shopSettings, setShopSettings] = useState<any>(null);

  // Manual Entry Form State
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    debit: '',
    credit: '',
    reference: '',
    number: ''
  });
  const [savingManual, setSavingManual] = useState(false);

  // Expansion States
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonthDetails, setSelectedMonthDetails] = useState<MonthlySummary | null>(null);
  const [selectedYearDetails, setSelectedYearDetails] = useState<YearSummary | null>(null);

  useEffect(() => {
    setLoading(true);
    let unsubInvoices = () => {};
    let unsubExpenses = () => {};
    let unsubDebts = () => {};
    let unsubManual = () => {};

    // Get Shop Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setShopSettings(snap.data());
    });

    let invoicesData: any[] = [];
    let expensesData: any[] = [];
    let debtsData: any[] = [];
    let manualData: any[] = [];

    const handleCombine = () => {
      const all: Transaction[] = [];

      // Append Invoices
      invoicesData.forEach(inv => {
        all.push({
          id: inv.id,
          number: inv.number ? `JE-INV-${inv.number}` : `JE-INV-${inv.id.substring(0, 5).toUpperCase()}`,
          date: inv.date || new Date().toISOString().split('T')[0],
          description: inv.description || `${t('مبيعات - فاتورة رقم')} ${inv.number || ''} ${inv.customerName ? `- ${inv.customerName}` : ''}`,
          type: 'sale',
          debit: Number(inv.total || 0),
          credit: Number(inv.total || 0),
          reference: inv.paymentMethod || t('نقداً')
        });
      });

      // Append Expenses
      expensesData.forEach(exp => {
        all.push({
          id: exp.id,
          number: `JE-EXP-${exp.id.substring(0, 5).toUpperCase()}`,
          date: exp.date || new Date().toISOString().split('T')[0],
          description: `${t('إدارة المصروفات')} - ${exp.category || ''}: ${exp.description || ''}`,
          type: 'expense',
          debit: Number(exp.amount || 0),
          credit: Number(exp.amount || 0),
          reference: exp.paymentMethod || 'Cash'
        });
      });

      // Append Debts
      debtsData.forEach(debt => {
        all.push({
          id: debt.id,
          number: `JE-DBT-${debt.id.substring(0, 5).toUpperCase()}`,
          date: debt.date || new Date().toISOString().split('T')[0],
          description: `${t('إدارة الديون')} (${debt.type === 'receivable' ? t('له') || 'Receivable' : t('عليه') || 'Payable'}) - ${debt.contactName || t('مستفيد')}: ${debt.description || ''}`,
          type: 'debt',
          debit: Number(debt.amount || 0),
          credit: Number(debt.amount || 0),
          reference: debt.status === 'paid' ? t('مسدد') : t('غير مسدد')
        });
      });

      // Append Manual Entries
      manualData.forEach(man => {
        all.push({
          id: man.id,
          number: man.number || `JE-MAN-${man.id.substring(0, 5).toUpperCase()}`,
          date: man.date || new Date().toISOString().split('T')[0],
          description: man.description || t('قيد يدوي'),
          type: 'manual',
          debit: Number(man.debit || 0),
          credit: Number(man.credit || 0),
          reference: man.reference || t('يدوي')
        });
      });

      // Sort chronological newest first
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(all);
      setLoading(false);
    };

    try {
      unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
        invoicesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        handleCombine();
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'invoices');
        handleCombine();
      });

      unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
        expensesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        handleCombine();
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'expenses');
        handleCombine();
      });

      unsubDebts = onSnapshot(collection(db, 'debts'), (snap) => {
        debtsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        handleCombine();
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'debts');
        handleCombine();
      });

      unsubManual = onSnapshot(collection(db, 'journal_entries'), (snap) => {
        manualData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        handleCombine();
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'journal_entries');
        handleCombine();
      });

    } catch (e) {
      console.error(e);
      setLoading(false);
    }

    return () => {
      unsubInvoices();
      unsubExpenses();
      unsubDebts();
      unsubManual();
      unsubSettings();
    };
  }, [t]);

  // Form Submission
  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFormData.description || !manualFormData.debit || !manualFormData.credit) {
      notify.error(t('يرجى ملء كافة الحقول الأساسية'));
      return;
    }

    try {
      setSavingManual(true);
      const uniqueCode = `MAN-${Date.now().toString().slice(-6)}`;
      const payload = {
        number: manualFormData.number || uniqueCode,
        date: manualFormData.date,
        description: manualFormData.description,
        debit: Number(manualFormData.debit),
        credit: Number(manualFormData.credit),
        reference: manualFormData.reference || '',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'journal_entries'), payload);

      notify.success(t('تم إدخال القيد بنجاح!'));
      setIsAddingManual(false);
      setManualFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        debit: '',
        credit: '',
        reference: '',
        number: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'journal_entries');
    } finally {
      setSavingManual(false);
    }
  };

  // Filter daily list
  const filteredDaily = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.reference && t.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    if (typeFilter === 'all') return matchesSearch;
    return matchesSearch && t.type === typeFilter;
  });

  // Calculate stats for daily
  const dailyStats = React.useMemo(() => {
    let deb = 0;
    let cre = 0;
    filteredDaily.forEach(t => {
      deb += t.debit;
      cre += t.credit;
    });
    return { debit: deb, credit: cre, count: filteredDaily.length };
  }, [filteredDaily]);

  // Months available
  const monthNamesArabic = [
    'يناير (01)', 'فبراير (02)', 'مارس (03)', 'أبريل (04)', 'مايو (05)', 'يونيو (06)', 
    'يوليو (07)', 'أغسطس (08)', 'سبتمبر (09)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
  ];

  // Derive summaries for monthly view based on selectedYear
  const monthlySummaries = React.useMemo(() => {
    const months: Record<string, MonthlySummary> = {};

    // Prep all 12 months
    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
      months[key] = {
        year: selectedYear,
        month: m,
        monthKey: key,
        sales: 0,
        expenses: 0,
        debtsAdded: 0,
        totalDebit: 0,
        totalCredit: 0,
        netProfit: 0,
        transactions: []
      };
    }

    transactions.forEach(t => {
      const d = new Date(t.date);
      const yr = d.getFullYear();
      const mn = d.getMonth() + 1;
      const key = `${yr}-${String(mn).padStart(2, '0')}`;

      if (yr === selectedYear) {
        if (!months[key]) {
          months[key] = {
            year: yr,
            month: mn,
            monthKey: key,
            sales: 0,
            expenses: 0,
            debtsAdded: 0,
            totalDebit: 0,
            totalCredit: 0,
            netProfit: 0,
            transactions: []
          };
        }
        const mObj = months[key];
        mObj.transactions.push(t);
        mObj.totalDebit += t.debit;
        mObj.totalCredit += t.credit;

        if (t.type === 'sale') mObj.sales += t.debit;
        else if (t.type === 'expense') mObj.expenses += t.debit;
        else if (t.type === 'debt') mObj.debtsAdded += t.debit;

        mObj.netProfit = mObj.sales - mObj.expenses;
      }
    });

    return Object.values(months).sort((a, b) => b.month - a.month);
  }, [transactions, selectedYear]);

  // Monthly stats summing
  const monthlyStats = React.useMemo(() => {
    let sales = 0;
    let exp = 0;
    monthlySummaries.forEach(m => {
      sales += m.sales;
      exp += m.expenses;
    });
    return { sales, expenses: exp, net: sales - exp };
  }, [monthlySummaries]);

  // Derive summaries for annual view
  const annualSummaries = React.useMemo(() => {
    const years: Record<number, YearSummary> = {};

    transactions.forEach(t => {
      const d = new Date(t.date);
      const yr = d.getFullYear();

      if (!years[yr]) {
        years[yr] = {
          year: yr,
          sales: 0,
          expenses: 0,
          totalDebit: 0,
          totalCredit: 0,
          netProfit: 0,
          transactions: []
        };
      }

      const yObj = years[yr];
      yObj.transactions.push(t);
      yObj.totalDebit += t.debit;
      yObj.totalCredit += t.credit;

      if (t.type === 'sale') yObj.sales += t.debit;
      else if (t.type === 'expense') yObj.expenses += t.debit;

      yObj.netProfit = yObj.sales - yObj.expenses;
    });

    return Object.values(years).sort((a, b) => b.year - a.year);
  }, [transactions]);

  // Cumulative annual stats
  const cumulativeStats = React.useMemo(() => {
    let sales = 0;
    let exp = 0;
    annualSummaries.forEach(y => {
      sales += y.sales;
      exp += y.expenses;
    });
    return { sales, expenses: exp, net: sales - exp };
  }, [annualSummaries]);

  // List of unique years available in transactions
  const yearsList = React.useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    transactions.forEach(t => {
      const yr = new Date(t.date).getFullYear();
      if (!isNaN(yr)) years.add(yr);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const handlePrint = () => {
    window.print();
  };

  const isRTL = t('القيود اليومية') !== 'Daily Journal Entries';

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-secondary" />
            {t('الدفتر الشهري والسنوي')}
          </h1>
          <p className="text-sm text-secondary mt-1">
            {t('دفتر اليومية الإلكتروني')} - {shopSettings?.shopName || 'الحسام فون'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة / PDF
          </button>
          <button 
            onClick={() => setIsAddingManual(true)}
            className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            {t('قيد يدوي جديد')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 flex items-center gap-2 print:hidden scrollbar-none overflow-x-auto">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'daily' 
              ? 'border-secondary text-secondary' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          {t('القيود اليومية')}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'monthly' 
              ? 'border-secondary text-secondary' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          {t('الدفتر الشهري')}
        </button>
        <button
          onClick={() => setActiveTab('yearly')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'yearly' 
              ? 'border-secondary text-secondary' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          {t('الدفتر السنوي')}
        </button>
      </div>

      {/* Statistics Cards based on Active Tab */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeTab === 'daily' && (
          <>
            <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/10 p-5 rounded-2xl border border-green-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-green-700/80 uppercase tracking-wider">{t('مدين')}</p>
                <h3 className="text-xl font-bold text-green-700 mt-1 font-mono">
                  {dailyStats.debit.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500/5 to-rose-500/10 p-5 rounded-2xl border border-red-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-red-700/80 uppercase tracking-wider">{t('دائن')}</p>
                <h3 className="text-xl font-bold text-red-700 mt-1 font-mono">
                  {dailyStats.credit.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className="w-10 h-10 bg-red-500/10 text-red-600 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-secondary/10 p-5 rounded-2xl border border-primary/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">{t('عدد القيود') || 'Entries Count'}</p>
                <h3 className="text-xl font-bold text-primary mt-1 font-mono">
                  {dailyStats.count}
                </h3>
              </div>
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </>
        )}

        {activeTab === 'monthly' && (
          <>
            <div className="bg-gradient-to-br from-secondary/5 to-primary/10 p-5 rounded-2xl border border-secondary/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">{t('إجمالي المبيعات')} ({selectedYear})</p>
                <h3 className="text-xl font-bold text-primary mt-1 font-mono">
                  {monthlyStats.sales.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500/5 to-orange-500/10 p-5 rounded-2xl border border-red-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-red-700/80 uppercase tracking-wider">{t('إجمالي المصروفات')} ({selectedYear})</p>
                <h3 className="text-xl font-bold text-red-700 mt-1 font-mono">
                  {monthlyStats.expenses.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/10 p-5 rounded-2xl border border-emerald-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">{t('الصافي / الفارق')} ({selectedYear})</p>
                <h3 className="text-xl font-bold text-emerald-700 mt-1 font-mono">
                  {monthlyStats.net.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${monthlyStats.net >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </>
        )}

        {activeTab === 'yearly' && (
          <>
            <div className="bg-gradient-to-br from-secondary/5 to-primary/10 p-5 rounded-2xl border border-secondary/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">{t('إجمالي المبيعات')} ({t('تراكمي') || 'Cumulative'})</p>
                <h3 className="text-xl font-bold text-primary mt-1 font-mono">
                  {cumulativeStats.sales.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500/5 to-orange-500/10 p-5 rounded-2xl border border-red-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-red-700/80 uppercase tracking-wider">{t('إجمالي المصروفات')} ({t('تراكمي') || 'Cumulative'})</p>
                <h3 className="text-xl font-bold text-red-700 mt-1 font-mono">
                  {cumulativeStats.expenses.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/10 p-5 rounded-2xl border border-emerald-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">{t('الصافي / الفارق')} ({t('تراكمي') || 'Cumulative'})</p>
                <h3 className="text-xl font-bold text-emerald-700 mt-1 font-mono">
                  {cumulativeStats.net.toLocaleString()}
                  <span className="text-[10px] font-black mr-1">{shopSettings?.currency || 'ر.ي'}</span>
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cumulativeStats.net >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          {t('جاري التحميل...')}
        </div>
      ) : (
        <>
          {/* TAB 1: DAILY VIEW */}
          {activeTab === 'daily' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex flex-col md:flex-row md:items-center gap-4 print:hidden">
                <div className="relative flex-1">
                  <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <input 
                    type="text" 
                    placeholder={t('البحث في القيود...')} 
                    className={`w-full bg-background border border-gray-100 dark:border-slate-800 rounded-xl py-2 text-sm focus:ring-2 focus:ring-secondary/40 outline-none ${isRTL ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 shrink-0">
                  <div className="flex items-center gap-2 bg-background border border-gray-100 dark:border-slate-800 px-3 py-2 rounded-xl">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="all">{t('الكل')}</option>
                      <option value="sale">{t('المبيعات')}</option>
                      <option value="expense">{t('إدارة المصروفات')}</option>
                      <option value="debt">{t('إدارة الديون')}</option>
                      <option value="manual">{t('قيد يدوي') || 'Manual Entry'}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className={`w-full border-collapse ${isRTL ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-gray-50/70 border-b border-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('رقم القيد')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('التاريخ')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('البيان / الوصف')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('مدين')} ({shopSettings?.currency || 'ر.ي'})</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('دائن')} ({shopSettings?.currency || 'ر.ي'})</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('المرجع')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDaily.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-xs">
                          {t('لا توجد قيود محاسبية مطابقة')}
                        </td>
                      </tr>
                    ) : (
                      filteredDaily.map((tr) => (
                        <tr key={tr.id} className="hover:bg-background transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-primary font-mono bg-primary/5 px-2.5 py-1 rounded-lg">
                              {tr.number}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[11px] text-gray-400">
                            {new Date(tr.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 max-w-xs md:max-w-md">
                            <p className="text-xs font-semibold text-primary block break-words">{tr.description}</p>
                            <span className={`inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                              tr.type === 'sale' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                              tr.type === 'expense' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                              tr.type === 'debt' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                              'bg-indigo-50 text-indigo-600 border border-indigo-100'
                            }`}>
                              {tr.type === 'sale' ? t('المبيعات') :
                               tr.type === 'expense' ? t('إدارة المصروفات') :
                               tr.type === 'debt' ? t('إدارة الديون') :
                               t('قيد يدوي')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-green-600">
                            {tr.debit > 0 ? tr.debit.toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-red-500">
                            {tr.credit > 0 ? tr.credit.toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-[10px] text-gray-400 font-bold bg-gray-100/80 px-2 py-0.5 rounded">
                              {tr.reference || '-'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY VIEW */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              
              {/* Year Selector option */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between print:hidden">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('اختر السنة المالية')}</span>
                <div className="flex gap-1.5">
                  {yearsList.map(y => (
                    <button
                      key={y}
                      onClick={() => {
                        setSelectedYear(y);
                        setSelectedMonthDetails(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        selectedYear === y 
                        ? 'bg-secondary text-white' 
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={`w-full border-collapse ${isRTL ? 'text-right' : 'text-left'}`}>
                    <thead className="bg-gray-50/70 border-b border-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('الشهر')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('المبيعات')} ({shopSettings?.currency || 'ر.ي'})</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('المصروفات')} ({shopSettings?.currency || 'ر.ي'})</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('الصافي / الفارق')}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('إجمالي الحركات') || 'Activities'}</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider print:hidden"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthlySummaries.map((m) => {
                        const monthName = monthNamesArabic[m.month - 1];
                        return (
                          <React.Fragment key={m.monthKey}>
                            <tr className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-xs font-extrabold text-primary flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-secondary shrink-0" />
                                  {monthName}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-700 font-mono">
                                {m.sales.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-700 font-mono">
                                {m.expenses.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`text-xs font-bold font-mono ${m.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {m.netProfit >= 0 ? '+' : ''}{m.netProfit.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-bold font-mono">
                                {m.transactions.length} {t('حركة') || 'ops'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-left print:hidden">
                                <button
                                  onClick={() => setSelectedMonthDetails(selectedMonthDetails?.monthKey === m.monthKey ? null : m)}
                                  className="text-xs font-bold text-secondary hover:underline cursor-pointer"
                                >
                                  {selectedMonthDetails?.monthKey === m.monthKey ? t('إغلاق') : t('استعراض تفاصيل الشهر')}
                                </button>
                              </td>
                            </tr>

                            {/* EXPANEDED MONTH DETAILS INLINE */}
                            {selectedMonthDetails?.monthKey === m.monthKey && (
                              <tr>
                                <td colSpan={6} className="bg-gray-50/60 p-6">
                                  <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4 shadow-inner">
                                    <div className="flex items-center justify-between border-b pb-3">
                                      <h4 className="text-xs font-bold text-secondary flex items-center gap-2">
                                        <Clock className="w-4 h-4 animate-spin-slow text-secondary" />
                                        {t('القيود التفصيلية لشهر')} {monthName}
                                      </h4>
                                      <span className="text-[10px] text-gray-400 bg-background border px-2 py-0.5 rounded font-bold font-mono">{m.monthKey}</span>
                                    </div>
                                    
                                    <div className="overflow-x-auto max-h-96">
                                      <table className={`w-full text-right ${isRTL ? 'text-right' : 'text-left'}`}>
                                        <thead>
                                          <tr className="border-b text-gray-400 text-[10px] font-bold">
                                            <th className="pb-2">{t('الرقم')}</th>
                                            <th className="pb-2">{t('التاريخ')}</th>
                                            <th className="pb-2">{t('البيان / الوصف')}</th>
                                            <th className="pb-2">{t('مدين')}</th>
                                            <th className="pb-2">{t('دائن')}</th>
                                            <th className="pb-2">{t('المرجع')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {m.transactions.length === 0 ? (
                                            <tr>
                                              <td colSpan={6} className="py-4 text-center text-gray-400 text-xs">{t('لا توجد حركات هذا الشهر')}</td>
                                            </tr>
                                          ) : (
                                            m.transactions.map((subTr) => (
                                              <tr key={subTr.id} className="text-xs hover:bg-background">
                                                <td className="py-2.5 font-mono text-[11px] font-bold text-primary">{subTr.number}</td>
                                                <td className="py-2.5 text-gray-400 text-[10px] whitespace-nowrap">{new Date(subTr.date).toLocaleDateString()}</td>
                                                <td className="py-2.5 font-medium text-gray-600 max-w-xs truncate">{subTr.description}</td>
                                                <td className="py-2.5 font-mono text-green-600 font-bold">{subTr.debit > 0 ? subTr.debit.toLocaleString() : '-'}</td>
                                                <td className="py-2.5 font-mono text-red-500 font-bold">{subTr.credit > 0 ? subTr.credit.toLocaleString() : '-'}</td>
                                                <td className="py-2.5 text-gray-400 text-[10px] font-mono">{subTr.reference || '-'}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: YEARLY VIEW */}
          {activeTab === 'yearly' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className={`w-full border-collapse ${isRTL ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-gray-50/70 border-b border-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('السنة')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('مبيعات السنة') || 'Annual Sales'} ({shopSettings?.currency || 'ر.ي'})</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('مصروفات السنة') || 'Annual Expenses'} ({shopSettings?.currency || 'ر.ي'})</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('الصافي / الفارق')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('إجمالي الحركات')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {annualSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-xs">
                          {t('لا توجد بيانات محاسبية متاحة')}
                        </td>
                      </tr>
                    ) : (
                      annualSummaries.map((y) => (
                        <React.Fragment key={y.year}>
                          <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-black text-primary font-mono select-none">
                                {y.year}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-700 font-mono">
                              {y.sales.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-700 font-mono">
                              {y.expenses.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-xs font-bold font-mono ${y.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {y.netProfit >= 0 ? '+' : ''}{y.netProfit.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-bold font-mono">
                              {y.transactions.length} {t('حركة') || 'ops'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-left print:hidden">
                              <button
                                onClick={() => setSelectedYearDetails(selectedYearDetails?.year === y.year ? null : y)}
                                className="text-xs font-bold text-secondary hover:underline cursor-pointer"
                              >
                                {selectedYearDetails?.year === y.year ? t('إغلاق') : t('استعراض تفاصيل السنة')}
                              </button>
                            </td>
                          </tr>

                          {/* EXPANEDED YEAR DETAILS INLINE */}
                          {selectedYearDetails?.year === y.year && (
                            <tr>
                              <td colSpan={6} className="bg-gray-50/60 p-6">
                                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4 shadow-inner">
                                  <div className="flex items-center justify-between border-b pb-3">
                                    <h4 className="text-xs font-bold text-secondary flex items-center gap-2">
                                      <Clock className="w-4 h-4 animate-spin-slow text-secondary" />
                                      {t('إحصائيات الشهور للسنة المالية')} {y.year}
                                    </h4>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {monthNamesArabic.map((monthName, idx) => {
                                      const mnNum = idx + 1;
                                      const matchingOps = y.transactions.filter(t => new Date(t.date).getMonth() + 1 === mnNum);
                                      const salesSum = matchingOps.filter(t => t.type === 'sale').reduce((sum, current) => sum + current.debit, 0);
                                      const expensesSum = matchingOps.filter(t => t.type === 'expense').reduce((sum, current) => sum + current.debit, 0);
                                      const netSum = salesSum - expensesSum;

                                      return (
                                        <div key={idx} className="bg-background border rounded-lg p-3 space-y-2">
                                          <p className="text-xs font-black text-primary">{monthName}</p>
                                          <div className="grid grid-cols-2 text-[10px] text-gray-500 font-bold">
                                            <span>{t('المبيعات')}:</span>
                                            <span className="text-left font-mono">{salesSum.toLocaleString()}</span>
                                            <span>{t('المصروفات')}:</span>
                                            <span className="text-left font-mono">{expensesSum.toLocaleString()}</span>
                                            <span className="text-primary">{t('الصافي') || 'Net'}:</span>
                                            <span className={`text-left font-mono font-black ${netSum >= 0 ? 'text-green-600' : 'text-red-500'}`}>{netSum.toLocaleString()}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* FOOTER ALERT BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-primary/5 p-6 rounded-2xl border border-dashed border-primary/20 print:hidden">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-bold text-primary">{t('التوازن المحاسبي')}</p>
            <p className="text-xs text-gray-400">{t('يتم إنشاء القيود آلياً عند إتمام عمليات البيع والشراء ومتابعة المصاريف والديون')}</p>
          </div>
        </div>
        <div className="flex-1"></div>
        <button className="flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer">
          <Download className="w-4 h-4" /> 
           {t('تحميل نسخة احتياطية')}
        </button>
      </div>

      {/* MODAL: ADD MANUAL JOURNAL ENTRY */}
      <AnimatePresence>
        {isAddingManual && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingManual(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative bg-white border border-gray-100 rounded-2xl p-6 shadow-2xl max-w-md w-full z-10 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <button 
                onClick={() => setIsAddingManual(false)}
                className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-1 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-lg`}
              >
                <X className="w-4 h-4" />
              </button>
              
              <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                {t('إضافة قيد محاسبي')} {t('يدوي')}
              </h3>

              <form onSubmit={handleSaveManualEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400">{t('رقم القيد')}</label>
                    <input 
                      type="text" 
                      placeholder="e.g. JE-MAN-001"
                      className="w-full bg-background border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                      value={manualFormData.number}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400">{t('التاريخ')}</label>
                    <input 
                      type="date" 
                      required
                      className="w-full bg-background border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                      value={manualFormData.date}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">{t('البيان / الوصف')} *</label>
                  <input 
                    type="text" 
                    required
                    placeholder={t('أدخل وصف القيد المالي...')}
                    className="w-full bg-background border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                    value={manualFormData.description}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400">{t('مدين')} ({shopSettings?.currency || 'ر.ي'}) *</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      placeholder="0.00"
                      className="w-full bg-background border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                      value={manualFormData.debit}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, debit: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400">{t('دائن')} ({shopSettings?.currency || 'ر.ي'}) *</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      placeholder="0.00"
                      className="w-full bg-background border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                      value={manualFormData.credit}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, credit: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">{t('المرجع / ملاحظات')}</label>
                  <input 
                    type="text" 
                    placeholder="رقم المستند، رقم الشيك..."
                    className="w-full bg-background border border-gray-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                    value={manualFormData.reference}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, reference: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={savingManual}
                    className="w-full bg-primary text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 hover:bg-opacity-95 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {savingManual ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle className="w-4 h-4" />}
                    {t('حفظ')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingManual(false)}
                    className="w-full bg-gray-50 text-gray-500 hover:bg-gray-100 py-2.5 rounded-xl text-xs font-bold transition-all border border-gray-100 cursor-pointer"
                  >
                    {t('إلغاء')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
