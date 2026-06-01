import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocs,
  deleteDoc,
  doc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  History, 
  User, 
  Calendar, 
  ExternalLink,
  Search,
  Filter,
  X,
  Trash2,
  Trash,
  PlusCircle,
  RefreshCw,
  FileText,
  AlertCircle,
  Database,
  ArrowRightLeft,
  Settings as SettingsIcon,
  ShoppingBag,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notify } from '../../lib/notifications';

interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  recordId: string | null;
  collection: string | null;
  timestamp: string;
  details?: any;
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState('الكل');
  const [filterType, setFilterType] = useState('الكل');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'user_activity'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setActivities(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getActionType = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('إضافة') || act.includes('إنشاء') || act.includes('add') || act.includes('create')) return 'create';
    if (act.includes('حذف') || act.includes('إزالة') || act.includes('delete') || act.includes('remove')) return 'delete';
    if (act.includes('تحديث') || act.includes('تعديل') || act.includes('update') || act.includes('edit')) return 'update';
    if (act.includes('دخول') || act.includes('خروج') || act.includes('login') || act.includes('logout')) return 'auth';
    if (act.includes('فاتورة') || act.includes('ببيع') || act.includes('invoice') || act.includes('sale')) return 'sale';
    return 'other';
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'update': return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'auth': return <User className="w-4 h-4 text-amber-500" />;
      case 'sale': return <ShoppingBag className="w-4 h-4 text-primary" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionBg = (type: string) => {
    switch (type) {
      case 'create': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'delete': return 'bg-red-50 text-red-700 border-red-100';
      case 'update': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'auth': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'sale': return 'bg-primary/5 text-primary border-primary/10';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const filteredActivities = activities.filter(a => {
    const matchesSearch = a.action.includes(searchTerm) || a.userName.includes(searchTerm) || (a.collection && a.collection.includes(searchTerm));
    const matchesUser = filterUser === 'الكل' || a.userName === filterUser;
    const type = getActionType(a.action);
    const matchesType = filterType === 'الكل' || type === filterType;
    return matchesSearch && matchesUser && matchesType;
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = activities.filter(a => a.timestamp.startsWith(today));
    
    // Find most active user
    const userCounts: Record<string, number> = {};
    activities.forEach(a => {
      userCounts[a.userName] = (userCounts[a.userName] || 0) + 1;
    });
    const mostActive = Object.entries(userCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';

    return {
      total: activities.length,
      today: todayLogs.length,
      mostActive,
      errors: activities.filter(a => a.action.toLowerCase().includes('error') || a.action.includes('فشل')).length
    };
  }, [activities]);

  const uniqueUsers = Array.from(new Set(activities.map(a => a.userName)));

  const clearLogs = async () => {
    try {
      setIsDeleting(true);
      setShowConfirmDelete(false);
      notify.loading('جاري مسح السجلات...');
      
      const snap = await getDocs(collection(db, 'user_activity'));
      const docs = snap.docs;
      
      if (docs.length === 0) {
        notify.success('السجل فارغ بالفعل');
        return;
      }

      // Firestore batches are limited to 500 operations
      const CHUNK_SIZE = 450;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      
      notify.success('تم مسح السجلات بنجاح');
    } catch (error) {
      console.error("Clear logs error:", error);
      notify.error('فشل في مسح السجلات. تأكد من الصلاحيات.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-24 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary flex items-center gap-3">
            <History className="w-8 h-8" />
            سجل العمليات والنشاط
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">تتبع تحركات المستخدمين والعمليات الحساسة في النظام</p>
        </div>
        <div className="flex gap-2 relative">
           <AnimatePresence>
             {showConfirmDelete && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, x: 20 }}
                 animate={{ opacity: 1, scale: 1, x: 0 }}
                 exit={{ opacity: 0, scale: 0.9, x: 20 }}
                 className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-100 shadow-2xl p-4 rounded-2xl flex flex-col gap-3 min-w-[240px] ring-1 ring-black/5"
               >
                 <p className="text-[11px] font-black text-gray-600 leading-relaxed">
                   هل أنت متأكد؟ سيتم مسح كافة سجلات العمليات بشكل نهائي.
                 </p>
                 <div className="flex gap-2">
                   <button 
                     onClick={clearLogs}
                     className="flex-1 px-3 py-2 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-colors"
                   >
                     تأكيد المسح
                   </button>
                   <button 
                     onClick={() => setShowConfirmDelete(false)}
                     className="flex-1 px-3 py-2 bg-gray-50 text-gray-400 text-[10px] font-bold rounded-lg hover:bg-gray-100 transition-colors"
                   >
                     تراجع
                   </button>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>

           <button 
             onClick={() => setShowConfirmDelete(!showConfirmDelete)}
             disabled={isDeleting || activities.length === 0}
             className="flex items-center gap-2 px-4 py-2 border border-red-100 text-red-600 bg-red-50 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
           >
             <Trash className="w-4 h-4" />
             مسح السجل
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
         <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4" />
               </div>
               <span className="text-[10px] md:text-xs font-bold text-gray-400">إجمالي السجلات</span>
            </div>
            <p className="text-xl md:text-2xl font-black text-primary">{stats.total}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4" />
               </div>
               <span className="text-[10px] md:text-xs font-bold text-gray-400">عمليات اليوم</span>
            </div>
            <p className="text-xl md:text-2xl font-black text-emerald-600">{stats.today}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4" />
               </div>
               <span className="text-[10px] md:text-xs font-bold text-gray-400">الأكثر نشاطاً</span>
            </div>
            <p className="text-sm md:text-lg font-black text-amber-600 truncate">{stats.mostActive}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
               </div>
               <span className="text-[10px] md:text-xs font-bold text-gray-400">أخطاء/فشل</span>
            </div>
            <p className="text-xl md:text-2xl font-black text-red-600">{stats.errors}</p>
         </div>
      </div>

      {/* Quick User Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-6 items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
        <span className="text-xs font-bold text-gray-400 ml-2">تصفية سريعة بحسب المنفذ:</span>
        <button
          onClick={() => setFilterUser('الكل')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
            filterUser === 'الكل'
              ? 'bg-primary text-white shadow-md'
              : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-150'
          }`}
        >
          الكل
        </button>
        {uniqueUsers.map(user => (
          <button
            key={user}
            onClick={() => setFilterUser(user)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 ${
              filterUser === user
                ? 'bg-primary text-white shadow-md'
                : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-150'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            {user}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className="md:col-span-6 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="بحث في السجل (اسم، عملية، معرف)..."
            className="w-full bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 shadow-sm outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="md:col-span-3 relative">
          <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select 
            className="w-full bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 shadow-sm outline-none transition-all appearance-none cursor-pointer"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="الكل">كل المستخدمين</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3 relative">
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select 
            className="w-full bg-white border border-gray-100 rounded-2xl pr-10 pl-4 py-3 text-sm focus:ring-4 focus:ring-primary/5 shadow-sm outline-none transition-all appearance-none cursor-pointer"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="الكل">كل أنواع العمليات</option>
            <option value="auth">تسجيل الدخول/خروج</option>
            <option value="create">إنشاء وإضافة</option>
            <option value="update">تحديث وتعديل</option>
            <option value="delete">حذف وإزالة</option>
            <option value="sale">مبيعات وفواتير</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden ring-1 ring-black/[0.02]">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">المستخدم</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-center">نوع العملية</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">البيان</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">المعرف / القسم</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">التاريـخ والوقت</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              <AnimatePresence mode="popLayout">
                {filteredActivities.map((activity) => {
                  const type = getActionType(activity.action);
                  return (
                    <motion.tr 
                      key={activity.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedActivity(activity)}
                      className="group cursor-pointer hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:shadow-sm group-hover:text-primary transition-all">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">{activity.userName}</span>
                            <span className="text-[10px] text-gray-400 font-mono">ID: {activity.userId.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="flex justify-center">
                            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100">
                               {getActionIcon(type)}
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[11px] md:text-xs font-black px-3 py-1 rounded-full border ${getActionBg(type)}`}>
                          {activity.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {activity.collection ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-black mb-0.5">
                               <Database className="w-3 h-3" />
                               <span className="uppercase tracking-widest">{activity.collection}</span>
                            </div>
                            <span className="text-[10px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md w-fit">{activity.recordId || '-'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-gray-500">
                          <div className="flex items-center gap-2">
                             <Calendar className="w-3 h-3 text-gray-400" />
                             <span className="text-xs font-bold">
                               {new Date(activity.timestamp).toLocaleDateString('ar-YE')}
                             </span>
                          </div>
                          <span className="text-[10px] text-gray-400 mr-5">
                            {new Date(activity.timestamp).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <button 
                          onClick={() => setSelectedActivity(activity)}
                          className="text-gray-400 hover:text-primary transition-all p-2 hover:bg-white hover:shadow-sm rounded-xl"
                         >
                            <ExternalLink className="w-4 h-4" />
                         </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>

          {filteredActivities.length === 0 && !loading && (
            <div className="p-24 text-center">
              <div className="w-20 h-20 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <History className="w-10 h-10" />
              </div>
              <p className="text-gray-400 font-black text-lg">لا توجد أي نشاطات توافق بحثك</p>
              <button 
                onClick={() => { setSearchTerm(''); setFilterUser('الكل'); setFilterType('الكل'); }}
                className="mt-4 text-primary font-bold text-sm hover:underline"
              >
                إعادة ضبط المرشحات
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative border border-white/20"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-primary">
                      <History className="w-6 h-6" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-primary">تفاصيل العملية</h2>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Operation Deep Insights</p>
                   </div>
                </div>
                <button 
                  onClick={() => setSelectedActivity(null)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                   <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100/50">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                         <User className="w-3.5 h-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">المستخدم المسؤول</span>
                      </div>
                      <p className="font-black text-primary text-lg">{selectedActivity.userName}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-1 opacity-60">UID: {selectedActivity.userId}</p>
                   </div>
                   <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100/50">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                         <Zap className="w-3.5 h-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">نوع القرار / العمل</span>
                      </div>
                      <p className="font-black text-primary text-lg">{selectedActivity.action}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 opacity-60">تعديل مباشر على قاعدة البيانات</p>
                   </div>
                   <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100/50">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                         <Calendar className="w-3.5 h-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">الختم الزمني</span>
                      </div>
                      <p className="font-bold text-gray-700">{new Date(selectedActivity.timestamp).toLocaleString('ar-YE')}</p>
                   </div>
                   <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100/50">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                         <Database className="w-3.5 h-3.5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">المستند المستهدف</span>
                      </div>
                      <p className="font-bold text-gray-700">{selectedActivity.collection || 'غير محدد'} / {selectedActivity.recordId || '-'}</p>
                   </div>
                </div>
                
                {selectedActivity.details && Object.keys(selectedActivity.details).length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-xs font-black text-primary uppercase tracking-widest">مصفوفة البيانات المفصلة</span>
                       </div>
                       <div className="h-px flex-1 bg-gray-100 mx-4 opacity-50" />
                    </div>
                    
                    <div className="bg-slate-900 rounded-3xl p-6 shadow-inner border border-slate-800 relative group">
                      <div className="absolute top-4 left-4 flex gap-1.5">
                         <div className="w-2 h-2 rounded-full bg-red-400/40" />
                         <div className="w-2 h-2 rounded-full bg-amber-400/40" />
                         <div className="w-2 h-2 rounded-full bg-emerald-400/40" />
                      </div>
                      <pre className="text-blue-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed py-2 no-scrollbar">
                        {JSON.stringify(selectedActivity.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-gray-50/50 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedActivity(null)}
                  className="px-10 py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-black text-gray-700 hover:bg-gray-100 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                >
                  إغلاق النافذة
                  <ArrowRightLeft className="w-4 h-4 rotate-90" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
