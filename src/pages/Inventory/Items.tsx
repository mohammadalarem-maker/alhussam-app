import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Package,
  Barcode,
  ArrowUpDown,
  Edit2,
  Trash2,
  Camera,
  Image as ImageIcon,
  Upload,
  X,
  Tag,
  CheckCircle2
} from 'lucide-react';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import { Link } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  increment,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { db, auth, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { notify } from '../../lib/notifications';
import { logActivity } from '../../lib/activity';
import { AnimatePresence } from 'motion/react';
import { useCurrency } from '../../lib/CurrencyContext'; // استيراد محرك العملات الجديد

interface Item {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  purchasePrice: number;
  costCurrency?: 'USD' | 'SAR' | 'YER'; // عملة التكلفة
  profitMargin?: number; // نسبة الربح
  stock: number;
  category: string;
  minStock?: number;
  imageUrl?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function Items() {
  const { convertToYER, rates } = useCurrency(); // جلب دوال وأسعار الصرف الحية
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkField, setBulkField] = useState<'category' | 'minStock'>('category');
  const [bulkValue, setBulkValue] = useState('');
  const [newItem, setNewItem] = useState<any>({
    code: '',
    name: '',
    unit: 'حبة',
    price: 0,
    purchasePrice: '',
    costCurrency: 'YER', // الافتراضي ريال يمني
    profitMargin: '10', // الافتراضي نسبة ربح 10%
    stock: '',
    minStock: '5',
    category: 'عام',
    imageUrl: ''
  });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // مراقبة وحساب سعر البيع تلقائياً عند إضافة صنف جديد
  useEffect(() => {
    if (isAdding) {
      const cost = Number(newItem.purchasePrice || 0);
      const currency = newItem.costCurrency || 'YER';
      const margin = Number(newItem.profitMargin || 0);
      const yerCost = convertToYER(cost, currency);
      const finalPrice = Math.round(yerCost * (1 + margin / 100));
      
      setNewItem(prev => prev.price === finalPrice ? prev : { ...prev, price: finalPrice });
    }
  }, [newItem.purchasePrice, newItem.costCurrency, newItem.profitMargin, isAdding, convertToYER]);

  // مراقبة وحساب سعر البيع تلقائياً عند تعديل صنف حالي
  useEffect(() => {
    if (editingItem) {
      const cost = Number(editingItem.purchasePrice || 0);
      const currency = editingItem.costCurrency || 'YER';
      const margin = Number(editingItem.profitMargin || 0);
      const yerCost = convertToYER(cost, currency);
      const finalPrice = Math.round(yerCost * (1 + margin / 100));

      setEditingItem(prev => {
        if (!prev || prev.price === finalPrice) return prev;
        return { ...prev, price: finalPrice };
      });
    }
  }, [editingItem?.purchasePrice, editingItem?.costCurrency, editingItem?.profitMargin, convertToYER]);

  useEffect(() => {
    const qItems = query(collection(db, 'items'), orderBy('name', 'asc'));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    const qCats = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      const catsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(catsData);
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
      if (snap.exists()) setShopSettings(ensureSettingsDefaults(snap.data()));
    });

    return () => {
      unsubItems();
      unsubCats();
      unsubSettings();
    };
  }, []);

  const handleBarcodeScan = (result: string) => {
    setSearchTerm(result);
    if (isAdding) {
      setNewItem({ ...newItem, code: result });
    } else if (editingItem) {
      setEditingItem({ ...editingItem, code: result });
    }
  };

  const deleteItem = (item: Item) => {
    setItemToDelete(item);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'items', itemToDelete.id));
      await logActivity('حذف صنف من المخزون', itemToDelete.id, 'items', { name: itemToDelete.name });
      notify.success('تم حذف الصنف بنجاح');
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `items/${itemToDelete.id}`);
    }
  };

  const startEdit = (item: Item) => {
    setEditingItem({
      ...item,
      costCurrency: item.costCurrency || 'YER',
      profitMargin: item.profitMargin ?? 0
    });
    setImagePreview(item.imageUrl || null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        notify.error('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت لتحميل أسرع.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (currentImageUrl: string = ''): Promise<string> => {
    if (!imageFile) return currentImageUrl || (imagePreview && imagePreview.startsWith('http') ? imagePreview : '');
    try {
      const options = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        initialQuality: 0.6
      };
      let fileToUpload: File | Blob = imageFile;
      try {
        fileToUpload = await imageCompression(imageFile, options);
      } catch (compressionError) {
        console.error("Compression component failed, using original file:", compressionError);
      }
      const fileRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
      const uploadResult = await uploadBytes(fileRef, fileToUpload);
      const url = await getDownloadURL(uploadResult.ref);
      return url;
    } catch (error: any) {
      console.error("Upload error details:", error);
      notify.error('فشل في رفع الصورة بسبب ضعف الإنترنت. سيتم الحفظ بدون الصورة الجديدة.');
      return currentImageUrl;
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || saving) return;
    setSaving(true);
    try {
      let imageUrl = await uploadImage(editingItem.imageUrl);
      const { id, ...data } = editingItem;
      const finalData = {
        ...data,
        imageUrl,
        price: Number(data.price || 0),
        purchasePrice: Number(data.purchasePrice || 0),
        profitMargin: Number(data.profitMargin || 0),
        costCurrency: data.costCurrency || 'YER',
        stock: Number(data.stock || 0),
        minStock: Number(data.minStock || 0),
        updatedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'مستخدم غير معروف',
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'items', id), finalData);
      await logActivity('تحديث بيانات الصنف', id, 'items', finalData);
      notify.success('تم تحديث بيانات الصنف بنجاح');
      setEditingItem(null);
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Save error:", error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `items/${editingItem.id}`);
      } catch (e) {
        notify.error('فشل في حفظ البيانات. تأكد من صلاحياتك وصحة البيانات المدخلة.');
      }
    } finally {
      setSaving(false);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      let imageUrl = await uploadImage('');
      const finalData = {
        ...newItem,
        imageUrl,
        price: Number(newItem.price || 0),
        purchasePrice: Number(newItem.purchasePrice || 0),
        profitMargin: Number(newItem.profitMargin || 0),
        costCurrency: newItem.costCurrency || 'YER',
        stock: Number(newItem.stock || 0),
        minStock: Number(newItem.minStock || 0),
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'مستخدم غير معروف',
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'items'), finalData);
      await logActivity('إضافة صنف جديد للمخزون', docRef.id, 'items', finalData);
      notify.success('تم إضافة الصنف الجديد بنجاح');
      setIsAdding(false);
      setImageFile(null);
      setImagePreview(null);
      setNewItem({
        code: '',
        name: '',
        unit: 'حبة',
        price: 0,
        purchasePrice: '',
        costCurrency: 'YER',
        profitMargin: '10',
        stock: '',
        minStock: '5',
        category: 'عام',
        imageUrl: ''
      });
    } catch (error) {
      console.error("Add item error:", error);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'items');
      } catch (e) {
        notify.error('فشل في إضافة الصنف. تأكد من تعبئة جميع الحقول المطلوبة بشكل صحيح.');
      }
    } finally {
      setSaving(false);
    }
  };

  const quickUpdateStock = async (id: string, delta: number) => {
    try {
      await updateDoc(doc(db, 'items', id), {
        stock: increment(delta)
      });
      await logActivity('تعديل كمية المخزون', id, 'items', { adjustment: delta });
      notify.success('تم تحديث المخزون');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${id}`);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id));
    }
  };

  const applyBulkEdit = async () => {
    if (selectedItems.length === 0 || !bulkValue) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      selectedItems.forEach(id => {
        const itemRef = doc(db, 'items', id);
        const updateData: any = {};
        if (bulkField === 'category') {
          updateData.category = bulkValue;
        } else if (bulkField === 'minStock') {
          updateData.minStock = Number(bulkValue);
        }
        batch.update(itemRef, updateData);
      });
      await batch.commit();
      await logActivity('تعديل جماعي للأصناف', 'bulk', 'items', { count: selectedItems.length, field: bulkField });
      notify.success('تم التعديل الجماعي بنجاح');
      setSelectedItems([]);
      setIsBulkEditing(false);
      setBulkValue('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'multiple items');
    } finally {
      setLoading(false);
    }
  };

  const applyBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    const confirmDeleteAll = window.confirm(
      `هل أنت متأكد تماماً من حذف ${selectedItems.length} أصناف دفعة واحدة؟ لا يمكن التراجع عن هذا الإجراء.`
    );
    if (!confirmDeleteAll) return;

    try {
      setLoading(true);
      const batch = writeBatch(db);
      selectedItems.forEach(id => {
        const itemRef = doc(db, 'items', id);
        batch.delete(itemRef);
      });
      await batch.commit();
      await logActivity('حذف جماعي للأصناف', 'bulk_delete', 'items', { count: selectedItems.length });
      notify.success('تم حذف الأصناف المحددة بنجاح');
      setSelectedItems([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'multiple items');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(i =>
    i.name?.includes(searchTerm) ||
    i.code?.includes(searchTerm) ||
    i.category?.includes(searchTerm)
  );

  const totalValue = items.reduce((sum, item) => sum + (item.stock * (item.price || 0)), 0);
  const lowStockCount = items.filter(item => item.stock <= (item.minStock || 0)).length;

  return (
    <div className="space-y-6">
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-primary mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-secondary mb-6">
              هل أنت متأكد من حذف الصنف <span className="font-bold text-primary">"{itemToDelete.name}"</span>؟ لا يمكن التراجع عن هذه العملية.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
              >
                حذف الصنف
              </button>
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-bold hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(editingItem || isAdding) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary text-white">
              <h3 className="font-bold">{isAdding ? 'إضافة صنف جديد' : `تعديل صنف: ${editingItem?.name}`}</h3>
              <button onClick={() => { setEditingItem(null); setIsAdding(false); }} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={isAdding ? addItem : saveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden group">
                  {imagePreview ? (
                    <img src={imagePreview} className="w-full h-full object-cover" alt="Product" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer gap-2">
                    <Upload className="w-6 h-6" />
                    <span className="text-[10px] font-bold">رفع صورة</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 font-bold">صورة المنتج (اختياري)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  required
                  value={isAdding ? newItem.name : editingItem?.name || ''}
                  onChange={e => isAdding ? setNewItem({...newItem, name: e.target.value}) : setEditingItem({...editingItem!, name: e.target.value})}
                  className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الباركود / الكود</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={isAdding ? newItem.code : editingItem?.code || ''}
                    onChange={e => isAdding ? setNewItem({...newItem, code: e.target.value}) : setEditingItem({...editingItem!, code: e.target.value})}
                    className="flex-1 bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-12 h-10 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg text-secondary hover:bg-gray-100 transition-colors shadow-sm"
                    title="فتح الكاميرا للمسح"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">الفئة</label>
                  <select
                    required
                    value={isAdding ? newItem.category : editingItem?.category || ''}
                    onChange={e => isAdding ? setNewItem({...newItem, category: e.target.value}) : setEditingItem({...editingItem!, category: e.target.value})}
                    className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                  >
                    <option value="">اختر الفئة...</option>
                    <option value="عام">عام</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">الوحدة</label>
                  <select
                    value={isAdding ? newItem.unit : editingItem?.unit || 'حبة'}
                    onChange={e => isAdding ? setNewItem({...newItem, unit: e.target.value}) : setEditingItem({...editingItem!, unit: e.target.value})}
                    className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                  >
                    <option value="حبة">حبة</option>
                    <option value="كيلو">كيلو</option>
                    <option value="متر">متر</option>
                    <option value="كرتون">كرتون</option>
                    <option value="درزن">درزن</option>
                  </select>
                </div>
              </div>

              {/* نظام العملات المطوّر في إدخال الأسعار */}
              <div className="grid grid-cols-2 gap-4 border p-3 rounded-xl bg-gray-50/50 border-dashed">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">عملة التكلفة</label>
                  <select
                    value={isAdding ? newItem.costCurrency : (editingItem?.costCurrency || 'YER')}
                    onChange={e => isAdding ? setNewItem({...newItem, costCurrency: e.target.value}) : setEditingItem({...editingItem!, costCurrency: e.target.value as any})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-secondary/50 font-bold text-primary"
                  >
                    <option value="YER">ريال يمني (YER)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={isAdding ? newItem.purchasePrice : (editingItem?.purchasePrice ?? '')}
                    onChange={e => isAdding ? setNewItem({...newItem, purchasePrice: e.target.value}) : setEditingItem({...editingItem!, purchasePrice: e.target.value as any})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">نسبة الربح (%)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={isAdding ? newItem.profitMargin : (editingItem?.profitMargin ?? '0')}
                    onChange={e => isAdding ? setNewItem({...newItem, profitMargin: e.target.value}) : setEditingItem({...editingItem!, profitMargin: e.target.value as any})}
                    className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50 font-bold text-green-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">سعر البيع (تلقائي ر.ي)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      disabled
                      value={isAdding ? newItem.price : (editingItem?.price ?? 0)}
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-sm font-black text-primary cursor-not-allowed text-center"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] bg-secondary/10 text-secondary px-1 rounded font-bold">تلقائي</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">الكمية</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={isAdding ? newItem.stock : (editingItem?.stock ?? '')}
                    onChange={e => isAdding ? setNewItem({...newItem, stock: e.target.value}) : setEditingItem({...editingItem!, stock: e.target.value as any})}
                    className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">حد التنبيه (الحد الأدنى)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={isAdding ? newItem.minStock : (editingItem?.minStock ?? '')}
                    onChange={e => isAdding ? setNewItem({...newItem, minStock: e.target.value}) : setEditingItem({...editingItem!, minStock: e.target.value as any})}
                    className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-primary justify-center py-3 disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ والرفع...' : (isAdding ? 'إضافة الصنف' : 'حفظ التغييرات')}
                </button>
                <button type="button" onClick={() => { setEditingItem(null); setIsAdding(false); setImagePreview(null); setImageFile(null); }} className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">إلغاء</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {isBulkEditing && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-secondary text-white">
                <h3 className="font-bold">تعديل جماعي ({selectedItems.length} أصناف)</h3>
                <button onClick={() => setIsBulkEditing(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">الحقل المراد تعديله</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setBulkField('category'); setBulkValue(''); }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${bulkField === 'category' ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-500 border-gray-200'}`}
                    >
                      تغيير الفئة
                    </button>
                    <button
                      onClick={() => { setBulkField('minStock'); setBulkValue('5'); }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${bulkField === 'minStock' ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-500 border-gray-200'}`}
                    >
                      حد التنبيه
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">القيمة الجديدة</label>
                  {bulkField === 'category' ? (
                    <select
                      required
                      value={bulkValue}
                      onChange={e => setBulkValue(e.target.value)}
                      className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                    >
                      <option value="">اختر الفئة...</option>
                      <option value="عام">عام</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      className="w-full bg-background border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-secondary/50"
                      value={bulkValue}
                      onChange={e => setBulkValue(e.target.value)}
                    />
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={applyBulkEdit}
                    className="flex-1 bg-secondary text-white rounded-xl py-3 text-sm font-bold hover:bg-secondary/90 transition-colors"
                  >
                    تطبيق التعديل
                  </button>
                  <button
                    onClick={() => setIsBulkEditing(false)}
                    className="flex-1 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary">إدارة الأصناف والمخزون</h1>
          <p className="text-[10px] md:text-sm text-secondary mt-1">نظام {shopSettings?.shopName || 'الحسام فون'} - إدارة المخازن الذكية</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex-1 lg:flex-none bg-white px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-gray-100 shadow-sm text-center">
            <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">قيمة المخزون</p>
            <p className="text-sm md:text-lg font-black text-primary truncate">{totalValue.toLocaleString()} <span className="text-[9px] font-medium text-gray-400">{shopSettings?.currency || 'ر.ي'}</span></p>
          </div>
          <div className="flex-1 lg:flex-none bg-white px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-gray-100 shadow-sm text-center">
            <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">أصناف منخفضة</p>
            <p className="text-sm md:text-lg font-black text-red-600">{lowStockCount}</p>
          </div>
          <div className="w-full sm:w-auto flex gap-2">
            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 sm:flex-none btn-primary text-xs md:text-sm py-2 px-3 md:px-4"
            >
              <Plus className="w-3 h-3 md:w-4 md:h-4" /> صنف جديد
            </button>
            <Link
              to="/inventory/categories"
              className="flex-1 sm:flex-none btn-secondary text-xs md:text-sm py-2 px-3 md:px-4 flex items-center justify-center"
            >
              <Tag className="w-3 h-3 md:w-4 md:h-4" /> الفئات
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="البحث بالاسم، الكود، أو الباركود..."
              className="w-full bg-background border border-gray-200 rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="p-2 border border-gray-200 rounded-lg text-secondary hover:bg-gray-50 transition-colors shadow-sm"
            title="مسح باركود"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Filter className="w-4 h-4" /> تصفية
          </button>
          <button className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden md:block overflow-x-auto relative">
          <table className="w-full text-right">
            <thead className="bg-background border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary"
                    checked={selectedItems.length > 0 && selectedItems.length === filteredItems.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الكود / الصنف</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">السعر والربح</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الكمية</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400">جاري تحميل البيانات...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-gray-400">لا توجد أصناف تطابق البحث</td>
                </tr>
              ) : filteredItems.map((item) => (
                <tr key={item.id} className={`hover:bg-background/50 transition-colors ${selectedItems.includes(item.id) ? 'bg-secondary/5' : ''}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleSelectItem(item.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-secondary/5 rounded-xl flex items-center justify-center text-secondary overflow-hidden border border-gray-100">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                        ) : (
                          <Package className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">{item.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Barcode className="w-3 h-3" /> {item.code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-[10px] font-bold">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-primary">{item.price.toLocaleString()} {shopSettings?.currency || 'ر.ي'}</p>
                    <p className="text-[10px] text-gray-400 font-bold">التكلفة: {item.purchasePrice} {item.costCurrency || 'YER'} (%{item.profitMargin || 0} ربح)</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1 group/stock">
                      <p className={`text-sm font-bold ${item.stock <= (item.minStock || 0) ? 'text-red-600' : 'text-primary'}`}>
                        {item.stock} {item.unit}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover/stock:opacity-100 transition-opacity">
                        <button
                          onClick={() => quickUpdateStock(item.id, 5)}
                          className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100 hover:bg-green-100 transition-colors"
                          title="إضافة 5"
                        >+5</button>
                        <button
                          onClick={() => quickUpdateStock(item.id, -1)}
                          className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 hover:bg-red-100 transition-colors"
                          title="خصم 1"
                        >-1</button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.stock > 10 ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div> متوفر
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div> منخفض
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-end gap-2 text-gray-400">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1.5 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
            <div className="px-6 py-20 text-center text-gray-400 text-sm">جاري تحميل البيانات...</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-6 py-20 text-center text-gray-400 text-sm">لا توجد أصناف تطابق البحث</div>
          ) : filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex gap-4 hover:bg-background/50 active:bg-gray-50 transition-colors ${selectedItems.includes(item.id) ? 'bg-secondary/5' : ''}`}
              onClick={() => toggleSelectItem(item.id)}
            >
              <div className="w-16 h-16 bg-secondary/5 rounded-xl flex items-center justify-center text-secondary shrink-0 overflow-hidden border border-gray-100">
                {item.imageUrl ? (
                  <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                ) : (
                  <Package className="w-8 h-8" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-xs font-bold text-primary truncate">{item.name}</h4>
                  <span className={`text-[10px] font-bold ${item.stock <= (item.minStock || 0) ? 'text-red-600' : 'text-green-600'}`}>
                    {item.stock} {item.unit}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                      <Barcode className="w-3 h-3" /> {item.code}
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-secondary/10 text-secondary rounded text-[9px] font-bold">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-xs font-black text-primary truncate">
                      {item.price.toLocaleString()} {shopSettings?.currency || 'ر.ي'}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 font-bold">التكلفة: {item.purchasePrice} {item.costCurrency || 'YER'}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                        className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                        className="p-1.5 text-red-600 bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-50 flex items-center justify-between text-xs text-secondary font-medium">
          <p>عرض {items.length} أصناف في {shopSettings?.shopName || 'الحسام فون'}</p>
          <div className="flex gap-2">
            <button disabled className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50">السابق</button>
            <button disabled className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50">التالي</button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedItems.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-20 md:bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 z-[100] bg-white border border-gray-200 shadow-2xl rounded-2xl px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-center gap-3 md:gap-6 md:min-w-[500px]"
          >
            <div className="flex items-center gap-3 md:border-l md:border-gray-100 md:pl-6 w-full md:w-auto">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-secondary text-white rounded-lg md:rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="flex-1">
                <p className="text-[8px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">تم اختيار</p>
                <p className="text-xs md:text-sm font-black text-primary">{selectedItems.length} أصناف</p>
              </div>
              <button
                onClick={() => setSelectedItems([])}
                className="md:hidden p-1.5 bg-gray-50 text-gray-400 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full md:flex-1 flex gap-2 md:gap-3">
              <button
                onClick={() => setIsBulkEditing(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 md:py-3 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-xl text-xs sm:text-sm font-bold transition-all"
              >
                <Edit2 className="w-3 h-3 md:w-4 md:h-4" />
                تعديل جماعي
              </button>
              
              {/* زر الحذف الجماعي بعد التفعيل */}
              <button
                onClick={applyBulkDelete}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 md:py-3 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 rounded-xl text-xs sm:text-sm font-bold transition-all"
                title="حذف جميع الأصناف المحددة"
              >
                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                {loading ? 'جاري الحذف...' : 'حذف المحدد'}
              </button>
            </div>

            <button
              onClick={() => setSelectedItems([])}
              className="hidden md:block p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
