import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  User,
  X,
  CreditCard,
  Banknote,
  ScanLine,
  Camera,
  CheckCircle,
  AlertCircle,
  Printer,
  Wallet,
  Star,
  RefreshCw
} from 'lucide-react';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { logActivity } from '../../lib/activity';

interface POSItem {
  id: string;
  name: string;
  price: number;
  category: string;
  code?: string;
  stock: number;
  unit: string;
  minStock?: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  points?: number;
}

const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Primary chime
    const playChime = (freq: number, startTime: number, duration: number, vol = 0.1) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gainNode.gain.setValueAtTime(vol, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Ascending melody (C5 -> E5 -> G5)
    playChime(523.25, now, 0.15, 0.08);      // C5
    playChime(659.25, now + 0.08, 0.15, 0.08); // E5
    playChime(783.99, now + 0.16, 0.3, 0.1);   // G5
    
    // Cash register "clink" (high pitch short click)
    playChime(1975.53, now + 0.18, 0.05, 0.15); // B6 / high register "ding"
  } catch (error) {
    console.warn("Failed to play audio feedback:", error);
  }
};

export default function POS() {
  const [items, setItems] = useState<POSItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categoriesData, setCategoriesData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{item: POSItem, qty: number, price: number}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [showScanner, setShowScanner] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'wallet' | 'debt'>('cash');
  const [selectedWallet, setSelectedWallet] = useState('الكريمي (M-Floos)');
  const [allowOverSell, setAllowOverSell] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [customerName, setCustomerName] = useState('عميل نقدي');
  const [customerType, setCustomerType] = useState<'guest' | 'registered'>('guest');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('الدفع عند الاستلام (Due on Receipt)');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);

  const yemeniWallets = [
    'الكريمي (M-Floos)',
    'بيس (Pyes)',
    'ون كاش (One Cash)',
    'يسر (Yousur)',
    'شامل موني (Shamil Money)',
    'تضامن باي (Tadhamon Pay)',
    'موبايلي موني (Mobily Money)',
    'جيب (Jeeb)',
    'جوالي (Jawali)',
  ];

  const paymentTermsOptions = [
    'الدفع عند الاستلام (Due on Receipt)',
    'صافي 15 يوم (Net 15)',
    'صافي 30 يوم (Net 30)',
    'صافي 60 يوم (Net 60)',
  ];

  useEffect(() => {
    const unsubItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as POSItem[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs
        .map(doc => (doc.data() as any).name)
        .map(name => typeof name === 'string' ? name.trim() : '')
        .filter(Boolean);
      const uniqueCats = Array.from(new Set(cats));
      setCategoriesData(['الكل', ...uniqueCats]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubItems();
      unsubCustomers();
      unsubCategories();
      unsubSettings();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length > 3) {
      const exactMatch = items.find(i => i.code === searchTerm.trim());
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
      }
    }
  }, [searchTerm, items]);

  const addToCart = (item: POSItem) => {
    if (item.stock <= 0) {
      notify.error("عذراً، هذا الصنف غير متوفر في المخزن!");
      return;
    }
    
    let alreadyInCart = false;
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        alreadyInCart = true;
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item, qty: 1, price: item.price }];
    });

    if (!alreadyInCart) {
      notify.success(`${item.name} تمت إضافته للسلة`);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    const item = items.find(p => p.code === barcode);
    if (item) {
      addToCart(item);
    } else {
      notify.error("المنتج غير موجود!");
    }
  };

  const updateQty = (id: string, value: number | string) => {
    setCart(prev => {
      const item = prev.find(i => i.item.id === id);
      if (!item) return prev;

      let newQty: number;
      if (typeof value === 'string') {
        newQty = parseInt(value) || 0;
      } else {
        newQty = Math.max(0, item.qty + value);
      }
      
      if (newQty === 0) {
        return prev.filter(i => i.item.id !== id);
      }

      // Check if newQty exceeds stock
      if (newQty > item.item.stock && !allowOverSell) {
        notify.error(`العذر، الكمية المتاحة هي ${item.item.stock} فقط`);
        return prev.map(i => i.item.id === id ? { ...i, qty: item.item.stock } : i);
      }

      return prev.map(i => i.item.id === id ? { ...i, qty: newQty } : i);
    });
  };

  const updatePrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(i => i.item.id === id ? { ...i, price: newPrice } : i));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.item.id !== id));
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    const invoiceId = `INV-${Date.now()}`;
    try {
      const invoiceResult = await runTransaction(db, async (transaction) => {
        // 1. Check stock for all items
        for (const cartItem of cart) {
          const itemRef = doc(db, 'items', cartItem.item.id);
          const itemSnap = await transaction.get(itemRef);
          if (!itemSnap.exists()) throw new Error(`Item ${cartItem.item.name} not found`);
          const currentStock = itemSnap.data().stock || 0;
          if (!allowOverSell && currentStock < cartItem.qty) {
            throw new Error(`كمية غير كافية من ${cartItem.item.name} (المتوفر: ${currentStock})`);
          }
        }

        // 2. Update stock and create invoice
        const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const grandTotal = total;

        const isDebt = paymentType === 'debt' || paymentTerms !== 'الدفع عند الاستلام (Due on Receipt)';
        const earnedPoints = Math.floor(grandTotal / 1000); // 1 point for each 1000 YER

        const invoiceRef = doc(collection(db, 'invoices'));
        
        const invoiceData = {
          number: invoiceId,
          date: new Date().toISOString(),
          total: grandTotal,
          subtotal: total,
          tax: 0,
          status: isDebt ? 'unpaid' : 'paid',
          paymentType: paymentType === 'wallet' ? `Wallet: ${selectedWallet}` : paymentType,
          customer: customerName,
          customerId: selectedCustomerId,
          paymentTerms: paymentType === 'debt' ? 'دين (On Credit)' : paymentTerms,
          earnedPoints: selectedCustomerId ? earnedPoints : 0,
          createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'مستخدم غير معروف',
          userId: auth.currentUser?.uid || null,
          items: cart.map(i => ({
            id: i.item.id,
            name: i.item.name,
            qty: i.qty,
            price: i.price,
            purchasePrice: (i.item as any).purchasePrice || 0
          }))
        };
        transaction.set(invoiceRef, invoiceData);

        // 2.5 Create Debt if applicable
        if (isDebt) {
          const debtRef = doc(collection(db, 'debts'));
          const customer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : null;
          transaction.set(debtRef, {
            contactName: customerName,
            amount: grandTotal,
            remainingAmount: grandTotal,
            type: 'receivable',
            date: invoiceData.date,
            status: 'pending',
            description: `فاتورة رقم ${invoiceId}${paymentType === 'debt' ? ' (دين مباشر)' : ''}`,
            phoneNumber: customer?.phone || '',
            createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'مستخدم غير معروف',
            userId: auth.currentUser?.uid || null
          });
        }

        // 3. Update customer stats if selected
        if (selectedCustomerId) {
          const customerRef = doc(db, 'customers', selectedCustomerId);
          transaction.update(customerRef, {
            totalPurchases: increment(grandTotal),
            lastPurchaseDate: invoiceData.date,
            points: increment(earnedPoints)
          });
        }

        for (const cartItem of cart) {
          const itemRef = doc(db, 'items', cartItem.item.id);
          transaction.update(itemRef, {
            stock: increment(-cartItem.qty)
          });
        }

        return invoiceData;
      });

      setLastInvoice(invoiceResult);
      setSuccess(true);
      playSuccessSound();
      await logActivity('إنشاء فاتورة مبيعات', invoiceId, 'invoices', {
        number: invoiceId,
        total: invoiceResult.total,
        paymentType: paymentType,
        itemsCount: cart.length,
        customer: customerName,
        tax: invoiceResult.tax || 0
      });
      notify.success('تم إتمام العملية بنجاح');
      setCart([]);
      // Show success for 3 seconds, then reset
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      notify.error(error.message || "حدث خطأ أثناء إتمام العملية");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  
  const filteredItems = items.filter(i => {
    const matchesSearch = i.name?.includes(searchTerm) || i.code?.includes(searchTerm);
    const matchesCategory = selectedCategory === 'الكل' || i.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const [showMobileCart, setShowMobileCart] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-0 lg:gap-6 -m-4 text-foreground overflow-hidden relative">
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-primary/95 text-white p-6 print:bg-white print:p-0"
          >
             <motion.div 
               initial={{ scale: 0.5, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="text-center space-y-6 print:hidden w-full max-w-lg"
             >
                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                   <CheckCircle className="w-10 h-10 md:w-16 md:h-16" />
                </div>
                <h2 className="text-2xl md:text-4xl font-black text-white">تمت العملية بنجاح!</h2>
                <p className="text-lg md:text-xl opacity-80 text-white">رقم الفاتورة: {lastInvoice?.number}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 px-4">
                  <button 
                    onClick={() => {
                      window.print();
                    }}
                    className="bg-white text-primary px-8 py-3 md:px-10 md:py-4 rounded-2xl font-bold text-base md:text-lg hover:bg-gray-100 transition-colors shadow-2xl flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5 md:w-6 md:h-6 text-primary" /> طباعة الإيصال
                  </button>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="bg-primary-dark/20 text-white border border-white/20 px-8 py-3 md:px-10 md:py-4 rounded-2xl font-bold text-base md:text-lg hover:bg-white/10 transition-colors"
                  >
                    متابعة مبيعات جديدة
                  </button>
                </div>

                {/* Hidden printable receipt for POS */}
                <div className="hidden print:block fixed inset-0 bg-white p-8 text-black text-right" dir="rtl">
                   <div className="text-center mb-6">
                      {shopSettings?.logoUrl && (
                        <img src={shopSettings.logoUrl} alt="Logo" className="w-20 h-20 object-contain mx-auto mb-2" referrerPolicy="no-referrer" />
                      )}
                      <h2 className="text-2xl font-black">{shopSettings?.shopName || 'الحسام فون'}</h2>
                      <p className="text-sm">{shopSettings?.shopPhone && `تلفون: ${shopSettings.shopPhone}`}</p>
                      <p className="text-xs">{shopSettings?.shopAddress}</p>
                   </div>
                   <div className="flex justify-between text-xs mb-4">
                      <span>الفاتورة: {lastInvoice?.number}</span>
                      <span>التاريخ: {new Date(lastInvoice?.date || Date.now()).toLocaleString()}</span>
                   </div>
                   <div className="text-xs mb-4">
                      <span>العميل: {lastInvoice?.customer}</span>
                   </div>
                   <hr className="border-black mb-4" />
                   <table className="w-full text-xs">
                      <thead>
                         <tr className="border-b border-black">
                            <th className="py-1 text-right">الصنف</th>
                            <th className="py-1 text-center">الكمية</th>
                            <th className="py-1 text-left">الإجمالي</th>
                         </tr>
                      </thead>
                      <tbody>
                         {lastInvoice?.items.map((item: any, idx: number) => (
                           <tr key={idx}>
                              <td className="py-1">{item.name}</td>
                              <td className="py-1 text-center">{item.qty}</td>
                              <td className="py-1 text-left">{(item.qty * item.price).toLocaleString()}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                   <hr className="border-black mt-4 mb-2" />
                    <div className="space-y-1 text-left">
                       <div className="text-sm font-bold flex justify-between border-t border-black pt-1 mt-1">
                         <span>الإجمالي الكلي:</span>
                         <span>{lastInvoice?.total.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</span>
                       </div>
                    </div>
                   <div className="mt-8 text-center text-[10px] leading-relaxed">
                      <p className="whitespace-pre-line">{shopSettings?.receiptNotes}</p>
                      
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Products Side */}
      <div className={`flex-1 flex flex-col gap-4 lg:gap-6 p-4 overflow-hidden ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex flex-col gap-3 bg-surface p-2 md:p-3 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.03]">
           <div className="flex items-center gap-2">
             <div className="relative flex-1 group">
               <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
               <input 
                 ref={searchInputRef}
                 type="text" 
                 placeholder="ابحث..." 
                 className="w-full bg-background dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg pr-9 md:pr-10 pl-4 py-2 text-xs md:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>
             <button 
               onClick={() => setShowScanner(true)}
               className="p-2 md:p-2.5 bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition-all flex items-center gap-2 border border-secondary/20 shadow-sm"
               title="فتح الكاميرا للمسح"
             >
                 <Camera className="w-4 h-4 md:w-5 md:h-5" />
             </button>
           </div>
           
           <div className="flex items-center justify-between gap-3 overflow-hidden">
             <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-0.5 flex-nowrap min-w-0 flex-1">
                 <label className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 bg-surface border border-gray-100 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shrink-0">
                   <input 
                     type="checkbox" 
                     className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary rounded border-gray-300 dark:border-slate-700 focus:ring-primary"
                     checked={allowOverSell}
                     onChange={(e) => setAllowOverSell(e.target.checked)}
                   />
                   <span className="text-[8px] md:text-[9px] font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">تجاوز المخزون</span>
                 </label>
                 {categoriesData.map(cat => (
                   <button 
                     key={cat}
                     onClick={() => setSelectedCategory(cat)}
                     className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                       selectedCategory === cat ? 'bg-primary text-white shadow-md' : 'bg-surface border border-gray-100 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                     }`}
                   >
                     {cat}
                   </button>
                 ))}
             </div>
             <button 
               onClick={() => setShowMobileCart(true)}
               className="lg:hidden relative flex items-center justify-center p-2 bg-primary text-white rounded-lg transition-transform active:scale-90 shrink-0"
             >
               <ShoppingCart className="w-5 h-5" />
               {cart.length > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center border border-white">
                   {cart.length}
                 </span>
               )}
             </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
           {loading ? (
             <div className="h-full flex items-center justify-center text-gray-400">جاري تحميل المنتجات...</div>
           ) : filteredItems.length === 0 ? (
             <div className="h-full flex items-center justify-center text-gray-400">لا توجد منتجات</div>
           ) : (
             <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {filteredItems.map((p) => (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addToCart(p)}
                    className="bg-surface p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/10 transition-all text-right flex flex-col min-h-[120px] md:min-h-[140px] h-full relative overflow-hidden group"
                  >
                    <div className="flex-1">
                      <span className="text-[9px] text-secondary font-bold bg-secondary/10 px-1.5 py-0.5 rounded-full uppercase">{p.category}</span>
                      <h4 className="font-bold text-primary mt-2 text-xs md:text-sm line-clamp-2 dark:text-foreground">{p.name}</h4>
                      <p className="text-[9px] text-gray-400 mt-1">المخزون: {p.stock} {p.unit}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <p className="text-secondary font-black text-xs md:text-sm">{p.price.toLocaleString()} <span className="text-[9px] opacity-70">ر.ي</span></p>
                      <div className="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>
                    {p.stock <= (p.minStock || 5) && p.stock > 0 && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 text-amber-500">
                        <AlertCircle className="w-3 h-3" />
                      </div>
                    )}
                    {p.stock <= 0 && <div className="absolute inset-0 bg-surface/80 flex items-center justify-center font-bold text-red-600 text-[10px] backdrop-blur-[1px]">نفذت الكمية</div>}
                  </motion.button>
                ))}
             </div>
           )}
        </div>
      </div>

      {/* Cart Side */}
      <div className={`fixed inset-0 lg:relative lg:inset-auto w-full lg:w-[400px] bg-surface border-r border-gray-200 dark:border-slate-800 flex flex-col p-4 lg:p-6 shadow-2xl transition-transform z-[110] lg:z-10 ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col gap-4 mb-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 relative flex-1">
                 <button 
                  onClick={() => setShowMobileCart(false)}
                  className="lg:hidden p-2 text-gray-400 hover:text-primary transition-colors"
                 >
                    <X className="w-6 h-6" />
                 </button>
                 <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/5 text-primary flex items-center justify-center rounded-lg md:rounded-xl font-bold">
                    ح
                 </div>
                 <div className="flex-1">
                   <h2 className="font-bold text-primary text-sm md:text-base">سلة المبيعات</h2>
                   <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => {
                          setCustomerType('guest');
                          setCustomerName('عميل نقدي');
                          setSelectedCustomerId(null);
                        }}
                        className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors ${customerType === 'guest' ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        زبون عابر
                      </button>
                      <button 
                        onClick={() => setCustomerType('registered')}
                        className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors ${customerType === 'registered' ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        عملاء مسجلين
                      </button>
                   </div>
                 </div>
              </div>
              <button className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-2" onClick={() => setShowClearConfirm(true)}>
                 <Trash2 className="w-5 h-5" />
              </button>
           </div>

           <AnimatePresence>
             {showClearConfirm && (
               <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center border border-gray-100 dark:border-slate-800"
                 >
                   <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertCircle className="w-8 h-8" />
                   </div>
                   <h3 className="text-lg font-bold text-primary dark:text-white mb-2">تفريغ السلة؟</h3>
                   <p className="text-sm text-secondary dark:text-gray-400 mb-6">
                     هل أنت متأكد من حذف جميع الأصناف في السلة الحالية؟
                   </p>
                   <div className="flex gap-3">
                     <button 
                       onClick={() => { setCart([]); setShowClearConfirm(false); }}
                       className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                     >
                       نعم، تفريغ
                     </button>
                     <button 
                       onClick={() => setShowClearConfirm(false)}
                       className="flex-1 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400 rounded-xl py-3 text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                     >
                       إلغاء
                     </button>
                   </div>
                 </motion.div>
               </div>
             )}
           </AnimatePresence>

           {customerType === 'registered' && (
             <div className="relative bg-background border border-gray-100 dark:border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                   <User className="w-4 h-4 text-secondary" />
                   <div className="flex-1">
                      <input 
                        type="text" 
                        value={customerName === 'عميل نقدي' ? '' : customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          setSelectedCustomerId(null);
                          setShowCustomerSearch(true);
                        }}
                        onFocus={() => setShowCustomerSearch(true)}
                        placeholder="ابحث عن عميل..."
                        className="text-xs bg-transparent border-none p-0 focus:ring-0 text-primary font-bold placeholder:text-gray-400 w-full"
                      />
                      {selectedCustomerId && (
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-amber-500 font-bold">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>{customers.find(c => c.id === selectedCustomerId)?.points || 0} نقطة</span>
                        </div>
                      )}
                   </div>
                   {showCustomerSearch && (
                    <button 
                      className="text-gray-400 hover:text-primary p-1"
                      onClick={() => setShowCustomerSearch(false)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                   )}
                </div>
                {showCustomerSearch && customerName && (
                  <div className="absolute top-full right-0 left-0 bg-surface border border-gray-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto mt-2 p-1">
                     <button 
                       className="w-full text-right px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between mb-1 text-secondary"
                       onClick={() => {
                         setShowCustomerSearch(false);
                       }}
                     >
                       <span className="opacity-60 text-[10px]">استخدام:</span>
                       <span className="font-bold">{customerName}</span>
                     </button>
                     {customers
                      .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()) || c.phone.includes(customerName))
                      .map(c => (
                       <button 
                         key={c.id}
                         className="w-full text-right px-3 py-2 text-xs hover:bg-secondary/10 rounded-lg transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0"
                         onClick={() => {
                           setCustomerName(c.name);
                           setSelectedCustomerId(c.id);
                           setShowCustomerSearch(false);
                         }}
                       >
                          <div className="flex justify-between items-center">
                             <p className="font-bold text-primary">{c.name}</p>
                             <div className="flex items-center gap-1 text-[9px] text-amber-500 font-black">
                               <Star className="w-2.5 h-2.5 fill-current" />
                               <span>{c.points || 0}</span>
                             </div>
                          </div>
                          <p className="text-gray-400 font-mono text-[10px]">{c.phone}</p>
                       </button>
                     ))}
                  </div>
                )}
             </div>
           )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-6 scrollbar-thin scrollbar-thumb-gray-200">
           <AnimatePresence>
              {cart.map((i) => (
                <motion.div 
                  key={i.item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 bg-gray-50/50 dark:bg-slate-900/50 p-2 rounded-xl"
                >
                   <div className="flex-1">
                      <p className="text-xs font-bold text-primary line-clamp-1">{i.item.name}</p>
                      <div className="flex items-center gap-1 group/price">
                        <input 
                           type="number"
                           step="any"
                           className="text-[10px] text-secondary font-bold bg-transparent border-none p-0 focus:ring-0 w-16 hover:bg-white dark:hover:bg-slate-800 rounded px-1 transition-colors"
                           value={i.price === 0 ? '' : i.price}
                           onChange={(e) => updatePrice(i.item.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                        <span className="text-[9px] text-gray-400">ر.ي</span>
                      </div>
                   </div>
                   <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 border border-gray-100 dark:border-slate-700">
                      <button 
                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded transition-all text-secondary active:scale-90" 
                        onClick={() => updateQty(i.item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input 
                        type="number"
                        min="1"
                        className="w-8 text-center bg-transparent border-none p-0 focus:ring-0 text-xs font-black text-primary font-mono appearance-none"
                        value={i.qty}
                        onChange={(e) => updateQty(i.item.id, e.target.value)}
                      />
                      <button 
                        className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 rounded transition-all text-secondary active:scale-90" 
                        onClick={() => updateQty(i.item.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                   </div>
                   <button className="p-1 text-gray-300 hover:text-red-500 transition-colors" onClick={() => removeFromCart(i.item.id)}><X className="w-4 h-4" /></button>
                </motion.div>
              ))}
           </AnimatePresence>
           {cart.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 mt-12 opacity-40">
                <ShoppingCart className="w-12 h-12" />
                <p className="text-xs">السلة فارغة</p>
             </div>
           )}
        </div>

        <div className="space-y-3 border-t border-gray-100 dark:border-slate-800 pt-4">
           <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
              <span>الإجمالي الفرعي</span>
              <span className="font-mono text-primary dark:text-foreground">{total.toLocaleString()} <span className="text-[9px]">ر.ي</span></span>
           </div>
           {/* Tax removed or compacted for mobile space if needed, keep for now */}
           <div className="flex items-center justify-between text-2xl font-black text-primary dark:text-foreground">
              <span className="text-lg">الإجمالي</span>
              <span className="font-mono">{total.toLocaleString()} <span className="text-xs">ر.ي</span></span>
           </div>
           
           <div className="grid grid-cols-4 gap-1.5 mt-4">
              <button 
                onClick={() => setPaymentType('cash')}
                title="نقدي"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group ${paymentType === 'cash' ? 'bg-primary/5 border-primary shadow-sm' : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <Banknote className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'cash' ? 'text-primary' : 'text-green-600'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">نقدي</span>
              </button>
              <button 
                onClick={() => setPaymentType('debt')}
                title="دين"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group ${paymentType === 'debt' ? 'bg-red-500/5 border-red-500' : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <AlertCircle className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'debt' ? 'text-red-500' : 'text-orange-500'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">دين</span>
              </button>
              <button 
                onClick={() => setPaymentType('card')}
                title="بطاقة"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group ${paymentType === 'card' ? 'bg-primary/5 border-primary' : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <CreditCard className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'card' ? 'text-primary' : 'text-indigo-600'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">بطاقة</span>
              </button>
              <button 
                onClick={() => setPaymentType('wallet')}
                title="محفظة"
                className={`flex flex-col items-center gap-1 p-2 border rounded-xl transition-colors group ${paymentType === 'wallet' ? 'bg-secondary/5 border-secondary' : 'border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
              >
                 <Wallet className={`w-4 h-4 group-hover:scale-110 transition-transform ${paymentType === 'wallet' ? 'text-secondary' : 'text-blue-500'}`} />
                 <span className="text-[8px] font-bold text-gray-600 dark:text-gray-400">محفظة</span>
              </button>
           </div>

           <div className="flex gap-2">
             {paymentType === 'wallet' && (
                <div className="flex-1">
                  <select 
                    className="w-full bg-secondary/5 border border-secondary/20 rounded-lg py-1.5 px-2 text-[10px] font-bold text-secondary outline-none appearance-none"
                    value={selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value)}
                  >
                    {yemeniWallets.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
             )}
             <div className="flex-1">
                <select 
                  className="w-full bg-background dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-lg py-1.5 px-2 text-[10px] font-bold text-primary dark:text-foreground outline-none appearance-none"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                >
                  {paymentTermsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
             </div>
           </div>

           <button 
            disabled={cart.length === 0 || processing}
            onClick={completeSale}
            className="w-full bg-primary text-white py-3 md:py-4 rounded-xl font-bold hover:bg-opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
           >
              {processing ? <RefreshCw className="w-5 h-5 animate-spin" /> : success ? <><CheckCircle className="w-5 h-5" /> تمت العملية</> : 'إتمام الفاتورة'}
           </button>
        </div>
      </div>
    </div>
  );
}
