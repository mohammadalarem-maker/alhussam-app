import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Eye, 
  Download, 
  Printer, 
  Filter, 
  ArrowXpt 
} from 'lucide-react';
import InvoiceModal from '../../../components/InvoiceModal';
import InvoiceDetailsModal from '../../../components/InvoiceDetailsModal';

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Invoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  type: 'cash' | 'debt';
  status: 'paid' | 'unpaid' | 'partially_paid';
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  notes?: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      setInvoices(list);
      setLoading(false);
    });

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'shop'), (doc) => {
      if (doc.exists()) setShopSettings(doc.data());
    });

    return () => {
      unsubscribe();
      settingsUnsubscribe();
    };
  }, []);

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      setInvoiceToDelete(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.number.toLowerCase().includes(search.toLowerCase()) ||
      (invoice.customer && invoice.customer.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-green-50 text-green-600">مدفوع</span>;
      case 'unpaid':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-600">غير مدفوع</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-50 text-orange-600">مدفوع جزئياً</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-primary">الفواتير</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة وفحص فواتير المبيعات</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          <span>فاتورة جديدة</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="بحث برقم الفاتورة أو العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary transition-all text-sm outline-none"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-40 px-3 py-2 bg-gray-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-primary transition-all"
          >
            <option value="all">كل الفواتير</option>
            <option value="paid">مدفوعة</option>
            <option value="unpaid">غير مدفوعة</option>
            <option value="partially_paid">جزئية</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-xs font-bold uppercase">
                <th className="px-6 py-4">رقم الفاتورة</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4 text-left">الإجمالي</th>
                <th className="px-6 py-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">جاري تحميل البيانات...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">لا توجد فواتير مطابقة</td>
                </tr>
              ) : filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50/50 transition-colors text-sm">
                  <td className="px-6 py-4 font-mono font-bold text-gray-600">{invoice.number}</td>
                  <td className="px-6 py-4 font-black text-primary">{invoice.customer || 'عميل نقدي'}</td>
                  <td className="px-6 py-4 text-gray-500">{new Date(invoice.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{getStatusBadge(invoice.status)}</td>
                  <td className="px-6 py-4 text-left font-black text-primary font-mono">
                    {invoice.total.toLocaleString()} {shopSettings?.currency || 'ر.ي'}
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-secondary/10 rounded-md transition-colors"
                        title="عرض"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setInvoiceToDelete(invoice)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-50">
          {loading ? (
            <div className="px-6 py-20 text-center text-gray-400">جاري تحميل الفواتير...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="px-6 py-20 text-center text-gray-400">لا توجد فواتير حالياً</div>
          ) : filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="p-4 hover:bg-background/50 active:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setSelectedInvoice(invoice)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <FileText className="w-4 h-4 text-secondary" />
                  {invoice.number}
                </div>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-medium text-primary">{invoice.customer || 'عميل نقدي'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(invoice.date).toLocaleDateString()}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-primary font-mono">
                    {invoice.total.toLocaleString()} <span className="text-[10px] opacity-60">{shopSettings?.currency || 'ر.ي'}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAddModalOpen && (
        <InvoiceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      )}

      {selectedInvoice && (
        <InvoiceDetailsModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}

      {invoiceToDelete && (
        <div className="modal-overlay">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full mx-4 shadow-xl border border-gray-100 text-center animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-primary mb-2">تأكيد الحذف</h3>
            <p className="text-gray-500 text-sm mb-6">هل أنت متأكد من حذف الفاتورة رقم <span className="font-mono font-bold text-primary">{invoiceToDelete.number}</span>؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setInvoiceToDelete(null)} className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors w-full">إلغاء</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20 transition-colors w-full">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
ne}`}</p>
                            <p className="text-xs text-secondary mt-1">{shopSettings?.shopAddress}</p>
                         </div>
                      </div>
                      <div className="text-left">
                         <div className="bg-primary text-white px-4 py-2 rounded-lg mb-2 print:border print:border-primary print:text-primary print:bg-white inline-block">
                            <h3 className="text-xl font-bold">فاتورة ضريبية</h3>
                         </div>
                         <p className="text-sm text-gray-500 font-mono text-left">{selectedInvoice.number}</p>
                      </div>
                   </div>

                   <hr className="border-gray-100" />

                   <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                         <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">العميل</p>
                         <div className="flex items-center gap-2 text-primary font-bold">
                            <User className="w-4 h-4" />
                            {selectedInvoice.customer || 'عميل نقدي'}
                         </div>
                      </div>
                      <div className="space-y-1 text-center">
                         <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">طريقة الدفع</p>
                         {isEditing ? (
                           <select
                             className="w-full text-xs bg-background border border-gray-200 rounded p-1"
                             value={editPaymentType}
                             onChange={(e) => setEditPaymentType(e.target.value as any)}
                           >
                             <option value="cash">نقدي</option>
                             <option value="card">فيزا / شبكة</option>
                           </select>
                         ) : (
                           <p className="text-primary font-bold">
                             {selectedInvoice.paymentType === 'cash' ? 'نقدي' :
                              selectedInvoice.paymentType === 'card' ? 'فيزا / شبكة' : 'غير محدد'}
                           </p>
                         )}
                      </div>
                      <div className="space-y-1 text-center">
                         <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">شروط الدفع</p>
                         {isEditing ? (
                           <select
                            className="w-full text-xs bg-background border border-gray-200 rounded p-1"
                            value={editTerms}
                            onChange={(e) => setEditTerms(e.target.value)}
                           >
                             <option value="">اختر الشروط...</option>
                             {paymentTermsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                           </select>
                         ) : (
                           <p className="text-primary font-bold">{selectedInvoice.paymentTerms || 'غير محدد'}</p>
                         )}
                      </div>
                      <div className="space-y-1 text-left">
                         <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">التاريخ</p>
                         <p className="text-primary font-bold font-mono">
                            {new Date(selectedInvoice.date).toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })}
                         </p>
                      </div>
                   </div>

                   <table className="w-full text-right border-collapse">
                      <thead className="bg-background">
                         <tr>
                            <th className="p-4 text-xs font-bold text-gray-400">الصنف</th>
                            <th className="p-4 text-xs font-bold text-gray-400 text-center">الكمية</th>
                            <th className="p-4 text-xs font-bold text-gray-400 text-center">السعر</th>
                            <th className="p-4 text-xs font-bold text-gray-400 text-left">الإجمالي</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                         {selectedInvoice.items?.map((item, idx) => (
                           <tr key={idx} className="text-sm">
                              <td className="p-4 font-bold text-primary">{item.name}</td>
                              <td className="p-4 text-center text-gray-600">{item.qty}</td>
                              <td className="p-4 text-center text-gray-600">{item.price.toLocaleString()}</td>
                              <td className="p-4 text-left font-bold text-primary">{(item.qty * item.price).toLocaleString()}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>

                   <div className="pt-6 border-t border-gray-100">
                      <div className="w-64 mr-auto space-y-2">
                         <div className="flex justify-between text-xl font-black text-primary pt-2 border-t border-gray-50">
                            <span>الإجمالي</span>
                            <span className="font-mono">{selectedInvoice.total.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</span>
                         </div>
                      </div>
                   </div>

                   <div className="mt-12 text-center text-[10px] text-gray-400 space-y-1 print:mt-20 leading-relaxed">
                      <p className="font-bold text-gray-600 whitespace-pre-line">{shopSettings?.receiptNotes || 'شكراً لتعاملكم معنا - زيارتكم تسرنا'}</p>
                      <p className="text-[8px] opacity-70">تم استخراج الفاتورة بواسطة نظام {shopSettings?.shopName || 'الحسام فون'} السحابي</p>
                   </div>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4 print:hidden">
                    {isEditing ? (
                       <>
                          <button onClick={updateInvoiceDetails} className="flex-1 btn-primary justify-center py-3">
                             حفظ التعديلات
                          </button>
                          <button onClick={() => setIsEditing(false)} className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-white transition-colors">
                             إلغاء
                          </button>
                       </>
                    ) : (
                       <>
                          <button onClick={printInvoice} className="flex-1 btn-primary justify-center py-3">
                             <Printer className="w-4 h-4" /> طباعة
                          </button>
                          <button onClick={downloadInvoicePDF} className="flex-1 bg-secondary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 py-3 hover:bg-secondary/90 transition-all">
                             <Download className="w-4 h-4" /> تحميل PDF
                          </button>
                          <button
                            onClick={() => {
                              setEditTerms(selectedInvoice.paymentTerms || '');
                              setEditPaymentType(selectedInvoice.paymentType || 'cash');
                              setIsEditing(true);
                            }}
                            className="btn-secondary py-3 flex-1"
                          >
                             تعديل البيانات
                          </button>
                          <button
                            onClick={() => setInvoiceToDelete(selectedInvoice)}
                            className="bg-red-50 text-red-600 border border-red-100 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => setSelectedInvoice(null)} className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-white transition-colors">
                             إغلاق
                          </button>
                       </>
                    )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="البحث برقم الفاتورة أو اسم العميل..."
              className="w-full bg-background border border-gray-200 rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-secondary hover:bg-background transition-colors">
            <Calendar className="w-4 h-4" /> الفترة الزمنية
          </button>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-background border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">رقم الفاتورة</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">العميل</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">التاريخ</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الإجمالي</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">جاري تحميل الفواتير...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">لا توجد فواتير حالياً</td>
                </tr>
              ) : filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-background/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm">
                       <FileText className="w-4 h-4 text-secondary group-hover:scale-110 transition-transform" />
                       {invoice.number}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-primary">{invoice.customer || 'عميل نقدي'}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {new Date(invoice.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-primary font-mono">
                    {invoice.total.toLocaleString()} {shopSettings?.currency || 'ر.ي'}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td className="px-6 py-4 text-left">
                     <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-secondary/10 rounded-md transition-colors"
                          onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); setTimeout(downloadInvoicePDF, 500); }}
                          title="تحميل PDF"
                        >
                           <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-secondary/10 rounded-md transition-colors"
                          onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); setTimeout(printInvoice, 100); }}
                          title="طباعة"
                        >
                           <Printer className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          onClick={(e) => { e.stopPropagation(); setInvoiceToDelete(invoice); }}
                          title="حذف"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-50">
          {loading ? (
            <div className="px-6 py-20 text-center text-gray-400">جاري تحميل الفواتير...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="px-6 py-20 text-center text-gray-400">لا توجد فواتير حالياً</div>
          ) : filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="p-4 hover:bg-background/50 active:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setSelectedInvoice(invoice)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                   <FileText className="w-4 h-4 text-secondary" />
                   {invoice.number}
                </div>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-medium text-primary">{invoice.customer || 'عميل نقدي'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(invoice.date).toLocaleDateString()}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-primary font-mono">
                    {invoice.total.toLocaleString()} <span className="text-[10px] opacity-60">{shopSettings?.currency || 'ر.ي'}</span>
                  </p>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
  
