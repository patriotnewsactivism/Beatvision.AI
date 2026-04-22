import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { VideoBlueprint } from "../types";

const BLUEPRINTS_COLLECTION = "blueprints";

const mapBlueprint = (id: string, data: Record<string, unknown>): VideoBlueprint => {
  return { id, ...(data as Omit<VideoBlueprint, "id">) };
};

export const fetchSharedBlueprint = async (id: string): Promise<VideoBlueprint | null> => {
  const snapshot = await getDocs(
    query(collection(db, BLUEPRINTS_COLLECTION), where("__name__", "==", id)),
  );

  if (snapshot.empty) {
    return null;
  }

  const docData = snapshot.docs[0];
  return mapBlueprint(docData.id, docData.data() as Record<string, unknown>);
};

export const fetchBlueprintsByUser = async (uid: string): Promise<VideoBlueprint[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, BLUEPRINTS_COLLECTION),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
    ),
  );

  return snapshot.docs.map((entry) => mapBlueprint(entry.id, entry.data() as Record<string, unknown>));
};

export const createBlueprint = async ({
  blueprint,
  userId,
  vibe,
  lyrics,
}: {
  blueprint: VideoBlueprint;
  userId: string;
  vibe: string;
  lyrics: string;
}): Promise<string> => {
  const docRef = await addDoc(collection(db, BLUEPRINTS_COLLECTION), {
    ...blueprint,
    userId,
    vibe,
    lyrics,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
};

export const deleteBlueprintById = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, BLUEPRINTS_COLLECTION, id));
};
