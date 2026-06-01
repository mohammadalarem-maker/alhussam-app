import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  CreditCard,
  Calendar,
  Filter,
  DollarSign,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Wallet,
  MessageCircle
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface Debt {
  id: string;
  contactName: string;
  phoneNumber?: string;
  amount: number;
  remainingAmount: number;
  type: 'receivable' | 'payable';
  date: string;
  dueDate?: string;
  description?: string;
  status: 'pending' | 'partial' | 'settled';
}

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [isSettling, setIsSettling] = useState<Debt | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [shopSettings, setShopSettings] = useState<any>(null);

  const [formData, setFormData] = useState<any>({
    contactName: '',
    phoneNumber: '',
    amount: '',
    type: 'receivable',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    status: 'pending'
  });

  useEffect(() => {
    const q = query(collection(db, 'debts'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
      setDebts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'debts');
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setShopSettings(snap.data());
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = Number(formData.amount);
      const dataToSave = {
        ...formData,
        amount,
        remainingAmount: editingDebt ? (amount - (editingDebt.amount - editingDebt.remainingAmount)) : amount,
        updatedAt: new Date().toISOString()
      };

      if (editingDebt) {
        await updateDoc(doc(db, 'debts', editingDebt.id), dataToSave);
      } else {
        await addDoc(collection(db, 'debts'), {
          ...dataToSave,
          createdAt: new Date().toISOString()
        });
      }
      setIsAdding(false);
      setEditingDebt(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingDebt ? OperationType.UPDATE : OperationType.CREATE, `debts/${editingDebt?.id || ''}`);
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSettling) return;
    try {
      const payment = Number(settlementAmount);
      if (payment > isSettling.remainingAmount) {
        alert('المبلغ المدفوع أكبر من المتبقي');
        return;
      }

      const newRemaining = isSettling.remainingAmount - payment;
      const newStatus = newRemaining === 0 ? 'settled' : 'partial';

      await updateDoc(doc(db, 'debts', isSettling.id), {
        remainingAmount: newRemaining,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      setIsSettling(null);
      setSettlementAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `debts/${isSettling.id}`);
    }
  };

  const handleDelete = async () => {
    if (!debtToDelete) return;
    try {
      await deleteDoc(doc(db, 'debts', debtToDelete.id));
      setDebtToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `debts/${debtToDelete.id}`);
    }
  };

  const openEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
      contactName: debt.contactName,
      phoneNumber: debt.phoneNumber || '',
      amount: debt.amount,
      type: debt.type,
      date: debt.date,
      dueDate: debt.dueDate || '',
      description: debt.description || '',
      status: debt.status
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      contactName: '',
      phoneNumber: '',
      amount: '',
      type: activeTab,
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      description: '',
      status: 'pending'
    });
  };

  const filteredDebts = debts.filter(d => 
    d.type === activeTab &&
    (d.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     d.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalReceivables = debts.filter(d => d.type === 'receivable').reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalPayables = debts.filter(d => d.type === 'payable').reduce((sum, d) => sum + d.remainingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">إدارة الديون</h1>
          <p className="text-sm text-secondary mt-1">نظام {shopSettings?.shopName || 'الحسام فون'} - متابعة المبالغ المستحقة لنا والديون المترتبة علينا</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsAdding(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> إضافة سجل دين
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -translate-y-12 translate-x-12 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center gap-4">
             <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ديون لنا (مبالغ مستحقة للتحصيل)</p>
                <div className="flex items-baseline gap-1">
                   <h3 className="text-2xl font-bold text-primary font-mono">{totalReceivables.toLocaleString()}</h3>
                   <span className="text-xs text-gray-400 font-bold">ر.ي</span>
                </div>
             </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-24 h-24 bg-red-50 rounded-full -translate-y-12 -translate-x-12 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center gap-4">
             <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ديون علينا (مبالغ مستحقة للدفع)</p>
                <div className="flex items-baseline gap-1">
                   <h3 className="text-2xl font-bold text-primary font-mono">{totalPayables.toLocaleString()}</h3>
                   <span className="text-xs text-gray-400 font-bold">ر.ي</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('receivable')}
            className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'receivable' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            ديون لنا (المدينون)
          </button>
          <button 
            onClick={() => setActiveTab('payable')}
            className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'payable' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            ديون علينا (الدائنون)
          </button>
        </div>

        <div className="p-4 border-b border-gray-50 flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="بحث باسم العميل أو الوصف..."
              className="w-full pr-10 pl-4 py-2 bg-background border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-background border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">الاسم / الجهة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">المبلغ الكلي</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">المتبقي</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">تاريخ الاستحقاق</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <p className="text-gray-400 text-sm">لا توجد سجلات ديون حالياً في هذا القسم</p>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => (
                  <tr key={debt.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${debt.type === 'receivable' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                           <User className="w-4 h-4" />
                        </div>
                    <div>
                      <p className="text-sm font-bold text-primary">{debt.contactName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-gray-400">{debt.description || 'بدون وصف'}</p>
                        {debt.phoneNumber && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">{debt.phoneNumber}</span>
                            <a 
                              href={`https://wa.me/${debt.phoneNumber.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-green-500 hover:bg-green-50 rounded transition-colors"
                              title="مراسلة عبر واتساب"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {debt.amount.toLocaleString()} {shopSettings?.currency || 'ر.ي'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-primary font-mono">{debt.remainingAmount.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        debt.status === 'settled' ? 'bg-green-50 text-green-600' :
                        debt.status === 'partial' ? 'bg-blue-50 text-blue-600' :
                        'bg-yellow-50 text-yellow-600'
                      }`}>
                        {debt.status === 'settled' ? 'مسدد' :
                         debt.status === 'partial' ? 'مسدد جزئياً' : 'معلق'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span className="font-mono">{debt.dueDate || 'غير محدد'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {debt.status !== 'settled' && (
                          <button 
                            onClick={() => { setIsSettling(debt); setSettlementAmount(debt.remainingAmount.toString()); }}
                            className="p-1.5 text-secondary hover:bg-secondary/10 rounded-md transition-colors text-xs font-bold flex items-center gap-1"
                            title="سداد مالي"
                          >
                             <CheckCircle2 className="w-4 h-4" />
                             سداد
                          </button>
                        )}
                        <button 
                          onClick={() => openEdit(debt)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDebtToDelete(debt)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Modal */}
      <AnimatePresence>
        {isSettling && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
             >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-secondary text-white">
                   <h3 className="font-bold">تسجيل سداد مالي</h3>
                   <button onClick={() => setIsSettling(null)}><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSettle} className="p-6 space-y-4 text-right">
                   <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">المبلغ المراد سداده</label>
                      <div className="relative mt-1">
                         <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                         <input 
                           required
                           type="number" 
                           max={isSettling.remainingAmount}
                           className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm font-mono focus:ring-2 focus:ring-secondary/50 outline-none"
                           value={settlementAmount}
                           onChange={(e) => setSettlementAmount(e.target.value)}
                         />
                      </div>
                      <p className="mt-1 text-[10px] text-secondary font-bold">المتبقي الكلي: {isSettling.remainingAmount.toLocaleString()} ر.ي</p>
                   </div>
                   <button type="submit" className="w-full btn-primary py-3">تأكيد عملية السداد</button>
                </form>
             </motion.div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {(isAdding || editingDebt) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between text-primary">
                <h3 className="font-bold">{editingDebt ? 'تعديل سجل الدين' : 'إضافة سجل دين جديد'}</h3>
                <button 
                  onClick={() => { setIsAdding(false); setEditingDebt(null); }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">اسم العميل / المورد</label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="text" 
                        placeholder="اسم الشخص أو الشركة..."
                        className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">رقم الهاتف</label>
                    <input 
                      type="text" 
                      placeholder="77xxxxxxx"
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none font-mono"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">المبلغ الكلي</label>
                    <div className="relative">
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="number"
                        placeholder="0.00"
                        className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none font-mono"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">نوع الدين</label>
                    <div className="flex gap-2 p-1 bg-background border border-gray-100 rounded-xl">
                       <button 
                         type="button"
                         onClick={() => setFormData({ ...formData, type: 'receivable' })}
                         className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formData.type === 'receivable' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400'}`}
                       >ديون لنا</button>
                       <button 
                         type="button"
                         onClick={() => setFormData({ ...formData, type: 'payable' })}
                         className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formData.type === 'payable' ? 'bg-red-500 text-white shadow-md' : 'text-gray-400'}`}
                       >ديون علينا</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">تاريخ السجل</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">تاريخ الاستحقاق (اختياري)</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">الوصف / السبب</label>
                  <textarea 
                    placeholder="اكتب ملاحظات إضافية هنا..."
                    className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none min-h-[80px]"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="submit" className="flex-1 btn-primary py-3">
                    {editingDebt ? 'تعديل السجل' : 'حفظ السجل'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingDebt(null); }}
                    className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {debtToDelete && (
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
              <h3 className="text-lg font-bold text-primary mb-2">تأكيد حذف الدين</h3>
              <p className="text-sm text-secondary mb-6">
                هل أنت متأكد من حذف هذا السجل؟ سيتم إزالته نهائياً وستفقد بيانات المتبقي والتحصيل.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  حذف السجل
                </button>
                <button 
                  onClick={() => setDebtToDelete(null)}
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
