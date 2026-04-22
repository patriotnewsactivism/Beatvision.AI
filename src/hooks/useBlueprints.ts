import { useCallback, useState } from "react";
import { User } from "firebase/auth";
import { VideoBlueprint } from "../types";
import {
  createBlueprint,
  deleteBlueprintById,
  fetchBlueprintsByUser,
  fetchSharedBlueprint,
} from "../services/blueprintRepository";

export const useBlueprints = () => {
  const [myBlueprints, setMyBlueprints] = useState<VideoBlueprint[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadMyBlueprints = useCallback(async (uid: string) => {
    const records = await fetchBlueprintsByUser(uid);
    setMyBlueprints(records);
  }, []);

  const loadSharedBlueprint = useCallback(async (id: string) => {
    return fetchSharedBlueprint(id);
  }, []);

  const saveBlueprint = useCallback(
    async ({
      user,
      blueprint,
      vibe,
      lyrics,
    }: {
      user: User;
      blueprint: VideoBlueprint;
      vibe: string;
      lyrics: string;
    }): Promise<VideoBlueprint> => {
      setIsSaving(true);
      try {
        const id = await createBlueprint({ blueprint, userId: user.uid, vibe, lyrics });
        const savedBlueprint = { ...blueprint, id };
        await loadMyBlueprints(user.uid);
        return savedBlueprint;
      } finally {
        setIsSaving(false);
      }
    },
    [loadMyBlueprints],
  );

  const deleteBlueprint = useCallback(
    async (user: User, id: string): Promise<void> => {
      await deleteBlueprintById(id);
      await loadMyBlueprints(user.uid);
    },
    [loadMyBlueprints],
  );

  return {
    myBlueprints,
    isSaving,
    loadMyBlueprints,
    loadSharedBlueprint,
    saveBlueprint,
    deleteBlueprint,
  };
};
