import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CORRECT_PIN = import.meta.env.VITE_APP_PIN || '121212'; // PIN statis untuk panitia (diambil dari env)

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      sessionStorage.setItem('scanner_auth', 'true');
      navigate('/scan');
    } else {
      setError('PIN salah. Silakan coba lagi.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blush-50 via-white to-pink-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows for desktop aesthetics */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-blush-100/50 blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-pink-100/50 blur-[100px] pointer-events-none z-0"></div>

      <div className="glass-card w-full max-w-md md:max-w-lg p-8 md:p-12 rounded-3xl text-center shadow-2xl relative z-10 animate-fade-in border-t-4 border-t-blush-400">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-blush-900 mb-3 tracking-wide">
          Scanner Panitia
        </h1>
        <p className="text-sm md:text-base text-text-light mb-8 max-w-xs md:max-w-md mx-auto">
          Silakan masukkan PIN keamanan untuk mengakses kamera pemindai QR Code
        </p>

        <form onSubmit={handleLogin} className="space-y-6 max-w-sm mx-auto">
          <div className="space-y-2">
            <input
              type="password"
              pattern="[0-9]*"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Masukkan PIN"
              className="w-full text-center text-3xl tracking-[0.4em] font-mono px-4 py-3 md:py-4 border border-blush-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blush-500 focus:border-transparent bg-white shadow-inner transition-all"
              maxLength={6}
              required
            />
            {error && <p className="text-red-500 text-xs font-semibold mt-1.5">{error}</p>}
          </div>
          
          <button
            type="submit"
            className="w-full bg-blush-600 hover:bg-blush-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 text-base md:text-lg"
          >
            Masuk ke Aplikasi
          </button>
        </form>
      </div>
    </div>
  );
}
