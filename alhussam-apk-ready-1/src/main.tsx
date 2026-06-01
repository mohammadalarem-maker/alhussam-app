import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { testConnection } from './lib/firebase';
import {AuthProvider} from './lib/AuthContext';
import { TranslationProvider } from './lib/translations';

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TranslationProvider>
          <App />
        </TranslationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
