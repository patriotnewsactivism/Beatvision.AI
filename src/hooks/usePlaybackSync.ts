import { RefObject, useCallback, useEffect, useState } from "react";
import { VideoBlueprint } from "../types";

const toSeconds = (timestamp: string): number => {
  const parts = timestamp.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
};

export const usePlaybackSync = ({
  audioRef,
  blueprint,
  audioFile,
  currentTime,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  blueprint: VideoBlueprint | null;
  audioFile: File | null;
  currentTime: number;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(-1);

  useEffect(() => {
    if (!blueprint || !audioFile) {
      setActiveSceneIndex(-1);
      return;
    }

    const currentScene = blueprint.storyboard.reduce((acc, scene, idx) => {
      if (currentTime >= toSeconds(scene.timestamp)) {
        return idx;
      }
      return acc;
    }, -1);

    setActiveSceneIndex(currentScene);
  }, [audioFile, blueprint, currentTime]);

  const jumpToScene = useCallback(
    (timestamp: string) => {
      if (!audioRef.current) {
        return;
      }

      audioRef.current.currentTime = toSeconds(timestamp);
      if (!isPlaying) {
        void audioRef.current.play();
        setIsPlaying(true);
      }
    },
    [audioRef, isPlaying],
  );

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    void audioRef.current.play();
    setIsPlaying(true);
  }, [audioRef, isPlaying]);

  return { isPlaying, setIsPlaying, activeSceneIndex, jumpToScene, togglePlayback };
};
