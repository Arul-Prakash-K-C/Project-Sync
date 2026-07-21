export interface User {
  id: string;
  name: string;
  email: string;
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
}

export interface IdeaAdvice {
  id: string;
  facultyId: string;
  facultyName: string;
  facultyAvatar: string;
  feedback: string;
  createdAt: string;
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
  invitedTeammates: string[]; // student user IDs
  advisingFaculty?: string; // single faculty user ID
  advice?: IdeaAdvice[];
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
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julian',
    role: 'faculty',
    department: 'Software Engineering',
    skills: ['Software Design', 'Architecture', 'Quality Assurance'],
    interests: ['Software Engineering', 'System Design'],
    availability: true
  },
  {
    id: 'faculty_alistair',
    name: 'Dr. Alistair Vance',
    email: 'alistair@teamforge.edu',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alistair',
    role: 'faculty',
    department: 'Information Systems',
    skills: ['System Analysis', 'Business Processes', 'IT Strategy'],
    interests: ['Enterprise Systems', 'Business Analysis'],
    availability: true
  },
  {
    id: 'faculty_helena',
    name: 'Dr. Helena Rostova',
    email: 'helena@teamforge.edu',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Helena',
    role: 'faculty',
    department: 'Data Science & Analytics',
    skills: ['Advanced Analytics', 'Predictive Modeling', 'Big Data'],
    interests: ['Data Analytics', 'Big Data Engineering'],
    availability: true
  },
  {
    id: 'admin_sys',
    name: 'Admin System',
    email: 'admin@teamforge.edu',
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
    createdAt: '2026-07-01T10:00:00.000Z'
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
    createdAt: '2026-07-10T14:30:00.000Z'
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
    createdAt: '2026-07-15T12:00:00.000Z',
    invitedTeammates: ['student_sarah'],
    advisingFaculty: 'faculty_evelyn',
    advice: []
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
    createdAt: '2026-07-16T14:30:00.000Z',
    invitedTeammates: [],
    advisingFaculty: 'faculty_evelyn',
    advice: []
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

class DatabaseService {
  private getStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    const item = localStorage.getItem(`teamforge_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  }

  private setStorage<T>(key: string, val: T): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`teamforge_${key}`, JSON.stringify(val));
    }
  }

  // Reactive Data getters using svelte store pattern or local fields
  getDepartments(): Department[] {
    return this.getStorage('departments', defaultDepartments);
  }

  saveDepartments(deps: Department[]): void {
    this.setStorage('departments', deps);
  }

  getUsers(): User[] {
    return this.getStorage('users', defaultUsers);
  }

  saveUsers(users: User[]): void {
    this.setStorage('users', users);
  }

  getProjects(): Project[] {
    return this.getStorage('projects', defaultProjects);
  }

  saveProjects(projects: Project[]): void {
    this.setStorage('projects', projects);
  }

  getTasks(): Task[] {
    return this.getStorage('tasks', defaultTasks);
  }

  saveTasks(tasks: Task[]): void {
    this.setStorage('tasks', tasks);
  }

  getThreads(): Thread[] {
    return this.getStorage('threads', defaultThreads);
  }

  saveThreads(threads: Thread[]): void {
    this.setStorage('threads', threads);
  }

  getFiles(): ProjectFile[] {
    return this.getStorage('files', defaultFiles);
  }

  saveFiles(files: ProjectFile[]): void {
    this.setStorage('files', files);
  }

  getProjectIdeas(): ProjectIdea[] {
    return this.getStorage('project_ideas', defaultProjectIdeas);
  }

  saveProjectIdeas(ideas: ProjectIdea[]): void {
    this.setStorage('project_ideas', ideas);
  }

  getNotifications(userId: string): Notification[] {
    const notifs = this.getStorage('notifications', defaultNotifications);
    return notifs.filter(n => n.userId === userId);
  }

  saveNotifications(notifs: Notification[]): void {
    const all = this.getStorage('notifications', defaultNotifications);
    // Merge or replace
    const otherNotifs = all.filter(n => !notifs.some(x => x.id === n.id));
    this.setStorage('notifications', [...otherNotifs, ...notifs]);
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
  createProject(name: string, description: string, department: string, owner: User): Project {
    const projects = this.getProjects();
    const newProj: Project = {
      id: `project_${Date.now()}`,
      name,
      description,
      department,
      status: 'pending',
      ownerId: owner.id,
      ownerName: owner.name,
      members: [{ userId: owner.id, name: owner.name, role: 'Creator / PM', avatar: owner.avatar }],
      milestones: [],
      pendingInvites: [],
      pendingRequests: [],
      createdAt: new Date().toISOString()
    };
    projects.push(newProj);
    this.saveProjects(projects);
    return newProj;
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
    owner: User,
    invitedTeammates: string[] = [],
    advisingFaculty?: string
  ): ProjectIdea {
    const ideas = this.getProjectIdeas();
    const newIdea: ProjectIdea = {
      id: `idea_${Date.now()}`,
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
      createdAt: new Date().toISOString(),
      invitedTeammates,
      advisingFaculty,
      advice: []
    };
    ideas.push(newIdea);
    this.saveProjectIdeas(ideas);

    // Send notifications to invited teammates
    const notifs = this.getStorage('notifications', defaultNotifications);
    invitedTeammates.forEach(uid => {
      notifs.push({
        id: `notif_${Date.now()}_${uid}`,
        userId: uid,
        title: 'Project Idea Collaboration Invite',
        description: `${owner.name} invited you to collaborate on the project idea "${title}".`,
        type: 'invite',
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: `/dashboard/student/ideas`
      });
    });

    // Send notifications to advising faculty
    if (advisingFaculty) {
      notifs.push({
        id: `notif_${Date.now()}_${advisingFaculty}`,
        userId: advisingFaculty,
        title: 'Project Advice Requested',
        description: `${owner.name} requested advice on the project idea "${title}".`,
        type: 'discussion',
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: `/dashboard/faculty`
      });
    }

    this.setStorage('notifications', notifs);
    return newIdea;
  }

  updateProjectIdea(id: string, data: Partial<ProjectIdea>): ProjectIdea {
    const ideas = this.getProjectIdeas();
    const idx = ideas.findIndex(i => i.id === id);
    if (idx !== -1) {
      const oldIdea = ideas[idx];
      const oldInvited = oldIdea.invitedTeammates || [];
      const oldFaculty = oldIdea.advisingFaculty;

      const newInvited = data.invitedTeammates || [];
      const newFaculty = data.advisingFaculty;

      const newlyInvited = newInvited.filter(uid => !oldInvited.includes(uid));
      const newlyFacultyRequested = newFaculty && newFaculty !== oldFaculty ? [newFaculty] : [];

      ideas[idx] = { ...ideas[idx], ...data } as ProjectIdea;
      this.saveProjectIdeas(ideas);

      const notifs = this.getStorage('notifications', defaultNotifications);
      let updatedNotifs = false;

      if (newlyInvited.length > 0 || newlyFacultyRequested.length > 0) {
        const ownerName = ideas[idx].ownerName;
        const ideaTitle = ideas[idx].title;

        newlyInvited.forEach(uid => {
          notifs.push({
            id: `notif_${Date.now()}_${uid}`,
            userId: uid,
            title: 'Project Idea Collaboration Invite',
            description: `${ownerName} invited you to collaborate on the project idea "${ideaTitle}".`,
            type: 'invite',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/ideas`
          });
        });

        newlyFacultyRequested.forEach(uid => {
          notifs.push({
            id: `notif_${Date.now()}_${uid}`,
            userId: uid,
            title: 'Project Advice Requested',
            description: `${ownerName} requested advice on the project idea "${ideaTitle}".`,
            type: 'discussion',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/faculty`
          });
        });

        updatedNotifs = true;
      }

      if (updatedNotifs) {
        this.setStorage('notifications', notifs);
      }

      return ideas[idx];
    }
    throw new Error('Project Idea not found');
  }

  addIdeaAdvice(ideaId: string, faculty: User, feedback: string): IdeaAdvice {
    const ideas = this.getProjectIdeas();
    const idx = ideas.findIndex(i => i.id === ideaId);
    if (idx !== -1) {
      if (!ideas[idx].advice) {
        ideas[idx].advice = [];
      }
      const newAdvice: IdeaAdvice = {
        id: `advice_${Date.now()}`,
        facultyId: faculty.id,
        facultyName: faculty.name,
        facultyAvatar: faculty.avatar,
        feedback,
        createdAt: new Date().toISOString()
      };
      ideas[idx].advice!.push(newAdvice);
      this.saveProjectIdeas(ideas);

      const notifs = this.getStorage('notifications', defaultNotifications);
      notifs.push({
        id: `notif_${Date.now()}`,
        userId: ideas[idx].ownerId,
        title: 'New Advice on Project Idea',
        description: `${faculty.name} left advice on your idea "${ideas[idx].title}".`,
        type: 'discussion',
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: `/dashboard/student/ideas`
      });
      this.setStorage('notifications', notifs);

      return newAdvice;
    }
    throw new Error('Project Idea not found');
  }

  deleteProjectIdea(id: string): void {
    const ideas = this.getProjectIdeas();
    const filtered = ideas.filter(i => i.id !== id);
    this.saveProjectIdeas(filtered);
  }

  inviteToProject(projectId: string, email: string): void {
    const user = this.getUsers().find(u => u.email === email);
    if (!user) throw new Error('User not found');
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      const proj = projects[idx];
      if (proj.members.some(m => m.userId === user.id)) throw new Error('Already a member');
      if (!proj.pendingInvites.includes(user.id)) {
        proj.pendingInvites.push(user.id);
        this.saveProjects(projects);
        
        // Add notification
        const notifs = this.getStorage('notifications', defaultNotifications);
        notifs.push({
          id: `notif_${Date.now()}`,
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
      proj.pendingInvites = proj.pendingInvites.filter(id => id !== userId);
      if (!proj.members.some(m => m.userId === userId)) {
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
      id: `task_${Date.now()}`,
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
    const notifs = this.getStorage('notifications', defaultNotifications);
    assignees.forEach(uid => {
      notifs.push({
        id: `notif_${Date.now()}_${uid}`,
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
        id: `comment_${Date.now()}`,
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
      id: `thread_${Date.now()}`,
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
        id: `reply_${Date.now()}`,
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
      id: `file_${Date.now()}`,
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
}

export const db = new DatabaseService();
