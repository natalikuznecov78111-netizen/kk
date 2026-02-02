
export type AppID = 'home' | 'chat' | 'worldbook' | 'settings' | 'camera' | 'photos' | 'calendar' | 'system_settings';

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  translatedContent?: string;
  showTranslation?: boolean;
  isTranslating?: boolean;
}

export type InjectionPosition = 'front' | 'middle' | 'back';

export interface WorldEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  injectionPosition?: InjectionPosition;
}

export interface ApiPreset {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
}

export type AvatarStyle = 'all' | 'first' | 'last' | 'above_bubble';
export type TimestampStyle = 'hidden' | 'below_bubble' | 'beside_bubble' | 'beside_bubble_last' | 'below_avatar' | 'inside_bubble';
export type ResponseLanguage = 'zh' | 'ja' | 'en' | 'ko';
export type RegionTimezone = 'Asia/Shanghai' | 'Asia/Tokyo' | 'Asia/Seoul' | 'America/New_York';

export interface ChatStyles {
  bubbleCSS: string;
  avatarStyle: AvatarStyle;
  showUserAvatar: boolean;
  showModelAvatar: boolean;
  timestampStyle: TimestampStyle;
  languageMode: ResponseLanguage;
  userTimezone: RegionTimezone;
  aiTimezone: RegionTimezone;
  timeAwareness: boolean;
  translationEnabled: boolean;
  translationTargetLanguage: ResponseLanguage;
  useSeparateTimezones: boolean;
  showSeconds: boolean;
  minResponseCount: number;
  maxResponseCount: number;
  maxCharacterCount: number;
  avatarSize: number;
  avatarRadius: number;
  bubbleRadius: number;
  bubblePadding: number;
  bubbleMaxWidth: number;
}

export interface AppState {
  currentApp: AppID;
  messages: Message[];
  worldEntries: WorldEntry[];
  userName: string;
  userPersona: string;
  aiPersona: string;
  wallpaper: string;
  historyWallpapers: string[]; // Added to store uploaded images
  fontUrl: string;
  fontFamily: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  availableModels: string[];
  presets: ApiPreset[];
  chatStyles: ChatStyles;
}
