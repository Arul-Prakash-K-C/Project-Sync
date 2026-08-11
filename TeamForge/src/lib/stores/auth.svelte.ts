import { db, type User } from '$lib/services/db';
import { hashPassword, verifyPassword } from '$lib/utils/password';

class AuthStore {
  user = $state<User | null>(null);
  loading = $state<boolean>(true);

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('teamforge_current_user');
      if (stored) {
        try {
          this.user = JSON.parse(stored);
        } catch (e) {
          this.user = null;
        }
      } else {
        // Auto login to default student Alex Mercer for seamless demo
        const defaultStudent = db.getUser('student_alex');
        if (defaultStudent) {
          this.user = defaultStudent;
          localStorage.setItem('teamforge_current_user', JSON.stringify(defaultStudent));
        }
      }
    }
    this.loading = false;
  }

  async login(email: string, password: string) {
    const matched = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!matched) {
      throw new Error('Invalid email or password');
    }
    // Accounts created before password support have no hash yet — let them in once,
    // then require a hash on every login going forward.
    if (matched.passwordHash) {
      const valid = await verifyPassword(password, matched.passwordHash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }
    }
    this.user = matched;
    if (typeof window !== 'undefined') {
      localStorage.setItem('teamforge_current_user', JSON.stringify(matched));
    }
    return matched;
  }

  logout() {
    this.user = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('teamforge_current_user');
    }
  }

  async register(name: string, email: string, password: string, role: 'student' | 'faculty' | 'admin', department: string, academicYear?: string) {
    const users = db.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email already exists');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      name,
      email,
      passwordHash: await hashPassword(password),
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      role,
      department,
      academicYear: role === 'student' ? (academicYear || 'Year 1') : undefined,
      bio: '',
      skills: [],
      interests: [],
      availability: true,
      previousProjects: []
    };

    users.push(newUser);
    db.saveUsers(users);
    this.user = newUser;
    if (typeof window !== 'undefined') {
      localStorage.setItem('teamforge_current_user', JSON.stringify(newUser));
    }
    return newUser;
  }

  refreshUser() {
    if (this.user) {
      const refreshed = db.getUser(this.user.id);
      if (refreshed) {
        this.user = refreshed;
        if (typeof window !== 'undefined') {
          localStorage.setItem('teamforge_current_user', JSON.stringify(refreshed));
        }
      }
    }
  }
}

export const auth = new AuthStore();
