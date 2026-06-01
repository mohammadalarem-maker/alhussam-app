import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Download,
  Calendar,
  X,
  User,
  Printer,
  Trash2,
  FileDown
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { logActivity } from '../../lib/activity';
import { Link } from 'react-router-dom';
import { exportToPDF } from '../../lib/pdfExport';

interface Invoice {
  id: string;
  number: string;
  customer?: string;
  date: string;
  total: number;
  status: 'paid' | 'unpaid' | 'draft';
  paymentType?: 'cash' | 'card';
  paymentTerms?: string;
  items?: { name: string, qty: number, price: number }[];
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTerms, setEditTerms] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<'cash' | 'card' | ''>('');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);

  const paymentTermsOptions = [
    'الدفع عند الاستلام (Due on Receipt)',
    'صافي 15 يوم (Net 15)',
    'صافي 30 يوم (Net 30)',
    'صافي 60 يوم (Net 60)',
  ];

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      setInvoices(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    });

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

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setShopSettings(ensureSettingsDefaults(snap.data()));
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> مدفوعة</span>;
      case 'unpaid':
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold"><AlertCircle className="w-3 h-3" /> غير مدفوعة</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-gray-600 rounded-full text-[10px] font-bold"><Clock className="w-3 h-3" /> مسودة</span>;
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.number?.includes(searchTerm) || 
    inv.customer?.includes(searchTerm)
  );

  const printInvoice = () => {
    window.print();
  };

  const downloadInvoicePDF = async () => {
    if (!selectedInvoice) return;
    await exportToPDF('invoice-print', `invoice_${selectedInvoice.number}`);
  };

  const updateInvoiceDetails = async () => {
    if (!selectedInvoice) return;
    try {
      const invoiceRef = doc(db, 'invoices', selectedInvoice.id);
      const updates: any = { paymentTerms: editTerms };
      if (editPaymentType) updates.paymentType = editPaymentType;
      
      await updateDoc(invoiceRef, updates);
      await logActivity('تعديل فاتورة', selectedInvoice.id, 'invoices', { number: selectedInvoice.number });
      notify.success('تم تحديث بيانات الفاتورة بنجاح');
      
      setSelectedInvoice({ 
        ...selectedInvoice, 
        paymentTerms: editTerms,
        paymentType: (editPaymentType || selectedInvoice.paymentType) as any
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${selectedInvoice.id}`);
    }
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      await logActivity('حذف فاتورة', invoiceToDelete.id, 'invoices', { number: invoiceToDelete.number });
      notify.success('تم حذف الفاتورة بنجاح');
      setInvoiceToDelete(null);
      if (selectedInvoice?.id === invoiceToDelete.id) {
        setSelectedInvoice(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invoices/${invoiceToDelete.id}`);
    }
  };

  const exportToCSV = () => {
    const headers = ["رقم الفاتورة", "العميل", "التاريخ", "الإجمالي", "الحالة"];
    const rows = filteredInvoices.map(inv => [
      inv.number,
      inv.customer || 'عميل نقدي',
      new Date(inv.date).toLocaleDateString(),
      inv.total,
      inv.status
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + "\uFEFF" // UTF-8 BOM
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoices_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">فواتير المبيعات</h1>
          <p className="text-sm text-secondary mt-1">سجل المبيعات - {shopSettings?.shopName || 'الحسام فون'}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> تصدير Excel
          </button>
          <Link to="/pos" className="btn-primary">
            <Plus className="w-4 h-4" /> فاتورة جديدة
          </Link>
        </div>
      </div>

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
              <p className="text-sm text-secondary mb-6">
                هل أنت متأكد من حذف الفاتورة رقم <span className="font-bold text-primary">"{invoiceToDelete.number}"</span>؟ سيتم إزالتها نهائياً من السجلات.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  حذف الفاتورة
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

        {selectedInvoice && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:inset-0 print:z-[200]">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] print:max-h-full print:rounded-none print:shadow-none"
             >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary text-white print:hidden">
                   <h3 className="font-bold">تفاصيل الفاتورة: {selectedInvoice.number}</h3>
                   <button onClick={() => setSelectedInvoice(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                
                <div className="p-8 space-y-6 overflow-y-auto flex-1 font-sans print:overflow-visible" id="invoice-print">
                   <div className="flex justify-between items-start">
                      <div className="flex items-start gap-4">
                         {shopSettings?.logoUrl && (
                           <img src={shopSettings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                         )}
                         <div>
                            <h2 className="text-3xl font-black text-primary">{shopSettings?.shopName || 'الحسام فون'}</h2>
                            <p className="text-sm text-gray-400">{shopSettings?.shopPhone && `تلفون: ${shopSettings.shopPhone}`}</p>
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

        {/* Mobile List View */}
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
    </div>
  );
}
