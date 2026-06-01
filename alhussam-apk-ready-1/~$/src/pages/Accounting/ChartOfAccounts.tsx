import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  FileText, 
  Search,
  ArrowRightLeft,
  X,
  Edit2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  isAnalytical: boolean;
  balance: number;
  parentId: string | null;
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<any>({
    code: '',
    name: '',
    type: 'asset',
    isAnalytical: true,
    parentId: null
  });
  const [shopSettings, setShopSettings] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'accounts'), orderBy('code', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(data);
      
      // Auto-expand top level if empty previous expanded state
      if (Object.keys(expanded).length === 0) {
        const topLevel = data.filter(a => !a.parentId).map(a => a.id);
        const autoExp: Record<string, boolean> = {};
        topLevel.forEach(id => { autoExp[id] = true; });
        setExpanded(autoExp);
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
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
      if (editingAccount) {
        await updateDoc(doc(db, 'accounts', editingAccount.id), formData);
      } else {
        await addDoc(collection(db, 'accounts'), formData);
      }
      setIsAdding(false);
      setEditingAccount(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingAccount ? OperationType.UPDATE : OperationType.CREATE, `accounts/${editingAccount?.id || ''}`);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'asset',
      isAnalytical: true,
      parentId: null
    });
  };

  const seedInitialAccounts = async () => {
    const initialAccounts = [
      { code: '1', name: 'الأصول', type: 'asset', isAnalytical: false, parentId: null },
      { code: '2', name: 'الخصوم', type: 'liability', isAnalytical: false, parentId: null },
      { code: '3', name: 'حقوق الملكية', type: 'equity', isAnalytical: false, parentId: null },
      { code: '4', name: 'الإيرادات', type: 'revenue', isAnalytical: false, parentId: null },
      { code: '5', name: 'المصروفات', type: 'expense', isAnalytical: false, parentId: null },
    ];

    try {
      setLoading(true);
      for (const acc of initialAccounts) {
        await addDoc(collection(db, 'accounts'), acc);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'accounts/seed');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      isAnalytical: account.isAnalytical,
      parentId: account.parentId
    });
    setIsAdding(true);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderAccounts = (parentId: string | null = null, depth = 0) => {
    const filtered = accounts.filter(acc => {
      const matchesParent = acc.parentId === parentId;
      const matchesSearch = acc.name.includes(searchTerm) || acc.code.includes(searchTerm);
      return searchTerm ? matchesSearch : matchesParent;
    });

    if (searchTerm && parentId !== null) return null; // Simplified list when searching

    return filtered.map(account => {
      const hasChildren = accounts.some(a => a.parentId === account.id);
      const isExp = expanded[account.id];

      return (
        <React.Fragment key={account.id}>
          <tr className={`hover:bg-secondary/5 transition-colors cursor-pointer group ${!account.isAnalytical ? 'font-bold text-primary' : 'text-gray-600'}`}>
            <td className="px-6 py-4">
              <div 
                className="flex items-center gap-2" 
                style={{ marginRight: `${depth * 24}px` }}
                onClick={() => hasChildren && toggleExpand(account.id)}
              >
                {hasChildren ? (
                  isExp ? <ChevronDown className="w-4 h-4 text-secondary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                ) : (
                  <div className="w-4" />
                )}
                {account.isAnalytical ? (
                  <FileText className="w-4 h-4 text-gray-400" />
                ) : (
                  <Folder className="w-4 h-4 text-secondary" />
                )}
                <span className="font-mono text-xs">{account.code}</span>
              </div>
            </td>
            <td className="px-6 py-4 text-sm">{account.name}</td>
            <td className="px-6 py-4">
               <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                 account.type === 'asset' ? 'bg-green-100 text-green-700' : 
                 account.type === 'liability' ? 'bg-red-100 text-red-700' :
                 account.type === 'revenue' ? 'bg-blue-100 text-blue-700' :
                 'bg-gray-100 text-gray-700'
               }`}>
                 {account.type === 'asset' ? 'أصول' : 
                  account.type === 'liability' ? 'خصوم' : 
                  account.type === 'equity' ? 'حقوق ملكية' : 
                  account.type === 'revenue' ? 'إيرادات' : 'مصروفات'}
               </span>
            </td>
            <td className="px-6 py-4 text-xs">
              {account.isAnalytical ? 'تحليلي' : 'رئيسي'}
            </td>
            <td className="px-6 py-4 text-left font-mono text-sm">
              {(account.balance || 0).toLocaleString()} {shopSettings?.currency || 'ر.ي'}
            </td>
            <td className="px-6 py-4 text-left opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={(e) => { e.stopPropagation(); openEdit(account); }}
                 className="p-1 hover:text-secondary hover:bg-secondary/10 rounded transition-colors"
               >
                  <Edit2 className="w-3 h-3" />
               </button>
            </td>
          </tr>
          {hasChildren && isExp && !searchTerm && renderAccounts(account.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">دليل الحسابات (الشجرة)</h1>
          <p className="text-sm text-secondary mt-1">نظام {shopSettings?.shopName || 'الحسام فون'}</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-200 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> ميزان المراجعة
          </button>
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> إضافة حساب
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-50">
           <div className="relative max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="بحث في الحسابات..." 
                className="w-full bg-background border border-gray-200 rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-background border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">رقم الحساب</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">اسم الحساب</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">النوع</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">المستوى</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-left">الرصيد الحالي</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <Folder className="w-8 h-8" />
                      </div>
                      <div className="text-gray-400 max-w-xs mx-auto">
                        <p className="font-bold text-gray-600 mb-1">دليل الحسابات فارغ</p>
                        <p className="text-xs">يجب عليك إنشاء شجرة الحسابات لتبدأ العمليات المحاسبية بشكل صحيح.</p>
                      </div>
                      <button 
                        onClick={seedInitialAccounts}
                        className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary/90 transition-all shadow-lg"
                      >
                         إنشاء الحسابات الرئيسية المحاسبية
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                renderAccounts()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between text-primary">
                <h3 className="font-bold">{editingAccount ? 'تعديل حساب' : 'إضافة حساب جديد'}</h3>
                <button 
                  onClick={() => { setIsAdding(false); setEditingAccount(null); }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">رقم الحساب (الكود)</label>
                    <input 
                      required
                      type="text" 
                      placeholder="مثلاً: 1101"
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none font-mono"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">نوع الحساب</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="asset">أصول</option>
                      <option value="liability">خصوم</option>
                      <option value="equity">حقوق ملكية</option>
                      <option value="revenue">إيرادات</option>
                      <option value="expense">مصروفات</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">اسم الحساب</label>
                  <input 
                    required
                    type="text" 
                    placeholder="مثلاً: البنك التجاري"
                    className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">الحساب الأب</label>
                  <select 
                    className="w-full px-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                    value={formData.parentId || ''}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}
                  >
                    <option value="">لا يوجد (حساب جذر)</option>
                    {accounts.filter(a => !a.isAnalytical).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <input 
                    type="checkbox"
                    id="isAnalytical"
                    className="w-4 h-4 text-secondary rounded border-gray-300 focus:ring-secondary"
                    checked={formData.isAnalytical}
                    onChange={(e) => setFormData({ ...formData, isAnalytical: e.target.checked })}
                  />
                  <label htmlFor="isAnalytical" className="text-sm font-bold text-primary cursor-pointer">
                    حساب تحليلي (يقبل قيود اليومية)
                  </label>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 btn-primary py-3">
                    {editingAccount ? 'تعديل البيانات' : 'إضافة الحساب'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingAccount(null); }}
                    className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
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
