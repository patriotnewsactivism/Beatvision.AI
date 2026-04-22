export interface StylePack {
  id: string;
  name: string;
  description: string;
  defaultVibe: string;
  defaultCameraProfile: string;
  defaultLightingProfile: string;
  defaultGradeProfile: string;
}

export interface Scene {
  timestamp: string;
  description: string;
  visualStyle: string;
  cameraMovement: string;
  lighting: string;
  lensSuggestion: string;
  cameraRig: string;
  shotType: string;
  lightingEquipment: string;
  thumbnailUrl?: string;
  locked?: boolean;
}

export interface EnergyPoint {
  time: number;
  value: number;
}

export interface AnalysisSection {
  start: number;
  end: number;
  label: string;
  intensity: number;
}

export interface AudioAnalysisMetadata {
  bpm: number;
  beatGrid: number[];
  downbeats: number[];
  sections: AnalysisSection[];
  energyCurve: EnergyPoint[];
  confidence: number;
  peaks: number[];
}

export interface VideoBlueprint {
  id?: string;
  userId?: string;
  title: string;
  overallMood: string;
  colorPalette: string[];
  suggestedAspectRatio: string;
  storyboard: Scene[];
  analysis?: AudioAnalysisMetadata;
  vibe?: string;
  lyrics?: string;
  stylePackId?: string;
  cameraProfile?: string;
  lightingProfile?: string;
  gradeProfile?: string;
  createdAt?: string;
}

export type RenderStatus = "queued" | "processing" | "failed" | "complete";
export type RenderStage = "scene-plan" | "asset-generation" | "timeline-assembly" | "final-encode";

export interface RenderJob {
  id: string;
  userId: string;
  blueprintId: string;
  status: RenderStatus;
  stage: RenderStage;
  progress: number;
  downloadUrl?: string;
  errorMessage?: string;
}
