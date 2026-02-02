
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, AppState, WorldEntry, ChatStyles, AvatarStyle, TimestampStyle, ResponseLanguage, RegionTimezone } from '../types';
import { aiService } from '../services/geminiService';

interface ChatAppProps {
  messages: Message[];
  userName: string;
  userPersona: string;
  aiPersona: string;
  worldEntries: WorldEntry[];
  modelName: string;
  apiKey: string;
  apiUrl: string;
  temperature: number;
  chatStyles: ChatStyles;
  onSendMessage: (content: string, role: 'user' | 'model') => void;
  onUpdateState: (updates: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => void;
  onBack: () => void;
}

type ConfigTab = 'persona' | 'settings' | 'beautify';

interface ContextMenuState {
  message: Message;
  x: number;
  y: number;
  isUser: boolean;
}

const ChatApp: React.FC<ChatAppProps> = ({ 
  messages, userName, userPersona, aiPersona, worldEntries, modelName, apiKey, apiUrl, temperature, chatStyles,
  onSendMessage, onUpdateState, onBack 
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTab>('persona');
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<any>(null);

  const [minInput, setMinInput] = useState(chatStyles.minResponseCount > 0 ? chatStyles.minResponseCount.toString() : '');
  const [maxInput, setMaxInput] = useState(chatStyles.maxResponseCount > 0 ? chatStyles.maxResponseCount.toString() : '');
  const [maxCharsInput, setMaxCharsInput] = useState(chatStyles.maxCharacterCount > 0 ? chatStyles.maxCharacterCount.toString() : '');

  const canReceive = messages.length > 0 && messages[messages.length - 1].role === 'user' && !isTyping;

  useEffect(() => {
    if (!chatStyles.translationEnabled) {
      onUpdateState(prev => {
        const hasVisibleTranslation = prev.messages.some(m => m.showTranslation);
        if (!hasVisibleTranslation) return {}; 
        return {
          messages: prev.messages.map(m => ({ ...m, showTranslation: false }))
        };
      });
    }
  }, [chatStyles.translationEnabled]);

  useEffect(() => {
    aiService.initChat({
      userName,
      aiPersona,
      userPersona,
      worldEntries,
      modelName,
      apiKey,
      apiUrl,
      temperature,
      language: chatStyles.languageMode,
      timeAwareness: chatStyles.timeAwareness,
      userTimezone: chatStyles.userTimezone,
      aiTimezone: chatStyles.aiTimezone,
      minResponseCount: chatStyles.minResponseCount,
      maxResponseCount: chatStyles.maxResponseCount,
      maxCharacterCount: chatStyles.maxCharacterCount
    });
  }, [modelName, apiKey, apiUrl, userName, worldEntries, temperature, aiPersona, userPersona, chatStyles]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input;
    setInput('');
    onSendMessage(userMsg, 'user');
  };

  const handleReceive = useCallback(async (customMessage?: string) => {
    if (isTyping) return;
    setIsTyping(true);
    try {
      let fullResponse = '';
      const lastUserMsg = customMessage || (messages.length > 0 ? messages[messages.length - 1].content : '');
      if (!lastUserMsg) throw new Error("没有可回复的消息");

      const historyExceptLast = customMessage ? messages : messages.slice(0, -1);
      const stream = aiService.sendMessageStream(lastUserMsg, historyExceptLast);
      for await (const chunk of stream) {
        fullResponse += chunk;
      }

      const msgs = fullResponse.split('---MSG_BREAK---').filter(m => m.trim());
      if (msgs.length > 0) {
        msgs.forEach(m => onSendMessage(m.trim(), 'model'));
      } else if (fullResponse.trim()) {
        onSendMessage(fullResponse.trim(), 'model');
      }
    } catch (error: any) {
      onSendMessage(`连接失败: ${error.message || "未知ERROR"}`, 'model');
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, onSendMessage]);

  const handleTranslate = async (msgId: string) => {
    const currentMsg = messages.find(m => m.id === msgId);
    if (!currentMsg || currentMsg.role === 'user' || !chatStyles.translationEnabled) return;

    // 检查是否已经是显示翻译的状态
    if (currentMsg.showTranslation) {
      // 检查当前翻译是否是错误信息，如果是，则允许重试而不只是关闭
      const isError = currentMsg.translatedContent === "翻译失败" || currentMsg.translatedContent === "翻译服务暂不可用";
      if (!isError) {
        onUpdateState(prev => ({
          messages: prev.messages.map(m => m.id === msgId ? { ...m, showTranslation: false } : m)
        }));
        return;
      }
    }

    // 触发翻译逻辑：尚未有翻译内容，或翻译内容为错误提示
    const isError = currentMsg.translatedContent === "翻译失败" || currentMsg.translatedContent === "翻译服务暂不可用";
    if (!currentMsg.translatedContent || isError) {
      try {
        // 先设为翻译中状态（或者重置错误信息）
        onUpdateState(prev => ({
          messages: prev.messages.map(m => 
            m.id === msgId ? { ...m, showTranslation: true, translatedContent: "正在翻译..." } : m
          )
        }));
        
        const result = await aiService.translateText(currentMsg.content, chatStyles.translationTargetLanguage);
        
        onUpdateState(prev => ({
          messages: prev.messages.map(m => 
            m.id === msgId ? { ...m, translatedContent: result, showTranslation: true } : m
          )
        }));
      } catch (error) {
        onUpdateState(prev => ({
          messages: prev.messages.map(m => 
            m.id === msgId ? { ...m, translatedContent: "翻译失败", showTranslation: true } : m
          )
        }));
      }
    } else {
      // 已经有正确的翻译内容了，直接显示
      onUpdateState(prev => ({
        messages: prev.messages.map(m => m.id === msgId ? { ...m, showTranslation: true } : m)
      }));
    }
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, msg: Message) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        message: msg,
        x: clientX,
        y: clientY,
        isUser: msg.role === 'user'
      });
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMenu(null);
  };

  const deleteMessage = (id: string) => {
    onUpdateState(prev => ({
      messages: prev.messages.filter(m => m.id !== id)
    }));
    setContextMenu(null);
  };

  const resendMessage = (msg: Message) => {
    setContextMenu(null);
    if (msg.role === 'model') {
      onUpdateState(prev => ({
        messages: prev.messages.filter(m => m.id !== msg.id)
      }));
      setTimeout(() => handleReceive(), 100);
    } else {
      handleReceive(msg.content);
    }
  };

  const startEditing = (msg: Message) => {
    setEditingMessage(msg);
    setEditBuffer(msg.content);
    setContextMenu(null);
  };

  const saveEdit = () => {
    if (editingMessage && editBuffer.trim()) {
      onUpdateState(prev => ({
        messages: prev.messages.map(m => 
          m.id === editingMessage.id ? { ...m, content: editBuffer } : m
        )
      }));
      setEditingMessage(null);
    }
  };

  const quoteMessage = (msg: Message) => {
    setInput(`「${msg.content.slice(0, 20)}${msg.content.length > 20 ? '...' : ''}」\n${input}`);
    setContextMenu(null);
  };

  const getBubbleStyle = (role: 'user' | 'model', isPreview: boolean = false) => {
    const css = chatStyles.bubbleCSS || '';
    const sizeBase = chatStyles.bubblePadding || 16;
    
    const paddingX = sizeBase;
    const paddingY = sizeBase * 0.6;
    const fontSize = 13 + (sizeBase - 8) * 0.15;

    const style: any = {
        borderRadius: `${chatStyles.bubbleRadius || 20}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
        fontSize: `${fontSize}px`,
        lineHeight: '1.4',
        background: role === 'model' ? 'white' : 'black',
        color: role === 'model' ? 'black' : 'white',
        cursor: (role === 'model' && chatStyles.translationEnabled) ? 'pointer' : 'default',
        whiteSpace: isPreview ? 'nowrap' : 'pre-wrap',
        transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1.2)' // 改进的弹簧效果
    };
    
    css.split(';').forEach(rule => {
      const [prop, val] = rule.split(':');
      if (prop && val) {
        const camelProp = prop.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
        style[camelProp] = val.trim();
      }
    });
    return style;
  };

  const getAvatarStyle = (role: 'user' | 'model') => {
    return {
      width: `${chatStyles.avatarSize || 32}px`,
      height: `${chatStyles.avatarSize || 32}px`,
      borderRadius: chatStyles.avatarRadius === 50 ? '50%' : `${chatStyles.avatarRadius || 8}px`,
      fontSize: `${(chatStyles.avatarSize || 32) * 0.35}px`
    };
  };

  const formatMessageTime = (date: Date, role: 'user' | 'model') => {
    const timezone = chatStyles.useSeparateTimezones 
      ? (role === 'model' ? chatStyles.aiTimezone : chatStyles.userTimezone)
      : 'Asia/Shanghai';
    
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      ...(chatStyles.showSeconds ? { second: '2-digit' } : {}),
      hour12: false,
      timeZone: timezone
    }).format(date);
  };

  const shouldShowAvatar = (index: number, role: 'user' | 'model') => {
    const { avatarStyle, showUserAvatar, showModelAvatar } = chatStyles;
    const isVisible = role === 'user' ? showUserAvatar : showModelAvatar;
    
    if (!isVisible) return false;
    if (avatarStyle === 'all') return true;

    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];
    
    if (avatarStyle === 'first' || avatarStyle === 'above_bubble') return !prevMsg || prevMsg.role !== role;
    if (avatarStyle === 'last') return !nextMsg || nextMsg.role !== role;
    return true;
  };

  const shouldReserveAvatarSpace = (role: 'user' | 'model') => {
    if (chatStyles.avatarStyle === 'above_bubble') return false;
    return role === 'user' ? chatStyles.showUserAvatar : chatStyles.showModelAvatar;
  };

  const timezoneOptions = [
    { label: '中国', value: 'Asia/Shanghai' as RegionTimezone },
    { label: '日本', value: 'Asia/Tokyo' as RegionTimezone },
    { label: '韩国', value: 'Asia/Seoul' as RegionTimezone },
    { label: '美国', value: 'America/New_York' as RegionTimezone },
  ];

  const languageOptions = [
    { label: '中文', value: 'zh' as ResponseLanguage },
    { label: '日语', value: 'ja' as ResponseLanguage },
    { label: '英语', value: 'en' as ResponseLanguage },
    { label: '韩语', value: 'ko' as ResponseLanguage },
  ];

  const avatarDisplayOptions = [
    { label: '全部显示', value: 'all' as AvatarStyle },
    { label: '仅首条', value: 'first' as AvatarStyle },
    { label: '仅末尾', value: 'last' as AvatarStyle },
    { label: '气泡上方', value: 'above_bubble' as AvatarStyle },
  ];

  const timestampStylesOptions = [
    { label: '全部隐藏', value: 'hidden' as TimestampStyle },
    { label: '气泡下方', value: 'below_bubble' as TimestampStyle },
    { label: '气泡侧边（全部）', value: 'beside_bubble' as TimestampStyle },
    { label: '气泡侧边（最后）', value: 'beside_bubble_last' as TimestampStyle },
    { label: '头像下方', value: 'below_avatar' as TimestampStyle },
    { label: '气泡内', value: 'inside_bubble' as TimestampStyle },
  ];

  const renderPicker = () => {
    if (!activePicker) return null;

    let title = "";
    let options: { label: string; value: any; short?: string }[] = [];
    let currentVal: any;
    let onSelect: (val: any) => void;

    switch (activePicker) {
      case 'avatarFrequency': title = "头像显示"; options = avatarDisplayOptions; currentVal = chatStyles.avatarStyle; onSelect = (v) => onUpdateState({ chatStyles: { ...chatStyles, avatarStyle: v } }); break;
      case 'timestamp': title = "时间戳样式"; options = timestampStylesOptions; currentVal = chatStyles.timestampStyle; onSelect = (v) => onUpdateState({ chatStyles: { ...chatStyles, timestampStyle: v } }); break;
      case 'language': title = "角色回复语言"; options = languageOptions; currentVal = chatStyles.languageMode; onSelect = (v) => onUpdateState({ chatStyles: { ...chatStyles, languageMode: v } }); break;
      case 'translateTarget': title = "自动翻译"; options = languageOptions; currentVal = chatStyles.translationTargetLanguage; onSelect = (v) => onUpdateState({ chatStyles: { ...chatStyles, translationEnabled: !chatStyles.translationEnabled, translationTargetLanguage: v } }); break;
      case 'aiRegion': title = "角色国家"; options = timezoneOptions; currentVal = chatStyles.aiTimezone; onSelect = (v) => onUpdateState({ chatStyles: { ...chatStyles, aiTimezone: v } }); break;
      case 'userRegion': title = "我的国家"; options = timezoneOptions; currentVal = chatStyles.userTimezone; onSelect = (v) => onUpdateState({ chatStyles: { ...chatStyles, userTimezone: v } }); break;
    }

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-[300px] bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-black/30">{title}</h3>
            <button onClick={() => setActivePicker(null)} className="p-1">
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); setActivePicker(null); }}
                className={`py-3 px-2 rounded-2xl text-[12px] font-black transition-all border ${
                  currentVal === opt.value ? 'bg-black text-white border-black shadow-lg' : 'bg-gray-50 text-black border-transparent hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const SplitSettingRow = ({ leftLabel, leftValue, onLeftClick, rightLabel, rightValue, onRightClick, rightIsToggle = false, rightToggleValue = false, onRightToggle = () => {} }: any) => (
    <div className="flex bg-white border-b border-gray-50 last:border-none">
      <div onClick={onLeftClick} className="flex-1 flex items-center justify-between p-4 border-r border-gray-50 active:bg-gray-50 transition-colors">
        <span className="text-[14px] font-bold text-black shrink-0">{leftLabel}</span>
        <span className="text-[12px] font-medium text-zinc-400 text-right truncate ml-2">{leftValue}</span>
      </div>
      <div onClick={rightIsToggle ? undefined : onRightClick} className="flex-1 flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative">
        <span className="text-[14px] font-bold text-black shrink-0">{rightLabel}</span>
        <div className="flex items-center space-x-2">
          {rightIsToggle ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); onRightClick(); }} className={`text-[12px] font-medium transition-colors ${rightToggleValue ? 'text-zinc-400 hover:text-black' : 'text-zinc-200 cursor-default'}`} disabled={!rightToggleValue}>{rightValue}</button>
              <div onClick={(e) => { e.stopPropagation(); onRightToggle(); }} className={`w-10 h-5 rounded-full relative transition-all duration-300 shrink-0 ${rightToggleValue ? 'bg-black' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 ${rightToggleValue ? 'translate-x-5' : ''}`} />
              </div>
            </>
          ) : (
            <span className="text-[12px] font-medium text-zinc-400 shrink-0">{rightValue}</span>
          )}
        </div>
      </div>
    </div>
  );

  const SplitToggleRow = ({ leftLabel, leftValue, onLeftToggle, rightLabel, rightValue, onRightToggle }: any) => (
    <div className="flex bg-white border-b border-gray-50 last:border-none">
      <div onClick={onLeftToggle} className="flex-1 flex items-center justify-between p-4 border-r border-gray-50 active:bg-gray-50 transition-colors">
        <span className="text-[14px] font-bold text-black shrink-0">{leftLabel}</span>
        <div className={`w-10 h-5 rounded-full relative transition-all duration-300 shrink-0 ${leftValue ? 'bg-black' : 'bg-gray-200'}`}>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 ${leftValue ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      <div onClick={onRightToggle} className="flex-1 flex items-center justify-between p-4 active:bg-gray-50 transition-colors relative">
        <span className="text-[14px] font-bold text-black shrink-0">{rightLabel}</span>
        <div className={`w-10 h-5 rounded-full relative transition-all duration-300 shrink-0 ${rightValue ? 'bg-black' : 'bg-gray-200'}`}>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 ${rightValue ? 'translate-x-5' : ''}`} />
        </div>
      </div>
    </div>
  );

  const SettingToggle = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
    <div onClick={onToggle} className="flex items-center justify-between p-4 bg-white active:bg-gray-50 transition-colors border-b border-gray-50 first:rounded-t-[20px] last:rounded-b-[20px] last:border-none">
      <span className="text-[14px] font-bold text-black">{label}</span>
      <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${value ? 'bg-black' : 'bg-gray-200'}`}>
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${value ? 'translate-x-6' : ''}`} />
      </div>
    </div>
  );

  const handleClearHistory = () => { onUpdateState({ messages: [] }); setShowClearConfirm(false); };

  const dynamicTimeFontSize = 13;
  const isAboveMode = chatStyles.avatarStyle === 'above_bubble';

  return (
    <div className="flex flex-col h-full bg-white text-black app-transition relative overflow-hidden">
      {/* Header */}
      <div className="pt-7 pb-4 px-4 border-b border-gray-100 flex items-center bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div onClick={onBack} className="flex-1 overflow-hidden cursor-pointer active:opacity-60 transition-opacity">
          <h1 className="text-lg font-bold truncate">AI 助手</h1>
          <p className="text-[10px] text-zinc-400 truncate tracking-tight">{modelName || '未配置智能体'}</p>
        </div>
        <button onClick={() => { setIsConfigOpen(true); setActiveTab('persona'); }} className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center transition-all bg-black shadow-md overflow-hidden active:scale-95"><span className="text-xs font-black text-white">AI</span></button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-0 bg-white no-scrollbar pb-10">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
            <div className="w-16 h-16 border-2 border-black rounded-full mb-4 flex items-center justify-center"><span className="font-black">AI</span></div>
            <p className="text-xs font-bold uppercase tracking-widest">开始对话吧</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const showAvatar = shouldShowAvatar(idx, msg.role);
          const time = formatMessageTime(new Date(msg.timestamp), msg.role);
          const nextMsg = messages[idx + 1];
          const isLastInGroup = !nextMsg || nextMsg.role !== msg.role;
          const reserveSpace = shouldReserveAvatarSpace(msg.role);
          
          const isAvatarBottomAlign = chatStyles.avatarStyle === 'last';
          const isBelowAvatarStyle = chatStyles.timestampStyle === 'below_avatar';
          
          const hasBelowTimestamp = chatStyles.timestampStyle === 'below_bubble' && isLastInGroup;
          const hasAvatarBelowTimestamp = isBelowAvatarStyle && showAvatar;

          const isFirstOrLastStyle = chatStyles.avatarStyle === 'first' || chatStyles.avatarStyle === 'last';
          const containerMarginTop = '2px';
          
          const containerMarginBottom = hasBelowTimestamp 
            ? '20px' 
            : (hasAvatarBelowTimestamp && !isFirstOrLastStyle && !isAboveMode ? '20px' : '2px');

          return (
            <div 
              key={msg.id} 
              style={{ 
                marginTop: containerMarginTop,
                marginBottom: containerMarginBottom 
              }}
              className={`flex ${isAboveMode ? 'flex-col gap-0' : (isAvatarBottomAlign ? 'items-end' : 'items-start') + ' gap-[3px]'} animate-in fade-in slide-in-from-bottom-1 duration-300 ${!isAboveMode ? (isUser ? 'flex-row-reverse -mr-[5px]' : 'flex-row -ml-[5px]') : (isUser ? 'items-end -mr-[5px]' : 'items-start -ml-[5px]')}`}
            >
              
              {isAboveMode && showAvatar && (
                <div 
                  className={`flex flex-col mb-[2px] ${isUser ? 'items-end' : 'items-start'} relative shrink-0 w-full`}
                >
                   {/* 头像容器：根据是否开启秒数决定对齐方式。未开启秒数时 items-center（水平居中），开启后按角色对齐。 */}
                   <div 
                     className={`flex flex-col ${!chatStyles.showSeconds ? 'items-center' : (isUser ? 'items-end' : 'items-start')}`} 
                     style={{ width: `${chatStyles.avatarSize}px` }}
                   >
                     <div style={getAvatarStyle(msg.role)} className={`flex items-center justify-center font-bold border border-black ${isUser ? 'bg-zinc-100 text-black' : 'bg-black text-white'}`}>
                      {isUser ? 'ME' : 'AI'}
                     </div>
                     {isBelowAvatarStyle && (
                      <span style={{ fontSize: `${dynamicTimeFontSize}px`, marginTop: '-1px' }} className="text-zinc-400 uppercase font-black tracking-tighter whitespace-nowrap opacity-60 leading-none pt-1">{time}</span>
                     )}
                   </div>
                </div>
              )}

              {!isAboveMode && reserveSpace && (
                <div 
                  style={{ width: `${chatStyles.avatarSize || 32}px` }} 
                  className={`shrink-0 flex flex-col items-center relative ${isAvatarBottomAlign ? 'self-end mb-0' : 'self-start mt-0'}`} 
                >
                  {showAvatar ? (
                    <>
                      <div 
                        style={getAvatarStyle(msg.role)}
                        className={`flex items-center justify-center font-bold border border-black ${isUser ? 'bg-zinc-100 text-black' : 'bg-black text-white'}`}
                      >
                        {isUser ? 'ME' : 'AI'}
                      </div>
                      {isBelowAvatarStyle && (
                        <span 
                          style={{ fontSize: `${dynamicTimeFontSize}px`, marginTop: '-1px' }} 
                          className="absolute top-full text-zinc-400 uppercase font-black tracking-tighter whitespace-nowrap opacity-60"
                        >
                          {time}
                        </span>
                      )}
                    </>
                  ) : <div style={{ width: `${chatStyles.avatarSize || 32}px`, height: `${chatStyles.avatarSize || 32}px` }} />}
                </div>
              )}
              
              <div 
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0 relative`}
                style={{ maxWidth: `${chatStyles.bubbleMaxWidth || 75}%` }}
              >
                <div className={`flex items-end gap-[3px] ${isUser ? 'flex-row' : 'flex-row-reverse'} w-full relative`}>
                  {(chatStyles.timestampStyle === 'beside_bubble' || (chatStyles.timestampStyle === 'beside_bubble_last' && isLastInGroup)) && (
                    <span 
                      style={{ 
                        fontSize: `${dynamicTimeFontSize}px`, 
                        bottom: `-2px`,
                        [isUser ? 'right' : 'left']: 'calc(100% + 5px)'
                      }} 
                      className="absolute text-zinc-300 uppercase font-bold tracking-tighter whitespace-nowrap flex-shrink-0 animate-in fade-in duration-300 opacity-60"
                    >
                      {time}
                    </span>
                  )}
                  <div 
                    onClick={() => !contextMenu && handleTranslate(msg.id)}
                    onMouseDown={(e) => handleTouchStart(e, msg)}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchEnd={handleTouchEnd}
                    style={getBubbleStyle(msg.role)}
                    className={`relative group/bubble min-w-[42px] animate-in zoom-in-95 duration-200 ${
                      (msg.role === 'model' && chatStyles.translationEnabled) ? 'active:scale-95' : 'active:scale-[0.99]'
                    } ${
                      chatStyles.timestampStyle === 'inside_bubble' ? 'flex items-end gap-[3px] flex-row' : 'whitespace-pre-wrap'
                    }`}
                  >
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      {/* 核心修改：翻译文字和虚线更紧凑，虚线样式调整 */}
                      {msg.showTranslation && msg.translatedContent && (
                        <div 
                          className="mt-0 pt-1 border-t border-dashed border-black/[0.08] text-[12px] text-zinc-400 font-light leading-relaxed animate-in fade-in slide-in-from-top-0 duration-200" 
                          style={{ 
                            borderStyle: 'dashed', 
                            borderWidth: '1px 0 0 0', 
                            backgroundImage: 'none', 
                            borderImage: 'none',
                            borderDasharray: '6, 4' // 这个属性仅对 SVG 有效，对于 div 边框，标准 dashed 表现取决于浏览器，这里通过 css-dash 实现更精准控制
                          }}
                        >
                          {msg.translatedContent}
                        </div>
                      )}
                    </div>
                    {chatStyles.timestampStyle === 'inside_bubble' && (
                      <div 
                        style={{ fontSize: `${dynamicTimeFontSize}px`, transform: 'translateY(4px)' }}
                        className={`font-bold tracking-tighter uppercase shrink-0 pb-[2px] ${isUser ? 'text-white/40 text-right' : 'text-zinc-400 text-right'}`}
                      >
                        {time}
                      </div>
                    )}
                  </div>
                </div>
                {hasBelowTimestamp && (
                  <span 
                    style={{ fontSize: `${dynamicTimeFontSize}px`, marginTop: '-1px' }} 
                    className="absolute top-full text-zinc-300 uppercase font-bold tracking-tighter animate-in fade-in duration-500 opacity-60"
                  >
                    {time}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
           <div style={{ marginTop: '2px', marginBottom: '2px' }} className={`flex ${isAboveMode ? 'flex-col items-start gap-0' : (chatStyles.avatarStyle === 'last' ? 'items-end' : 'items-start') + ' flex-row gap-[3px]'} -ml-[5px] animate-in fade-in duration-300 pt-1`}>
             {isAboveMode && shouldShowAvatar(messages.length, 'model') && (
                <div className="mb-[2px]">
                   <div style={getAvatarStyle('model')} className="flex items-center justify-center font-bold border border-black bg-black text-white">AI</div>
                </div>
             )}
             {!isAboveMode && shouldReserveAvatarSpace('model') && (
               <div style={{ width: `${chatStyles.avatarSize || 32}px` }} className={`shrink-0 flex flex-col items-center ${chatStyles.avatarStyle === 'last' ? 'self-end' : 'self-start mt-0'}`}>
                 {shouldShowAvatar(messages.length, 'model') ? (
                    <div style={getAvatarStyle('model')} className="flex items-center justify-center font-bold border border-black bg-black text-white">AI</div>
                 ) : <div style={{ width: `${chatStyles.avatarSize || 32}px`, height: `${chatStyles.avatarSize || 32}px` }} />}
               </div>
             )}
             <div className="bg-white border border-zinc-100 px-3 py-2 rounded-2xl rounded-bl-none flex space-x-1 items-center shadow-sm"><div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0.4s]"></div></div>
           </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white pb-10 border-t border-gray-100 flex flex-col space-y-3">
        <div className="flex items-center">
          <div className="flex-1 flex items-center space-x-2 bg-gray-50/50 rounded-2xl px-4 py-1.5 border border-zinc-100 shadow-sm relative pr-2">
            <textarea 
              rows={1}
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }} 
              placeholder="聊点什么..." 
              className="flex-1 bg-transparent border-none py-2.5 focus:outline-none text-[15px] text-black resize-none no-scrollbar max-h-32" 
            />
            <div className="flex items-center space-x-1">
              <button onClick={() => handleReceive()} disabled={!canReceive || isTyping} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${canReceive && !isTyping ? 'text-black active:scale-95' : 'text-zinc-200 cursor-not-allowed'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg></button>
              <button onClick={handleSend} disabled={!input.trim() || isTyping} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${input.trim() && !isTyping ? 'bg-black text-white shadow-lg' : 'bg-transparent text-zinc-300'}`}><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-[400] overflow-hidden" 
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div 
            className="absolute bg-black/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 p-1 flex items-center gap-1 animate-in zoom-in-95 duration-200"
            style={{ 
              top: `${Math.min(contextMenu.y - 60, window.innerHeight - 80)}px`, 
              left: `${Math.max(16, Math.min(contextMenu.x - 100, window.innerWidth - 250))}px` 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => copyToClipboard(contextMenu.message.content)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              <span className="text-[9px] font-bold mt-0.5">复制</span>
            </button>
            <button onClick={() => deleteMessage(contextMenu.message.id)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-red-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span className="text-[9px] font-bold mt-0.5">删除</span>
            </button>
            <button onClick={() => resendMessage(contextMenu.message)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="text-[9px] font-bold mt-0.5">重发</span>
            </button>
            <button onClick={() => startEditing(contextMenu.message)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <span className="text-[9px] font-bold mt-0.5">编辑</span>
            </button>
            <button onClick={() => quoteMessage(contextMenu.message)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              <span className="text-[9px] font-bold mt-0.5">引用</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Message Overlay */}
      {editingMessage && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black uppercase tracking-widest text-black/30 mb-4">编辑消息</h3>
            <textarea 
              autoFocus
              className="w-full h-32 bg-gray-50 rounded-2xl p-4 text-[14px] border border-gray-100 leading-relaxed focus:ring-2 focus:ring-black/5 outline-none transition-all resize-none mb-4"
              value={editBuffer}
              onChange={e => setEditBuffer(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={saveEdit} className="flex-1 bg-black text-white py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">确认修改</button>
              <button onClick={() => setEditingMessage(null)} className="flex-1 bg-gray-100 text-black py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isConfigOpen && (
        <div className="absolute inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right duration-300">
          <div className="pt-7 pb-2 px-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setIsConfigOpen(false)} className="p-2 -ml-2 active:opacity-50 text-black"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
              <h2 className="text-lg font-black uppercase tracking-tight">助手中心</h2>
              <button onClick={() => setIsConfigOpen(false)} className="px-4 py-1.5 bg-black text-white text-[12px] font-bold rounded-full">完成</button>
            </div>
            <div className="flex p-1 bg-gray-50 rounded-[20px] border border-zinc-100 shadow-sm">
              {([['persona', '人设'], ['settings', '设置'], ['beautify', '美化']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setActiveTab(id)} className={`flex-1 py-2 text-[13px] font-bold rounded-[20px] transition-all ${activeTab === id ? 'bg-black text-white shadow-sm' : 'text-zinc-400'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 no-scrollbar bg-[#f8f8f8]">
            {activeTab === 'persona' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
                <section className="space-y-3"><label className="text-[12px] font-black uppercase text-black/30 tracking-wider px-1">角色设定</label><textarea className="w-full h-40 bg-white rounded-[24px] p-4 text-[14px] border border-gray-100 leading-relaxed focus:ring-2 focus:ring-black/5 outline-none transition-all resize-none shadow-sm" value={aiPersona} onChange={e => onUpdateState({ aiPersona: e.target.value })} /></section>
                <section className="space-y-3"><label className="text-[12px] font-black uppercase text-black/30 tracking-wider px-1">我的人设</label><textarea className="w-full h-32 bg-white rounded-[24px] p-4 text-[14px] border border-gray-100 leading-relaxed focus:ring-2 focus:ring-black/5 outline-none transition-all resize-none shadow-sm" value={userPersona} onChange={e => onUpdateState({ userPersona: e.target.value })} /></section>
                <section className="pt-2 px-1">
                  {!showClearConfirm ? <button onClick={() => setShowClearConfirm(true)} className="w-full py-4 bg-white border border-red-100 text-red-500 rounded-[24px] text-[14px] font-bold shadow-sm active:scale-[0.98] active:bg-red-50 transition-all flex items-center justify-center space-x-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg><span>清空所有聊天记录</span></button>
                  : <div className="bg-white border border-red-200 rounded-[24px] p-4 shadow-xl animate-in zoom-in-95 duration-200"><p className="text-[14px] font-bold text-black text-center mb-4">确定清空所有聊天记录吗？</p><div className="flex gap-3"><button onClick={handleClearHistory} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">确定删除</button><button onClick={() => setShowClearConfirm(false)} className="flex-1 bg-gray-100 text-black py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">取消</button></div></div>}
                </section>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <SplitToggleRow 
                    leftLabel="我的头像" 
                    leftValue={chatStyles.showUserAvatar} 
                    onLeftToggle={() => onUpdateState({ chatStyles: { ...chatStyles, showUserAvatar: !chatStyles.showUserAvatar } })}
                    rightLabel="角色头像"
                    rightValue={chatStyles.showModelAvatar}
                    onRightToggle={() => onUpdateState({ chatStyles: { ...chatStyles, showModelAvatar: !chatStyles.showModelAvatar } })}
                  />

                  <SplitSettingRow 
                    leftLabel="头像显示" 
                    leftValue={avatarDisplayOptions.find(o => o.value === chatStyles.avatarStyle)?.label || ''} 
                    onLeftClick={() => setActivePicker('avatarFrequency')} 
                    rightLabel="时间戳样式" 
                    rightValue={timestampStylesOptions.find(o => o.value === chatStyles.timestampStyle)?.label || ''} 
                    onRightClick={() => setActivePicker('timestamp')} 
                  />
                  
                  <SplitSettingRow leftLabel="角色国家" leftValue={timezoneOptions.find(o => o.value === chatStyles.aiTimezone)?.label || ''} onLeftClick={() => setActivePicker('aiRegion')} rightLabel="我的国家" rightValue={timezoneOptions.find(o => o.value === chatStyles.userTimezone)?.label || ''} onRightClick={() => setActivePicker('userRegion')} />
                  <SplitSettingRow leftLabel="回复语言" leftValue={languageOptions.find(o => o.value === chatStyles.languageMode)?.label || ''} onLeftClick={() => setActivePicker('language')} rightLabel="自动翻译" rightValue={languageOptions.find(o => o.value === chatStyles.translationTargetLanguage)?.label || ''} onRightClick={() => setActivePicker('translateTarget')} rightIsToggle={true} rightToggleValue={chatStyles.translationEnabled} onRightToggle={() => onUpdateState({ chatStyles: { ...chatStyles, translationEnabled: !chatStyles.translationEnabled } })} />
                  
                  <div className="flex bg-white border-b border-gray-50">
                    <div className="flex-1 flex items-center justify-between p-4 border-r border-gray-50">
                      <span className="text-[14px] font-bold text-black shrink-0">回复条数</span>
                      <div className="flex items-center space-x-1">
                        <input type="text" className="w-8 bg-gray-50 border border-zinc-100 rounded-lg text-center text-[12px] py-1 focus:outline-none focus:border-black font-bold" value={minInput} placeholder="1" onChange={e => { const val = e.target.value; if (/^\d*$/.test(val)) { setMinInput(val); const num = parseInt(val); onUpdateState({ chatStyles: { ...chatStyles, minResponseCount: !isNaN(num) ? num : 0 } }); } }} />
                        <span className="text-[10px] font-bold text-zinc-300">-</span>
                        <input type="text" className="w-8 bg-gray-50 border border-zinc-100 rounded-lg text-center text-[12px] py-1 focus:outline-none focus:border-black font-bold" value={maxInput} placeholder="1" onChange={e => { const val = e.target.value; if (/^\d*$/.test(val)) { setMaxInput(val); const num = parseInt(val); onUpdateState({ chatStyles: { ...chatStyles, maxResponseCount: !isNaN(num) ? num : 0 } }); } }} />
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-between p-4">
                      <span className="text-[14px] font-bold text-black shrink-0">单条字数</span>
                      <div className="flex items-center space-x-1">
                        <input type="text" className="w-10 bg-gray-50 border border-zinc-100 rounded-lg text-center text-[12px] py-1 focus:outline-none focus:border-black font-bold" value={maxCharsInput} placeholder="15" onChange={e => { const val = e.target.value; if (/^\d*$/.test(val)) { setMaxCharsInput(val); const num = parseInt(val); onUpdateState({ chatStyles: { ...chatStyles, maxCharacterCount: !isNaN(num) ? num : 0 } }); } }} />
                        <span className="text-[10px] font-bold text-zinc-400">字</span>
                      </div>
                    </div>
                  </div>

                  <SettingToggle label="时间感知" value={chatStyles.timeAwareness} onToggle={() => onUpdateState({ chatStyles: { ...chatStyles, timeAwareness: !chatStyles.timeAwareness } })} />
                  <SettingToggle label="显示国家时间" value={chatStyles.useSeparateTimezones} onToggle={() => onUpdateState({ chatStyles: { ...chatStyles, useSeparateTimezones: !chatStyles.useSeparateTimezones } })} />
                  <SettingToggle label="显示秒数" value={chatStyles.showSeconds} onToggle={() => onUpdateState({ chatStyles: { ...chatStyles, showSeconds: !chatStyles.showSeconds } })} />
                </div>
              </div>
            )}
            {activeTab === 'beautify' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
                {/* Style Preview with Avatars */}
                <div className="p-6 bg-white rounded-[24px] border border-gray-100 shadow-sm">
                  <div className="space-y-2 px-2">
                    <div className={`flex ${isAboveMode ? 'flex-col items-start gap-0' : (chatStyles.avatarStyle === 'last' ? 'items-end' : 'items-start') + ' justify-start gap-[3px]'} -ml-[5px]`}>
                      <div style={getAvatarStyle('model')} className={`flex items-center justify-center font-bold border border-black bg-black text-white shrink-0`}>AI</div>
                      <div className="flex flex-col items-start">
                        <div style={getBubbleStyle('model', true)} className={`max-w-fit shadow-sm border border-transparent ${chatStyles.timestampStyle === 'inside_bubble' ? 'flex items-end gap-[3px] flex-row' : ''}`}>
                          <div className="flex-1">气泡预览</div>
                          {chatStyles.timestampStyle === 'inside_bubble' && <div style={{ fontSize: `${dynamicTimeFontSize}px`, transform: 'translateY(4px)' }} className="text-zinc-400 font-bold uppercase tracking-tighter pb-[2px]">AI侧</div>}
                        </div>
                      </div>
                    </div>
                    <div className={`flex ${isAboveMode ? 'flex-col items-end gap-0' : (chatStyles.avatarStyle === 'last' ? 'items-end' : 'items-start') + ' justify-end gap-[3px]'} -mr-[5px]`}>
                      {isAboveMode && (
                        <div style={getAvatarStyle('user')} className="flex items-center justify-center font-bold border border-black bg-zinc-100 text-black shrink-0">ME</div>
                      )}
                      <div className="flex flex-col items-end">
                        <div style={getBubbleStyle('user', true)} className={`max-w-fit text-right shadow-sm border border-transparent ${chatStyles.timestampStyle === 'inside_bubble' ? 'flex items-end gap-[3px] flex-row' : ''}`}>
                          <div className="flex-1">气泡预览</div>
                          {chatStyles.timestampStyle === 'inside_bubble' && <div style={{ fontSize: `${dynamicTimeFontSize}px`, transform: 'translateY(4px)' }} className="text-white/40 font-bold uppercase tracking-tighter pb-[2px]">我侧</div>}
                        </div>
                      </div>
                      {!isAboveMode && (
                        <div style={getAvatarStyle('user')} className="flex items-center justify-center font-bold border border-black bg-zinc-100 text-black shrink-0">ME</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom CSS Input moved right after Style Preview */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-black/30 tracking-widest ml-4 block">自定义 CSS 容器 (高级)</label>
                  <textarea 
                    className="w-full h-32 bg-white text-black font-mono text-[11px] border border-gray-100 rounded-[24px] p-5 focus:ring-2 focus:ring-black/5 outline-none transition-all resize-none shadow-sm" 
                    value={chatStyles.bubbleCSS} 
                    onChange={e => onUpdateState({ chatStyles: { ...chatStyles, bubbleCSS: e.target.value } })} 
                    spellCheck={false} 
                    placeholder="例如: border: 1px solid #eee; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" 
                  />
                </div>

                <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                   <div className="p-4 border-b border-gray-50 flex flex-col space-y-2">
                    <div className="flex justify-between items-center"><span className="text-[14px] font-bold text-black">头像大小</span><span className="text-[12px] font-bold text-black border border-black px-2 py-0.5 rounded-lg">{chatStyles.avatarSize}px</span></div>
                    <input type="range" min="20" max="64" value={chatStyles.avatarSize} onChange={e => onUpdateState({ chatStyles: { ...chatStyles, avatarSize: parseInt(e.target.value) } })} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black" />
                  </div>
                  <div className="p-4 border-b border-gray-50 flex flex-col space-y-2">
                    <div className="flex justify-between items-center"><span className="text-[14px] font-bold text-black">头像圆度</span><span className="text-[12px] font-bold text-black border border-black px-2 py-0.5 rounded-lg">{chatStyles.avatarRadius}%</span></div>
                    <input type="range" min="0" max="50" value={chatStyles.avatarRadius} onChange={e => onUpdateState({ chatStyles: { ...chatStyles, avatarRadius: parseInt(e.target.value) } })} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black" />
                  </div>
                   <div className="p-4 border-b border-gray-50 flex flex-col space-y-2">
                    <div className="flex justify-between items-center"><span className="text-[14px] font-bold text-black">气泡圆度</span><span className="text-[12px] font-bold text-black border border-black px-2 py-0.5 rounded-lg">{chatStyles.bubbleRadius}px</span></div>
                    <input type="range" min="0" max="40" value={chatStyles.bubbleRadius} onChange={e => onUpdateState({ chatStyles: { ...chatStyles, bubbleRadius: parseInt(e.target.value) } })} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black" />
                  </div>
                   <div className="p-4 border-b border-gray-50 flex flex-col space-y-2">
                    <div className="flex justify-between items-center"><span className="text-[14px] font-bold text-black">气泡大小</span><span className="text-[12px] font-bold text-black border border-black px-2 py-0.5 rounded-lg">{chatStyles.bubblePadding}</span></div>
                    <input type="range" min="8" max="40" value={chatStyles.bubblePadding} onChange={e => onUpdateState({ chatStyles: { ...chatStyles, bubblePadding: parseInt(e.target.value) } })} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black" />
                  </div>
                   <div className="p-4 border-b border-gray-50 flex flex-col space-y-2">
                    <div className="flex justify-between items-center"><span className="text-[14px] font-bold text-black">容器宽度</span><span className="text-[12px] font-bold text-black border border-black px-2 py-0.5 rounded-lg">{chatStyles.bubbleMaxWidth || 75}%</span></div>
                    <input type="range" min="50" max="100" value={chatStyles.bubbleMaxWidth || 75} onChange={e => onUpdateState({ chatStyles: { ...chatStyles, bubbleMaxWidth: parseInt(e.target.value) } })} className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-black" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {renderPicker()}
        </div>
      )}
    </div>
  );
};

export default ChatApp;
