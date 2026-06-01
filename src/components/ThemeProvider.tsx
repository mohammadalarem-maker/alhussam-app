import React, { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const primaryColor = '#541919';
        const secondaryColor = '#B3803E';
        const isDark = data.isDarkMode || false;
        
        // Inject CSS variables
        document.documentElement.style.setProperty('--primary', primaryColor);
        document.documentElement.style.setProperty('--secondary', secondaryColor);
        
        // Handle dark mode class
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.setProperty('--background', '#0F172A'); // Set a dark background
          document.documentElement.style.setProperty('--surface', '#1E293B');
          document.documentElement.style.setProperty('--text', '#F8FAFC');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.setProperty('--background', '#F9FAFB');
          document.documentElement.style.setProperty('--surface', '#FFFFFF');
          document.documentElement.style.setProperty('--text', '#111827');
        }
      }
    });
    return () => unsub();
  }, []);

  return <>{children}</>;
}
