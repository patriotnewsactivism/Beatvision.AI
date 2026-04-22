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
  stylePackId?: string;
  cameraProfile?: string;
  lightingProfile?: string;
  gradeProfile?: string;
  createdAt?: string;
}
