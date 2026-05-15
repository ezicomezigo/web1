export type AIProvider = "claude" | "gemini";
export type MediaType = "ai_image" | "stock_photo" | "stock_video";
export type MoodType = "bright" | "calm" | "serious" | "energetic" | "dark" | "emotional";

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

export interface MediaPlan {
  media_type: MediaType;
  ai_image_prompt: string | null;
  stock_keywords: string[] | null;
  mood: MoodType;
}

export interface SceneAssets {
  audio: string | null;
  visual: string | null;
}

export interface Scene {
  scene_id: number;
  text: string;
  topic_summary: string;
  estimated_duration: number;
  media: MediaPlan;
  assets?: SceneAssets;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

export type TTSProvider = "gemini" | "minimax";

export interface TTSSettings {
  provider: TTSProvider;
  model: string;
  voice: string;
  speed: number;
}

export const GEMINI_TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.1-flash-tts-preview",
] as const;

export type GeminiTTSModel = (typeof GEMINI_TTS_MODELS)[number];

// 30개 프리빌트 보이스 중 한국어 콘텐츠에 잘 맞는 것들
export const GEMINI_TTS_VOICES = [
  "Kore", "Charon", "Aoede", "Fenrir", "Puck",
  "Zephyr", "Orbit", "Leda", "Orus", "Autonoe",
  "Callirrhoe", "Despina", "Erinome", "Gacrux", "Laomedeia",
  "Pulcherrima", "Schedar", "Sulafat", "Umbriel", "Vindemiatrix",
  "Achernar", "Achird", "Alasia", "Algenib", "Algieba",
  "Alnair", "Alnitaq", "Rasalgethi", "Sadachbia", "Sadaltager",
] as const;

export const MINIMAX_TTS_MODELS = [
  "speech-02-hd",
  "speech-02-turbo",
] as const;

export type MinimaxTTSModel = (typeof MINIMAX_TTS_MODELS)[number];

export const MINIMAX_PRESET_VOICES = [
  { id: "Calm_Woman",         label: "차분한 여성" },
  { id: "Gentle_Woman",       label: "부드러운 여성" },
  { id: "Energetic_Woman",    label: "활기찬 여성" },
  { id: "Calm_Man",           label: "차분한 남성" },
  { id: "Gentle_Man",         label: "부드러운 남성" },
  { id: "Energetic_Man",      label: "활기찬 남성" },
  { id: "Narrator",           label: "나레이터" },
  { id: "News_Reporter",      label: "뉴스 리포터" },
] as const;

export interface AnalyzeResponse {
  scenes: Scene[];
  total_duration: number;
  total_scenes: number;
  ai_provider: string;
  model_used: string;
  warnings: string[];
}

export interface AnalyzeRequest {
  script: string;
  ai_provider: AIProvider;
  gemini_model?: GeminiModel;
}

// ─── 프로젝트 ────────────────────────────────────────────────────────────────

export interface AnalysisInfo {
  ai_provider: string;
  model_used: string;
  warnings: string[];
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  script: string;
  analysis_info: AnalysisInfo | null;
  scenes: Scene[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  scene_count: number;
}
