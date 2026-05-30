import React, { useState } from 'react';
import { FolderLock, Lock, User, AlertCircle } from 'lucide-react';
import logoImg from '../assets/image.jpeg';
export default function LoginView({ onLogin, isLoading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (!username.trim() || !password.trim()) {
      setValidationError('Please enter both username and password.');
      return;
    }

    onLogin(username, password);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-200 p-4 md:p-8">
      {/* Absolute Decorative Background elements for Modern Glassmorphism feel */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        {/* Glowing Brand Card Container */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 md:p-10 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-300">
          
          {/* Header Icon & Title */}
          <div className="flex flex-col items-center mb-8 text-center">
            <img src={logoImg} alt="Shreeji Industries Logo" className="w-28 h-28 object-contain mb-5" />
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1">
              Shreeji Industries
            </h2>
            <p className="text-xs font-black text-blue-600 uppercase tracking-widest">
              DeskManager
            </p>
          </div>

          {/* Form Alert Callout (API errors or Local validation) */}
          {(error || validationError) && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-2xl text-red-700 animate-fadeIn">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="text-sm font-bold leading-snug">
                {validationError || error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div className="space-y-2">
              <label 
                htmlFor="username" 
                className="block text-sm font-bold text-slate-600"
              >
                Username
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <User size={20} />
                </span>
                <input
                  id="username"
                  type="text"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 font-medium text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-sm font-bold text-slate-600"
              >
                Password
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={20} />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 font-medium text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Remember Session Info banner */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
              <span>Session persists on this device</span>
              <span>LAN Access Only</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  {/* CSS-based loading spinner */}
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in...</span>
                </div>
              ) : (
                <span>Sign In to System</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer Subtext */}
        <p className="text-center mt-8 text-sm font-semibold text-slate-400">
          Operator Console &bull; DeskManager v1.1.0
        </p>
      </div>
    </div>
  );
}
