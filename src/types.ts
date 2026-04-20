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
