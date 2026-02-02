
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ApiPreset } from '../types';

interface SettingsProps {
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  availableModels: string[];
  presets: ApiPreset[];
  onUpdateSettings: (apiUrl: string, apiKey: string, modelName: string, temperature: number, availableModels?: string[], presets?: ApiPreset[]) => void;
  onBack: () => void;
}

const SettingsApp: React.FC<SettingsProps> = ({ apiUrl, apiKey, modelName, temperature, availableModels, presets, onUpdateSettings, onBack }) => {
  const [tempUrl, setTempUrl] = useState(apiUrl);
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempModel, setTempModel] = useState(modelName);
  const [tempTemperature, setTempTemperature] = useState(temperature);
  const [currentModels, setCurrentModels] = useState<string[]>(availableModels);
  const [currentPresets, setCurrentPresets] = useState<ApiPreset[]>(presets);
  const [isSaved, setIsSaved] = useState(false);
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'success' | 'error'>('idle');
  const [presetName, setPresetName] = useState('');
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 计算当前配置是否完全匹配某个预设
  const activePreset = useMemo(() => {
    return currentPresets.find(p => 
      p.apiUrl === tempUrl && 
      p.apiKey === tempKey && 
      p.modelName === tempModel && 
      Math.abs((p.temperature ?? 1.0) - tempTemperature) < 0.01
    );
  }, [tempUrl, tempKey, tempModel, tempTemperature, currentPresets]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 输入密钥时自动拉取模型 (简单的防抖)
  useEffect(() => {
    if (tempKey && tempUrl && tempKey.length > 5) {
      const timer = setTimeout(() => {
        handlePullModels(tempUrl, tempKey);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tempKey, tempUrl]);

  const handleGlobalSave = () => {
    onUpdateSettings(tempUrl, tempKey.trim(), tempModel, tempTemperature, currentModels, currentPresets);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddPreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ApiPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name: presetName,
      apiUrl: tempUrl,
      apiKey: tempKey.trim(),
      modelName: tempModel,
      temperature: tempTemperature
    };
    const updatedPresets = [...currentPresets, newPreset];
    setCurrentPresets(updatedPresets);
    setPresetName('');
    setShowAddPreset(false);
    onUpdateSettings(tempUrl, tempKey.trim(), tempModel, tempTemperature, currentModels, updatedPresets);
  };

  const selectPreset = (preset: ApiPreset) => {
    setTempUrl(preset.apiUrl);
    setTempKey(preset.apiKey);
    setTempModel(preset.modelName);
    setTempTemperature(preset.temperature ?? 1.0);
    setIsDropdownOpen(false);
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // 防止触发选中
    const updatedPresets = currentPresets.filter(p => p.id !== id);
    setCurrentPresets(updatedPresets);
    onUpdateSettings(tempUrl, tempKey, tempModel, tempTemperature, currentModels, updatedPresets);
  };

  const handlePullModels = async (targetUrl?: string, targetKey?: string) => {
    const urlToUse = targetUrl || tempUrl;
    const keyToUse = (targetKey || tempKey || '').trim();

    if (!keyToUse || !urlToUse) return;

    setPullStatus('pulling');
    const base = urlToUse.replace(/\/$/, '');
    
    try {
      let pulledModels: string[] = [];
      
      try {
        const response = await fetch(`${base}/v1beta/models?key=${keyToUse}`);
        if (response.ok) {
          const data = await response.json();
          if (data.models) {
            pulledModels = data.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => m.name.replace('models/', ''));
          }
        }
      } catch (e) {}

      if (pulledModels.length === 0) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        // Check for non ISO-8859-1 characters to avoid browser fetch error
        if (/^[\x00-\x7F]*$/.test(keyToUse)) {
          headers['Authorization'] = `Bearer ${keyToUse}`;
        }

        const response = await fetch(`${base}/v1/models`, {
          headers: headers
        });
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            pulledModels = data.data.map((m: any) => m.id);
          }
        }
      }

      if (pulledModels.length > 0) {
        const uniqueModels = Array.from(new Set(pulledModels)).sort();
        setCurrentModels(uniqueModels);
        if (!uniqueModels.includes(tempModel)) {
          setTempModel(uniqueModels[0]);
        }
        setPullStatus('success');
      } else {
        throw new Error('未获取到有效模型列表');
      }
    } catch (error) {
      console.error('拉取模型失败:', error);
      setPullStatus('error');
    } finally {
      setTimeout(() => setPullStatus('idle'), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] text-black app-transition overflow-hidden relative">
      <div className="pt-7 pb-4 px-6 bg-white border-b border-gray-200 flex items-center shrink-0">
        <h1 onClick={onBack} className="text-xl font-bold tracking-tight text-black cursor-pointer active:opacity-60 transition-opacity">API 设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 px-4 pb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100 mb-6">
          
          {/* 自定义预设下拉菜单 */}
          <div className="p-4 flex flex-col space-y-1 relative" ref={dropdownRef}>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">预设</span>
            <div 
              className={`text-[16px] font-medium w-full cursor-pointer py-1 transition-colors ${
                !activePreset ? "text-zinc-400" : "text-black"
              }`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {activePreset ? activePreset.name : "点击切换预设"}
            </div>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 mx-4 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="max-h-48 overflow-y-auto py-2">
                  {currentPresets.length > 0 ? (
                    currentPresets.map(p => (
                      <div 
                        key={p.id}
                        className={`flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer ${
                          activePreset?.id === p.id ? 'bg-zinc-50 font-bold' : ''
                        }`}
                        onClick={() => selectPreset(p)}
                      >
                        <span className="text-sm truncate mr-4">{p.name}</span>
                        <button 
                          onClick={(e) => handleDeletePreset(e, p.id)}
                          className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-zinc-400 text-center uppercase tracking-widest font-bold">暂无预设</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">API 地址</span>
            <input 
              className="text-[16px] font-medium bg-transparent focus:outline-none w-full text-black placeholder-gray-300"
              value={tempUrl}
              onChange={e => setTempUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="p-4 flex flex-col space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">密钥（key）</span>
            <input 
              type="password"
              className="text-[16px] font-medium bg-transparent focus:outline-none w-full text-black placeholder-gray-300"
              value={tempKey}
              onChange={e => setTempKey(e.target.value)}
              placeholder="输入密钥以自动加载模型"
            />
          </div>

          <div className="p-4 flex flex-col space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">模型列表</span>
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                {currentModels.length > 0 ? (
                  <select 
                    className="text-[16px] font-medium bg-transparent focus:outline-none w-full text-black appearance-none cursor-pointer"
                    value={tempModel}
                    onChange={e => setTempModel(e.target.value)}
                  >
                    {currentModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[14px] text-zinc-300 font-medium">请等待拉取...</div>
                )}
              </div>
              <button 
                onClick={() => handlePullModels()}
                disabled={pullStatus === 'pulling'}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 shrink-0 min-w-[75px] border ${
                  pullStatus === 'pulling' ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 
                  pullStatus === 'success' ? 'bg-black text-white border-black' :
                  pullStatus === 'error' ? 'bg-zinc-200 text-black border-zinc-300' :
                  'bg-white text-black border-black'
                }`}
              >
                {pullStatus === 'pulling' ? '拉取中...' : 
                 pullStatus === 'success' ? '拉取成功' :
                 pullStatus === 'error' ? '拉取失败' :
                 '拉取模型'}
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">温度 (Temperature)</span>
              <span className="text-sm font-bold text-black border border-black px-2 py-0.5 rounded-lg">{tempTemperature.toFixed(1)}</span>
            </div>
            <input 
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={tempTemperature}
              onChange={e => setTempTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={handleGlobalSave}
            className="w-full py-4 rounded-2xl font-bold transition-all border-[1.5px] border-black shadow-lg active:scale-95 flex items-center justify-center bg-black text-white"
          >
            {isSaved ? '✓ 已保存' : '保存设置'}
          </button>

          {!showAddPreset ? (
            <button 
              onClick={() => setShowAddPreset(true)}
              className="w-full py-3 px-4 bg-white border border-zinc-300 border-dashed rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-50 active:scale-[0.99] transition-all"
            >
              <svg className="w-4 h-4 mr-1.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">保存当前为新预设</span>
            </button>
          ) : (
            <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[11px] font-bold text-zinc-500 uppercase mb-3 tracking-tight">为该配置命名</p>
              <div className="flex space-x-2">
                <input 
                  autoFocus
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-black focus:outline-none focus:border-zinc-400"
                  placeholder="例如: 工作助手"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddPreset()}
                />
                <div className="flex space-x-1">
                  <button onClick={handleAddPreset} className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95">确定</button>
                  <button onClick={() => {setShowAddPreset(false); setPresetName('');}} className="bg-white text-zinc-500 border border-zinc-200 px-3 py-2 rounded-xl text-xs font-bold active:scale-95">取消</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsApp;
