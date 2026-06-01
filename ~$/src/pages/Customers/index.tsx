import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Trash2, 
  X,
  History,
  MoreVertical,
  FileText,
  Star
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
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { logActivity } from '../../lib/activity';
import { motion, AnimatePresence } from 'motion/react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  totalPurchases?: number;
  lastPurchaseDate?: string;
  points?: number;
  createdBy?: string;
  userId?: string;
  updatedBy?: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [invoicesSort, setInvoicesSort] = useState<{ field: 'date' | 'total', direction: 'asc' | 'desc' }>({ field: 'date', direction: 'desc' });
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!viewingCustomer) {
      setCustomerInvoices([]);
      return;
    }

    const q = query(
      collection(db, 'invoices'),
      where('customerId', '==', viewingCustomer.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomerInvoices(data);
    }, (error) => {
      console.error("Error fetching customer invoices:", error);
    });

    return () => unsubscribe();
  }, [viewingCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'مستخدم غير معروف';

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          ...formData,
          updatedBy: userName
        });
        await logActivity('تحديث بيانات عميل', editingCustomer.id, 'customers', { name: formData.name });
        notify.success('تم تحديث بيانات العميل بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'customers'), {
          ...formData,
          createdBy: userName,
          userId: currentUser?.uid || null,
          createdAt: new Date().toISOString()
        });
        await logActivity('إضافة عميل جديد', docRef.id, 'customers', { name: formData.name });
        notify.success('تم إضافة العميل بنجاح');
      }
      setIsAdding(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', address: '' });
    } catch (error) {
      handleFirestoreError(error, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, 'customers');
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    try {
      await deleteDoc(doc(db, 'customers', customerToDelete.id));
      await logActivity('حذف عميل', customerToDelete.id, 'customers', { name: customerToDelete.name });
      notify.success('تم حذف العميل بنجاح');
      setCustomerToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${customerToDelete.id}`);
    }
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address
    });
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">إدارة العملاء</h1>
          <p className="text-sm text-secondary mt-1">نظام الحسام فون</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> عميل جديد
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="بحث باسم العميل أو رقم الهاتف..."
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
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">العميل</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">التواصل</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">العنوان</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">النقاط</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">إحصائيات</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">لا يوجد عملاء مطابقين للبحث</td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-primary">{customer.name}</p>
                          <p className="text-xs text-gray-400">ID: {customer.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-xs text-secondary">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {customer.address || 'غير محدد'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-amber-500 font-black">
                        <Star className="w-4 h-4 fill-current" />
                        <span>{customer.points || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-primary">
                          {customer.totalPurchases?.toLocaleString() || 0} ر.ي
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          آخر شراء: {customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : 'لا يوجد'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setViewingCustomer(customer)}
                          className="p-1.5 hover:text-secondary hover:bg-secondary/10 rounded-md transition-colors"
                          title="عرض التفاصيل"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEdit(customer)}
                          className="p-1.5 hover:text-primary hover:bg-secondary/10 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setCustomerToDelete(customer)}
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
        <div className="md:hidden divide-y divide-gray-100">
           {loading ? (
             <div className="px-6 py-20 text-center text-gray-400">جاري التحميل...</div>
           ) : filteredCustomers.length === 0 ? (
             <div className="px-6 py-20 text-center text-gray-400">لا يوجد عملاء مطابقين للبحث</div>
           ) : (
             filteredCustomers.map((customer) => (
                <div 
                  key={customer.id} 
                  className="p-4 flex gap-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setViewingCustomer(customer)}
                >
                  <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-primary truncate">{customer.name}</h4>
                      <div className="flex items-center gap-1 text-amber-500 font-bold text-[10px]">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{customer.points || 0}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-secondary font-mono">
                          <Phone className="w-3 h-3" />
                          {customer.phone || 'بدون هاتف'}
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">
                           مشتريات: {(customer.totalPurchases || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEdit(customer); }}
                          className="p-1.5 text-primary bg-primary/5 rounded-lg"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCustomerToDelete(customer); }}
                          className="p-1.5 text-red-600 bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
             ))
           )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAdding || editingCustomer) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between text-primary">
                <h3 className="font-bold">{editingCustomer ? 'تعديل بيانات عميل' : 'إضافة عميل جديد'}</h3>
                <button 
                  onClick={() => { setIsAdding(false); setEditingCustomer(null); }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">اسم العميل</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">رقم الهاتف</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="tel" 
                      className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="email" 
                      className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">عنوان العميل</label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea 
                      className="w-full pr-10 pl-4 py-3 bg-background border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-secondary/50 outline-none min-h-[100px]"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 btn-primary py-3">
                    {editingCustomer ? 'حفظ التعديلات' : 'إضافة العميل'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingCustomer(null); }}
                    className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {customerToDelete && (
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
              <h3 className="text-lg font-bold text-primary mb-2">تأكيد حذف العميل</h3>
              <p className="text-sm text-secondary mb-6">
                هل أنت متأكد من حذف العميل <span className="font-bold text-primary">"{customerToDelete.name}"</span>؟ لا يمكن التراجع عن هذه العملية.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  حذف العميل
                </button>
                <button 
                  onClick={() => setCustomerToDelete(null)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {viewingCustomer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between text-primary bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl">{viewingCustomer.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">سجل المعاملات والفواتير</p>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full text-amber-600 border border-amber-100">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-black">{viewingCustomer.points || 0} نقطة</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingCustomer(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">إجمالي المشتريات</p>
                    <p className="text-xl font-black text-primary">{(viewingCustomer.totalPurchases || 0).toLocaleString()} <span className="text-xs">ر.ي</span></p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-[10px] font-black text-amber-500 uppercase mb-1">النقاط المجمعة</p>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-current" />
                      <p className="text-xl font-black text-amber-600">{viewingCustomer.points || 0}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">آخر عملية شراء</p>
                    <p className="text-sm font-bold text-secondary">
                      {viewingCustomer.lastPurchaseDate ? new Date(viewingCustomer.lastPurchaseDate).toLocaleDateString('ar-YE') : 'لا يوجد'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 text-right">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    قائمة الفواتير
                  </h4>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setInvoicesSort(prev => ({ field: 'date', direction: prev.field === 'date' ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                      className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${invoicesSort.field === 'date' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-400 border-gray-200'}`}
                    >
                      التاريخ {invoicesSort.field === 'date' && (invoicesSort.direction === 'asc' ? '↑' : '↓')}
                    </button>
                    <button 
                      onClick={() => setInvoicesSort(prev => ({ field: 'total', direction: prev.field === 'total' ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                      className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${invoicesSort.field === 'total' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-400 border-gray-200'}`}
                    >
                      المبلغ {invoicesSort.field === 'total' && (invoicesSort.direction === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {[...customerInvoices].sort((a, b) => {
                    const dir = invoicesSort.direction === 'asc' ? 1 : -1;
                    if (invoicesSort.field === 'date') {
                      return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
                    }
                    return ((a.total || 0) - (b.total || 0)) * dir;
                  }).map((inv) => (
                    <div key={inv.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between hover:border-primary/30 transition-all group text-right">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{inv.number}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {new Date(inv.date).toLocaleString('ar-YE')}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-primary font-mono">{inv.total?.toLocaleString()} <span className="text-[10px]">ر.ي</span></p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {inv.status === 'paid' ? 'مكتملة' : 'آجلة'}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {customerInvoices.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
                        <FileText className="w-8 h-8" />
                      </div>
                      <p className="text-gray-400 font-bold">لا توجد فواتير مسجلة لهذا العميل</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex justify-end">
                <button 
                  onClick={() => setViewingCustomer(null)}
                  className="px-10 py-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-700 hover:bg-gray-100 transition-all shadow-sm active:scale-95"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
