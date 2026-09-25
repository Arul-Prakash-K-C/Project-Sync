import { z } from 'zod';

export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  headName: z.string(),
  description: z.string()
});

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  passwordHash: z.string().optional(),
  avatar: z.string(),
  role: z.enum(['student', 'faculty', 'admin']),
  department: z.string(),
  academicYear: z.string().optional(),
  bio: z.string().optional(),
  skills: z.array(z.string()),
  interests: z.array(z.string()),
  availability: z.boolean(),
  previousProjects: z.array(z.string()).optional()
});

const ProjectMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.string(),
  avatar: z.string()
});

const MilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  deadline: z.string(),
  completed: z.boolean(),
  locked: z.boolean().optional(),
  extendedDeadline: z.string().optional()
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  department: z.string(),
  status: z.enum(['pending', 'active', 'archived', 'rejected']),
  ownerId: z.string(),
  ownerName: z.string(),
  members: z.array(ProjectMemberSchema),
  milestones: z.array(MilestoneSchema),
  pendingInvites: z.array(z.string()),
  pendingRequests: z.array(z.string()),
  createdAt: z.string(),
  // Optional so projects created before these fields existed still load.
  requiredSkills: z.array(z.string()).optional(),
  teamSize: z.number().int().optional(),
  mentorId: z.string().optional(),
  mentorName: z.string().optional()
});

export const ProjectIdeaSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  requiredSkills: z.array(z.string()),
  teamSizeRequirement: z.number(),
  techStack: z.array(z.string()),
  domain: z.string(),
  visibility: z.enum(['public', 'private']),
  ownerId: z.string(),
  ownerName: z.string(),
  ownerAvatar: z.string(),
  createdAt: z.string()
});

const TaskAttachmentSchema = z.object({
  name: z.string(),
  size: z.string(),
  url: z.string()
});

const TaskCommentSchema = z.object({
  id: z.string(),
  userName: z.string(),
  userAvatar: z.string(),
  text: z.string(),
  createdAt: z.string()
});

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  column: z.enum(['todo', 'inprogress', 'review', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  deadline: z.string(),
  assignees: z.array(z.string()),
  comments: z.array(TaskCommentSchema),
  attachments: z.array(TaskAttachmentSchema)
});

const ReplySchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorAvatar: z.string(),
  content: z.string(),
  createdAt: z.string()
});

export const ThreadSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorAvatar: z.string(),
  createdAt: z.string(),
  replies: z.array(ReplySchema)
});

export const ProjectFileSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  path: z.string(),
  size: z.string(),
  type: z.string(),
  uploadedBy: z.string(),
  uploadedByName: z.string(),
  createdAt: z.string(),
  version: z.number()
});

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['invite', 'task', 'project', 'discussion', 'announcement']),
  read: z.boolean(),
  createdAt: z.string(),
  actionUrl: z.string().optional()
});

export const WeeklyReportSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  weekNumber: z.number(),
  submittedBy: z.string(),
  submittedByName: z.string(),
  submittedAt: z.string(),
  achievements: z.string(),
  plannedTasks: z.string(),
  blockers: z.string(),
  status: z.enum(['pending', 'approved', 'revision_requested']),
  feedback: z.string()
});

export const CategorizedFeedbackSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  category: z.enum(['code', 'documentation', 'ui', 'testing', 'presentation']),
  feedbackText: z.string(),
  facultyName: z.string(),
  createdAt: z.string()
});

export const MeetingSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string(),
  linkOrLocation: z.string(),
  status: z.enum(['scheduled', 'cancelled']),
  createdAt: z.string(),
  attendance: z.record(z.string(), z.enum(['present', 'late', 'excused', 'absent'])).optional()
});

export const AnnouncementSchema = z.object({
  id: z.string(),
  targetType: z.enum(['team', 'all']),
  targetIds: z.array(z.string()),
  title: z.string(),
  content: z.string(),
  facultyName: z.string(),
  createdAt: z.string()
});

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  action: z.string(),
  targetType: z.enum(['project', 'milestone', 'weekly_report', 'announcement', 'feedback', 'meeting']),
  targetId: z.string().optional(),
  targetLabel: z.string().optional(),
  createdAt: z.string()
});

export const StaffRequestSchema = z.object({
  id: z.string(),
  authUid: z.string().optional(),
  name: z.string(),
  email: z.string(),
  department: z.string(),
  role: z.literal('faculty'),
  /** Local mode only: the chosen password's hash, used to create the account on approval. */
  passwordHash: z.string().optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string(),
  decidedAt: z.string().optional(),
  decidedBy: z.string().optional(),
  reason: z.string().optional()
});

export const FacultyNoteSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  studentId: z.string().optional(),
  content: z.string(),
  updatedAt: z.string()
});
