import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
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
  deleteDoc 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { logActivity } from '../../lib/activity';
import { motion, AnimatePresence } from 'motion/react';

interface Category {
  id: string;
  name: string;
  description: string;
  createdBy?: string;
  userId?: string;
  updatedBy?: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'مستخدم غير معروف';

      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), {
          ...formData,
          updatedBy: userName
        });
        await logActivity('تحديث فئة المنتجات', editingCategory.id, 'categories', { name: formData.name });
        notify.success('تم تحديث الفئة بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'categories'), {
          ...formData,
          createdBy: userName,
          userId: currentUser?.uid || null,
          createdAt: new Date().toISOString()
        });
        await logActivity('إضافة فئة منتجات جديدة', docRef.id, 'categories', { name: formData.name });
        notify.success('تم إضافة الفئة الجديدة بنجاح');
      }
      setIsAdding(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, editingCategory ? OperationType.UPDATE : OperationType.CREATE, `categories/${editingCategory?.id || ''}`);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteDoc(doc(db, 'categories', categoryToDelete.id));
      await logActivity('حذف فئة منتجات', categoryToDelete.id, 'categories', { name: categoryToDelete.name });
      notify.success('تم حذف الفئة بنجاح');
      setCategoryToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${categoryToDelete.id}`);
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || ''
    });
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary">إدارة فئات المنتجات</h1>
          <p className="text-[10px] md:text-sm text-secondary mt-1">تحديد وتصنيف منتجات المخزن لسهولة الترتيب والبحث</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary py-2 px-4 text-sm"
        >
          <Plus className="w-4 h-4" /> فئة جديدة
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="بحث في الفئات..."
              className="w-full pr-10 pl-4 py-2 bg-background border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-background border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">الوصف</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">لا يوجد فئات مضافة حالياً</td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary">
                          <Tag className="w-4 h-4" />
                        </div>
                        <p className="font-bold text-primary">{category.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-secondary truncate max-w-xs">{category.description || 'لا يوجد وصف'}</p>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEdit(category)}
                          className="p-1.5 hover:text-primary hover:bg-secondary/10 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setCategoryToDelete(category)}
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

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-gray-50">
          {loading ? (
             <div className="px-6 py-12 text-center text-gray-400 text-sm">جاري التحميل...</div>
          ) : filteredCategories.length === 0 ? (
             <div className="px-6 py-12 text-center text-gray-400 text-sm">لا يوجد فئات مضافة حالياً</div>
          ) : (
            filteredCategories.map((category) => (
              <div 
                key={category.id} 
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary">{category.name}</h4>
                    <p className="text-[10px] text-secondary truncate max-w-[150px]">{category.description || 'لا يوجد وصف'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => openEdit(category)}
                    className="p-2 text-primary bg-primary/5 rounded-lg"
                   >
                     <Edit2 className="w-3.5 h-3.5" />
                   </button>
                   <button 
                    onClick={() => setCategoryToDelete(category)}
                    className="p-2 text-red-600 bg-red-50 rounded-lg"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAdding || editingCategory) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between text-primary">
                <h3 className="font-bold">{editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</h3>
                <button 
                  onClick={() => { setIsAdding(false); setEditingCategory(null); }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">اسم الفئة</label>
                  <div className="relative">
                    <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      required
                      type="text" 
                      className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">وصف الفئة</label>
                  <div className="relative">
                    <Info className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea 
                      className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none min-h-[100px]"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 btn-primary py-3">
                    {editingCategory ? 'حفظ التعديلات' : 'إضافة الفئة'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingCategory(null); }}
                    className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {categoryToDelete && (
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
              <h3 className="text-lg font-bold text-primary mb-2">تأكيد حذف الفئة</h3>
              <p className="text-sm text-secondary mb-6">
                هل أنت متأكد من حذف الفئة <span className="font-bold text-primary">"{categoryToDelete.name}"</span>؟ سيتم حذف التصنيف من جميع المنتجات المرتبطة.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  حذف الفئة
                </button>
                <button 
                  onClick={() => setCategoryToDelete(null)}
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
