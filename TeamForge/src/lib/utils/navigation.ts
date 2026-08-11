import type { User } from '$lib/services/db';

export function getDashboardRoute(role: User['role']): string {
  switch (role) {
    case 'student':
      return '/dashboard/student';
    case 'faculty':
      return '/dashboard/faculty';
    case 'admin':
      return '/dashboard/admin';
  }
}
