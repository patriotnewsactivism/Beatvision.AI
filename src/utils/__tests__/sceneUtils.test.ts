import { describe, expect, it } from "vitest";
import { getStylePackById, mergeLockedScenes, parseTimestampToSeconds, STYLE_PACKS } from "../sceneUtils";
import { VideoBlueprint } from "../../types";

describe("sceneUtils", () => {
  it("parses timestamps in mm:ss format", () => {
    expect(parseTimestampToSeconds("2:30")).toBe(150);
  });

  it("returns 0 for invalid timestamp", () => {
    expect(parseTimestampToSeconds("abc")).toBe(0);
  });

  it("preserves locked scenes on regeneration", () => {
    const previous: VideoBlueprint = {
      title: "Prev",
      overallMood: "dark",
      colorPalette: ["#000"],
      suggestedAspectRatio: "16:9",
      storyboard: [
        { timestamp: "0:00", description: "keep me", visualStyle: "A", cameraMovement: "B", lighting: "C", lensSuggestion: "D", cameraRig: "E", shotType: "MS", lightingEquipment: "F", locked: true },
        { timestamp: "0:20", description: "replace me", visualStyle: "A", cameraMovement: "B", lighting: "C", lensSuggestion: "D", cameraRig: "E", shotType: "MS", lightingEquipment: "F" }
      ]
    };

    const next: VideoBlueprint = {
      title: "Next",
      overallMood: "new",
      colorPalette: ["#111"],
      suggestedAspectRatio: "16:9",
      storyboard: [
        { timestamp: "0:00", description: "new desc", visualStyle: "N", cameraMovement: "N", lighting: "N", lensSuggestion: "N", cameraRig: "N", shotType: "LS", lightingEquipment: "N" },
        { timestamp: "0:20", description: "new two", visualStyle: "N", cameraMovement: "N", lighting: "N", lensSuggestion: "N", cameraRig: "N", shotType: "LS", lightingEquipment: "N" }
      ]
    };

    const merged = mergeLockedScenes(previous, next);
    expect(merged.storyboard[0].description).toBe("keep me");
    expect(merged.storyboard[0].locked).toBe(true);
    expect(merged.storyboard[1].description).toBe("new two");
  });

  it("returns default style pack when unknown id", () => {
    expect(getStylePackById("missing").id).toBe(STYLE_PACKS[0].id);
  });
});
