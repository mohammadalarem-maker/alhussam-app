import { toast } from 'react-hot-toast';

export const notify = {
  success: (message: string) => {
    toast.success(message, {
      style: {
        borderRadius: '12px',
        background: '#3D2B1F',
        color: '#fff',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
      iconTheme: {
        primary: '#8B5E3C',
        secondary: '#fff',
      },
      duration: 1200,
    });
  },
  error: (message: string) => {
    toast.error(message, {
      style: {
        borderRadius: '12px',
        background: '#ef4444',
        color: '#fff',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
      duration: 5000,
    });
  },
  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        borderRadius: '12px',
        background: '#f3f4f6',
        color: '#1f2937',
        direction: 'rtl',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
      },
    });
  }
};
