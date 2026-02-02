
import React, { useState, useEffect } from 'react';
import StatusBar from './components/StatusBar';
import ChatApp from './components/ChatApp';
import WorldBookApp from './components/WorldBookApp';
import SettingsApp from './components/SettingsApp';
import SystemSettingsApp from './components/SystemSettingsApp';
import PhotosApp from './components/PhotosApp';
import { AppID, Message, WorldEntry, AppState, ApiPreset } from './types';

const App: React.FC = () => {
  const [time, setTime] = useState(new Date());
  
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('gemini_os_state');
    const baseState: AppState = {
      currentApp: 'home',
      messages: [],
      worldEntries: [],
      userName: '',
      userPersona: '',
      aiPersona: '',
      wallpaper: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop',
      historyWallpapers: [],
      fontUrl: '',
      fontFamily: 'Inter, sans-serif',
      apiUrl: '',
      apiKey: '',
      modelName: '',
      temperature: 1.0,
      availableModels: [],
      presets: [],
      chatStyles: {
        bubbleCSS: 'border: 0.5px solid #f0f0f0; box-shadow: 0 1px 2px rgba(0,0,0,0.03);',
        avatarStyle: 'all',
        showUserAvatar: true,
        showModelAvatar: true,
        timestampStyle: 'hidden',
        languageMode: 'zh',
        userTimezone: 'Asia/Shanghai',
        aiTimezone: 'Asia/Shanghai',
        timeAwareness: false,
        translationEnabled: false,
        translationTargetLanguage: 'zh',
        useSeparateTimezones: false,
        showSeconds: false,
        minResponseCount: 1,
        maxResponseCount: 1,
        maxCharacterCount: 15,
        avatarSize: 30,
        avatarRadius: 50,
        bubbleRadius: 15,
        bubblePadding: 9,
        bubbleMaxWidth: 75
      }
    };
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...baseState, 
          ...parsed,
          historyWallpapers: parsed.historyWallpapers || [],
          currentApp: 'home'
        };
      } catch (e) {
        return baseState;
      }
    }
    return baseState;
  });

  useEffect(() => {
    try {
      localStorage.setItem('gemini_os_state', JSON.stringify(state));
    } catch (e) {
      console.warn("存储空间不足，无法保存最新状态。正在尝试清理历史记录...");
      if (state.historyWallpapers.length > 3) {
        setState(prev => ({ ...prev, historyWallpapers: prev.historyWallpapers.slice(0, 3) }));
      }
    }
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const changeApp = (app: AppID) => setState(prev => ({ ...prev, currentApp: app }));
  const handleBack = () => changeApp('home');

  const handleUpdateWallpapers = (urls: string[]) => {
    setState(prev => {
      const filteredOld = prev.historyWallpapers.filter(w => !urls.includes(w));
      const newHistory = [...urls, ...filteredOld].slice(0, 15);
      return { 
        ...prev, 
        wallpaper: urls.length > 0 ? urls[0] : prev.wallpaper, 
        historyWallpapers: newHistory 
      };
    });
  };

  const handleRemoveWallpapers = (urlsToRemove: string[]) => {
    setState(prev => {
      const newHistory = prev.historyWallpapers.filter(url => !urlsToRemove.includes(url));
      let nextWallpaper = prev.wallpaper;
      if (urlsToRemove.includes(prev.wallpaper)) {
        nextWallpaper = newHistory.length > 0 ? newHistory[0] : 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop';
      }
      return {
        ...prev,
        wallpaper: nextWallpaper,
        historyWallpapers: newHistory
      };
    });
  };

  const updateState = (updates: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => {
    setState(prev => {
      const resolvedUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...resolvedUpdates };
    });
  };

  const renderCurrentApp = () => {
    switch (state.currentApp) {
      case 'chat':
        return <ChatApp messages={state.messages} userName={state.userName} userPersona={state.userPersona} aiPersona={state.aiPersona} worldEntries={state.worldEntries} modelName={state.modelName} apiKey={state.apiKey} apiUrl={state.apiUrl} temperature={state.temperature} chatStyles={state.chatStyles} onSendMessage={(c, r) => setState(p => ({ ...p, messages: [...p.messages, { id: Math.random().toString(36).substr(2, 9), content: c, role: r, timestamp: new Date() }] }))} onUpdateState={updateState} onBack={handleBack} />;
      case 'worldbook':
        return <WorldBookApp entries={state.worldEntries} onAddEntry={(e) => setState(p => ({ ...p, worldEntries: [...p.worldEntries, { ...e, id: Math.random().toString(36).substr(2, 9) }] }))} onDeleteEntry={(id) => setState(p => ({ ...p, worldEntries: p.worldEntries.filter(e => e.id !== id) }))} onUpdateState={updateState} onBack={handleBack} />;
      case 'settings':
        return <SettingsApp apiUrl={state.apiUrl} apiKey={state.apiKey} modelName={state.modelName} temperature={state.temperature} availableModels={state.availableModels} presets={state.presets} onUpdateSettings={(u, k, m, t, am, pr) => setState(p => ({ ...p, apiUrl: u, apiKey: k, modelName: m, temperature: t, availableModels: am || p.availableModels, presets: pr || p.presets }))} onBack={handleBack} />;
      case 'system_settings':
        return <SystemSettingsApp wallpaper={state.wallpaper} onUpdate={(u) => setState(p => ({ ...p, ...u }))} onOpenPhotos={() => changeApp('photos')} onBack={handleBack} />;
      case 'photos':
        return <PhotosApp historyWallpapers={state.historyWallpapers} onSelectWallpapers={handleUpdateWallpapers} onRemoveWallpapers={handleRemoveWallpapers} onBack={handleBack} />;
      default:
        return <HomeScreen onLaunchApp={changeApp} wallpaper={state.wallpaper} />;
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans text-black">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src={state.wallpaper} 
          alt="wallpaper" 
          className="w-full h-full object-cover object-center brightness-[0.75] transition-all duration-500 scale-105 select-none" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40"></div>
      </div>
      <StatusBar time={time} />
      <main className="relative z-10 h-full w-full">{renderCurrentApp()}</main>
      {state.currentApp !== 'home' && (
        <div className="absolute bottom-2 left-0 right-0 h-10 flex items-end justify-center z-[100] pb-2 pointer-events-none">
          <div onClick={handleBack} className="w-40 h-1.5 bg-black/40 rounded-full cursor-pointer pointer-events-auto transition-all active:scale-95 shadow-sm" />
        </div>
      )}
    </div>
  );
};

const HomeScreen: React.FC<{ onLaunchApp: (app: AppID) => void; wallpaper: string }> = ({ onLaunchApp }) => {
  const apps = [
    { id: 'chat' as AppID, name: 'Chat', color: 'bg-white/10 backdrop-blur-md', iconColor: 'text-white', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'worldbook' as AppID, name: '世界书', color: 'bg-white/10 backdrop-blur-md', iconColor: 'text-white', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'settings' as AppID, name: 'API', color: 'bg-white/10 backdrop-blur-md', iconColor: 'text-white', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'system_settings' as AppID, name: '系统', color: 'bg-white/10 backdrop-blur-md', iconColor: 'text-white', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z' },
  ];
  return (
    <div className="h-full flex flex-col items-start pt-6 px-6">
      <div className="grid grid-cols-4 gap-x-5 gap-y-8 w-full animate-in fade-in slide-in-from-top-4 duration-700">
        {apps.map(app => (
          <div key={app.id} onClick={(e) => { e.stopPropagation(); onLaunchApp(app.id); }} className="flex flex-col items-center space-y-1.5 cursor-pointer active:scale-90 transition-all group">
            <div className={`w-[60px] h-[60px] rounded-[1.2rem] ${app.color} flex items-center justify-center shadow-xl border border-white/10 group-active:brightness-110`}>
              <svg className={`w-8 h-8 ${app.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={app.icon} /></svg>
            </div>
            <span className="text-[11px] font-medium text-white text-center drop-shadow-lg truncate w-full">{app.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
