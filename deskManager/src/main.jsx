import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { RfqProvider } from './context/RfqContext.jsx'
import { ReceivedQuotationProvider } from './context/ReceivedQuotationContext.jsx'
import { ReleaseOrderProvider } from './context/ReleaseOrderContext.jsx'

// Global window.fetch Interceptor for JWT injection and 401 redirect
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const urlStr = url.toString();
  
  // Attach token if making a call to a protected endpoint
  if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/')) {
    const token = sessionStorage.getItem('token');
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
    sessionStorage.removeItem('token');
    window.location.href = '/login';
  }

  return response;
};


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RfqProvider>
        <ReceivedQuotationProvider>
          <ReleaseOrderProvider>
            <App />
          </ReleaseOrderProvider>
        </ReceivedQuotationProvider>
      </RfqProvider>
    </BrowserRouter>
  </StrictMode>,
)
