import { db } from '$lib/services/db';

/**
 * Current avatar for every user, kept live. Many records carry a copy of a
 * person's avatar from when they were created (project members, discussion
 * posts, ideas). Rendering through this map means a new profile picture
 * shows up everywhere at once, including on those older records, and on
 * other people's screens as soon as the change syncs.
 */
class PeopleStore {
  avatars = $state<Record<string, string>>({});
  private started = false;

  constructor() {
    // Started eagerly, never from inside a render: reading must not write state.
    this.start();
  }

  private load() {
    const next: Record<string, string> = {};
    for (const u of db.getUsers()) next[u.id] = u.avatar;
    this.avatars = next;
  }

  /** Loads once and follows every later change to the users collection. */
  private start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.load();
    db.onChange((key) => {
      if (key === 'users') this.load();
    });
  }

  /** The user's current avatar, or `fallback` for someone unknown. */
  avatarOf(userId: string | undefined, fallback = ''): string {
    if (!userId) return fallback;
    return userId in this.avatars ? this.avatars[userId] : fallback;
  }
}

export const people = new PeopleStore();
