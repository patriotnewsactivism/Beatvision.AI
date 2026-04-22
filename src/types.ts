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
}

export interface VideoBlueprint {
  id?: string;
  userId?: string;
  title: string;
  overallMood: string;
  colorPalette: string[];
  suggestedAspectRatio: string;
  storyboard: Scene[];
  vibe?: string;
  lyrics?: string;
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
