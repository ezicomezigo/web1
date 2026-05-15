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

export interface Scene {
  scene_id: number;
  text: string;
  topic_summary: string;
  estimated_duration: number;
  media: MediaPlan;
}

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
