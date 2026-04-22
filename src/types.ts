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
  createdAt?: string;
}
