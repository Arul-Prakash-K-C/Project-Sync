import type { ZodType } from 'zod';
import { z } from 'zod';
import {
  DepartmentSchema,
  UserSchema,
  ProjectSchema,
  ProjectIdeaSchema,
  TaskSchema,
  ThreadSchema,
  ProjectFileSchema,
  NotificationSchema,
  WeeklyReportSchema,
  CategorizedFeedbackSchema,
  MeetingSchema,
  AnnouncementSchema,
  FacultyNoteSchema,
  AuditLogEntrySchema,
  StaffRequestSchema
} from '$lib/schemas';
import { newId } from '$lib/utils/id';

export interface User {
  id: string;
  name: string;
  email: string;
  /**
   * `pbkdf2:<salt>:<hash>` (legacy accounts may still hold a bare SHA-256 digest,
   * upgraded on next login). Never store or compare plaintext passwords, and
   * never synced to Supabase — cloud mode authenticates through Supabase Auth.
   */
  passwordHash?: string;
  avatar: string;
  role: 'student' | 'faculty' | 'admin';
  department: string;
  academicYear?: string;
  bio?: string;
  skills: string[];
  interests: string[];
  availability: boolean;
  previousProjects?: string[];
}

export interface ProjectMember {
  userId: string;
  name: string;
  role: string;
  avatar: string;
}

export interface Milestone {
  id: string;
  title: string;
  deadline: string;
  completed: boolean;
  locked?: boolean;
  extendedDeadline?: string;
}

export interface WeeklyReport {
  id: string;
  projectId: string;
  weekNumber: number;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  achievements: string;
  plannedTasks: string;
  blockers: string;
  status: 'pending' | 'approved' | 'revision_requested';
  feedback: string;
}

export interface CategorizedFeedback {
  id: string;
  projectId: string;
  category: 'code' | 'documentation' | 'ui' | 'testing' | 'presentation';
  feedbackText: string;
  facultyName: string;
  createdAt: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  date: string;
  time: string;
  linkOrLocation: string;
  status: 'scheduled' | 'cancelled';
  createdAt: string;
  /** Per-member attendance, keyed by user id. Absent until someone takes a register. */
  attendance?: Record<string, AttendanceStatus>;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface Announcement {
  id: string;
  targetType: 'team' | 'all';
  targetIds: string[]; // project ids
  title: string;
  content: string;
  facultyName: string;
  createdAt: string;
}

export interface FacultyNote {
  id: string;
  projectId: string;
  studentId?: string;
  content: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  status: 'pending' | 'active' | 'archived' | 'rejected';
  ownerId: string;
  ownerName: string;
  members: ProjectMember[];
  milestones: Milestone[];
  pendingInvites: string[]; // User IDs
  pendingRequests: string[]; // User IDs
  createdAt: string;
  /** Skills the team needs; drives who gets invited. Missing on legacy projects. */
  requiredSkills?: string[];
  /** Maximum members, creator included. Missing on legacy projects (no limit). */
  teamSize?: number;
  /** Supervising faculty member. Missing on legacy projects. */
  mentorId?: string;
  mentorName?: string;
}

/** Label for the student who created a project and leads its team. */
export const TEAM_LEADER_ROLE = 'Team Leader';

/** The creator (owner) of a project is its team leader, whatever label an older record carries. */
export function isTeamLeader(project: Pick<Project, 'ownerId'>, userId: string | undefined): boolean {
  return !!userId && project.ownerId === userId;
}

/** Role shown for a member: the owner is always the Team Leader. */
export function memberRoleLabel(project: Pick<Project, 'ownerId'>, member: ProjectMember): string {
  return member.userId === project.ownerId ? TEAM_LEADER_ROLE : member.role;
}

/**
 * A faculty sign-up waiting for an administrator. Faculty accounts are not
 * self-service: the request holds the person's details until an admin
 * approves (which creates the account) or rejects it.
 */
export interface StaffRequest {
  id: string;
  authUid?: string;
  name: string;
  email: string;
  department: string;
  role: 'faculty';
  passwordHash?: string;
  profile?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}

export const TEAM_SIZE_MIN = 2;
export const TEAM_SIZE_MAX = 8;

export interface NewProjectInput {
  name: string;
  description: string;
  department: string;
  requiredSkills: string[];
  teamSize: number;
  mentorId: string;
}

export interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  teamSizeRequirement: number;
  techStack: string[];
  domain: string;
  visibility: 'public' | 'private';
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  createdAt: string;
}

export interface TaskAttachment {
  name: string;
  size: string;
  url: string;
}

export interface TaskComment {
  id: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  column: 'todo' | 'inprogress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high';
  deadline: string;
  assignees: string[]; // User IDs
  comments: TaskComment[];
  attachments: TaskAttachment[];
}

export interface Reply {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  projectId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  createdAt: string;
  replies: Reply[];
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  path: string; // e.g. "Documents/Spec.pdf"
  size: string;
  type: string; // "pdf" | "doc" | "image" | "code" | "other"
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  version: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'project' | 'milestone' | 'weekly_report' | 'announcement' | 'feedback' | 'meeting';
  targetId?: string;
  targetLabel?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headName: string;
  description: string;
}

// Initial Mock Data
const defaultDepartments: Department[] = [
  { id: '1', name: 'Computer Science & Engineering', code: 'CSE', headName: 'Dr. Evelyn Sterling', description: 'Department focusing on computation, systems, algorithms, and artificial intelligence.' },
  { id: '2', name: 'Software Engineering', code: 'SE', headName: 'Prof. Julian Brooks', description: 'Applied engineering focusing on software design, quality assurance, and architecture.' },
  { id: '3', name: 'Information Systems', code: 'IS', headName: 'Dr. Alistair Vance', description: 'bridging the gap between business processes and technical solution building.' },
  { id: '4', name: 'Data Science & Analytics', code: 'DSA', headName: 'Dr. Helena Rostova', description: 'Advanced analytics, predictive modeling, and big data systems engineering.' }
];

const defaultUsers: User[] = [
  {
    id: 'student_alex',
    name: 'Alex Mercer',
    email: 'alex@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
    role: 'student',
    department: 'Computer Science & Engineering',
    academicYear: 'Year 3',
    bio: 'Full-stack enthusiast interested in Svelte, reactive database engineering, and human-computer interaction designs.',
    skills: ['Svelte', 'Tailwind CSS', 'TypeScript', 'Node.js', 'Firebase'],
    interests: ['Web Development', 'UI/UX Design', 'Cloud Architectures'],
    availability: true,
    previousProjects: ['Virtual Classroom', 'StudyBuddy App']
  },
  {
    id: 'student_sarah',
    name: 'Sarah Chen',
    email: 'sarah@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah',
    role: 'student',
    department: 'Computer Science & Engineering',
    academicYear: 'Year 3',
    bio: 'ML researcher specializing in NLP and automated tutoring assistants. Enjoys data visualization and web application design.',
    skills: ['Python', 'TensorFlow', 'Data Analytics', 'TypeScript', 'Svelte'],
    interests: ['AI/Machine Learning', 'Data Visualization', 'Education Tech'],
    availability: true,
    previousProjects: ['BERT Grading Assistant', 'Campus Heatmap Visualizer']
  },
  {
    id: 'student_marcus',
    name: 'Marcus Vance',
    email: 'marcus@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus',
    role: 'student',
    department: 'Information Systems',
    academicYear: 'Year 4',
    bio: 'Product owner and agile team coordinator. Passionate about system analysis, cloud integrations, and Scrum practices.',
    skills: ['Project Management', 'Agile/Scrum', 'SQL', 'Figma', 'System Design'],
    interests: ['Product Management', 'SaaS Platforms', 'FinTech Applications'],
    availability: true,
    previousProjects: ['ERP Campus Prototype', 'Agile Task Canvas']
  },
  {
    id: 'student_elena',
    name: 'Elena Rostova',
    email: 'elena@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Elena',
    role: 'student',
    department: 'Software Engineering',
    academicYear: 'Year 2',
    bio: 'Fast learner focusing on backend development, containerization, API development, and automated testing pipelines.',
    skills: ['Node.js', 'Docker', 'PostgreSQL', 'Go', 'Git'],
    interests: ['Backend Systems', 'DevOps Pipelines', 'Microservices'],
    availability: false,
    previousProjects: ['Secure Auth microservice']
  },
  {
    id: 'faculty_evelyn',
    name: 'Dr. Evelyn Sterling',
    email: 'evelyn@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Evelyn',
    role: 'faculty',
    department: 'Computer Science & Engineering',
    skills: ['Research Supervision', 'Algorithms', 'AI Governance'],
    interests: ['AI Ethics', 'SaaS Architectures'],
    availability: true
  },
  {
    id: 'faculty_julian',
    name: 'Prof. Julian Brooks',
    email: 'julian@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julian',
    role: 'faculty',
    department: 'Software Engineering',
    skills: ['Software Architecture', 'Quality Assurance', 'DevOps'],
    interests: ['Distributed Systems', 'Developer Tooling'],
    availability: true
  },
  {
    id: 'admin_sys',
    name: 'Admin System',
    email: 'admin@teamforge.edu',
    passwordHash: '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', // demo1234
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=System',
    role: 'admin',
    department: 'Administration',
    skills: ['System Management'],
    interests: [],
    availability: true
  }
];

const defaultProjects: Project[] = [
  {
    id: 'project_studyhub',
    name: 'Decentralized Study Hub',
    description: 'A platform providing decentralized, student-moderated channels for course-specific study guides, past exams repositories, and group discussion slots.',
    department: 'Computer Science & Engineering',
    status: 'active',
    ownerId: 'student_alex',
    ownerName: 'Alex Mercer',
    members: [
      { userId: 'student_alex', name: 'Alex Mercer', role: 'Project Lead / Frontend Dev', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex' },
      { userId: 'student_sarah', name: 'Sarah Chen', role: 'Data Engineer / Backend', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah' }
    ],
    milestones: [
      { id: 'm1', title: 'System Architecture Design', deadline: '2026-08-01', completed: true },
      { id: 'm2', title: 'Interactive Wireframe Prototype', deadline: '2026-08-20', completed: true },
      { id: 'm3', title: 'Database & Sync Setup', deadline: '2026-09-10', completed: false },
      { id: 'm4', title: 'Final Deployment and Faculty Evaluation', deadline: '2026-10-15', completed: false }
    ],
    pendingInvites: ['student_marcus'],
    pendingRequests: [],
    createdAt: '2026-07-01T10:00:00.000Z',
    requiredSkills: ['Svelte', 'TypeScript', 'Firebase', 'UI/UX Design'],
    teamSize: 4,
    mentorId: 'faculty_evelyn',
    mentorName: 'Dr. Evelyn Sterling'
  },
  {
    id: 'project_campusage',
    name: 'AI-Powered Campus Guide',
    description: 'An AI assistant utilizing Large Language Models to answer student queries about schedule conflicts, room maps, and course requisites.',
    department: 'Computer Science & Engineering',
    status: 'pending',
    ownerId: 'student_elena',
    ownerName: 'Elena Rostova',
    members: [
      { userId: 'student_elena', name: 'Elena Rostova', role: 'Backend Developer', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Elena' }
    ],
    milestones: [
      { id: 'm_c1', title: 'Proposal submission', deadline: '2026-07-20', completed: true },
      { id: 'm_c2', title: 'Model fine-tuning data collection', deadline: '2026-08-15', completed: false }
    ],
    pendingInvites: [],
    pendingRequests: [],
    createdAt: '2026-07-10T14:30:00.000Z',
    requiredSkills: ['Python', 'Machine Learning', 'NLP'],
    teamSize: 3,
    mentorId: 'faculty_evelyn',
    mentorName: 'Dr. Evelyn Sterling'
  }
];

const defaultProjectIdeas: ProjectIdea[] = [
  {
    id: 'idea_1',
    title: 'Smart Campus Parking Assistant',
    description: 'An IoT-based campus parking slot detector that shows real-time occupancy maps using computer vision and edge computing nodes.',
    requiredSkills: ['Computer Vision', 'Python', 'IoT Programming', 'Tailwind CSS'],
    teamSizeRequirement: 3,
    techStack: ['Python', 'OpenCV', 'Raspberry Pi', 'SvelteKit'],
    domain: 'Internet of Things (IoT)',
    visibility: 'public',
    ownerId: 'student_alex',
    ownerName: 'Alex Mercer',
    ownerAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
    createdAt: '2026-07-15T12:00:00.000Z'
  },
  {
    id: 'idea_2',
    title: 'Blockchain Academic Credential Verifier',
    description: 'A platform to issue and securely verify university graduation certificates, preventing fraud and making resume verification instant.',
    requiredSkills: ['Solidity', 'Web3.js', 'Cryptography', 'Svelte'],
    teamSizeRequirement: 4,
    techStack: ['Ethereum', 'Solidity', 'Hardhat', 'TypeScript', 'SvelteKit'],
    domain: 'Blockchain / Cryptography',
    visibility: 'public',
    ownerId: 'student_sarah',
    ownerName: 'Sarah Chen',
    ownerAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah',
    createdAt: '2026-07-16T14:30:00.000Z'
  }
];

const defaultTasks: Task[] = [
  {
    id: 'task_1',
    projectId: 'project_studyhub',
    title: 'Implement Firebase Authentication',
    description: 'Configure Svelte authentication flow to utilize Firebase SDK for email-password login and role checking.',
    column: 'review',
    priority: 'high',
    deadline: '2026-07-20',
    assignees: ['student_alex'],
    comments: [
      { id: 'c1', userName: 'Sarah Chen', userAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah', text: 'I can help with the Firestore user mapping if needed.', createdAt: '2026-07-12T11:00:00.000Z' }
    ],
    attachments: []
  },
  {
    id: 'task_2',
    projectId: 'project_studyhub',
    title: 'Design UI for Teammate Compatibility Drawer',
    description: 'Implement a side-drawer showing compatibility breakdown based on skills, department and year overlap.',
    column: 'inprogress',
    priority: 'medium',
    deadline: '2026-07-25',
    assignees: ['student_alex'],
    comments: [],
    attachments: []
  },
  {
    id: 'task_3',
    projectId: 'project_studyhub',
    title: 'Configure SvelteKit layout styles & theme config',
    description: 'Set up global Tailwind v4 configuration, font structures, and baseline glassmorphism CSS helpers.',
    column: 'completed',
    priority: 'medium',
    deadline: '2026-07-14',
    assignees: ['student_alex'],
    comments: [],
    attachments: []
  },
  {
    id: 'task_4',
    projectId: 'project_studyhub',
    title: 'Setup Database schema mapping and indexes',
    description: 'Write collection and index mappings for Users, Projects, Tasks, and Discussions.',
    column: 'todo',
    priority: 'high',
    deadline: '2026-08-05',
    assignees: ['student_sarah'],
    comments: [],
    attachments: []
  }
];

const defaultThreads: Thread[] = [
  {
    id: 'thread_1',
    projectId: 'project_studyhub',
    title: 'Project Kickoff & Brainstorming Ideas',
    content: 'Hi team, let’s use this discussion board to draft our ideas. Please post links to design patterns and tech structures here.',
    authorId: 'student_alex',
    authorName: 'Alex Mercer',
    authorAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
    createdAt: '2026-07-02T09:00:00.000Z',
    replies: [
      {
        id: 'r1',
        authorId: 'student_sarah',
        authorName: 'Sarah Chen',
        authorAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah',
        content: 'Awesome. I’ve started drafting the ML pipeline ideas for recommending study slots based on calendar traffic.',
        createdAt: '2026-07-02T10:15:00.000Z'
      }
    ]
  }
];

const defaultFiles: ProjectFile[] = [
  {
    id: 'file_1',
    projectId: 'project_studyhub',
    name: 'Software_Architecture_Spec.pdf',
    path: 'Documents/Software_Architecture_Spec.pdf',
    size: '1.2 MB',
    type: 'pdf',
    uploadedBy: 'student_alex',
    uploadedByName: 'Alex Mercer',
    createdAt: '2026-07-05T16:00:00.000Z',
    version: 1
  },
  {
    id: 'file_2',
    projectId: 'project_studyhub',
    name: 'Figma_UI_Wireframes.png',
    path: 'Design/Figma_UI_Wireframes.png',
    size: '4.8 MB',
    type: 'image',
    uploadedBy: 'student_alex',
    uploadedByName: 'Alex Mercer',
    createdAt: '2026-07-08T11:20:00.000Z',
    version: 2
  }
];

export interface Notification {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'invite' | 'task' | 'project' | 'discussion' | 'announcement';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

const defaultNotifications: Notification[] = [
  {
    id: 'notif_1',
    userId: 'student_marcus',
    title: 'Project Invitation',
    description: 'Alex Mercer invited you to join Decentralized Study Hub.',
    type: 'invite',
    read: false,
    createdAt: '2026-07-15T18:00:00.000Z',
    actionUrl: '/dashboard/student/project/project_studyhub'
  },
  {
    id: 'notif_2',
    userId: 'student_alex',
    title: 'Task Assigned',
    description: 'You have been assigned to: "Implement Firebase Authentication".',
    type: 'task',
    read: false,
    createdAt: '2026-07-15T19:30:00.000Z',
    actionUrl: '/dashboard/student/project/project_studyhub'
  }
];

/** Every collection the service persists, keyed by its storage name. */
export const COLLECTION_KEYS = [
  'departments',
  'users',
  'projects',
  'tasks',
  'threads',
  'files',
  'project_ideas',
  'notifications',
  'weekly_reports',
  'categorized_feedback',
  'meetings',
  'announcements',
  'faculty_notes',
  'audit_log',
  'staff_requests'
] as const;
export type CollectionKey = (typeof COLLECTION_KEYS)[number];

/** Demo content each collection falls back to when nothing is stored yet. */
export const DEMO_SEED: Partial<Record<CollectionKey, unknown[]>> = {
  departments: defaultDepartments,
  users: defaultUsers,
  projects: defaultProjects,
  tasks: defaultTasks,
  threads: defaultThreads,
  files: defaultFiles,
  project_ideas: defaultProjectIdeas,
  notifications: defaultNotifications
};

/** Called after a local write with the collection's state before and after. */
export type WriteHook = (key: CollectionKey, prev: unknown[], next: unknown[]) => void;
/** Called whenever a collection changes, whether the write was local or remote. */
export type ChangeListener = (key: CollectionKey, origin: 'local' | 'remote') => void;

class DatabaseService {
  private writeHooks = new Set<WriteHook>();
  private changeListeners = new Set<ChangeListener>();
  /**
   * When false, empty collections read as empty rather than falling back to the
   * built-in demo data. Cloud mode turns this off so a real deployment never
   * shows fabricated projects while its first snapshot is still loading.
   */
  useDemoDefaults = true;

  onWrite(hook: WriteHook): () => void {
    this.writeHooks.add(hook);
    return () => this.writeHooks.delete(hook);
  }

  onChange(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private emitChange(key: string, origin: 'local' | 'remote') {
    this.changeListeners.forEach((l) => l(key as CollectionKey, origin));
  }

  /** Raw stored array for a collection, without validation or demo fallback. */
  private readRaw(key: string): unknown[] {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(`teamforge_${key}`) ?? 'null');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Replaces a collection with state that arrived from the backend. Unlike a
   * local save it does not fire write hooks, so it never echoes back upstream.
   */
  applyRemote(key: CollectionKey, items: unknown[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`teamforge_${key}`, JSON.stringify(items));
    this.emitChange(key, 'remote');
  }

  private getStorage<T>(key: string, defaultValue: T, schema?: ZodType<T>): T {
    if (typeof window === 'undefined') return defaultValue;
    if (!this.useDemoDefaults && Array.isArray(defaultValue)) {
      defaultValue = (key === 'departments' ? defaultValue : []) as T;
    }
    const item = localStorage.getItem(`teamforge_${key}`);
    if (!item) return defaultValue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(item);
    } catch {
      console.warn(`[TeamForge] Corrupted JSON in localStorage for "${key}", falling back to defaults.`);
      return defaultValue;
    }
    if (!schema) return parsed as T;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.warn(`[TeamForge] Stored data for "${key}" failed validation, falling back to defaults.`, result.error);
      return defaultValue;
    }
    return result.data;
  }

  private setStorage<T>(key: string, val: T): void {
    if (typeof window === 'undefined') return;
    const prev = this.writeHooks.size > 0 ? this.readRaw(key) : [];
    localStorage.setItem(`teamforge_${key}`, JSON.stringify(val));
    if (Array.isArray(val)) {
      this.writeHooks.forEach((h) => h(key as CollectionKey, prev, val));
    }
    this.emitChange(key, 'local');
  }

  // Reactive Data getters using svelte store pattern or local fields
  getDepartments(): Department[] {
    return this.getStorage('departments', defaultDepartments, z.array(DepartmentSchema));
  }

  saveDepartments(deps: Department[]): void {
    this.setStorage('departments', deps);
  }

  getUsers(): User[] {
    return this.getStorage('users', defaultUsers, z.array(UserSchema));
  }

  saveUsers(users: User[]): void {
    this.setStorage('users', users);
  }

  getProjects(): Project[] {
    return this.getStorage('projects', defaultProjects, z.array(ProjectSchema));
  }

  saveProjects(projects: Project[]): void {
    this.setStorage('projects', projects);
  }

  getTasks(): Task[] {
    return this.getStorage('tasks', defaultTasks, z.array(TaskSchema));
  }

  saveTasks(tasks: Task[]): void {
    this.setStorage('tasks', tasks);
  }

  getThreads(): Thread[] {
    return this.getStorage('threads', defaultThreads, z.array(ThreadSchema));
  }

  saveThreads(threads: Thread[]): void {
    this.setStorage('threads', threads);
  }

  getFiles(): ProjectFile[] {
    return this.getStorage('files', defaultFiles, z.array(ProjectFileSchema));
  }

  saveFiles(files: ProjectFile[]): void {
    this.setStorage('files', files);
  }

  getProjectIdeas(): ProjectIdea[] {
    return this.getStorage('project_ideas', defaultProjectIdeas, z.array(ProjectIdeaSchema));
  }

  saveProjectIdeas(ideas: ProjectIdea[]): void {
    this.setStorage('project_ideas', ideas);
  }

  getNotifications(userId: string): Notification[] {
    const notifs = this.getStorage('notifications', defaultNotifications, z.array(NotificationSchema));
    return notifs.filter(n => n.userId === userId);
  }

  saveNotifications(notifs: Notification[]): void {
    const all = this.getStorage('notifications', defaultNotifications, z.array(NotificationSchema));
    // Merge or replace
    const otherNotifs = all.filter(n => !notifs.some(x => x.id === n.id));
    this.setStorage('notifications', [...otherNotifs, ...notifs]);
  }

  /**
   * `saveNotifications` merges by id, so it cannot express a removal — handing
   * it "everything except X" leaves X in place. Deletion needs its own path.
   */
  deleteNotification(id: string): void {
    const all = this.getStorage('notifications', defaultNotifications, z.array(NotificationSchema));
    this.setStorage('notifications', all.filter((n) => n.id !== id));
  }

  // Core functions
  getUser(userId: string): User | undefined {
    return this.getUsers().find(u => u.id === userId);
  }

  updateUserProfile(userId: string, data: Partial<User>): User {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...data } as User;
      this.saveUsers(users);
      return users[idx];
    }
    throw new Error('User not found');
  }

  // Projects CRUD
  /**
   * The projects a faculty member supervises: the ones whose students chose
   * them as mentor. Other faculty never see those teams. A project recorded
   * before mentors existed (no mentorId) falls back to its department's
   * faculty so it is never left unsupervised. Every faculty page uses this;
   * the database enforces the same rule (see public.supervises()).
   */
  getSupervisedProjects(faculty: Pick<User, 'id' | 'department'>): Project[] {
    return this.getProjects().filter((p) =>
      p.mentorId ? p.mentorId === faculty.id : p.department === faculty.department
    );
  }

  /**
   * Whether an announcement is addressed to a project. "All teams" posts record
   * the exact teams they went to, so they reach only that faculty member's
   * mentees; only legacy broadcasts with no recorded targets reach everyone.
   */
  announcementReaches(a: Pick<Announcement, 'targetType' | 'targetIds'>, projectId: string): boolean {
    return a.targetIds.includes(projectId) || (a.targetType === 'all' && a.targetIds.length === 0);
  }

  /** Faculty accounts a project can name as its mentor. */
  getMentors(): User[] {
    return this.getUsers()
      .filter((u) => u.role === 'faculty')
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  createProject(input: NewProjectInput, owner: User): Project {
    const name = input.name.trim();
    const description = input.description.trim();
    // De-duplicate case-insensitively, keeping the first spelling given.
    const requiredSkills = input.requiredSkills
      .map((s) => s.trim())
      .filter((s, i, all) => s && all.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
    if (!name) throw new Error('Give the project a name.');
    if (!description) throw new Error('Describe what the project will build.');
    if (requiredSkills.length === 0) throw new Error('List at least one skill the team needs.');
    if (!Number.isInteger(input.teamSize) || input.teamSize < TEAM_SIZE_MIN || input.teamSize > TEAM_SIZE_MAX) {
      throw new Error(`Team size must be between ${TEAM_SIZE_MIN} and ${TEAM_SIZE_MAX}.`);
    }
    const mentor = this.getUser(input.mentorId);
    if (!mentor || mentor.role !== 'faculty') throw new Error('Choose a mentor from the registered faculty.');

    const projects = this.getProjects();
    const newProj: Project = {
      id: newId('project'),
      name,
      description,
      department: input.department,
      status: 'pending',
      ownerId: owner.id,
      ownerName: owner.name,
      members: [{ userId: owner.id, name: owner.name, role: TEAM_LEADER_ROLE, avatar: owner.avatar }],
      milestones: [],
      pendingInvites: [],
      pendingRequests: [],
      createdAt: new Date().toISOString(),
      requiredSkills,
      teamSize: input.teamSize,
      mentorId: mentor.id,
      mentorName: mentor.name
    };
    projects.push(newProj);
    this.saveProjects(projects);

    // The chosen mentor hears about the proposal directly.
    this.saveNotifications([
      {
        id: newId('notif'),
        userId: mentor.id,
        title: 'New project to mentor',
        description: `${owner.name} proposed "${name}" and named you as mentor. It is waiting for approval.`,
        type: 'project',
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: '/dashboard/faculty/approvals'
      }
    ]);
    return newProj;
  }

  /** Open places left on a team, counting outstanding invitations as taken. `null` when unlimited. */
  openSeats(project: Project): number | null {
    if (!project.teamSize) return null;
    return Math.max(0, project.teamSize - project.members.length - project.pendingInvites.length);
  }

  updateProject(id: string, data: Partial<Project>): Project {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], ...data } as Project;
      this.saveProjects(projects);
      return projects[idx];
    }
    throw new Error('Project not found');
  }

  // Project Ideas CRUD
  createProjectIdea(
    title: string,
    description: string,
    requiredSkills: string[],
    teamSizeRequirement: number,
    techStack: string[],
    domain: string,
    visibility: 'public' | 'private',
    owner: User
  ): ProjectIdea {
    const ideas = this.getProjectIdeas();
    const newIdea: ProjectIdea = {
      id: newId('idea'),
      title,
      description,
      requiredSkills,
      teamSizeRequirement,
      techStack,
      domain,
      visibility,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerAvatar: owner.avatar,
      createdAt: new Date().toISOString()
    };
    ideas.push(newIdea);
    this.saveProjectIdeas(ideas);
    return newIdea;
  }

  updateProjectIdea(id: string, data: Partial<ProjectIdea>): ProjectIdea {
    const ideas = this.getProjectIdeas();
    const idx = ideas.findIndex(i => i.id === id);
    if (idx !== -1) {
      ideas[idx] = { ...ideas[idx], ...data } as ProjectIdea;
      this.saveProjectIdeas(ideas);
      return ideas[idx];
    }
    throw new Error('Project Idea not found');
  }

  deleteProjectIdea(id: string): void {
    const ideas = this.getProjectIdeas();
    const filtered = ideas.filter(i => i.id !== id);
    this.saveProjectIdeas(filtered);
  }

  /**
   * Invites a student by email. Only the team leader may invite: pass the
   * person sending the invitation as `invitedBy`.
   */
  inviteToProject(projectId: string, email: string, invitedBy?: Pick<User, 'id'>): void {
    const user = this.getUsers().find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new Error('User not found');
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      const proj = projects[idx];
      if (invitedBy && !isTeamLeader(proj, invitedBy.id)) {
        throw new Error('Only the team leader can invite teammates.');
      }
      if (proj.members.some(m => m.userId === user.id)) throw new Error('Already a member');
      if (!proj.pendingInvites.includes(user.id) && this.openSeats(proj) === 0) {
        throw new Error(`The team is full (${proj.teamSize} members, including pending invitations).`);
      }
      if (!proj.pendingInvites.includes(user.id)) {
        proj.pendingInvites.push(user.id);
        this.saveProjects(projects);
        
        // Add notification
        const notifs = this.getStorage('notifications', defaultNotifications, z.array(NotificationSchema));
        notifs.push({
          id: newId('notif'),
          userId: user.id,
          title: 'Project Invitation',
          description: `You have been invited to join "${proj.name}".`,
          type: 'invite',
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: `/dashboard/student/project/${proj.id}`
        });
        this.setStorage('notifications', notifs);
      }
    }
  }

  acceptInvite(projectId: string, userId: string): void {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    const user = this.getUser(userId);
    if (idx !== -1 && user) {
      const proj = projects[idx];
      const alreadyMember = proj.members.some(m => m.userId === userId);
      if (!alreadyMember && proj.teamSize && proj.members.length >= proj.teamSize) {
        throw new Error(`This team is already full (${proj.teamSize} members).`);
      }
      proj.pendingInvites = proj.pendingInvites.filter(id => id !== userId);
      if (!alreadyMember) {
        proj.members.push({
          userId,
          name: user.name,
          role: 'Team Member',
          avatar: user.avatar
        });
      }
      this.saveProjects(projects);
    }
  }

  declineInvite(projectId: string, userId: string): void {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      const proj = projects[idx];
      proj.pendingInvites = proj.pendingInvites.filter(id => id !== userId);
      this.saveProjects(projects);
    }
  }

  // Kanban Tasks
  createTask(projectId: string, title: string, description: string, priority: 'low' | 'medium' | 'high', deadline: string, assignees: string[]): Task {
    const tasks = this.getTasks();
    const newTask: Task = {
      id: newId('task'),
      projectId,
      title,
      description,
      column: 'todo',
      priority,
      deadline,
      assignees,
      comments: [],
      attachments: []
    };
    tasks.push(newTask);
    this.saveTasks(tasks);
    
    // Notify assignees
    const notifs = this.getStorage('notifications', defaultNotifications, z.array(NotificationSchema));
    assignees.forEach(uid => {
      notifs.push({
        id: newId('notif'),
        userId: uid,
        title: 'New Task Assigned',
        description: `You have been assigned to: "${title}".`,
        type: 'task',
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: `/dashboard/student/project/${projectId}`
      });
    });
    this.setStorage('notifications', notifs);

    return newTask;
  }

  updateTask(id: string, data: Partial<Task>): Task {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...data } as Task;
      this.saveTasks(tasks);
      return tasks[idx];
    }
    throw new Error('Task not found');
  }

  addComment(taskId: string, user: User, text: string): TaskComment {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      const comment: TaskComment = {
        id: newId('comment'),
        userName: user.name,
        userAvatar: user.avatar,
        text,
        createdAt: new Date().toISOString()
      };
      tasks[idx].comments.push(comment);
      this.saveTasks(tasks);
      return comment;
    }
    throw new Error('Task not found');
  }

  // Discussions
  createThread(projectId: string, title: string, content: string, user: User): Thread {
    const threads = this.getThreads();
    const newThread: Thread = {
      id: newId('thread'),
      projectId,
      title,
      content,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      createdAt: new Date().toISOString(),
      replies: []
    };
    threads.push(newThread);
    this.saveThreads(threads);
    return newThread;
  }

  addReply(threadId: string, content: string, user: User): Reply {
    const threads = this.getThreads();
    const idx = threads.findIndex(t => t.id === threadId);
    if (idx !== -1) {
      const reply: Reply = {
        id: newId('reply'),
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        content,
        createdAt: new Date().toISOString()
      };
      threads[idx].replies.push(reply);
      this.saveThreads(threads);
      return reply;
    }
    throw new Error('Thread not found');
  }

  // File Upload Simulation
  uploadFile(projectId: string, name: string, size: string, fileType: string, user: User): ProjectFile {
    const files = this.getFiles();
    const path = `Documents/${name}`;
    const newFile: ProjectFile = {
      id: newId('file'),
      projectId,
      name,
      path,
      size,
      type: fileType,
      uploadedBy: user.id,
      uploadedByName: user.name,
      createdAt: new Date().toISOString(),
      version: 1
    };
    files.push(newFile);
    this.saveFiles(files);
    return newFile;
  }

  getWeeklyReports(projectId?: string): WeeklyReport[] {
    const reports = this.getStorage('weekly_reports', [] as WeeklyReport[], z.array(WeeklyReportSchema));
    return projectId ? reports.filter(r => r.projectId === projectId) : reports;
  }

  saveWeeklyReports(reports: WeeklyReport[]): void {
    this.setStorage('weekly_reports', reports);
  }

  submitWeeklyReport(projectId: string, weekNumber: number, userId: string, userName: string, achievements: string, plannedTasks: string, blockers: string): WeeklyReport {
    const reports = this.getWeeklyReports();
    const newReport: WeeklyReport = {
      id: newId('rep'),
      projectId,
      weekNumber,
      submittedBy: userId,
      submittedByName: userName,
      submittedAt: new Date().toISOString(),
      achievements,
      plannedTasks,
      blockers,
      status: 'pending',
      feedback: ''
    };
    reports.push(newReport);
    this.saveWeeklyReports(reports);
    return newReport;
  }

  updateWeeklyReportStatus(reportId: string, status: WeeklyReport['status'], feedback: string): WeeklyReport {
    const reports = this.getWeeklyReports();
    const idx = reports.findIndex(r => r.id === reportId);
    if (idx !== -1) {
      reports[idx] = { ...reports[idx], status, feedback };
      this.saveWeeklyReports(reports);
      return reports[idx];
    }
    throw new Error('Report not found');
  }

  getFeedback(projectId?: string): CategorizedFeedback[] {
    const feedbackList = this.getStorage('categorized_feedback', [] as CategorizedFeedback[], z.array(CategorizedFeedbackSchema));
    return projectId ? feedbackList.filter(f => f.projectId === projectId) : feedbackList;
  }

  saveFeedback(feedbackList: CategorizedFeedback[]): void {
    this.setStorage('categorized_feedback', feedbackList);
  }

  addFeedback(projectId: string, category: CategorizedFeedback['category'], feedbackText: string, facultyName: string): CategorizedFeedback {
    const feedbackList = this.getFeedback();
    const newFeedback: CategorizedFeedback = {
      id: newId('fb'),
      projectId,
      category,
      feedbackText,
      facultyName,
      createdAt: new Date().toISOString()
    };
    feedbackList.push(newFeedback);
    this.saveFeedback(feedbackList);
    return newFeedback;
  }

  getMeetings(projectId?: string): Meeting[] {
    const meetings = this.getStorage('meetings', [] as Meeting[], z.array(MeetingSchema));
    return projectId ? meetings.filter(m => m.projectId === projectId) : meetings;
  }

  saveMeetings(meetings: Meeting[]): void {
    this.setStorage('meetings', meetings);
  }

  scheduleMeeting(projectId: string, projectName: string, title: string, date: string, time: string, linkOrLocation: string): Meeting {
    const meetings = this.getMeetings();
    const newMeeting: Meeting = {
      id: newId('meet'),
      projectId,
      projectName,
      title,
      date,
      time,
      linkOrLocation,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    meetings.push(newMeeting);
    this.saveMeetings(meetings);
    return newMeeting;
  }

  /** Records who attended a meeting. Replaces the whole register for that meeting. */
  recordAttendance(meetingId: string, attendance: Record<string, AttendanceStatus>): Meeting {
    return this.updateMeeting(meetingId, { attendance });
  }

  /**
   * Attendance summary for one student across every meeting of a project that
   * has a register. `rate` counts present and late as attended; excused
   * meetings are left out of the denominator.
   */
  getAttendanceSummary(projectId: string, userId: string) {
    const recorded = this.getMeetings(projectId).filter(
      (m) => m.status === 'scheduled' && m.attendance && userId in m.attendance
    );
    const counts = { present: 0, late: 0, excused: 0, absent: 0 };
    recorded.forEach((m) => counts[m.attendance![userId]]++);
    const counted = recorded.length - counts.excused;
    return {
      ...counts,
      recorded: recorded.length,
      rate: counted > 0 ? Math.round(((counts.present + counts.late) / counted) * 100) : null
    };
  }

  updateMeeting(meetingId: string, data: Partial<Meeting>): Meeting {
    const meetings = this.getMeetings();
    const idx = meetings.findIndex(m => m.id === meetingId);
    if (idx !== -1) {
      meetings[idx] = { ...meetings[idx], ...data } as Meeting;
      this.saveMeetings(meetings);
      return meetings[idx];
    }
    throw new Error('Meeting not found');
  }

  getAnnouncements(projectId?: string): Announcement[] {
    const announcements = this.getStorage('announcements', [] as Announcement[], z.array(AnnouncementSchema));
    if (!projectId) return announcements;
    return announcements.filter(a => this.announcementReaches(a, projectId));
  }

  saveAnnouncements(announcements: Announcement[]): void {
    this.setStorage('announcements', announcements);
  }

  createAnnouncement(targetType: 'all' | 'team', targetIds: string[], title: string, content: string, facultyName: string): Announcement {
    const announcements = this.getAnnouncements();
    const newAnnouncement: Announcement = {
      id: newId('ann'),
      targetType,
      targetIds,
      title,
      content,
      facultyName,
      createdAt: new Date().toISOString()
    };
    announcements.push(newAnnouncement);
    this.saveAnnouncements(announcements);
    return newAnnouncement;
  }

  getFacultyNotes(projectId?: string): FacultyNote[] {
    const notes = this.getStorage('faculty_notes', [] as FacultyNote[], z.array(FacultyNoteSchema));
    return projectId ? notes.filter(n => n.projectId === projectId) : notes;
  }

  saveFacultyNotes(notes: FacultyNote[]): void {
    this.setStorage('faculty_notes', notes);
  }

  saveFacultyNote(projectId: string, studentId: string | undefined, content: string): FacultyNote {
    const notes = this.getFacultyNotes();
    const idx = notes.findIndex(n => n.projectId === projectId && n.studentId === studentId);
    if (idx !== -1) {
      notes[idx].content = content;
      notes[idx].updatedAt = new Date().toISOString();
      this.saveFacultyNotes(notes);
      return notes[idx];
    } else {
      const newNote: FacultyNote = {
        id: newId('note'),
        projectId,
        studentId,
        content,
        updatedAt: new Date().toISOString()
      };
      notes.push(newNote);
      this.saveFacultyNotes(notes);
      return newNote;
    }
  }

  // Staff (faculty) sign-up approvals
  getStaffRequests(status?: StaffRequest['status']): StaffRequest[] {
    const all = this.getStorage('staff_requests', [] as StaffRequest[], z.array(StaffRequestSchema) as unknown as ZodType<StaffRequest[]>);
    return status ? all.filter((r) => r.status === status) : all;
  }

  saveStaffRequests(requests: StaffRequest[]): void {
    this.setStorage('staff_requests', requests);
  }

  /**
   * Local mode: records a faculty sign-up for an admin to decide on, and
   * notifies every admin. Returns the existing request if one is already open.
   */
  requestStaffAccount(request: Omit<StaffRequest, 'id' | 'status' | 'createdAt' | 'role'>): StaffRequest {
    const requests = this.getStaffRequests();
    const email = request.email.toLowerCase();
    const open = requests.find((r) => r.email.toLowerCase() === email && r.status === 'pending');
    if (open) return open;
    const entry: StaffRequest = {
      ...request,
      email,
      id: newId('staffreq'),
      role: 'faculty',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.saveStaffRequests([...requests, entry]);
    this.saveNotifications(
      this.getUsers()
        .filter((u) => u.role === 'admin')
        .map((admin) => ({
          id: newId('notif'),
          userId: admin.id,
          title: 'Faculty sign-up to approve',
          description: `${entry.name} (${entry.email}) asked for a faculty account in ${entry.department}.`,
          type: 'project' as const,
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: '/dashboard/admin'
        }))
    );
    return entry;
  }

  /** Local mode: approves a request by creating the faculty account it describes. */
  approveStaffRequest(requestId: string, admin: Pick<User, 'id' | 'role'>): User {
    if (admin.role !== 'admin') throw new Error('Only an administrator can approve staff accounts.');
    const requests = this.getStaffRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') throw new Error('This request is no longer pending.');
    const users = this.getUsers();
    if (users.some((u) => u.email.toLowerCase() === req.email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const faculty: User = {
      id: newId('user'),
      name: req.name,
      email: req.email,
      passwordHash: req.passwordHash,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.name)}`,
      role: 'faculty',
      department: req.department,
      bio: '',
      skills: [],
      interests: [],
      availability: true
    };
    this.saveUsers([...users, faculty]);
    this.saveStaffRequests(
      requests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'approved' as const, decidedAt: new Date().toISOString(), decidedBy: admin.id, passwordHash: undefined }
          : r
      )
    );
    return faculty;
  }

  /** Local mode: turns a request down. The person can see the reason when they try to sign in. */
  rejectStaffRequest(requestId: string, admin: Pick<User, 'id' | 'role'>, reason = ''): void {
    if (admin.role !== 'admin') throw new Error('Only an administrator can reject staff accounts.');
    const requests = this.getStaffRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') throw new Error('This request is no longer pending.');
    this.saveStaffRequests(
      requests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected' as const, decidedAt: new Date().toISOString(), decidedBy: admin.id, reason, passwordHash: undefined }
          : r
      )
    );
  }

  // Faculty activity log
  getAuditLog(actorId?: string): AuditLogEntry[] {
    const log = this.getStorage('audit_log', [] as AuditLogEntry[], z.array(AuditLogEntrySchema));
    return actorId ? log.filter((e) => e.actorId === actorId) : log;
  }

  saveAuditLog(log: AuditLogEntry[]): void {
    this.setStorage('audit_log', log);
  }

  logAudit(
    actorId: string,
    actorName: string,
    action: string,
    targetType: AuditLogEntry['targetType'],
    targetId?: string,
    targetLabel?: string
  ): AuditLogEntry {
    const log = this.getAuditLog();
    const entry: AuditLogEntry = {
      id: newId('audit'),
      actorId,
      actorName,
      action,
      targetType,
      targetId,
      targetLabel,
      createdAt: new Date().toISOString()
    };
    log.push(entry);
    this.saveAuditLog(log);
    return entry;
  }

  // Local-storage-wide maintenance (the browser cache is the source of truth in
  // local mode, and a mirror of Supabase in cloud mode).
  private allStorageKeys(): string[] {
    if (typeof window === 'undefined') return [];
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('teamforge_') && !NON_DATA_KEYS.has(k)) keys.push(k);
    }
    return keys;
  }

  /** Wipes all locally stored app data so it re-seeds from the built-in demo defaults. */
  resetAllData(): void {
    if (typeof window === 'undefined') return;
    const prev = Object.fromEntries(COLLECTION_KEYS.map((k) => [k, this.readRaw(k)]));
    this.allStorageKeys().forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('teamforge_current_user');
    localStorage.removeItem('teamforge_auth_session');
    // Let the sync layer mirror the reset (it re-seeds the demo defaults).
    COLLECTION_KEYS.forEach((k) => {
      const next = (this.useDemoDefaults ? (DEMO_SEED[k] ?? []) : []) as unknown[];
      this.writeHooks.forEach((h) => h(k, prev[k], next));
      this.emitChange(k, 'local');
    });
  }

  /**
   * Drops the cached copy of every collection without touching the backend.
   * Used on sign-out in cloud mode so the next person on a shared machine
   * never sees the previous user's cached data.
   */
  clearLocalCache(): void {
    if (typeof window === 'undefined') return;
    this.allStorageKeys().forEach((k) => localStorage.removeItem(k));
  }

  /** Snapshots every `teamforge_*` data key currently in localStorage as a plain object. */
  exportAllData(): Record<string, unknown> {
    if (typeof window === 'undefined') return {};
    const data: Record<string, unknown> = {};
    this.allStorageKeys().forEach((k) => {
      try {
        data[k] = JSON.parse(localStorage.getItem(k) as string);
      } catch {
        // skip unreadable entries
      }
    });
    return data;
  }

  /** Restores a previously exported snapshot, overwriting matching collections. */
  importAllData(data: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    Object.entries(data).forEach(([k, v]) => {
      if (!k.startsWith('teamforge_') || NON_DATA_KEYS.has(k)) return;
      const key = k.slice('teamforge_'.length);
      if ((COLLECTION_KEYS as readonly string[]).includes(key) && Array.isArray(v)) {
        // Goes through setStorage so a connected backend receives the import too.
        this.setStorage(key, v);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    });
  }
}

/** Keys under the `teamforge_` prefix that hold session or UI state, not data. */
const NON_DATA_KEYS = new Set([
  'teamforge_current_user',
  'teamforge_auth_session',
  'teamforge_rate_limit_records',
  'teamforge_sidebar'
]);

export const db = new DatabaseService();
