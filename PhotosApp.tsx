
import React, { useState, useRef } from 'react';

interface PhotosAppProps {
  historyWallpapers: string[];
  onSelectWallpapers: (urls: string[]) => void;
  onRemoveWallpapers: (urls: string[]) => void;
  onBack: () => void;
}

const PhotosApp: React.FC<PhotosAppProps> = ({ historyWallpapers, onSelectWallpapers, onRemoveWallpapers, onBack }) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = useRef<any>(null);

  // 图片压缩函数：优化尺寸并防止 localStorage 溢出
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; 
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // 限制单次上传最多15张
      const selectedFiles = Array.from(files).slice(0, 15);
      
      const uploadPromises = selectedFiles.map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            if (ev.target?.result) {
              const compressed = await compressImage(ev.target.result as string);
              resolve(compressed);
            } else {
              resolve("");
            }
          };
          reader.readAsDataURL(file);
        });
      });

      const compressedUrls = (await Promise.all(uploadPromises)).filter(url => url !== "");
      if (compressedUrls.length > 0) {
        onSelectWallpapers(compressedUrls);
      }
    }
  };

  const handleTouchStart = (url: string) => {
    if (isSelectionMode) return;
    longPressTimer.current = setTimeout(() => {
      setIsSelectionMode(true);
      const newSelected = new Set(selectedUrls);
      newSelected.add(url);
      setSelectedUrls(newSelected);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handlePhotoClick = (url: string) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedUrls);
      if (newSelected.has(url)) {
        newSelected.delete(url);
      } else {
        // Enforce the 15-item selection limit
        if (newSelected.size < 15) {
          newSelected.add(url);
        } else {
          // You could add a visual feedback here, like a vibration or alert
          if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
          return;
        }
      }
      setSelectedUrls(newSelected);
      if (newSelected.size === 0) {
        setIsSelectionMode(false);
      }
    } else {
      onSelectWallpapers([url]);
      onBack();
    }
  };

  const handleDelete = () => {
    onRemoveWallpapers(Array.from(selectedUrls));
    setIsSelectionMode(false);
    setSelectedUrls(new Set());
    setShowDeleteConfirm(false);
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedUrls(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-black text-white app-transition relative">
      <div className="pt-7 pb-4 px-6 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 transition-all">
        <div className="flex items-center">
          {isSelectionMode ? (
            <button onClick={cancelSelection} className="text-white text-sm font-bold mr-4 active:opacity-60 transition-opacity">取消</button>
          ) : null}
          <h1 
            onClick={!isSelectionMode ? onBack : undefined} 
            className={`text-xl font-bold ${!isSelectionMode ? 'cursor-pointer active:opacity-60 transition-opacity' : ''}`}
          >
            {isSelectionMode ? `已选择 ${selectedUrls.size} 项` : '壁纸库'}
          </h1>
        </div>
        
        {isSelectionMode ? (
          <div className="flex items-center space-x-2">
            {selectedUrls.size === 15 && <span className="text-[10px] text-zinc-400 font-bold bg-white/10 px-2 py-1 rounded-md">MAX 15</span>}
            <button 
              disabled={selectedUrls.size === 0}
              onClick={() => setShowDeleteConfirm(true)}
              className={`p-2 rounded-full transition-colors ${selectedUrls.size > 0 ? 'bg-red-500/20 text-red-500 active:bg-red-500/40' : 'text-white/20'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ) : (
          <label className="p-2 bg-white/10 rounded-full active:bg-white/20 transition-colors cursor-pointer">
            <input 
               type="file" 
               className="hidden" 
               accept="image/*" 
               multiple 
               onChange={handleFileUpload}
             />
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
             </svg>
          </label>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2">
          {historyWallpapers.map((url, idx) => {
            const isSelected = selectedUrls.has(url);
            return (
              <div 
                key={idx} 
                onClick={() => handlePhotoClick(url)}
                onMouseDown={() => handleTouchStart(url)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={() => handleTouchStart(url)}
                onTouchEnd={handleTouchEnd}
                className={`aspect-square rounded-xl overflow-hidden active:scale-95 transition-all cursor-pointer border relative group ${isSelected ? 'scale-90 border-blue-500' : 'border-white/5'}`}
              >
                <img src={url} alt={`History ${idx}`} className={`w-full h-full object-cover transition-all ${isSelected ? 'brightness-50' : ''}`} />
                {isSelectionMode && (
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-black/20 border-white/50'}`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 group-active:bg-transparent transition-colors" />
              </div>
            );
          })}
          
          {historyWallpapers.length === 0 && (
            <div className="col-span-3 py-20 flex flex-col items-center justify-center opacity-30 select-none">
               <p className="text-[10px] font-bold uppercase tracking-[0.3em]">暂无历史上传</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-[280px] bg-white rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <h3 className="text-black text-lg font-bold mb-2">删除照片</h3>
              <p className="text-zinc-500 text-sm">确定要删除选中的 {selectedUrls.size} 张照片吗？此操作无法撤销。</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-4 text-black font-medium border-r border-gray-100 active:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-4 text-red-500 font-bold active:bg-gray-50 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotosApp;
