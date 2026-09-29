import { redirect } from '@sveltejs/kit';

// The profile moved to /dashboard/profile, shared by every role; old links keep working.
export function load() {
  redirect(307, '/dashboard/profile');
}
