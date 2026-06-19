import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Global window.fetch Interceptor for JWT injection and 401 redirect
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const urlStr = url.toString();
  
  // Attach token if making a call to a protected endpoint
  if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/')) {
    const token = localStorage.getItem('token');
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }

  const response = await originalFetch(url, options);

  // If unauthorized, clear session and force login redirection
  if (response.status === 401 && urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    window.location.href = '/login';
  }

  return response;
};


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
