import { db } from "./db";
import type { UserProfile } from "../domain/types";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function ensureUserProfile(): Promise<UserProfile> {
  const existing = await db.userProfile.toCollection().first();
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const profile: UserProfile = {
    userId: makeId(),
    displayName: "Hunter",
    title: "E-Rank Novice",
    avatarId: "avatar-default",
    cosmetics: ["theme-neon", "frame-base"],
    createdAt: now,
    updatedAt: now
  };

  await db.userProfile.add(profile);
  return profile;
}
