import React from 'react';
import { useTheme, defaultTheme } from '../context/ThemeContext';
import { Settings as SettingsIcon, RotateCcw, Palette, Save, CheckCircle2, Loader2, Database, Check } from 'lucide-react';
import { toast } from 'react-toastify';

const PRESET_COLORS = [
  { name: 'Crimson (Default)', value: '#D9352D' },
  { name: 'Royal Blue', value: '#2563EB' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Fuchsia', value: '#C026D3' },
  { name: 'Rose', value: '#E11D48' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Cyan', value: '#0891B2' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Slate', value: '#334155' }
];

export default function Settings() {
  const { theme, updateTheme, resetTheme, saveTheme, isSaving, lastSaved } = useTheme();

  const currentAccent = theme.secondary || defaultTheme.secondary;

  const handleAccentChange = (value) => {
    updateTheme({ secondary: value });
  };

  const handleReset = async () => {
    await resetTheme();
    toast.success('Accent color reset to default and saved to user profile');
  };

  const handleManualSave = async () => {
    const success = await saveTheme();
    if (success) {
      toast.success('Accent color successfully saved to user table in database!');
    } else {
      toast.error('Failed to save accent color to database. Please check your connection.');
    }
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
              Customize the accent color of DeskManager to your liking.
            </p>
          </div>
        </div>

        {/* Accent Color Section */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-6 shadow-sm transition-colors duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <Palette size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 m-0">Accent Color Customization</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Database size={12} className="opacity-70" />
                    Stored in User Table
                  </span>
                  {isSaving ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <Loader2 size={10} className="animate-spin" />
                      Saving to DB...
                    </span>
                  ) : lastSaved ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 size={10} />
                      Saved
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                Reset Default
              </button>
              <button
                type="button"
                onClick={handleManualSave}
                disabled={isSaving}
                className="px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-white rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: currentAccent }}
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSaving ? 'Saving...' : 'Save Theme'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Accent Color Controls */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">Select Accent Color</h3>
                <p className="text-xs text-slate-500">
                  Used for primary buttons, active links, highlights, and focus borders across the system.
                </p>
              </div>

              {/* Color Presets */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-3">
                  Preset Palettes
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected = currentAccent.toLowerCase() === preset.value.toLowerCase();
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleAccentChange(preset.value)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-slate-800 shadow-xs ring-2 ring-slate-800/10 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white shadow-2xs"
                          style={{ backgroundColor: preset.value }}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="text-[11px] font-medium text-slate-700 truncate">
                          {preset.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Picker */}
              <div className="pt-2 border-t border-slate-200">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                  Custom Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={currentAccent?.startsWith('#') && currentAccent.length === 7 ? currentAccent : '#D9352D'}
                      onChange={(e) => handleAccentChange(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300 p-1 bg-white shadow-2xs"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={currentAccent}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleAccentChange(val.startsWith('#') ? val : '#' + val);
                        }}
                        placeholder="#D9352D"
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none uppercase bg-white"
                        style={{ borderColor: currentAccent }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Hex color code (e.g. #D9352D, #2563EB)
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Live Preview Box */}
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-6 flex flex-col justify-center items-center">
              <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">
                Live Preview
              </h3>
              
              <div 
                className="w-full max-w-sm rounded-xl overflow-hidden shadow-lg border border-slate-200 transition-colors duration-300 flex"
                style={{ backgroundColor: theme.bgApp, color: theme.textPrimary }}
              >
                {/* Mock Sidebar */}
                <div 
                  className="w-16 h-52 flex-shrink-0 transition-colors duration-300 p-2.5 flex flex-col gap-2 border-r border-white/10"
                  style={{ backgroundColor: theme.primary, color: theme.textSidebar }}
                >
                  <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center bg-white/10">
                    <div className="w-3.5 h-3.5 rounded-sm bg-white/90"></div>
                  </div>
                  {/* Active item showing selected accent color */}
                  <div 
                    className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center shadow-sm text-white transition-colors duration-300"
                    style={{ backgroundColor: currentAccent }}
                  >
                    <div className="w-3.5 h-3.5 rounded-sm bg-white"></div>
                  </div>
                  <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center bg-white/5">
                    <div className="w-3.5 h-3.5 rounded-sm bg-white/60"></div>
                  </div>
                </div>

                {/* Mock Content Area */}
                <div className="flex-1 p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-slate-800"></div>
                    <span 
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white transition-colors duration-300"
                      style={{ backgroundColor: currentAccent }}
                    >
                      Active
                    </span>
                  </div>
                  
                  {/* Card / Form Container */}
                  <div 
                    className="flex-1 rounded-lg border p-3 shadow-sm transition-colors duration-300 flex flex-col gap-2 bg-white"
                    style={{ borderColor: theme.borderColor }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-28 rounded bg-slate-300"></div>
                      <span 
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors duration-300"
                        style={{ 
                          color: currentAccent,
                          backgroundColor: 'color-mix(in srgb, ' + currentAccent + ' 12%, transparent)'
                        }}
                      >
                        Accent Tag
                      </span>
                    </div>

                    {/* Mock Input Tag showing accent focus */}
                    <div 
                      className="w-full px-2.5 py-1.5 rounded text-[10px] border font-mono transition-colors duration-300 flex items-center justify-between bg-slate-100 shadow-2xs"
                      style={{ borderColor: currentAccent }}
                    >
                      <span className="opacity-75">Input (Focused)</span>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: currentAccent }}></span>
                    </div>

                    {/* Mock Table showing Accent Highlights */}
                    <div 
                      className="w-full text-[9px] border rounded overflow-hidden transition-colors duration-300"
                      style={{ borderColor: theme.borderColor }}
                    >
                      <div className="px-2 py-1 border-b font-bold flex justify-between uppercase text-[8px] bg-slate-50 text-slate-700">
                        <span>Column</span>
                        <span>Status</span>
                      </div>
                      <div className="px-2 py-1 flex justify-between items-center text-slate-800">
                        <span className="opacity-80">DeskManager</span>
                        <span 
                          className="font-bold text-[8px]"
                          style={{ color: currentAccent }}
                        >
                          ● Highlighted
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      type="button"
                      className="mt-1 px-3 py-1.5 rounded text-white text-[11px] font-bold transition-colors duration-300 shadow-sm self-start"
                      style={{ backgroundColor: currentAccent }}
                    >
                      Primary Button
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-400 mt-6 text-center">
                Accent color updates instantly across all pages and is saved to your user profile.
              </p>
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}
