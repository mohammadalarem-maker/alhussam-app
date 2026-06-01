import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  Receipt,
  Calendar,
  Filter,
  DollarSign,
  Tag,
  Info
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
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { logActivity } from '../../lib/activity';
import { motion, AnimatePresence } from 'motion/react';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  paymentMethod: string;
  createdBy?: string;
  userId?: string;
  updatedBy?: string;
}

const EXPENSE_CATEGORIES = [
  'إيجار',
  'كهرباء ومياه',
  'رواتب',
  'صيانة',
  'تسويق',
  'مشتريات مكتبية',
  'بترول/نقل',
  'ضرائب',
  'رسوم حكومية',
  'أخرى'
];

const PAYMENT_METHODS = [
  'نقد (Cash)',
  'تحويل بنكي',
  'بطاقة ائتمان',
  'شيك'
];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: 'أخرى',
    description: '',
    paymentMethod: 'نقد (Cash)'
  });

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
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
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'مستخدم غير معروف';
      
      const dataToSave: any = {
        ...formData,
        amount: Number(formData.amount)
      };

      if (editingExpense) {
        dataToSave.updatedBy = userName;
        await updateDoc(doc(db, 'expenses', editingExpense.id), dataToSave);
        await logActivity('تحديث بيانات مصروف', editingExpense.id, 'expenses', { amount: dataToSave.amount, category: dataToSave.category });
        notify.success('تم تحديث بيانات المصروف بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'expenses'), {
          ...dataToSave,
          createdBy: userName,
          userId: currentUser?.uid || null,
          createdAt: new Date().toISOString()
        });
        await logActivity('إضافة مصروف جديد', docRef.id, 'expenses', { amount: dataToSave.amount, category: dataToSave.category });
        notify.success('تم إضافة المصروف بنجاح');
      }
      setIsAdding(false);
      setEditingExpense(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingExpense ? OperationType.UPDATE : OperationType.CREATE, `expenses/${editingExpense?.id || ''}`);
    }
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete.id));
      await logActivity('حذف مصروف', expenseToDelete.id, 'expenses', { amount: expenseToDelete.amount });
      notify.success('تم حذف المصروف بنجاح');
      setExpenseToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${expenseToDelete.id}`);
    }
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      amount: expense.amount,
      category: expense.category,
      description: expense.description || '',
      paymentMethod: expense.paymentMethod || 'نقد (Cash)'
    });
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: 'أخرى',
      description: '',
      paymentMethod: 'نقد (Cash)'
    });
  };

  const filteredExpenses = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">إدارة المصروفات</h1>
          <p className="text-sm text-secondary mt-1">نظام {shopSettings?.shopName || 'الحسام فون'} - تتبع وتسجيل كافة المصاريف التشغيلية</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsAdding(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> إضافة مصروف
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">إجمالي المصروفات</p>
                <div className="flex items-baseline gap-1">
                   <h3 className="text-2xl font-bold text-primary font-mono">{totalExpenses.toLocaleString()}</h3>
                   <span className="text-xs text-gray-400 font-bold">ر.ي</span>
                </div>
             </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                <Receipt className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">عدد العمليات</p>
                <h3 className="text-2xl font-bold text-primary font-mono">{filteredExpenses.length}</h3>
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Filter className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">أكثر فئة صرفاً</p>
                <h3 className="text-lg font-bold text-primary">المشتريات التشغيلية</h3>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="بحث في المصروفات..."
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
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">التاريخ</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">الوصف</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">طريقة الدفع</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">المبلغ</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">لا يوجد مصروفات مسجلة حالياً</td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-mono">{expense.date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-secondary/10 text-secondary rounded-lg text-[10px] font-bold">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-primary font-medium">{expense.description || 'بدون وصف'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-400">{expense.paymentMethod || 'نقد'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-primary font-mono">{expense.amount.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEdit(expense)}
                          className="p-1.5 hover:text-primary hover:bg-secondary/10 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setExpenseToDelete(expense)}
                          className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAdding || editingExpense) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between text-primary">
                <h3 className="font-bold">{editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}</h3>
                <button 
                  onClick={() => { setIsAdding(false); setEditingExpense(null); }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">التاريخ</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">المبلغ</label>
                    <div className="relative">
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none font-mono"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">الفئة</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">طريقة الدفع</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      {PAYMENT_METHODS.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">الوصف / البيان</label>
                  <div className="relative">
                    <Info className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea 
                      placeholder="اكتب وصفاً مختصراً للمصروف..."
                      className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none min-h-[100px]"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 btn-primary py-3">
                    {editingExpense ? 'تعديل المصروف' : 'حفظ المصروف'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingExpense(null); }}
                    className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {expenseToDelete && (
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
              <h3 className="text-lg font-bold text-primary mb-2">تأكيد حذف المصروف</h3>
              <p className="text-sm text-secondary mb-6">
                هل أنت متأكد من حذف هذا المصروف؟ سيتم إزالته نهائياً من السجلات المالية.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  حذف نهائي
                </button>
                <button 
                  onClick={() => setExpenseToDelete(null)}
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
