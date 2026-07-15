import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
// Inline SVGs are used for icons to avoid adding peer-dependent packages
import logoImg from '../assets/image.jpeg'

// Theme variables
const LOGO_SIZE = 64 // px - compact size for standard form

export default function LoginView({ onLogin = () => {} }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [previousPassword, setPreviousPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    setApiError('')
    setSuccessMessage('')

    if (!username.trim() || !password.trim()) {
      setValidationError('Please enter both username and password.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in')
      }
      
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('loginTime', Date.now().toString())
      
      onLogin(data.user)
      navigate('/dashboard')
    } catch (err) {
      setApiError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    setApiError('')
    setSuccessMessage('')

    if (!username.trim() || !previousPassword.trim() || !newPassword.trim()) {
      setValidationError('Please enter username, previous password, and new password.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, previousPassword, newPassword })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password')
      }
      
      setSuccessMessage('Password changed successfully! You can now log in.')
      setPreviousPassword('')
      setNewPassword('')
      setTimeout(() => {
        setIsChangingPassword(false)
        setSuccessMessage('')
      }, 2500)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-200 p-4 md:p-8">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 transition-all duration-300">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-6 md:p-8 shadow-md shadow-slate-200/30 transition-all duration-200">
          <div className="flex flex-col items-center mb-6 text-center">
            <img src={logoImg} alt="Shreeji Industries Logo" style={{ width: 'var(--logo-size)', height: 'var(--logo-size)' }} className="object-contain mb-4" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Shreeji Industries</h2>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--theme-color)' }}>
              {isChangingPassword ? 'Password Setup' : 'DeskManager'}
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

          {isChangingPassword ? (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="change-username" className="block text-sm font-bold text-slate-600">Username</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    id="change-username"
                    type="text"
                    required
                    disabled={isLoading}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="previous-password" className="block text-sm font-bold text-slate-600">Previous Password</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    id="previous-password"
                    type="password"
                    required
                    disabled={isLoading}
                    value={previousPassword}
                    onChange={(e) => setPreviousPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-password" className="block text-sm font-bold text-slate-600">New Password</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    id="new-password"
                    type="password"
                    required
                    disabled={isLoading}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer" style={{ backgroundColor: 'var(--theme-color)' }}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Updating...</span>
                  </div>
                ) : (
                  <span>Update Password</span>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setIsChangingPassword(false)
                    setValidationError('')
                    setApiError('')
                    setSuccessMessage('')
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-blue-500 transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="username" className="block text-sm font-bold text-slate-600">Username</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    required
                    disabled={isLoading}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-bold text-slate-600">Password</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    id="password"
                    type="password"
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                <span>Session persists on this device</span>
                <span>LAN Access Only</span>
              </div>

              <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer" style={{ backgroundColor: 'var(--theme-color)' }}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
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

              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setIsChangingPassword(true)
                    setValidationError('')
                    setApiError('')
                    setSuccessMessage('')
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-blue-500 transition-colors cursor-pointer"
                >
                  Change Password?
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center mt-8 text-sm font-semibold text-slate-400">Operator Console &bull; DeskManager v1.1.0</p>
      </div>
    </div>
  )
}
