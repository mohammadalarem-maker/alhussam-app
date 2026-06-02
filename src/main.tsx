import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { testConnection } from './lib/firebase';
import {AuthProvider} from './lib/AuthContext';
import { TranslationProvider } from './lib/translations';
import { CurrencyProvider } from './lib/CurrencyContext'; // تم إضافة الاستيراد هنا للعملات

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TranslationProvider>
          <CurrencyProvider> {/* تم تغليف التطبيق هنا بنظام العملات الجديد */}
            <App />
          </CurrencyProvider>
        </TranslationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

