import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// تعريف أنواع البيانات
interface Rates {
  USD: number; // سعر صرف الدولار مقابل الريال اليمني
  SAR: number; // سعر صرف السعودي مقابل الريال اليمني
  YER: number; // الريال اليمني الافتراضي (دائماً 1)
}

interface CurrencyContextType {
  rates: Rates;
  updateRates: (newRates: Partial<Rates>) => Promise<void>;
  convertToYER: (price: number, currency: keyof Rates) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // أسعار صرف افتراضية متوافقة مع سوق صنعاء (يمكنك تعديلها لاحقاً من التطبيق)
  const [rates, setRates] = useState<Rates>({
    USD: 535,
    SAR: 140,
    YER: 1
  });

  // جلب أسعار الصرف ومراقبتها حياً من الفايربيس (Real-time)
  useEffect(() => {
    const docRef = doc(db, 'settings', 'currency_rates');
    
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setRates(snapshot.data() as Rates);
      } else {
        // إذا لم تكن موجودة في قاعدة البيانات بعد، نقوم بإنشائها بالقيم الافتراضية
        setDoc(docRef, { USD: 535, SAR: 140, YER: 1 });
      }
    });

    return () => unsubscribe();
  }, []);

  // دالة لتحديث أسعار الصرف من صفحة الإعدادات
  const updateRates = async (newRates: Partial<Rates>) => {
    const docRef = doc(db, 'settings', 'currency_rates');
    await setDoc(docRef, { ...rates, ...newRates }, { merge: true });
  };

  // الدالة السحرية: تحول أي سعر إلى الريال اليمني تلقائياً بناءً على عملته
  const convertToYER = (price: number, currency: keyof Rates): number => {
    if (!price || isNaN(price)) return 0;
    const rate = rates[currency] || 1;
    return Math.round(price * rate); // تقريب الأرقام لكسور صحيحة
  };

  return (
    <CurrencyContext.Provider value={{ rates, updateRates, convertToYER }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// "Hook" مخصص لسهولة استدعاء النظام في أي صفحة
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

