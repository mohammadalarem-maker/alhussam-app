import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  Phone, 
  MapPin, 
  Coins, 
  FileText, 
  Image as ImageIcon,
  Save,
  RefreshCw,
  Trophy,
  ShieldCheck,
  BellRing,
  Palette,
  Check,
  Cloud,
  Download,
  Database,
  Globe,
  AlertCircle,
  Fingerprint,
  KeyRound
} from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { notify } from '../lib/notifications';
import { logActivity } from '../lib/activity';
import { motion } from 'motion/react';
import { useTranslation } from '../lib/translations';

interface AppSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  currency: string;
  receiptNotes: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupLocation: string;
  language?: 'ar' | 'en';
}

const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'متجر الحسام فون',
  shopPhone: '784707050 - 778915055',
  shopAddress: 'صنعاء - مذبح - جوار فندق ضواحي صنعاء',
  currency: 'YER',
  receiptNotes: 'صيانة وبموجة هواتف\nبيع جوالات - صيانة برمجة - اكسسوارات - ادوات تجميل - نسخ الافلام والمسلسلات - طباعة\nشكراً لتعاملكم معنا! البضاعة المباعة لا ترد ولا تستبدل بعد 24 ساعة.',
  primaryColor: '#541919',
  secondaryColor: '#B3803E',
  logoUrl: 'https://i.imgur.com/gK9Jd74.png',
  backupEnabled: true,
  backupFrequency: 'daily',
  backupLocation: 'Google Drive (Cloud)',
  language: 'ar',
};

const THEMES = [
  { 
    id: 'default',
    name: 'بني كلاسيك', 
    primary: '#3D2B1F', 
    secondary: '#8B5E3C',
    preview: 'bg-[#3D2B1F]'
  },
  { 
    id: 'brown-white',
    name: 'بني مع أبيض', 
    primary: '#5D4037', 
    secondary: '#FFFFFF',
    preview: 'bg-[#5D4037]'
  },
  { 
    id: 'dark-brown',
    name: 'بني غامق جداً', 
    primary: '#2D1B10', 
    secondary: '#4D3425',
    preview: 'bg-[#2D1B10]'
  },
  { 
    id: 'night',
    name: 'المظهر الليلي (أزرق)', 
    primary: '#0F172A', 
    secondary: '#3B82F6',
    preview: 'bg-[#0F172A]'
  },
  { 
    id: 'emerald',
    name: 'المظهر الحيوي (أخضر)', 
    primary: '#064E3B', 
    secondary: '#10B981',
    preview: 'bg-[#064E3B]'
  },
  { 
    id: 'royal',
    name: 'المظهر الملكي (بنفسجي)', 
    primary: '#4C1D95', 
    secondary: '#8B5CF6',
    preview: 'bg-[#4C1D95]'
  },
  { 
    id: 'classic',
    name: 'المظهر الكلاسيكي (أحمر)', 
    primary: '#450A0A', 
    secondary: '#EF4444',
    preview: 'bg-[#450A0A]'
  }
];

export default function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [localBiometricEnabled, setLocalBiometricEnabled] = useState(
    localStorage.getItem('biometric_enabled') === 'true'
  );

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        let currentSettings = DEFAULT_SETTINGS;
        if (docSnap.exists()) {
          const data = docSnap.data() as AppSettings;
          // Determine if we have outdated defaults
          const isOutdated = !data.logoUrl || 
                             data.shopPhone === '77XXXXXXX' || 
                             data.shopName === 'الحسام فون' || 
                             data.shopName === 'متجر الحسام';
          if (isOutdated) {
            currentSettings = {
              ...DEFAULT_SETTINGS,
              ...data,
              shopName: DEFAULT_SETTINGS.shopName,
              shopPhone: DEFAULT_SETTINGS.shopPhone,
              shopAddress: DEFAULT_SETTINGS.shopAddress,
              logoUrl: DEFAULT_SETTINGS.logoUrl,
              receiptNotes: DEFAULT_SETTINGS.receiptNotes,
              primaryColor: DEFAULT_SETTINGS.primaryColor,
              secondaryColor: DEFAULT_SETTINGS.secondaryColor
            };
            await setDoc(docRef, currentSettings, { merge: true });
          } else {
            currentSettings = data;
          }
        } else {
          await setDoc(docRef, DEFAULT_SETTINGS);
        }
        setSettings(currentSettings);
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await logActivity('تحديث إعدادات النظام', 'global', 'settings', { ...settings });
      notify.success('تم حفظ الإعدادات بنجاح!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
      notify.error('فشل حفظ الإعدادات. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualBackup = async () => {
    try {
      setSaving(true);
      notify.loading('جاري تجهيز نسخة احتياطية...');
      
      const collections = ['items', 'invoices', 'expenses', 'customers', 'activities', 'wallets', 'debts'];
      const backupData: any = {
        timestamp: new Date().toISOString(),
        settings: settings
      };

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${settings.shopName}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      await logActivity('إنشاء نسخة احتياطية يدوية', 'backup', 'system');
      notify.success('تم إنشاء وتحميل النسخة الاحتياطية بنجاح!');
    } catch (error) {
      console.error("Backup error:", error);
      notify.error('فشل إنشاء النسخة الاحتياطية.');
    } finally {
      setSaving(false);
    }
  };

  const applyPredefinedTheme = (primary: string, secondary: string) => {
    setSettings(prev => ({ ...prev, primaryColor: primary, secondaryColor: secondary }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify.error('يرجى اختيار ملف صورة صالح');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      notify.error('حجم الصورة يجب أن لا يتجاوز 2 ميجابايت');
      return;
    }

    setUploading(true);
    setProgress(0);

    const filename = `logo_${Date.now()}`;
    const storageRef = ref(storage, `logos/${filename}`);
    
    try {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(p);
        }, 
        (error) => {
          console.error("Upload Error:", error);
          notify.error('فشل في رفع الشعار.');
          setUploading(false);
        }, 
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setSettings(prev => ({ ...prev, logoUrl: downloadURL }));
            notify.success('تم رفع الشعار بنجاح!');
          } catch (err) {
            notify.error('فشل الحصول على رابط الشعار.');
          } finally {
            setUploading(false);
            setProgress(0);
          }
        }
      );
    } catch (error: any) {
      notify.error('حدث خطأ غير متوقع أثناء الرفع.');
      setUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-primary" />
           </div>
           <div className={t('إعدادات النظام') === 'System Settings' ? 'text-left' : 'text-right'}>
              <h1 className="text-2xl font-black text-primary">{t('إعدادات النظام')}</h1>
              <p className="text-sm text-gray-500">{t('تحكم بخصائص نظام')} {settings.shopName || t('الحسام فون')}</p>
           </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* معطيات هوية المتجر والترخيص الموحد */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group/card">
          <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-primary">ترخيص وهوية متجر الحسام فون</h3>
            </div>
            <p className="text-[10px] font-black text-white bg-primary px-3 py-1 rounded-full uppercase tracking-widest select-none">نظام مخبأ لمحل واحد</p>
          </div>
          
          <div className="p-6 flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-slate-50/20">
            {/* Elegant Logo Image Container */}
            <div className="w-32 h-32 rounded-3xl bg-white border border-gray-150 flex items-center justify-center p-2 shadow-inner shrink-0 relative overflow-hidden">
              <img 
                src="https://i.imgur.com/gK9Jd74.png" 
                alt="Logo" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
              />
            </div>
            
            <div className="flex-1 space-y-3 text-center md:text-right w-full">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h4 className="text-lg font-black text-primary">متجر الحسام فون</h4>
                <span className="text-[9.5px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">النسخة المرخصة المعتمدة</span>
              </div>
              
              <p className="text-xs text-secondary font-black leading-relaxed">
                بيع جوالات - صيانة برمجة - اكسسوارات - ادوات تجميل - نسخ الافلام والمسلسلات - طباعة
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right text-xs mt-2 border-t border-gray-150/60 pt-3">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-500 font-extrabold">تلفون وواتساب:</span>
                  <span className="font-mono text-primary font-bold">784707050 - 778915055</span>
                </div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-500 font-extrabold">العنوان والموقع:</span>
                  <span className="text-primary font-bold">صنعاء - مذبح - جوار فندق ضواحي صنعاء</span>
                </div>
              </div>

              {/* Developer License Badge */}
              <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-right">
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-sans">المبرمج المطور</span>
                  <span className="text-xs font-black text-gray-800 font-sans">مازن فارع</span>
                </div>
                <div className="flex items-center gap-1 justify-center sm:justify-start font-mono text-xs font-black text-secondary">
                  <span>هاتف الدعم الفني:</span>
                  <span className="text-primary">776591639</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Localization Section */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group/card">
          <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-primary">اللغة والعملة والمنطقة</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 w-full">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-1">لغة واجهة النظام</label>
                <div className="flex gap-2">
                   <button 
                    type="button"
                    onClick={() => setSettings({ ...settings, language: 'ar' })}
                    className={`flex-1 p-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all font-black text-sm ${
                      settings.language === 'ar' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 text-gray-400 grayscale'
                    }`}
                   >
                     <span className="text-lg">🇸🇦</span>
                     العربية
                   </button>
                   <button 
                    type="button"
                    onClick={() => setSettings({ ...settings, language: 'en' })}
                    className={`flex-1 p-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all font-black text-sm ${
                      settings.language === 'en' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 text-gray-400 grayscale'
                    }`}
                   >
                     <span className="text-lg">🇺🇸</span>
                     English
                   </button>
                </div>
              </div>
              <div className="space-y-2 w-full">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-1">عملة النظام الافتراضية</label>
                <div className="relative group/input">
                  <Coins className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within/input:text-secondary" />
                  <select 
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-secondary/10 outline-none transition-all appearance-none cursor-pointer" 
                    value={settings.currency} 
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  >
                    <option value="YER">ريال يمني (YER)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="EGP">جنيه مصري (EGP)</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 pt-4">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-1">تذييل فاتورة المبيعات الافتراضي</label>
              <div className="relative group/textarea">
                <FileText className="absolute right-4 top-4 w-4 h-4 text-gray-400 font-bold transition-colors group-focus-within/textarea:text-secondary" />
                <textarea rows={3} className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-secondary/10 outline-none transition-all resize-none font-bold" value={settings.receiptNotes} onChange={(e) => setSettings({ ...settings, receiptNotes: e.target.value })} />
              </div>
              <p className="text-[10px] text-gray-400 font-medium">سيظهر هذا النص في أسفل كل فاتورة مبيعات يتم طباعتها.</p>
            </div>
          </div>
        </div>

        {/* Cloud Backup Section */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group/card">
          <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-primary">النسخ الاحتياطي السحابي والأمان</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${settings.backupEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {settings.backupEnabled ? 'Auto Backup Active' : 'Backup Disabled'}
              </span>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100/50">
               <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${settings.backupEnabled ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-primary">مزامنة البيانات التلقائية</h4>
                    <p className="text-[10px] text-gray-500 font-bold">يقوم النظام برفع نسخة مشفرة من بياناتك يومياً</p>
                  </div>
               </div>
               <button 
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, backupEnabled: !prev.backupEnabled }))}
                className={`w-14 h-7 rounded-full transition-all relative ${settings.backupEnabled ? 'bg-primary' : 'bg-gray-300'}`}
               >
                 <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${settings.backupEnabled ? 'right-8' : 'right-1'}`} />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-1">تكرار النسخ الاحتياطي</label>
                <div className="relative group/input">
                  <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within/input:text-secondary" />
                  <select 
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-secondary/10 outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
                    value={settings.backupFrequency}
                    disabled={!settings.backupEnabled}
                    onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value as any })}
                  >
                    <option value="daily">يومياً (أمان عالي)</option>
                    <option value="weekly">أسبوعياً (متوسط)</option>
                    <option value="monthly">شهرياً (أساسي)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-1">وحدة التخزين المستهدفة</label>
                <div className="relative group/input">
                  <Cloud className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within/input:text-secondary" />
                  <select 
                    className="w-full pr-12 pl-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-secondary/10 outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
                    value={settings.backupLocation}
                    disabled={!settings.backupEnabled}
                    onChange={(e) => setSettings({ ...settings, backupLocation: e.target.value })}
                  >
                    <option value="Google Drive (Cloud)">Google Drive (Recommended)</option>
                    <option value="Dropbox">Dropbox Cloud</option>
                    <option value="Private Server">سيرفر خاص مشفر</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
                  <p className="text-[11px] text-gray-500 font-bold max-w-md">نوصي دائماً بتحميل نسخة يدوية وحفظها في وحدة تخزين خارجية لضمان أقصى حماية لبيانات عملك.</p>
               </div>
               <button 
                type="button"
                onClick={handleManualBackup}
                disabled={saving}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 active:scale-95"
               >
                 <Download className="w-5 h-5" />
                 تحميل نسخة الان
               </button>
            </div>
          </div>
        </div>

        {/* Biometrics Setup Section */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group/card">
          <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <Fingerprint className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-primary">تسجيل الدخول السريع بالبصمة (لهذا الجهاز)</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${localBiometricEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {localBiometricEnabled ? 'مفعل على هذا الجهاز' : 'غير نشط'}
              </span>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100/50">
               <div className="flex items-center gap-4 text-right">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${localBiometricEnabled ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Fingerprint className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-primary">تسجيل الدخول الفوري ببصمة الإصبع</h4>
                    <p className="text-[10px] text-gray-500 font-bold">تتيح لك الدخول إلى النظام بلمسة واحدة دون إدخال كلمة المرور في كل مرة.</p>
                  </div>
               </div>
               <button 
                type="button"
                onClick={() => {
                  if (localBiometricEnabled) {
                    localStorage.removeItem('biometric_enabled');
                    localStorage.removeItem('biometric_email');
                    localStorage.removeItem('biometric_pass');
                    setLocalBiometricEnabled(false);
                    notify.success('تم إيقاف الدخول بالبصمة على هذا الجهاز.');
                  } else {
                    notify.error('لتفعيل البصمة لأول مرة على جهازك، يرجى تحديد خيار "تفعيل تسجيل الدخول بالبصمة" في شاشة تسجيل الدخول عند كتابة البريد وكلمة المرور.');
                  }
                }}
                className={`w-14 h-7 rounded-full transition-all relative ${localBiometricEnabled ? 'bg-primary' : 'bg-gray-300'}`}
               >
                 <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${localBiometricEnabled ? 'right-8' : 'right-1'}`} />
               </button>
            </div>
            {!localBiometricEnabled && (
              <p className="text-[10px] text-amber-600 font-bold bg-amber-50/50 p-3 rounded-xl border border-amber-100/40 text-right leading-relaxed">
                * ملاحظة أمنية: للتفعيل الآمن، يرجى تفعيل البصمة مباشرة منصفحة تسجيل الدخول في المرة القادمة، حيث يتم تخزين مفتاح مشفر محلي بالكامل على جهازك دون إرساله لأي سيرفر خارجي.
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-6 left-0 right-0 flex justify-center z-50 px-4">
          <motion.button 
            type="submit"
            disabled={saving}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full max-w-md bg-primary text-white py-4 px-8 rounded-2xl shadow-2xl shadow-primary/25 font-black flex items-center justify-center gap-3 transition-all hover:shadow-primary/40 disabled:opacity-70"
          >
            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'جاري الحفظ...' : 'حفظ كافة الإعدادات والمظهر'}
          </motion.button>
        </div>
      </form>

      {/* Notifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-10">
         <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 group">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
               <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
               <p className="text-[10px] font-black text-blue-800 uppercase tracking-tighter">أمان البيانات</p>
               <p className="text-[10px] text-gray-400 font-medium">مشفرة ومحمية</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 group">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 transition-transform group-hover:scale-110">
               <BellRing className="w-5 h-5" />
            </div>
            <div>
               <p className="text-[10px] font-black text-purple-800 uppercase tracking-tighter">تنبيهات المخزون</p>
               <p className="text-[10px] text-gray-400 font-medium">نشطة تلقائياً</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 group">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
               <Trophy className="w-5 h-5" />
            </div>
            <div>
               <p className="text-[10px] font-black text-amber-800 uppercase tracking-tighter">الحساب الماسي</p>
               <p className="text-[10px] text-gray-400 font-medium">كامل الصلاحيات</p>
            </div>
         </div>
      </div>
    </div>
  );
}

