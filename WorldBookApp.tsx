
import React, { useState, useMemo, useRef } from 'react';
import { WorldEntry, InjectionPosition, AppState } from '../types';

interface WorldBookProps {
  entries: WorldEntry[];
  onAddEntry: (entry: Omit<WorldEntry, 'id'>) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateState: (updates: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => void;
  onBack: () => void;
}

const WorldBookApp: React.FC<WorldBookProps> = ({ entries, onAddEntry, onDeleteEntry, onUpdateState, onBack }) => {
  const [activeView, setActiveView] = useState<'list' | 'addEntry' | 'addCategory'>('list');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPosition, setNewPosition] = useState<InjectionPosition>('middle');
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const longPressTimer = useRef<any>(null);

  const categories = useMemo(() => {
    const entryCats = entries.map(e => e.category || '未分类');
    // Change '全部' to 'all'
    return Array.from(new Set(['all', ...entryCats, ...customCategories]));
  }, [entries, customCategories]);

  const handleAddOrUpdateEntry = () => {
    if (!newContent) return;
    
    const entryData = {
      title: newTitle.trim(), 
      content: newContent, 
      category: newCategory.trim() || '未分类',
      injectionPosition: newPosition
    };

    if (editingEntryId) {
      onDeleteEntry(editingEntryId);
      onAddEntry(entryData);
    } else {
      onAddEntry(entryData);
    }
    
    resetForm();
  };

  const startEdit = (entry: WorldEntry) => {
    setEditingEntryId(entry.id);
    setNewTitle(entry.title || '');
    setNewCategory(entry.category || '未分类');
    setNewContent(entry.content);
    setNewPosition(entry.injectionPosition || 'middle');
    setActiveView('addEntry');
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (!customCategories.includes(newCategory.trim())) {
      setCustomCategories(prev => [...prev, newCategory.trim()]);
    }
    resetForm();
  };

  const handleDeleteCategory = () => {
    if (!categoryToDelete) return;
    
    const catName = categoryToDelete;
    // 1. Remove from local custom categories
    setCustomCategories(prev => prev.filter(c => c !== catName));
    
    // 2. Re-assign entries in this category to '未分类'
    onUpdateState(prev => ({
      worldEntries: prev.worldEntries.map(e => 
        (e.category === catName || (!e.category && catName === '未分类')) 
          ? { ...e, category: '未分类' } 
          : e
      )
    }));

    // 3. Reset selected category if it was the one deleted
    if (selectedCategory === catName) {
      setSelectedCategory('all');
    }
    
    setCategoryToDelete(null);
  };

  const handleCategoryTouchStart = (cat: string) => {
    if (cat === 'all' || cat === '未分类') return;
    longPressTimer.current = setTimeout(() => {
      setCategoryToDelete(cat);
      if ('vibrate' in navigator) navigator.vibrate(60);
    }, 600);
  };

  const handleCategoryTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const resetForm = () => {
    setEditingEntryId(null);
    setNewTitle('');
    setNewCategory('');
    setNewContent('');
    setNewPosition('middle');
    setActiveView('list');
  };

  const filteredEntries = useMemo(() => {
    if (selectedCategory === 'all') return entries;
    return entries.filter(e => (e.category || '未分类') === selectedCategory);
  }, [entries, selectedCategory]);

  const getPositionLabel = (pos?: InjectionPosition) => {
    switch(pos) {
      case 'front': return '前置';
      case 'back': return '后置';
      default: return '中置';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-black app-transition overflow-hidden relative">
      {/* Header */}
      <div className="pt-7 pb-4 px-4 bg-white flex items-center justify-between shrink-0">
        <div onClick={onBack} className="flex items-center cursor-pointer active:opacity-60 transition-opacity">
          <div>
            <h1 className="text-xl font-black text-black tracking-tight">世界书</h1>
            <p className="text-[9px] text-zinc-400 uppercase tracking-[0.2em] font-bold">Chronicle Archive</p>
          </div>
        </div>
        
        <button 
          onClick={() => setActiveView('addEntry')}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm bg-black text-white active:scale-95`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12m6-6H6" />
          </svg>
        </button>
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto px-4 py-3 bg-white no-scrollbar shrink-0 border-b border-gray-50">
        {categories.map((cat, idx) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            onMouseDown={() => handleCategoryTouchStart(cat)}
            onMouseUp={handleCategoryTouchEnd}
            onMouseLeave={handleCategoryTouchEnd}
            onTouchStart={() => handleCategoryTouchStart(cat)}
            onTouchEnd={handleCategoryTouchEnd}
            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap border ${
              selectedCategory === cat 
                ? 'bg-black text-white border-black shadow-md' 
                : 'bg-white text-black border-black/10 hover:border-black'
            }`}
          >
            {cat === 'all' ? 'all' : cat}
          </button>
        ))}
        <button
          onClick={() => setActiveView('addCategory')}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-black/10 text-black hover:bg-gray-50 transition-colors font-bold text-lg active:scale-90"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white pb-24 px-4 pt-4">
        {activeView === 'addEntry' ? (
          <div className="mb-6 bg-white rounded-2xl p-5 border-[1.5px] border-black space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-black/20">
              {editingEntryId ? '修改内容' : '新建内容'}
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">所属分类</label>
                <select 
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 focus:border-black focus:bg-white focus:outline-none text-black text-sm appearance-none"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                >
                  <option value="">未分类</option>
                  {categories.filter(c => c !== 'all' && c !== '未分类').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">注入位置</label>
                <div className="flex bg-gray-50 p-1 rounded-xl border border-black/5">
                  {(['front', 'middle', 'back'] as InjectionPosition[]).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setNewPosition(pos)}
                      className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                        newPosition === pos ? 'bg-black text-white shadow-sm' : 'text-zinc-400 hover:text-black'
                      }`}
                    >
                      {pos === 'front' ? '前' : pos === 'middle' ? '中' : '后'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">关键词</label>
              <input 
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 focus:border-black focus:bg-white focus:outline-none text-black text-sm font-bold transition-all"
                placeholder="例如：人物姓名、特殊道具、地点..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">设定描述</label>
              <textarea 
                className="w-full h-40 bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:border-black focus:bg-white focus:outline-none resize-none text-black text-sm transition-all font-medium"
                placeholder="例如：这是一把传说中的圣剑，拥有斩断虚空的力量..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
              />
            </div>
            <div className="flex space-x-3 pt-2">
              <button onClick={handleAddOrUpdateEntry} className="flex-1 bg-black text-white py-3.5 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all">
                {editingEntryId ? '完成修改' : '保存'}
              </button>
              <button onClick={resetForm} className="flex-1 bg-white text-black border border-black py-3.5 rounded-xl font-black text-sm active:scale-95 transition-all">取消</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-300 opacity-60">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-xs font-bold uppercase tracking-widest">还没有记载条目</p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div 
                  key={entry.id} 
                  onClick={() => startEdit(entry)}
                  className="px-5 py-4 bg-white rounded-2xl border border-gray-200 transition-all duration-300 animate-in fade-in group cursor-pointer active:bg-gray-50 shadow-sm hover:border-black/20"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[9px] font-black uppercase tracking-wider group-hover:bg-black/5 group-hover:text-black/30 transition-colors">
                          {entry.category || '未分类'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          entry.injectionPosition === 'front' ? 'bg-blue-50 text-blue-400' :
                          entry.injectionPosition === 'back' ? 'bg-orange-50 text-orange-400' :
                          'bg-gray-50 text-gray-300'
                        }`}>
                          {getPositionLabel(entry.injectionPosition)}
                        </span>
                      </div>
                      <p className="text-[14px] text-zinc-600 leading-relaxed font-medium line-clamp-2 whitespace-pre-wrap">
                        {entry.content}
                      </p>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(entry.id);
                      }} 
                      className="p-1.5 text-gray-200 hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Popup: Add Category */}
        {activeView === 'addCategory' && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={resetForm} />
            <div className="relative w-full max-sm bg-white rounded-2xl p-6 border-[2px] border-black space-y-5 animate-in zoom-in-95 duration-200 shadow-2xl">
              <div className="flex flex-col space-y-1">
                <h2 className="text-sm font-black uppercase tracking-widest text-black">新建分类</h2>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Create a new archive folder</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">分类名称</label>
                <input 
                  className="w-full bg-gray-50 border border-black/10 rounded-xl px-4 py-3 focus:border-black focus:bg-white focus:outline-none text-black text-[15px] font-bold transition-all"
                  placeholder="例如：生物、历史、地理..."
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={handleAddCategory} 
                  className="flex-1 bg-black text-white py-3.5 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all"
                >
                  添加
                </button>
                <button 
                  onClick={resetForm} 
                  className="flex-1 bg-white text-black border border-black py-3.5 rounded-xl font-black text-sm active:scale-95 transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup: Delete Category Confirm */}
        {categoryToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-300" onClick={() => setCategoryToDelete(null)} />
            <div className="relative w-full max-w-[280px] bg-white rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <h3 className="text-black text-lg font-bold mb-2">删除分类</h3>
                <p className="text-zinc-500 text-sm">确定要删除分类 "{categoryToDelete}" 吗？该分类下的所有条目将移至 "未分类"。</p>
              </div>
              <div className="flex border-t border-gray-100">
                <button 
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-4 text-black font-medium border-r border-gray-100 active:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleDeleteCategory}
                  className="flex-1 py-4 text-red-500 font-bold active:bg-gray-50 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="h-16 shrink-0" />
    </div>
  );
};

export default WorldBookApp;
