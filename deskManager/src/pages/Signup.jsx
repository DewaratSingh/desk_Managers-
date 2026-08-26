import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logoImg from '../assets/image.jpeg';

export default function SignupView({ onLogin = () => {} }) {
  // User Info States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Company Info States
  const [openCompany, setOpenCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyOwnerName, setCompanyOwnerName] = useState('');

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

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    if (openCompany) {
      if (!companyName.trim()) {
        setValidationError('Company Name is required when opening a company.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: name.trim() || null,
          surname: surname.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          openCompany,
          companyName: openCompany ? companyName.trim() : null,
          companyEmail: openCompany ? companyEmail.trim() : null,
          companyAddress: openCompany ? companyAddress.trim() : null,
          companyPhone: openCompany ? companyPhone.trim() : null,
          companyOwnerName: openCompany ? companyOwnerName.trim() : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register account');
      }

      setSuccessMessage('Account registered successfully! Redirecting to login...');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-200 p-4 md:p-8 overflow-y-auto">
      {/* Decorative Blob backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 my-8 transition-all duration-300">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-6 md:p-8 shadow-md shadow-slate-200/30">
          <div className="flex flex-col items-center mb-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Sign Up</h2>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: User Account Credentials */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">User Account Credentials</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="username" className="block text-xs font-bold text-slate-600">Username *</label>
                  <input
                    id="username"
                    type="text"
                    required
                    disabled={isLoading}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="email" className="block text-xs font-bold text-slate-600">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-600">Confirm Password *</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    disabled={isLoading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: User Personal Profile */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1">Personal Profile</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="name" className="block text-xs font-bold text-slate-600">First Name</label>
                  <input
                    id="name"
                    type="text"
                    disabled={isLoading}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="surname" className="block text-xs font-bold text-slate-600">Surname</label>
                  <input
                    id="surname"
                    type="text"
                    disabled={isLoading}
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    placeholder="Doe"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label htmlFor="phone" className="block text-xs font-bold text-slate-600">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    disabled={isLoading}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Checkbox toggle for opening a company */}
            <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <input
                id="openCompany"
                type="checkbox"
                disabled={isLoading}
                checked={openCompany}
                onChange={(e) => setOpenCompany(e.target.checked)}
                className="w-4 h-4 text-red-500 border-slate-300 rounded  focus:ring-red-400 focus:ring-opacity-25"
              />
              <label htmlFor="openCompany" className="text-xs font-bold text-red-500 select-none cursor-pointer">
                Do you want to open a company?
              </label>
            </div>

            {/* Section 4: Company Details (Conditionally Displayed) */}
            {openCompany && (
              <div className="space-y-3 p-4 bg-slate-50/50 border border-slate-200/50 rounded-xl animate-fade-in space-y-4">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200/60 pb-1">Company Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="companyName" className="block text-xs font-bold text-slate-600">Company Name *</label>
                    <input
                      id="companyName"
                      type="text"
                      required={openCompany}
                      disabled={isLoading}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Shreeji Ltd"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="companyOwnerName" className="block text-xs font-bold text-slate-600">Company Owner Name</label>
                    <input
                      id="companyOwnerName"
                      type="text"
                      disabled={isLoading}
                      value={companyOwnerName}
                      onChange={(e) => setCompanyOwnerName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="companyEmail" className="block text-xs font-bold text-slate-600">Company Email</label>
                    <input
                      id="companyEmail"
                      type="email"
                      disabled={isLoading}
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="info@company.com"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="companyPhone" className="block text-xs font-bold text-slate-600">Company Phone</label>
                    <input
                      id="companyPhone"
                      type="tel"
                      disabled={isLoading}
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="Company Phone"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="companyAddress" className="block text-xs font-bold text-slate-600">Company Address</label>
                  <textarea
                    id="companyAddress"
                    rows={2}
                    disabled={isLoading}
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="123 Industrial Area, Phase 1"
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-60 resize-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-red-500/10 hover:opacity-95"
              style={{ backgroundColor: 'var(--theme-color, #ef4444)' }}
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
                className="text-xs font-bold transition-colors cursor-pointer text-red-500 hover:underline"
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
      </div>
    </div>
  );
}
