import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Settings as SettingsIcon, RotateCcw, Palette } from 'lucide-react';
import { toast } from 'react-toastify';

export default function Settings() {
  const { theme, updateTheme, resetTheme } = useTheme();

  const handleColorChange = (key, value) => {
    updateTheme({ [key]: value });
  };

  const handleReset = () => {
    resetTheme();
    toast.success('Theme reset to default');
  };

  return (
    <div className="flex-1 p-6 bg-[var(--bg-app)] text-slate-900 min-h-screen transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-[var(--theme-primary)] text-white">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 m-0">Settings</h1>
            <p className="text-xs text-slate-500 mt-1">
              Customize the appearance of DeskManager to your liking.
            </p>
          </div>
        </div>

        {/* Theme Section */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-6 shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Palette size={20} className="text-slate-600" />
              <h2 className="text-lg font-bold text-slate-800">Theme Customization</h2>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              Reset Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Color Pickers */}
            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Primary Color (Sidebar)</label>
                <p className="text-xs text-slate-500 mb-1">Used for sidebar background and major headers.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Sidebar Text Color</label>
                <p className="text-xs text-slate-500 mb-1">The primary text color inside the sidebar.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.textSidebar}
                    onChange={(e) => handleColorChange('textSidebar', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.textSidebar}
                    onChange={(e) => handleColorChange('textSidebar', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Accent Color</label>
                <p className="text-xs text-slate-500 mb-1">Used for primary buttons, active links, and highlights.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">App Background</label>
                <p className="text-xs text-slate-500 mb-1">The main background color of the application pages.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.bgApp}
                    onChange={(e) => handleColorChange('bgApp', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.bgApp}
                    onChange={(e) => handleColorChange('bgApp', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Card & Form Background</label>
                <p className="text-xs text-slate-500 mb-1">The background color for inner cards and forms.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.bgForm}
                    onChange={(e) => handleColorChange('bgForm', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.bgForm}
                    onChange={(e) => handleColorChange('bgForm', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Text Color</label>
                <p className="text-xs text-slate-500 mb-1">The primary color for text across the application.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.textPrimary}
                    onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.textPrimary}
                    onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Border Color</label>
                <p className="text-xs text-slate-500 mb-1">The color for all borders and dividers.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.borderColor}
                    onChange={(e) => handleColorChange('borderColor', e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={theme.borderColor}
                    onChange={(e) => handleColorChange('borderColor', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-secondary)] uppercase bg-white"
                  />
                </div>
              </div>

            </div>

            {/* Preview Box */}
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-6 flex flex-col justify-center items-center">
              <h3 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider">Live Preview</h3>
              
              <div 
                className="w-full max-w-sm rounded-xl overflow-hidden shadow-lg border border-slate-200 transition-colors duration-300 flex"
                style={{ backgroundColor: theme.bgApp, color: theme.textPrimary }}
              >
                {/* Mock Sidebar */}
                <div 
                  className="w-16 h-48 flex-shrink-0 transition-colors duration-300 p-3 flex flex-col gap-3"
                  style={{ backgroundColor: theme.primary, color: theme.textSidebar }}
                >
                  <div className="w-8 h-8 rounded bg-white/20"></div>
                  <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm" style={{ backgroundColor: theme.secondary }}>
                    <div className="w-4 h-4 rounded-sm bg-white/80"></div>
                  </div>
                  <div className="w-8 h-8 rounded bg-white/10"></div>
                </div>

                {/* Mock Content Area */}
                <div className="flex-1 p-4 flex flex-col gap-3">
                  <div className="h-4 w-24 rounded" style={{ backgroundColor: theme.textPrimary, opacity: 0.8 }}></div>
                  
                  <div 
                    className="flex-1 rounded-lg border p-3 shadow-sm transition-colors duration-300"
                    style={{ backgroundColor: theme.bgForm === 'transparent' ? 'transparent' : theme.bgForm, borderColor: theme.borderColor }}
                  >
                    <div className="h-3 w-32 rounded mb-4" style={{ backgroundColor: theme.textPrimary, opacity: 0.5 }}></div>
                    
                    <button 
                      className="px-4 py-2 rounded text-white text-xs font-bold transition-colors duration-300 shadow-sm"
                      style={{ backgroundColor: theme.secondary }}
                    >
                      Primary Action
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-400 mt-6 text-center">
                Changes are applied instantly and saved automatically.
              </p>
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}
