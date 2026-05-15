export type AIProvider = "claude" | "gemini";

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

export interface Scene {
  scene_id: number;
  text: string;
  topic_summary: string;
  estimated_duration: number;
}

export interface AnalyzeResponse {
  scenes: Scene[];
  total_duration: number;
  total_scenes: number;
  ai_provider: string;
  model_used: string;
}

export interface AnalyzeRequest {
  script: string;
  ai_provider: AIProvider;
  gemini_model?: GeminiModel;
}
