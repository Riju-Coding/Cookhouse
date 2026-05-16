/**
 * Auth Guard Utility
 * Ensures a user is authenticated before performing sensitive operations.
 * Used as a defense-in-depth layer alongside Firestore Security Rules.
 */
import { auth } from "./firebase"

/**
 * Throws if no user is currently authenticated.
 * Call at the top of any write operation.
 * @returns The authenticated user's UID.
 */
export function requireAuth(): string {
  const user = auth.currentUser
  if (!user) {
    throw new Error("Unauthorized: You must be logged in to perform this action.")
  }
  return user.uid
}

/**
 * Returns the current user's UID, or null if not authenticated.
 * Use for optional auth context (e.g., analytics, soft-gating reads).
 */
export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null
}
