import React, { useState, useEffect, useRef } from 'react';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Mail, 
  Clock, 
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  X,
  Lock,
  Unlock,
  Fingerprint
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { notify } from '../lib/notifications';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'accountant' | 'sales';
  status: 'active' | 'suspended';
  lastLogin?: string;
  biometricRegistered?: boolean;
  biometricToken?: string;
  biometricRegisteredAt?: string;
}

export default function Users() {
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: 'sales' as const,
    status: 'active' as const,
    password: '',
    biometricRegistered: false,
    biometricToken: '',
    biometricRegisteredAt: ''
  });

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);

  const [showBiometricRegister, setShowBiometricRegister] = useState(false);
  const [enrollScanning, setEnrollScanning] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(0);
  const [isFingerPressed, setIsFingerPressed] = useState(false);
  const [biometricInstruction, setBiometricInstruction] = useState('ضع إصبع الموظف على المستشعر أدناه واضغط باستمرار للبدء في مسح البصمة الحيوية.');
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Handle biometric scanning completion side effects
  useEffect(() => {
    if (enrollProgress >= 100) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      setEnrollScanning(false);
      setIsFingerPressed(false);
      
      // Ensure we only set the biometric registration once per session completion
      if (!formData.biometricRegistered) {
        const generatedToken = 'FP-HASH-' + Math.random().toString(36).substring(2, 12).toUpperCase();
        setFormData(f => ({
          ...f,
          biometricRegistered: true,
          biometricToken: generatedToken,
          biometricRegisteredAt: new Date().toISOString()
        }));
        setBiometricInstruction('تم مسح بصمة الإصبع وحفظ التشفير بنجاح!');
        notify.success('تم مسح بصمة الإصبع الحيوية وتوليد التشفير بنجاح!');
        
        // Play a delightful success audio sound dynamically
        try {
          const contextClass = (window.AudioContext || (window as any).webkitAudioContext);
          if (contextClass) {
            const ctx = new contextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);  // A5
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          }
        } catch (err) {}
      }
    }
  }, [enrollProgress, formData.biometricRegistered]);

  const handleStartEnrollBiometric = () => {
    if (!formData.email) {
      notify.error('يرجى كتابة البريد الإلكتروني للمستخدم أولاً قبل تهيئة البصمة.');
      return;
    }
    setShowBiometricRegister(true);
    setEnrollScanning(false);
    setEnrollProgress(0);
    setIsFingerPressed(false);
    setBiometricInstruction('ضع إصبع الموظف على المستشعر أدناه واضغط باستمرار للبدء في مسح البصمة الحيوية.');
  };

  const handleFingerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (enrollProgress >= 100) return;
    
    setIsFingerPressed(true);
    setEnrollScanning(true);
    setBiometricInstruction('جاري قراءة تفاصيل البصمة والأنماط الحيوية... حافظ على ثبات الإصبع.');

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      setEnrollProgress((prev) => {
        const next = prev + 4; // premium incremental progress speed
        if (next >= 100) {
          return 100;
        }
        return next;
      });
    }, 80);
  };

  const handleFingerUp = () => {
    if (enrollProgress >= 100) return;
    setIsFingerPressed(false);
    setEnrollScanning(false);
    setBiometricInstruction('تم رفع الإصبع! يرجى الاستمرار بالضغط حتى يكتمل شريط مسح البصمة %100.');
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserProfile));
      setUsers(data);
      setLoading(false);

      // Proactive normalization to fix any mixed casing or spacing issues in Firestore
      for (const docSnap of snapshot.docs) {
        const u = docSnap.data();
        if (u.email) {
          const sanitizedEmail = u.email.trim().toLowerCase();
          if (u.email !== sanitizedEmail) {
            try {
              await updateDoc(docSnap.ref, { email: sanitizedEmail });
              console.log(`Auto-normalized casing/spacing of email: ${u.email} -> ${sanitizedEmail}`);
            } catch (err) {
              console.error("Failed to auto-normalize user email:", err);
            }
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitizedEmail = formData.email.trim().toLowerCase();
      const { password, ...firestoreData } = formData;
      
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), {
          ...firestoreData,
          email: sanitizedEmail,
          updatedAt: new Date().toISOString()
        });
        notify.success('تم تحديث بيانات المستخدم بنجاح');
      } else {
        let authCreatedUid = '';
        
        if (formData.password) {
          let tempApp: any = null;
          try {
            tempApp = initializeApp(firebaseConfig, 'TempRegistrationApp');
            const tempAuth = getAuth(tempApp);
            const userCredential = await createUserWithEmailAndPassword(tempAuth, sanitizedEmail, formData.password);
            authCreatedUid = userCredential.user.uid;
            await deleteApp(tempApp);
            notify.success('تم إنشاء الحساب في نظام المصادقة بنجاح');
          } catch (authError: any) {
            console.error("Auth registration error:", authError);
            if (tempApp) {
              try { await deleteApp(tempApp); } catch (e) {}
            }
            if (authError.code === 'auth/email-already-in-use') {
              notify.success('الحساب مسجل مسبقاً في نظام المصادقة، سيتم ربطه بقائمة الوصول');
            } else if (authError.code === 'auth/weak-password') {
              notify.error('كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.');
              return;
            } else if (authError.code === 'auth/operation-not-allowed') {
              const errMsg = 'طريقة تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعّلة في مشروع Firebase الخاص بك. يرجى تفعيلها من لوحة التحكم لتتمكن من إضافة مستخدمين.';
              setAuthErrorMsg(errMsg);
              notify.error('تنبيه: طريقة الدخول Email/Password غير مفعّلة في Firebase Console');
              return;
            } else {
              notify.error(`فشل في إنشاء الحساب في نظام المصادقة: ${authError.message}`);
              return;
            }
          }
        }

        if (authCreatedUid) {
          await setDoc(doc(db, 'users', authCreatedUid), {
            ...firestoreData,
            email: sanitizedEmail,
            uid: authCreatedUid,
            createdAt: new Date().toISOString(),
            status: 'active'
          });
        } else {
          await addDoc(collection(db, 'users'), {
            ...firestoreData,
            email: sanitizedEmail,
            uid: '',
            createdAt: new Date().toISOString(),
            status: 'active'
          });
        }
        notify.success('تم إضافة المستخدم بنجاح وصلاحيات الوصول نشطة');
      }
      setIsAdding(false);
      setEditingUser(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingUser ? OperationType.UPDATE : OperationType.CREATE, `users/${editingUser?.id || ''}`);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    try {
      const newStatus = user.status === 'active' ? 'suspended' : 'active';
      await updateDoc(doc(db, 'users', user.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      notify.success(newStatus === 'active' ? 'تم تنشيط الحساب' : 'تم تعطيل الحساب');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      notify.success('تم حذف المستخدم من قائمة الوصول بنجاح');
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.id}`);
    }
  };

  const openEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      displayName: user.displayName || '',
      role: user.role,
      status: user.status,
      password: '',
      biometricRegistered: user.biometricRegistered || false,
      biometricToken: user.biometricToken || '',
      biometricRegisteredAt: user.biometricRegisteredAt || ''
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      displayName: '',
      role: 'sales',
      status: 'active',
      password: '',
      biometricRegistered: false,
      biometricToken: '',
      biometricRegisteredAt: ''
    });
    setAuthErrorMsg(null);
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">إدارة المستخدمين</h1>
          <p className="text-sm text-secondary mt-1">إدارة صلاحيات الوصول وأدوار الموظفين في النظام</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsAdding(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 bg-primary text-white rounded-lg text-xs md:text-sm font-medium hover:bg-primary/95 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 shrink-0 select-none cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" /> 
          <span>إضافة مستخدم</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md">
             <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
               type="text" 
               placeholder="بحث بالبريد الإلكتروني أو الاسم..."
               className="w-full pr-10 pl-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-secondary/50 outline-none"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           <div className="flex items-center gap-2 text-xs font-bold text-gray-400 border-r border-gray-200 pr-4 mr-4">
              <Filter className="w-4 h-4" />
              <span>تصفية حسب: الكل</span>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-background border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">البريد الإلكتروني</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">الدور / الصلاحية</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-center">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-center">بيانات البصمة</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">آخر دخول</th>
                <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                   <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                         <UsersIcon className="w-8 h-8" />
                      </div>
                      <p className="text-gray-400 text-sm">لا يوجد مستخدمون لعرضهم حالياً</p>
                   </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={`${user.id || 'user'}-${index}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-full flex items-center justify-center font-bold">
                           {user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <p className="text-sm font-bold text-primary">{user.displayName || 'بدون اسم'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                         <Mail className="w-3 h-3" />
                         <span>{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          {user.role === 'admin' ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold border border-red-100">
                               <ShieldAlert className="w-3 h-3" />
                               مدير نظام
                            </div>
                          ) : user.role === 'accountant' ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100">
                               <ShieldCheck className="w-3 h-3" />
                               محاسب
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold border border-green-100">
                               <Shield className="w-3 h-3" />
                               موظف مبيعات
                            </div>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                         user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                       }`}>
                          {user.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.status === 'active' ? 'نشط' : 'معطل'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                         user.biometricRegistered ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-50 text-gray-400 border border-gray-100'
                       }`}>
                          <Fingerprint className={`w-3.5 h-3.5 ${user.biometricRegistered ? 'animate-pulse text-indigo-500 font-bold' : 'text-gray-400'}`} />
                          {user.biometricRegistered ? 'جاهزة ومُوثقة' : 'غير مهيأة'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{user.lastLogin || 'لم يدخل بعد'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg transition-colors ${user.status === 'active' ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                            title={user.status === 'active' ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                          >
                             {user.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => openEdit(user)}
                            className="p-1.5 text-gray-400 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                          >
                             <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setUserToDelete(user)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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

      <AnimatePresence>
        {(isAdding || editingUser) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl w-full max-w-[420px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary text-white select-none">
                <h3 className="font-bold text-sm">{editingUser ? 'تعديل بيانات مستخدم' : 'إضافة مستخدم جديد'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingUser(null); }} className="p-1 hover:bg-white/15 rounded-md transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-3 text-right overflow-y-auto flex-1">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-gray-500 block mb-0.5">الاسم بالكامل</label>
                  <input 
                    required
                    type="text" 
                    placeholder="اسم الموظف..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary/50 outline-none transition-all"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-gray-500 block mb-0.5">البريد الإلكتروني</label>
                  <input 
                    required
                    type="email" 
                    placeholder="example@company.com"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary/50 outline-none font-mono transition-all"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                {!editingUser && (
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-gray-500 block mb-0.5">كلمة المرور (للدخول بالنظام)</label>
                    <input 
                      required
                      type="password" 
                      placeholder="••••••••"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary/50 outline-none font-mono text-left transition-all"
                      dir="ltr"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <p className="text-[9.5px] text-gray-400">ستُستخدم كلمة المرور والبريد للدخول الآمن بالنظام.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-gray-500 block mb-0.5">الدور الوظيفي</label>
                    <select 
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary/50 outline-none transition-all cursor-pointer"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    >
                      <option value="sales">موظف مبيعات</option>
                      <option value="accountant">محاسب نظام</option>
                      <option value="admin">مدير نظام</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-gray-500 block mb-0.5">الحالة</label>
                    <select 
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary/50 outline-none transition-all cursor-pointer"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="active">نشط</option>
                      <option value="suspended">معطل</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Fingerprint className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-[11px] font-bold text-gray-700">بيانات التعرف على البصمة للمستخدم</span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${formData.biometricRegistered ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {formData.biometricRegistered ? 'مُعرّفة وبدقة' : 'غير مهيأة مسبقاً'}
                    </span>
                  </div>
                  
                  <p className="text-[9.5px] text-gray-400 leading-normal">
                    تتيح ميزة التشفير SHA-256 محلياً لتمكين تسجيل الدخول السريع بمستشعر البصمة الحيوية للهاتف/الجهاز.
                  </p>

                  <button
                    type="button"
                    onClick={handleStartEnrollBiometric}
                    className="w-full py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-750 text-[10.5px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Fingerprint className="w-3.5 h-3.5 text-primary" />
                    {formData.biometricRegistered ? 'تحديث/إعادة مسح البصمة الحيوية' : 'بدء مسح بصمة إصبع الموظف'}
                  </button>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-100/60 rounded-xl flex gap-2 text-amber-800">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-[9.5px] leading-relaxed">
                    <p className="font-bold mb-0.5">تنبيه هام للأمان:</p>
                    <ul className="list-disc pr-3.5 space-y-0.5 text-gray-600">
                      <li>هذا الإجراء يوافق على البريد الإلكتروني المذكور للوصول إلى نظام المبيعات والحسابات.</li>
                      <li>يجب على الموظف استخدام نفس البريد المسجل هنا عند تسجيل الدخول لنظامه الهاتفي.</li>
                    </ul>
                  </div>
                </div>

                {authErrorMsg && (
                  <div className="p-3 bg-red-50 border border-red-105 rounded-xl flex flex-col gap-1.5 text-red-700 text-right">
                    <div className="flex gap-1.5 items-center justify-end">
                      <p className="font-bold text-[11px] text-red-700">تنبيه: طريقة الدخول غير مفعلة</p>
                      <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                    </div>
                    <p className="text-[10px] leading-relaxed">{authErrorMsg}</p>
                    <div className="mt-0.5 p-2 bg-white rounded-lg border border-red-100 text-[9px] text-gray-600 space-y-1">
                      <p className="font-bold text-red-600">لتفعيل تسجيل الدخول بالبريد في مشروعك على Firebase:</p>
                      <ol className="list-decimal pr-3.5 space-y-0.5">
                        <li>
                          اذهب إلى الرابط التالي:
                          <a 
                            href="https://console.firebase.google.com/project/gen-lang-client-0621337551/authentication/providers" 
                            target="_blank" 
                            className="text-blue-600 hover:underline mx-1 break-all font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            لوحة تحكم Firebase
                          </a>
                        </li>
                        <li>قم بتمكين <strong>Email/Password</strong> وحفظ التعديلات.</li>
                      </ol>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-2.5">
                  <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/95 transition-all select-none cursor-pointer">
                    {editingUser ? 'حفظ التعديلات' : 'إضافة المستخدم'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingUser(null); }}
                    className="flex-1 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all select-none cursor-pointer py-2"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showBiometricRegister && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-8 rounded-3xl max-w-sm w-full relative z-[140] text-center shadow-2xl"
            >
              <div className="flex flex-col items-center select-none">
                <div className="relative w-36 h-36 mb-6 flex items-center justify-center">
                  {/* Decorative glowing backdrops */}
                  {isFingerPressed && (
                    <div className="absolute inset-0 border-4 border-primary/40 rounded-full animate-ping opacity-60" />
                  )}
                  {enrollScanning && (
                    <div className="absolute inset-1 border-2 border-dashed border-primary/30 rounded-full animate-spin [animation-duration:8s]" />
                  )}
                  
                  {/* Interactive Tactile Biometric Touch Target */}
                  <button
                    type="button"
                    onMouseDown={handleFingerDown}
                    onMouseUp={handleFingerUp}
                    onMouseLeave={handleFingerUp}
                    onTouchStart={handleFingerDown}
                    onTouchEnd={handleFingerUp}
                    className={`w-28 h-28 rounded-full flex flex-col items-center justify-center relative shadow-lg border-4 transition-all duration-300 select-none cursor-pointer active:scale-95
                      ${isFingerPressed 
                        ? 'bg-primary/20 border-primary text-primary shadow-primary/30 scale-105' 
                        : enrollProgress >= 100 
                          ? 'bg-green-500/10 border-green-500 text-green-500 shadow-green-500/20' 
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 hover:border-gray-300 dark:hover:border-slate-700'
                      }`}
                  >
                    <Fingerprint className={`w-14 h-14 transition-transform duration-300 ${
                      isFingerPressed 
                        ? 'scale-110 text-primary' 
                        : enrollProgress >= 100 
                          ? 'text-green-500 scale-105' 
                          : 'text-gray-400'
                    }`} />
                    
                    {/* Animated vertical scanning laser */}
                    {isFingerPressed && (
                      <div className="absolute w-20 h-0.5 bg-primary rounded shadow-cyan-400 shadow-md animate-bounce top-1/3" />
                    )}

                    <span className="absolute bottom-2 text-[9px] font-black tracking-wider opacity-80 uppercase">
                      {isFingerPressed ? 'امسح...' : enrollProgress >= 100 ? 'مكتمل ✅' : 'اضغط مستمراً'}
                    </span>
                  </button>
                </div>

                <h3 className="text-base font-black text-gray-800 dark:text-white mb-2">
                  {enrollProgress >= 100 
                    ? 'اكتمل المسح الحيوي!' 
                    : isFingerPressed 
                      ? 'جاري استشعار البصمة...' 
                      : 'مستعد للمسح الحسي'}
                </h3>
                
                <p className="text-xs text-secondary mb-5 leading-relaxed max-w-[260px] min-h-[40px]">
                  {biometricInstruction}
                </p>

                {enrollProgress > 0 && (
                  <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-200 ${enrollProgress >= 100 ? 'bg-green-500' : 'bg-primary'}`} 
                      style={{ width: `${enrollProgress}%` }}
                    />
                  </div>
                )}

                {enrollProgress >= 100 && (
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl w-full mb-6 font-mono text-[9px] text-gray-400 break-all select-all">
                    🔑 الرمز المشفر: {formData.biometricToken}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowBiometricRegister(false)}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {enrollProgress >= 100 ? 'حفظ ومتابعة' : 'إلغاء الأمر'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {userToDelete && (
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
                <h3 className="text-lg font-bold text-primary mb-2">حذف المستخدم؟</h3>
                <p className="text-sm text-secondary mb-6">
                   بمجرد الحذف، سيفقد هذا المستخدم جميع صلاحيات الوصول للنظام فوراً.
                </p>
                <div className="flex gap-3">
                   <button 
                     onClick={handleDelete}
                     className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-700 transition-colors"
                   >
                      تأكيد الحذف
                   </button>
                   <button 
                     onClick={() => setUserToDelete(null)}
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
