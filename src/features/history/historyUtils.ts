export const formatCreatedAt = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "Draft";
  }

  const timestamp = value as { seconds?: number };
  if (typeof timestamp.seconds !== "number") {
    return "Draft";
  }

  return new Date(timestamp.seconds * 1000).toLocaleDateString();
};
