import { Scene, StylePack, VideoBlueprint } from "../types";

export const STYLE_PACKS: StylePack[] = [
  {
    id: "neon-performance",
    name: "Neon Performance",
    description: "High-energy stage blocking with saturated cyan/magenta contrast.",
    defaultVibe: "futuristic synth stage performance",
    defaultCameraProfile: "Dynamic handheld + gimbal whip transitions",
    defaultLightingProfile: "Neon edge lights, haze, practical tubes",
    defaultGradeProfile: "High-contrast teal/magenta with bloom highlights"
  },
  {
    id: "moody-narrative",
    name: "Moody Narrative",
    description: "Character-first storytelling with emotional contrast and slow reveals.",
    defaultVibe: "intimate cinematic narrative",
    defaultCameraProfile: "Slow dolly + composed locked-off shots",
    defaultLightingProfile: "Low-key motivated practical lighting",
    defaultGradeProfile: "Soft shadow rolloff, cool mids, warm skin retention"
  },
  {
    id: "lofi-dreamscape",
    name: "Lo-fi Dreamscape",
    description: "Textured nostalgia, dreamy movement, and analog imperfection.",
    defaultVibe: "dreamy nostalgic lo-fi visuals",
    defaultCameraProfile: "Floaty steadicam + occasional VHS-style zooms",
    defaultLightingProfile: "Diffused practicals with pastel color washes",
    defaultGradeProfile: "Low-contrast film emulation with lifted blacks"
  }
];

export function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return parts[0] || 0;
}

export function mergeLockedScenes(previous: VideoBlueprint | null, next: VideoBlueprint): VideoBlueprint {
  if (!previous) return next;

  const lockedByTimestamp = new Map(
    previous.storyboard
      .filter((scene) => scene.locked)
      .map((scene) => [scene.timestamp, scene])
  );

  if (lockedByTimestamp.size === 0) return next;

  return {
    ...next,
    storyboard: next.storyboard.map((scene) => {
      const lockedScene = lockedByTimestamp.get(scene.timestamp);
      if (!lockedScene) return scene;
      return { ...lockedScene, locked: true };
    })
  };
}

export function getStylePackById(stylePackId: string): StylePack {
  return STYLE_PACKS.find((pack) => pack.id === stylePackId) || STYLE_PACKS[0];
}
