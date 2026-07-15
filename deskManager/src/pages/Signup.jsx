import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logoImg from '../assets/image.jpeg';

export default function SignupView({ onLogin = () => {} }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setApiError('');
    setSuccessMessage('');

    if (!username.trim() || !password.trim()) {
      setValidationError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ownerName: ownerName.trim() || null,
          companyName: companyName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register account');
      }

      setSuccessMessage('Account registered successfully! Logging you in...');
      
      // Store token and user details for automatic sign-in
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('loginTime', Date.now().toString());

      onLogin(data.user);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-200 p-4 md:p-8">
      {/* Decorative Blob backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-6 md:p-8 shadow-md shadow-slate-200/30">
          <div className="flex flex-col items-center mb-6 text-center">
            <img src={logoImg} alt="Logo" className="w-14 h-14 object-contain mb-3 rounded-xl border border-slate-100" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Shreeji Industries</h2>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--theme-color)' }}>
              Create Operator Account
            </p>
          </div>

          {(validationError || apiError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 text-center animate-fade-in">
              {validationError || apiError}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-semibold text-green-600 text-center animate-fade-in">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div className="space-y-1">
                <label htmlFor="username" className="block text-xs font-bold text-slate-600">Username *</label>
                <input
                  id="username"
                  type="text"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="operator_name"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-600">Password *</label>
                <input
                  id="password"
                  type="password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Owner Name */}
              <div className="space-y-1">
                <label htmlFor="ownerName" className="block text-xs font-bold text-slate-600">Owner Name</label>
                <input
                  id="ownerName"
                  type="text"
                  disabled={isLoading}
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Full Name"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                />
              </div>

              {/* Company Name */}
              <div className="space-y-1">
                <label htmlFor="companyName" className="block text-xs font-bold text-slate-600">Company Name</label>
                <input
                  id="companyName"
                  type="text"
                  disabled={isLoading}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Shreeji Ltd"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="space-y-1">
                <label htmlFor="phone" className="block text-xs font-bold text-slate-600">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  disabled={isLoading}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-bold text-slate-600">Email Address</label>
                <input
                  id="email"
                  type="email"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex items-center text-[10px] font-semibold text-slate-400 px-1 pt-1 justify-center">
              <span>All details stored locally on LAN postgres cluster</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-red-500/10 hover:opacity-95"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating Account...</span>
                </div>
              ) : (
                <span>Register & Sign In</span>
              )}
            </button>

            <div className="text-center mt-4">
              <span className="text-xs text-slate-500">Already have an account? </span>
              <Link
                to="/login"
                className="text-xs font-bold transition-colors cursor-pointer"
                style={{ color: 'var(--theme-color)' }}
              >
                Sign In
              </Link>
            </div>
            
            <div className="text-center mt-1">
              <Link
                to="/"
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Back to Home Page
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center mt-6 text-xs font-semibold text-slate-400">Shreeji Industries DeskManager v1.1.0</p>
      </div>
    </div>
  );
}
