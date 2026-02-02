
import React from 'react';

interface SystemSettingsProps {
  wallpaper: string;
  onUpdate: (updates: { wallpaper?: string }) => void;
  onOpenPhotos: () => void;
  onBack: () => void;
}

const SystemSettingsApp: React.FC<SystemSettingsProps> = ({ wallpaper, onUpdate, onOpenPhotos, onBack }) => {
  return (
    <div className="flex flex-col h-full bg-[#f2f2f7] text-black app-transition overflow-hidden">
      <div className="pt-7 pb-4 px-6 bg-white border-b border-gray-200 flex items-center shrink-0">
        <h1 onClick={onBack} className="text-xl font-bold tracking-tight cursor-pointer active:opacity-60 transition-opacity">系统设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto pt-6 px-4 space-y-8 pb-32">
        {/* Wallpaper Section - Maximum size for preview */}
        <section className="space-y-3">
          <label className="text-[12px] font-black uppercase text-zinc-400 tracking-widest px-2">主屏幕壁纸</label>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden group">
            <div 
              onClick={onOpenPhotos}
              className="p-4 bg-zinc-50 flex flex-col items-center cursor-pointer active:bg-zinc-100 transition-colors"
            >
              <div className="w-full max-w-[380px] aspect-[16/10] rounded-xl overflow-hidden shadow-xl border border-gray-200 group-active:scale-[0.98] transition-transform">
                <img src={wallpaper} alt="Current Wallpaper" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </section>

        <section className="px-2">
           <p className="text-[10px] text-zinc-400 italic leading-relaxed">系统壁纸设置将自动同步至主屏幕。</p>
        </section>
      </div>
    </div>
  );
};

export default SystemSettingsApp;
