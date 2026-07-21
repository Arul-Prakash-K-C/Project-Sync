<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { 
    db, 
    type Project, 
    type Task, 
    type Milestone, 
    type WeeklyReport, 
    type CategorizedFeedback, 
    type Meeting, 
    type Announcement, 
    type FacultyNote,
    type User
  } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Grid, 
    CheckSquare, 
    Clock, 
    ArrowRight, 
    Check, 
    X, 
    Award, 
    Plus, 
    Calendar, 
    FileText, 
    FolderPlus, 
    BookOpen, 
    AlertTriangle, 
    BarChart3, 
    Users, 
    Megaphone, 
    Trash2, 
    Edit3, 
    Lock, 
    Unlock, 
    FileDown, 
    Notebook,
    ChevronRight,
    MessageSquare,
    Activity,
    Settings,
    HelpCircle,
    CheckCircle2,
    Circle
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';

  // State arrays
  let projects = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);
  let meetings = $state<Meeting[]>([]);
  let announcements = $state<Announcement[]>([]);
  let facultyNotes = $state<FacultyNote[]>([]);
  
  // Navigation active tab
  let activeTab = $state('overview');

  // Milestone management states
  let selectedMilestoneProjectId = $state('');
  let milestoneTitle = $state('');
  let milestoneDeadline = $state('');
  let editingMilestoneId = $state<string | null>(null);

  // Review states
  let reviewingReport = $state<WeeklyReport | null>(null);
  let reviewFeedbackText = $state('');

  // Feedback states
  let feedbackProjectId = $state('');
  let feedbackCategory = $state<'code' | 'documentation' | 'ui' | 'testing' | 'presentation'>('code');
  let feedbackText = $state('');

  // Meeting scheduler states
  let scheduleProjectId = $state('');
  let meetingTitle = $state('');
  let meetingDate = $state('');
  let meetingTime = $state('');
  let meetingLocation = $state('');
  let editingMeeting = $state<Meeting | null>(null);

  // Announcement states
  let announceTargetType = $state<'all' | 'team'>('all');
  let announceTargetIds = $state<string[]>([]);
  let announceTitle = $state('');
  let announceContent = $state('');

  // Faculty Notes states
  let selectedNotesProjectId = $state('');
  let selectedNotesStudentId = $state('');
  let notesContent = $state('');

  // Dialog controls
  let scheduleDialogOpen = $state(false);
  let feedbackDialogOpen = $state(false);
  let proposalCommentDialogOpen = $state(false);
  let selectedProposalForComment = $state<Project | null>(null);
  let proposalCommentText = $state('');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      allTasks = db.getTasks();
      weeklyReports = db.getWeeklyReports();
      meetings = db.getMeetings();
      announcements = db.getAnnouncements();
      facultyNotes = db.getFacultyNotes();

      // Default selection lists
      const activeP = projects.filter(p => p.status === 'active');
      if (activeP.length > 0) {
        if (!selectedMilestoneProjectId) selectedMilestoneProjectId = activeP[0].id;
        if (!feedbackProjectId) feedbackProjectId = activeP[0].id;
        if (!scheduleProjectId) scheduleProjectId = activeP[0].id;
        if (!selectedNotesProjectId) selectedNotesProjectId = activeP[0].id;
      }
    }
  }

  // Project proposal operations
  function approveProject(id: string) {
    try {
      db.updateProject(id, { status: 'active' });
      toast.success('Project proposal approved!');
      
      const p = db.getProjects().find(proj => proj.id === id);
      if (p) {
        // Add initial milestone
        const updated = [...p.milestones, {
          id: `m_${Date.now()}`,
          title: 'System Requirements Specification',
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          completed: false
        }];
        db.updateProject(p.id, { milestones: updated });

        // Notify owner
        db.saveNotifications([
          {
            id: `notif_${Date.now()}`,
            userId: p.ownerId,
            title: 'Project Approved!',
            description: `Your project proposal "${p.name}" has been approved by ${auth.user!.name}.`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${p.id}`
          }
        ]);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to approve project');
    }
  }

  function rejectProject(id: string) {
    try {
      db.updateProject(id, { status: 'rejected' });
      toast.success('Project proposal rejected');
      
      const p = db.getProjects().find(proj => proj.id === id);
      if (p) {
        db.saveNotifications([
          {
            id: `notif_${Date.now()}`,
            userId: p.ownerId,
            title: 'Project Proposal Rejected',
            description: `Your project proposal "${p.name}" was rejected by ${auth.user!.name}.`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString()
          }
        ]);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to reject project');
    }
  }

  function requestRevision(proj: Project) {
    selectedProposalForComment = proj;
    proposalCommentText = '';
    proposalCommentDialogOpen = true;
  }

  function submitRevisionRequest(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedProposalForComment) return;
    try {
      // In this setup, we keep status as pending but notify students with comment
      db.saveNotifications([
        {
          id: `notif_${Date.now()}`,
          userId: selectedProposalForComment.ownerId,
          title: 'Revision Requested on Proposal',
          description: `Supervisor "${auth.user!.name}" requested changes on "${selectedProposalForComment.name}": "${proposalCommentText}"`,
          type: 'project',
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: `/dashboard/student`
        }
      ]);
      toast.success('Revision request sent to the student team.');
      proposalCommentDialogOpen = false;
      selectedProposalForComment = null;
      loadData();
    } catch (err) {
      toast.error('Failed to request revision');
    }
  }

  // Milestone management
  function handleMilestoneSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedMilestoneProjectId) return;
    const proj = projects.find(p => p.id === selectedMilestoneProjectId);
    if (!proj) return;

    try {
      if (editingMilestoneId) {
        // Edit mode
        const updated = proj.milestones.map(m => m.id === editingMilestoneId ? { ...m, title: milestoneTitle, deadline: milestoneDeadline } : m);
        db.updateProject(proj.id, { milestones: updated });
        toast.success('Milestone updated successfully');
        editingMilestoneId = null;
      } else {
        // Create mode
        const newM: Milestone = {
          id: `m_${Date.now()}`,
          title: milestoneTitle,
          deadline: milestoneDeadline || new Date().toISOString().split('T')[0],
          completed: false,
          locked: false
        };
        db.updateProject(proj.id, { milestones: [...proj.milestones, newM] });
        
        // Notify team members
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'New Milestone Assigned',
              description: `A new milestone "${milestoneTitle}" has been added to project "${proj.name}".`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student/project/${proj.id}`
            }
          ]);
        });
        toast.success('Milestone assigned to team');
      }

      milestoneTitle = '';
      milestoneDeadline = '';
      loadData();
    } catch (err) {
      toast.error('Failed to save milestone');
    }
  }

  function deleteMilestone(projId: string, mId: string) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    try {
      const updated = proj.milestones.filter(m => m.id !== mId);
      db.updateProject(proj.id, { milestones: updated });
      toast.success('Milestone deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete milestone');
    }
  }

  function toggleLockMilestone(projId: string, mId: string) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    try {
      const updated = proj.milestones.map(m => m.id === mId ? { ...m, locked: !m.locked } : m);
      db.updateProject(proj.id, { milestones: updated });
      toast.success('Milestone lock state updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update milestone lock status');
    }
  }

  function extendMilestone(projId: string, mId: string) {
    const proj = projects.find(p => p.id === projId);
    const milestone = proj?.milestones.find(m => m.id === mId);
    if (!proj || !milestone) return;
    
    const newDeadline = prompt('Enter extended deadline date (YYYY-MM-DD):', milestone.deadline);
    if (newDeadline) {
      try {
        const updated = proj.milestones.map(m => m.id === mId ? { ...m, deadline: newDeadline, extendedDeadline: newDeadline } : m);
        db.updateProject(proj.id, { milestones: updated });
        
        // Notify team
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'Milestone Deadline Extended',
              description: `Deadline for "${milestone.title}" has been updated to ${newDeadline}.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student/project/${proj.id}`
            }
          ]);
        });

        toast.success('Milestone deadline extended');
        loadData();
      } catch (err) {
        toast.error('Failed to extend milestone');
      }
    }
  }

  // Weekly reviews review operations
  function reviewReportAction(report: WeeklyReport, status: 'approved' | 'revision_requested') {
    try {
      db.updateWeeklyReportStatus(report.id, status, reviewFeedbackText);
      
      const p = projects.find(proj => proj.id === report.projectId);
      if (p) {
        db.saveNotifications([
          {
            id: `notif_${Date.now()}`,
            userId: report.submittedBy,
            title: status === 'approved' ? 'Weekly Report Approved' : 'Changes Requested on Weekly Report',
            description: `Weekly Report for Week ${report.weekNumber} has been updated to "${status}" by supervisor. Feedback: "${reviewFeedbackText}"`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${p.id}`
          }
        ]);
      }
      
      toast.success(`Weekly Report marked as ${status}`);
      reviewingReport = null;
      reviewFeedbackText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to submit weekly review');
    }
  }

  // Categorized feedback
  function handleFeedbackSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!feedbackProjectId || !feedbackText) return;
    const proj = projects.find(p => p.id === feedbackProjectId);
    if (!proj) return;

    try {
      db.addFeedback(feedbackProjectId, feedbackCategory, feedbackText, auth.user!.name);
      
      // Notify team members
      proj.members.forEach(member => {
        db.saveNotifications([
          {
            id: `notif_${Date.now()}_${member.userId}`,
            userId: member.userId,
            title: 'New Categorized Feedback Added',
            description: `Your supervisor added feedback for category "${feedbackCategory}".`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${proj.id}`
          }
        ]);
      });

      toast.success('Feedback recorded!');
      feedbackText = '';
      feedbackDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to submit feedback');
    }
  }

  // Meeting scheduler
  function handleScheduleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!scheduleProjectId || !meetingTitle || !meetingDate || !meetingTime || !meetingLocation) return;
    const proj = projects.find(p => p.id === scheduleProjectId);
    if (!proj) return;

    try {
      if (editingMeeting) {
        db.updateMeeting(editingMeeting.id, {
          title: meetingTitle,
          date: meetingDate,
          time: meetingTime,
          linkOrLocation: meetingLocation
        });
        toast.success('Review meeting rescheduled!');
        
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'Review Meeting Rescheduled',
              description: `Meeting "${meetingTitle}" rescheduled for ${meetingDate} at ${meetingTime}.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student`
            }
          ]);
        });
        editingMeeting = null;
      } else {
        db.scheduleMeeting(scheduleProjectId, proj.name, meetingTitle, meetingDate, meetingTime, meetingLocation);
        toast.success('Review meeting scheduled!');
        
        // Notify team
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'New Review Meeting Scheduled',
              description: `Supervisor scheduled a meeting: "${meetingTitle}" for ${meetingDate} at ${meetingTime}.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student`
            }
          ]);
        });
      }

      meetingTitle = '';
      meetingDate = '';
      meetingTime = '';
      meetingLocation = '';
      scheduleDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to schedule meeting');
    }
  }

  function cancelMeeting(meet: Meeting) {
    if (!confirm('Are you sure you want to cancel this review meeting?')) return;
    try {
      db.updateMeeting(meet.id, { status: 'cancelled' });
      toast.success('Meeting cancelled.');
      
      const proj = projects.find(p => p.id === meet.projectId);
      if (proj) {
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'Review Meeting Cancelled',
              description: `Meeting "${meet.title}" has been cancelled.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString()
            }
          ]);
        });
      }
      loadData();
    } catch (err) {
      toast.error('Failed to cancel meeting');
    }
  }

  function editMeeting(meet: Meeting) {
    editingMeeting = meet;
    scheduleProjectId = meet.projectId;
    meetingTitle = meet.title;
    meetingDate = meet.date;
    meetingTime = meet.time;
    meetingLocation = meet.linkOrLocation;
    scheduleDialogOpen = true;
  }

  // Announcements posting
  function handleAnnounceSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!announceTitle || !announceContent) return;

    try {
      const targets = announceTargetType === 'all' ? projects.map(p => p.id) : announceTargetIds;
      db.createAnnouncement(announceTargetType, targets, announceTitle, announceContent, auth.user!.name);
      
      // Notify targeting students
      const targetingProjects = projects.filter(p => targets.includes(p.id));
      targetingProjects.forEach(proj => {
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'New Announcement Posted',
              description: `Supervisor posted: "${announceTitle}"`,
              type: 'announcement',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student`
            }
          ]);
        });
      });

      toast.success('Announcement broadcasted successfully!');
      announceTitle = '';
      announceContent = '';
      announceTargetIds = [];
      loadData();
    } catch (err) {
      toast.error('Failed to post announcement');
    }
  }

  // Private Faculty Notes
  function handleSaveNote(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedNotesProjectId || !notesContent) return;
    try {
      db.saveFacultyNote(selectedNotesProjectId, selectedNotesStudentId || undefined, notesContent);
      toast.success('Private note saved.');
      notesContent = '';
      loadData();
    } catch (err) {
      toast.error('Failed to save private note');
    }
  }

  function deleteNote(id: string) {
    try {
      const allNotes = db.getFacultyNotes();
      const filtered = allNotes.filter(n => n.id !== id);
      db.saveFacultyNotes(filtered);
      toast.success('Note deleted.');
      loadData();
    } catch (err) {
      toast.error('Failed to delete note');
    }
  }

  // Derived properties for dashboards/reporting
  let pendingProjects = $derived(projects.filter(p => p.status === 'pending'));
  let activeProjects = $derived(projects.filter(p => p.status === 'active'));
  let totalStudents = $derived(activeProjects.reduce((sum, p) => sum + p.members.length, 0));
  let overdueMilestones = $derived(
    activeProjects.reduce((count, p) => {
      const today = new Date().toISOString().split('T')[0];
      const overdue = p.milestones.filter(m => !m.completed && m.deadline < today);
      return count + overdue.length;
    }, 0)
  );
  let pendingReviewCount = $derived(weeklyReports.filter(r => r.status === 'pending').length);
  let upcomingMeetings = $derived(meetings.filter(m => m.status === 'scheduled'));
  let currentNotesProject = $derived(activeProjects.find(p => p.id === selectedNotesProjectId));

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter(m => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }

  // Print/Export helpers
  function simulateExport(reportName: string) {
    toast.success(`Exporting ${reportName} as PDF (Simulated download)...`);
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8">
    
    <!-- Title / Nav Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div class="flex flex-col">
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Faculty Dashboard</h2>
        <p class="text-sm text-muted-foreground mt-1">Academic supervisor panel for real-time team mentoring, reviews, and analytics.</p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="primary" size="sm" onclick={() => scheduleDialogOpen = true}>
          <Plus class="w-4 h-4" />
          Schedule Meeting
        </Button>
        <Button variant="outline" size="sm" onclick={() => feedbackDialogOpen = true}>
          <MessageSquare class="w-4 h-4" />
          Add Feedback
        </Button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <Tabs 
      items={[
        { value: 'overview', label: 'Dashboard Overview' },
        { value: 'approvals', label: `Proposals (${pendingProjects.length})` },
        { value: 'milestones', label: 'Milestones' },
        { value: 'reviews', label: `Weekly Reviews (${pendingReviewCount})` },
        { value: 'students', label: 'Student Analytics' },
        { value: 'scheduler', label: 'Meetings' },
        { value: 'announcements', label: 'Announcements' },
        { value: 'notes', label: 'Private Notes' },
        { value: 'reports', label: 'Reports Hub' }
      ]}
      bind:active={activeTab}
    />

    <!-- Tab contents -->
    {#if activeTab === 'overview'}
      <!-- Overview stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card hoverable class="flex items-center gap-4 py-5 px-6">
          <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen class="w-6 h-6" />
          </div>
          <div>
            <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Active Projects</p>
            <p class="text-2xl font-black text-foreground mt-1">{activeProjects.length}</p>
          </div>
        </Card>

        <Card hoverable class="flex items-center gap-4 py-5 px-6">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Clock class="w-6 h-6" />
          </div>
          <div>
            <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Pending Approvals</p>
            <p class="text-2xl font-black text-foreground mt-1">{pendingProjects.length}</p>
          </div>
        </Card>

        <Card hoverable class="flex items-center gap-4 py-5 px-6">
          <div class="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <div>
            <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Overdue Milestones</p>
            <p class="text-2xl font-black text-foreground mt-1">{overdueMilestones}</p>
          </div>
        </Card>

        <Card hoverable class="flex items-center gap-4 py-5 px-6">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Users class="w-6 h-6" />
          </div>
          <div>
            <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Students Monitored</p>
            <p class="text-2xl font-black text-foreground mt-1">{totalStudents}</p>
          </div>
        </Card>
      </div>

      <!-- Live project statistics / layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        <div class="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h3 class="text-lg font-bold text-foreground mb-4">Assigned Student Teams Statistics</h3>
            
            <div class="flex flex-col gap-5">
              {#each activeProjects as p}
                <div class="p-4 border rounded-xl hover:bg-muted/10 transition-colors flex flex-col gap-3">
                  <div class="flex justify-between items-start gap-4">
                    <div>
                      <h4 class="font-extrabold text-foreground text-sm">{p.name}</h4>
                      <p class="text-3xs text-muted-foreground mt-0.5 uppercase tracking-wider font-bold">Lead: {p.ownerName} • {p.members.length} Members</p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                  
                  <div class="flex flex-col gap-1">
                    <div class="flex justify-between text-3xs font-bold text-muted-foreground">
                      <span>Milestones Completed</span>
                      <span>{calculateProgress(p)}%</span>
                    </div>
                    <div class="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border mt-1">
                      <div class="h-full bg-primary transition-all duration-500" style="width: {calculateProgress(p)}%"></div>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="py-12 border border-dashed rounded-xl flex flex-col items-center justify-center text-center text-xs text-muted-foreground/60 italic">
                  No active projects currently under supervision in {auth.user.department}.
                </div>
              {/each}
            </div>
          </Card>
        </div>

        <!-- Recent activities sidebar -->
        <Card class="flex flex-col gap-4">
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Recent Submissions Activity</h3>
          
          <div class="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1">
            {#each weeklyReports.slice().reverse() as rep}
              {@const proj = projects.find(pr => pr.id === rep.projectId)}
              {#if proj}
                <div class="p-3 border rounded-xl bg-card flex flex-col gap-1">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-foreground">Weekly Report Week {rep.weekNumber}</span>
                    <Badge variant={rep.status === 'approved' ? 'success' : rep.status === 'pending' ? 'warning' : 'danger'}>
                      {rep.status}
                    </Badge>
                  </div>
                  <p class="text-3xs text-muted-foreground truncate">Project: {proj.name}</p>
                  <p class="text-3xs text-muted-foreground">Submitted by: {rep.submittedByName}</p>
                </div>
              {/if}
            {:else}
              <div class="py-8 text-center text-xs text-muted-foreground italic">No recent submission activities found.</div>
            {/each}
          </div>
        </Card>
      </div>

    {:else if activeTab === 'approvals'}
      <!-- Project proposal review list -->
      <div class="flex flex-col gap-4 text-left">
        <h3 class="text-xl font-bold text-foreground">Project Proposals Awaiting Approval</h3>
        
        {#if pendingProjects.length === 0}
          <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center">
            <CheckSquare class="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p class="text-sm font-bold text-muted-foreground">All proposals reviewed</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-4">
            {#each pendingProjects as p}
              <div class="p-6 border border-border bg-card rounded-2xl shadow-2xs flex flex-col gap-4">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-border/40 pb-3">
                  <div class="flex-1 flex flex-col gap-1 min-w-0">
                    <div class="flex items-center gap-3">
                      <span class="font-extrabold text-foreground text-lg truncate">{p.name}</span>
                      <Badge variant="warning">{p.status}</Badge>
                    </div>
                    <span class="text-3xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Proposed By: {p.ownerName}</span>
                  </div>

                  <div class="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <button 
                      onclick={() => rejectProject(p.id)}
                      class="px-3 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                    <button 
                      onclick={() => requestRevision(p)}
                      class="px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Request Revision
                    </button>
                    <button 
                      onclick={() => approveProject(p.id)}
                      class="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Approve Proposal
                    </button>
                  </div>
                </div>

                <div class="text-sm">
                  <p class="font-bold text-foreground mb-1">Proposal Details:</p>
                  <p class="text-muted-foreground leading-relaxed bg-muted/10 p-3 rounded-xl border">{p.description}</p>
                </div>

                <div class="flex flex-col gap-2">
                  <p class="text-xs font-bold text-foreground">Team Composition:</p>
                  <div class="flex flex-wrap gap-3">
                    {#each p.members as member}
                      <div class="flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-xl border border-border/40">
                        <img src={member.avatar} alt={member.name} class="w-6 h-6 rounded-full" />
                        <span class="text-xs font-bold text-foreground">{member.name} ({member.role})</span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'milestones'}
      <!-- Milestone management tab -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        <!-- Milestone definition column -->
        <Card class="flex flex-col gap-4">
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">
            {editingMilestoneId ? 'Edit Milestone Details' : 'Create New Milestone'}
          </h3>
          
          <form onsubmit={handleMilestoneSubmit} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="mil-proj" class="text-xs font-semibold text-foreground">Select Project Team</label>
              <select 
                id="mil-proj"
                bind:value={selectedMilestoneProjectId}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
              >
                {#each activeProjects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="mil-title" class="text-xs font-semibold text-foreground">Milestone Title</label>
              <input 
                id="mil-title"
                type="text" 
                placeholder="e.g. Setup API Endpoints" 
                bind:value={milestoneTitle}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="mil-deadline" class="text-xs font-semibold text-foreground">Target Deadline</label>
              <input 
                id="mil-deadline"
                type="date" 
                bind:value={milestoneDeadline}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
              />
            </div>

            <div class="flex justify-end gap-2 mt-2">
              {#if editingMilestoneId}
                <Button type="button" variant="outline" size="sm" onclick={() => { editingMilestoneId = null; milestoneTitle = ''; milestoneDeadline = ''; }}>Cancel</Button>
              {/if}
              <Button type="submit" variant="primary" size="sm">
                {editingMilestoneId ? 'Save Changes' : 'Assign Milestone'}
              </Button>
            </div>
          </form>
        </Card>

        <!-- Assigned Milestones list column -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <div class="flex justify-between items-center border-b border-border/40 pb-2 mb-4">
              <h3 class="text-lg font-bold text-foreground">Assigned Milestones Checklist</h3>
              <select 
                bind:value={selectedMilestoneProjectId}
                class="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                aria-label="Filter milestones by project"
              >
                {#each activeProjects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            {@const activeProj = projects.find(p => p.id === selectedMilestoneProjectId)}
            {#if activeProj}
              <div class="flex flex-col gap-3">
                {#each activeProj.milestones as m}
                  <div class="p-4 border rounded-xl bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/20 transition-all">
                    <div class="flex items-center gap-3">
                      {#if m.completed}
                        <CheckCircle2 class="w-5 h-5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                      {:else}
                        <Circle class="w-5 h-5 text-muted-foreground shrink-0" />
                      {/if}
                      <div class="flex flex-col">
                        <span class="text-sm font-bold text-foreground {m.completed ? 'line-through text-muted-foreground' : ''}">
                          {m.title}
                        </span>
                        <span class="text-3xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar class="w-3.5 h-3.5" />
                          Deadline: {m.deadline} {m.extendedDeadline ? '(Extended)' : ''}
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      <button 
                        onclick={() => toggleLockMilestone(activeProj.id, m.id)}
                        class="p-2 border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title={m.locked ? 'Unlock Milestone' : 'Lock Milestone'}
                      >
                        {#if m.locked}
                          <Lock class="w-3.5 h-3.5 text-rose-500" />
                        {:else}
                          <Unlock class="w-3.5 h-3.5" />
                        {/if}
                      </button>

                      <button 
                        onclick={() => extendMilestone(activeProj.id, m.id)}
                        class="p-2 border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Extend Milestone Deadline"
                      >
                        <Clock class="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onclick={() => { editingMilestoneId = m.id; milestoneTitle = m.title; milestoneDeadline = m.deadline; }}
                        class="p-2 border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Edit Milestone"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onclick={() => deleteMilestone(activeProj.id, m.id)}
                        class="p-2 border rounded-lg hover:bg-rose-500/10 text-rose-600 cursor-pointer transition-colors"
                        title="Delete Milestone"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                {:else}
                  <div class="py-8 text-center text-xs text-muted-foreground italic">No milestones defined for this project. Use the form on the left to add one.</div>
                {/each}
              </div>
            {:else}
              <div class="py-8 text-center text-xs text-muted-foreground italic">Select or launch a project first.</div>
            {/if}
          </Card>
        </div>
      </div>

    {:else if activeTab === 'reviews'}
      <!-- Weekly progress reviews tab -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        <!-- List reports -->
        <Card class="lg:col-span-2 flex flex-col gap-4">
          <div class="border-b border-border/40 pb-2 mb-2">
            <h3 class="text-lg font-bold text-foreground">Submitted Weekly Reports</h3>
          </div>
          
          <div class="flex flex-col gap-4">
            {#each weeklyReports as rep}
              {@const proj = projects.find(p => p.id === rep.projectId)}
              {#if proj}
                <div 
                  onclick={() => reviewingReport = rep}
                  onkeydown={(e) => e.key === 'Enter' && (reviewingReport = rep)}
                  role="button"
                  tabindex="0"
                  class="p-4 border rounded-2xl hover:border-primary/20 bg-card cursor-pointer transition-all flex justify-between items-center"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-extrabold text-foreground truncate">Week {rep.weekNumber} Report - {proj.name}</span>
                    <span class="text-3xs text-muted-foreground mt-1">Submitted by {rep.submittedByName} on {new Date(rep.submittedAt).toLocaleDateString()}</span>
                  </div>
                  <Badge variant={rep.status === 'approved' ? 'success' : rep.status === 'pending' ? 'warning' : 'danger'}>
                    {rep.status}
                  </Badge>
                </div>
              {/if}
            {:else}
              <div class="py-12 text-center text-xs text-muted-foreground italic border border-dashed rounded-2xl">
                No weekly progress reports submitted yet.
              </div>
            {/each}
          </div>
        </Card>

        <!-- Review details & feedback panel -->
        <Card>
          {#if reviewingReport}
            {@const reviewingProj = projects.find(p => p.id === reviewingReport.projectId)}
            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-start border-b border-border/40 pb-2">
                <div class="flex flex-col min-w-0">
                  <span class="font-extrabold text-sm text-foreground truncate">Reviewing Week {reviewingReport.weekNumber} Report</span>
                  <span class="text-3xs text-muted-foreground mt-0.5">{reviewingProj?.name}</span>
                </div>
                <button onclick={() => reviewingReport = null} class="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Close</button>
              </div>

              <div class="flex flex-col gap-3 text-xs">
                <div class="p-3 bg-muted/10 border rounded-xl">
                  <span class="font-bold text-foreground/80 block mb-0.5">Key Achievements:</span>
                  <p class="text-muted-foreground whitespace-pre-wrap leading-relaxed">{reviewingReport.achievements}</p>
                </div>
                <div class="p-3 bg-muted/10 border rounded-xl">
                  <span class="font-bold text-foreground/80 block mb-0.5">Planned Work:</span>
                  <p class="text-muted-foreground whitespace-pre-wrap leading-relaxed">{reviewingReport.plannedTasks}</p>
                </div>
                <div class="p-3 bg-muted/10 border rounded-xl">
                  <span class="font-bold text-foreground/80 block mb-0.5">Blockers:</span>
                  <p class="text-muted-foreground whitespace-pre-wrap leading-relaxed">{reviewingReport.blockers || 'None'}</p>
                </div>
              </div>

              <div class="flex flex-col gap-2 mt-2 border-t border-border/40 pt-4">
                <label for="rev-fb" class="text-xs font-bold text-foreground">Supervisor Evaluation & Feedback</label>
                <textarea 
                  id="rev-fb"
                  placeholder="Provide guidance, note modifications, or approve weekly report details..." 
                  bind:value={reviewFeedbackText}
                  rows="3"
                  class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
                ></textarea>
                
                <div class="flex gap-2 justify-end mt-1">
                  <Button variant="danger" size="sm" onclick={() => reviewReportAction(reviewingReport!, 'revision_requested')}>
                    Request Changes
                  </Button>
                  <Button variant="primary" size="sm" onclick={() => reviewReportAction(reviewingReport!, 'approved')}>
                    Approve Report
                  </Button>
                </div>
              </div>
            </div>
          {:else}
            <div class="h-44 flex flex-col items-center justify-center text-center text-xs text-muted-foreground/60 italic">
              Select a weekly report on the left to read details and submit evaluation.
            </div>
          {/if}
        </Card>
      </div>

    {:else if activeTab === 'students'}
      <!-- Student monitoring & team analytics tab -->
      <div class="flex flex-col gap-6 text-left">
        <Card>
          <div class="flex justify-between items-center border-b border-border/40 pb-3 mb-4">
            <h3 class="text-lg font-bold text-foreground">Individual Student Progress Monitor</h3>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="border-b border-border text-muted-foreground font-black text-2xs uppercase tracking-wider">
                  <th class="py-3 px-4">Student</th>
                  <th class="py-3 px-4">Project Workspace</th>
                  <th class="py-3 px-4 text-center">Milestones Done</th>
                  <th class="py-3 px-4 text-center">Tasks Handled</th>
                  <th class="py-3 px-4 text-center">Attendance</th>
                  <th class="py-3 px-4 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {#each activeProjects as p}
                  {#each p.members as member}
                    {@const studentTasks = allTasks.filter(t => t.projectId === p.id && t.assignees.includes(member.userId))}
                    {@const completedTasks = studentTasks.filter(t => t.column === 'completed').length}
                    {@const mProg = calculateProgress(p)}
                    <tr class="border-b border-border hover:bg-muted/10 transition-colors">
                      <td class="py-3.5 px-4 flex items-center gap-3">
                        <img src={member.avatar} alt={member.name} class="w-8 h-8 rounded-full bg-muted shrink-0" />
                        <div class="flex flex-col min-w-0">
                          <span class="font-extrabold text-foreground truncate">{member.name}</span>
                          <span class="text-3xs text-muted-foreground font-semibold uppercase tracking-wider">{member.role}</span>
                        </div>
                      </td>
                      <td class="py-3.5 px-4 text-xs font-semibold text-foreground/80">{p.name}</td>
                      <td class="py-3.5 px-4 text-center text-xs font-bold text-foreground">
                        {p.milestones.filter(m => m.completed).length} / {p.milestones.length}
                      </td>
                      <td class="py-3.5 px-4 text-center text-xs font-semibold text-muted-foreground">
                        {completedTasks} <span class="text-3xs text-muted-foreground/60">completed</span> / {studentTasks.length} total
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        <Badge variant="success">95% (Mocked)</Badge>
                      </td>
                      <td class="py-3.5 px-4 text-right">
                        <span class="text-xs font-black text-foreground">{mProg}%</span>
                      </td>
                    </tr>
                  {/each}
                {:else}
                  <tr>
                    <td colspan="6" class="py-8 text-center text-xs text-muted-foreground italic">No student tracking information available.</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Card>

        <!-- Team Analytics -->
        <Card>
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-3 mb-4">Team Contribution Analytics</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {#each activeProjects as p}
              <div class="p-4 border rounded-xl bg-card flex flex-col gap-4">
                <h4 class="font-extrabold text-foreground text-sm border-b border-border/40 pb-2">{p.name} Breakdown</h4>
                
                <div class="flex flex-col gap-3">
                  {#each p.members as member}
                    {@const studentTasks = allTasks.filter(t => t.projectId === p.id && t.assignees.includes(member.userId))}
                    {@const completedTasks = studentTasks.filter(t => t.column === 'completed').length}
                    {@const totalPTasks = allTasks.filter(t => t.projectId === p.id).length}
                    {@const contribution = totalPTasks > 0 ? Math.round((studentTasks.length / totalPTasks) * 100) : 0}
                    
                    <div class="flex flex-col gap-1">
                      <div class="flex justify-between items-center text-2xs font-bold text-muted-foreground">
                        <span>{member.name}</span>
                        <span>{contribution}% Work Share</span>
                      </div>
                      <div class="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border mt-0.5">
                        <div class="h-full bg-primary" style="width: {contribution}%"></div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </Card>
      </div>

    {:else if activeTab === 'scheduler'}
      <!-- Meetings Tab -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        <!-- Scheduling Form -->
        <Card class="flex flex-col gap-4">
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">
            {editingMeeting ? 'Reschedule Review Meeting' : 'Schedule Review Meeting'}
          </h3>
          
          <form onsubmit={handleScheduleSubmit} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="sch-proj" class="text-xs font-semibold text-foreground">Target Team</label>
              <select 
                id="sch-proj"
                bind:value={scheduleProjectId}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
              >
                {#each activeProjects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="sch-title" class="text-xs font-semibold text-foreground">Review Topic / Title</label>
              <input 
                id="sch-title"
                type="text" 
                placeholder="e.g. Mid-term presentation evaluation" 
                bind:value={meetingTitle}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label for="sch-date" class="text-xs font-semibold text-foreground">Date</label>
                <input 
                  id="sch-date"
                  type="date" 
                  bind:value={meetingDate}
                  required
                  class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <label for="sch-time" class="text-xs font-semibold text-foreground">Time</label>
                <input 
                  id="sch-time"
                  type="time" 
                  bind:value={meetingTime}
                  required
                  class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="sch-loc" class="text-xs font-semibold text-foreground">Location / Online Link</label>
              <input 
                id="sch-loc"
                type="text" 
                placeholder="e.g. Seminar Room 304 or Zoom URL" 
                bind:value={meetingLocation}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
              />
            </div>

            <div class="flex justify-end gap-2 mt-2">
              {#if editingMeeting}
                <Button type="button" variant="outline" size="sm" onclick={() => { editingMeeting = null; meetingTitle = ''; meetingDate = ''; meetingTime = ''; meetingLocation = ''; }}>Cancel</Button>
              {/if}
              <Button type="submit" variant="primary" size="sm">
                {editingMeeting ? 'Save Meeting' : 'Schedule Meeting'}
              </Button>
            </div>
          </form>
        </Card>

        <!-- Scheduled Meetings list -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2 mb-4">Scheduled Mentor Reviews</h3>
            
            <div class="flex flex-col gap-3">
              {#each upcomingMeetings as meet}
                <div class="p-4 border rounded-xl bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/20 transition-all">
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-bold text-foreground truncate">{meet.title}</span>
                      <Badge variant="success">Scheduled</Badge>
                    </div>
                    <span class="text-3xs text-muted-foreground font-semibold mt-1">Project: {meet.projectName}</span>
                    <span class="text-3xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Calendar class="w-3.5 h-3.5" />
                      {meet.date} at {meet.time}
                    </span>
                    <span class="text-3xs text-primary font-bold truncate mt-0.5">Link/Location: {meet.linkOrLocation}</span>
                  </div>

                  <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button 
                      onclick={() => editMeeting(meet)}
                      class="px-2.5 py-1.5 border rounded-lg hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      Reschedule
                    </button>
                    <button 
                      onclick={() => cancelMeeting(meet)}
                      class="px-2.5 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel Meeting
                    </button>
                  </div>
                </div>
              {:else}
                <div class="py-8 text-center text-xs text-muted-foreground italic">No review meetings scheduled yet. Use the scheduler on the left to set one.</div>
              {/each}
            </div>
          </Card>
        </div>
      </div>

    {:else if activeTab === 'announcements'}
      <!-- Announcements posting and history -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        <!-- New Announcement Form -->
        <Card class="flex flex-col gap-4">
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Publish Announcement</h3>
          
          <form onsubmit={handleAnnounceSubmit} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-foreground">Target Audience</span>
              <div class="flex items-center gap-4 mt-1">
                <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
                  <input type="radio" value="all" bind:group={announceTargetType} class="cursor-pointer" />
                  All Assigned Students
                </label>
                <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
                  <input type="radio" value="team" bind:group={announceTargetType} class="cursor-pointer" />
                  Specific Project Teams
                </label>
              </div>
            </div>

            {#if announceTargetType === 'team'}
              <div class="flex flex-col gap-1.5 p-3 border rounded-xl bg-muted/10">
                <span class="text-xs font-bold text-foreground mb-1 block">Select Teams:</span>
                {#each activeProjects as p}
                  <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground py-0.5 cursor-pointer">
                    <input type="checkbox" value={p.id} bind:group={announceTargetIds} class="cursor-pointer" />
                    {p.name}
                  </label>
                {/each}
              </div>
            {/if}

            <div class="flex flex-col gap-1.5">
              <label for="ann-title" class="text-xs font-semibold text-foreground">Announcement Title</label>
              <input 
                id="ann-title"
                type="text" 
                placeholder="e.g. Mid-term source code submission notice" 
                bind:value={announceTitle}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="ann-content" class="text-xs font-semibold text-foreground">Notice Content</label>
              <textarea 
                id="ann-content"
                placeholder="Write announcement details..." 
                bind:value={announceContent}
                required
                rows="4"
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
              ></textarea>
            </div>

            <div class="flex justify-end gap-2 mt-2">
              <Button type="submit" variant="primary" size="sm">Broadcast Announcement</Button>
            </div>
          </form>
        </Card>

        <!-- Broadcasted Announcements list -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2 mb-4">Published Announcements History</h3>
            
            <div class="flex flex-col gap-3">
              {#each announcements as ann}
                <div class="p-4 border rounded-xl bg-card flex flex-col gap-2">
                  <div class="flex justify-between items-start">
                    <span class="text-sm font-bold text-foreground">{ann.title}</span>
                    <Badge variant={ann.targetType === 'all' ? 'primary' : 'info'}>
                      {ann.targetType === 'all' ? 'All Assigned' : 'Specific Teams'}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                  
                  <div class="flex justify-between items-center text-3xs text-muted-foreground mt-2 border-t border-border/40 pt-2 font-semibold">
                    <span>Published by: {ann.facultyName}</span>
                    <span>{new Date(ann.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              {:else}
                <div class="py-8 text-center text-xs text-muted-foreground italic">No broadcast announcements published yet.</div>
              {/each}
            </div>
          </Card>
        </div>
      </div>

    {:else if activeTab === 'notes'}
      <!-- Faculty Private Notes -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start text-left">
        <!-- New Note Form -->
        <Card class="flex flex-col gap-4">
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Record Private Note</h3>
          
          <form onsubmit={handleSaveNote} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="note-proj" class="text-xs font-semibold text-foreground">Assigned Project</label>
              <select 
                id="note-proj"
                bind:value={selectedNotesProjectId}
                required
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
              >
                {#each activeProjects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="note-stud" class="text-xs font-semibold text-foreground">Target Student (Optional)</label>
              <select 
                id="note-stud"
                bind:value={selectedNotesStudentId}
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
              >
                <option value="">Entire Team Workspace</option>
                {#if currentNotesProject}
                  {#each currentNotesProject.members as member}
                    <option value={member.userId}>{member.name}</option>
                  {/each}
                {/if}
              </select>
            </div>


            <div class="flex flex-col gap-1.5">
              <label for="note-cont" class="text-xs font-semibold text-foreground">Private Notes Content</label>
              <textarea 
                id="note-cont"
                placeholder="Only visible to you. Document evaluation, performance notes, or feedback references..." 
                bind:value={notesContent}
                required
                rows="5"
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
              ></textarea>
            </div>

            <div class="flex justify-end gap-2 mt-2">
              <Button type="submit" variant="primary" size="sm">Save Note</Button>
            </div>
          </form>
        </Card>

        <!-- Saved Notes list -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2 mb-4">Your Private Evaluation Notes</h3>
            
            <div class="flex flex-col gap-3">
              {#each facultyNotes as note}
                {@const proj = projects.find(p => p.id === note.projectId)}
                {#if proj}
                  {@const targetStud = note.studentId ? proj.members.find(m => m.userId === note.studentId) : null}
                  <div class="p-4 border rounded-xl bg-card flex flex-col gap-2 relative group hover:border-primary/20 transition-all">
                    <button 
                      onclick={() => deleteNote(note.id)}
                      class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 bg-rose-500/10 text-rose-600 rounded-lg transition-opacity cursor-pointer"
                      title="Delete Note"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>

                    <div class="flex flex-col text-left">
                      <span class="text-xs font-bold text-foreground truncate">{proj.name}</span>
                      {#if targetStud}
                        <span class="text-3xs text-muted-foreground mt-0.5">Target: {targetStud.name} ({targetStud.role})</span>
                      {:else}
                        <span class="text-3xs text-muted-foreground mt-0.5">Target: General Team Workspace</span>
                      {/if}
                    </div>

                    <p class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mt-1 bg-muted/10 p-3 rounded-xl border">{note.content}</p>
                    
                    <span class="text-[10px] text-muted-foreground mt-1 font-semibold">Last updated: {new Date(note.updatedAt).toLocaleString()}</span>
                  </div>
                {/if}
              {:else}
                <div class="py-8 text-center text-xs text-muted-foreground italic">No evaluation notes stored yet. Use the form on the left to write one.</div>
              {/each}
            </div>
          </Card>
        </div>
      </div>

    {:else if activeTab === 'reports'}
      <!-- Reports Generation Hub -->
      <div class="flex flex-col gap-6 text-left">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Progress Report Card -->
          <Card class="flex flex-col justify-between h-48">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <BarChart3 class="w-6 h-6" />
              </div>
              <div class="flex flex-col min-w-0">
                <h4 class="font-extrabold text-foreground text-sm">Teams Progress Report</h4>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">Aggregated progress status showing milestones completed, task distributions, and submission health.</p>
              </div>
            </div>
            <div class="flex justify-end mt-4">
              <Button variant="outline" size="sm" onclick={() => simulateExport('Teams Progress Report')}>
                <FileDown class="w-4 h-4" />
                Export Progress CSV
              </Button>
            </div>
          </Card>

          <!-- Milestone Report Card -->
          <Card class="flex flex-col justify-between h-48">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <CheckSquare class="w-6 h-6" />
              </div>
              <div class="flex flex-col min-w-0">
                <h4 class="font-extrabold text-foreground text-sm">Milestone Clearing Report</h4>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">List of all active, completed, locked, and overdue milestones across all supervised projects.</p>
              </div>
            </div>
            <div class="flex justify-end mt-4">
              <Button variant="outline" size="sm" onclick={() => simulateExport('Milestone Clearing Report')}>
                <FileDown class="w-4 h-4" />
                Export Milestone CSV
              </Button>
            </div>
          </Card>

          <!-- Student Evaluation Report Card -->
          <Card class="flex flex-col justify-between h-48">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <Award class="w-6 h-6" />
              </div>
              <div class="flex flex-col min-w-0">
                <h4 class="font-extrabold text-foreground text-sm">Student Performance Evaluation</h4>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">Performance analytics for grading students based on task share, weekly review feedback, and meeting attendance.</p>
              </div>
            </div>
            <div class="flex justify-end mt-4">
              <Button variant="outline" size="sm" onclick={() => simulateExport('Student Performance Evaluation')}>
                <FileDown class="w-4 h-4" />
                Export Evaluation CSV
              </Button>
            </div>
          </Card>

          <!-- Project Status Card -->
          <Card class="flex flex-col justify-between h-48">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <FileText class="w-6 h-6" />
              </div>
              <div class="flex flex-col min-w-0">
                <h4 class="font-extrabold text-foreground text-sm">Project Lifecycle Status Report</h4>
                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">General project workspace registry showing timelines, supervisor remarks, and final qualification states.</p>
              </div>
            </div>
            <div class="flex justify-end mt-4">
              <Button variant="outline" size="sm" onclick={() => simulateExport('Project Lifecycle Status Report')}>
                <FileDown class="w-4 h-4" />
                Export Status CSV
              </Button>
            </div>
          </Card>

        </div>
      </div>
    {/if}

  </div>
{/if}

<!-- Dialog Modals -->

<!-- Meeting Scheduler Dialog -->
<Dialog bind:open={scheduleDialogOpen} title={editingMeeting ? "Reschedule Review Meeting" : "Schedule Project Review Meeting"}>
  <form onsubmit={handleScheduleSubmit} class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="dlg-sch-proj" class="text-xs font-semibold text-foreground">Target Team</label>
      <select 
        id="dlg-sch-proj"
        bind:value={scheduleProjectId}
        required
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
      >
        {#each activeProjects as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="dlg-sch-title" class="text-xs font-semibold text-foreground">Review Topic / Title</label>
      <input 
        id="dlg-sch-title"
        type="text" 
        placeholder="e.g. Mid-term presentation evaluation" 
        bind:value={meetingTitle}
        required
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="dlg-sch-date" class="text-xs font-semibold text-foreground">Date</label>
        <input 
          id="dlg-sch-date"
          type="date" 
          bind:value={meetingDate}
          required
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="dlg-sch-time" class="text-xs font-semibold text-foreground">Time</label>
        <input 
          id="dlg-sch-time"
          type="time" 
          bind:value={meetingTime}
          required
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="dlg-sch-loc" class="text-xs font-semibold text-foreground">Location / Online Link</label>
      <input 
        id="dlg-sch-loc"
        type="text" 
        placeholder="e.g. Seminar Room 304 or Zoom URL" 
        bind:value={meetingLocation}
        required
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
      />
    </div>

    <div class="flex justify-end gap-2 mt-2">
      <Button type="button" variant="outline" onclick={() => scheduleDialogOpen = false}>Cancel</Button>
      <Button type="submit" variant="primary">
        {editingMeeting ? "Reschedule" : "Schedule"}
      </Button>
    </div>
  </form>
</Dialog>

<!-- Categorized Feedback Dialog -->
<Dialog bind:open={feedbackDialogOpen} title="Add Categorized Faculty Feedback">
  <form onsubmit={handleFeedbackSubmit} class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="dlg-fb-proj" class="text-xs font-semibold text-foreground">Target Team</label>
      <select 
        id="dlg-fb-proj"
        bind:value={feedbackProjectId}
        required
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
      >
        {#each activeProjects as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="dlg-fb-cat" class="text-xs font-semibold text-foreground">Category</label>
      <select 
        id="dlg-fb-cat"
        bind:value={feedbackCategory}
        required
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
      >
        <option value="code">Code Quality & Architecture</option>
        <option value="documentation">Documentation & Specifications</option>
        <option value="ui">UI/UX & Responsiveness</option>
        <option value="testing">Testing, Coverage & Deployment</option>
        <option value="presentation">Presentation & Communication</option>
      </select>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="dlg-fb-text" class="text-xs font-semibold text-foreground">Feedback Comments</label>
      <textarea 
        id="dlg-fb-text"
        placeholder="Provide constructive review comments for this category..." 
        bind:value={feedbackText}
        required
        rows="4"
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
      ></textarea>
    </div>

    <div class="flex justify-end gap-2 mt-2">
      <Button type="button" variant="outline" onclick={() => feedbackDialogOpen = false}>Cancel</Button>
      <Button type="submit" variant="primary">Submit Feedback</Button>
    </div>
  </form>
</Dialog>

<!-- Request Revision Comment Dialog -->
<Dialog bind:open={proposalCommentDialogOpen} title="Request Revision on Project Proposal">
  <form onsubmit={submitRevisionRequest} class="flex flex-col gap-4">
    <div class="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex gap-2 text-xs">
      <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
      <span>Detail what changes or clarifications the students need to make before the proposal can be approved.</span>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="dlg-rev-text" class="text-xs font-semibold text-foreground">Supervisor Remarks / Clarifications</label>
      <textarea 
        id="dlg-rev-text"
        placeholder="e.g. Please refine tech stack or specify team member responsibilities..." 
        bind:value={proposalCommentText}
        required
        rows="4"
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
      ></textarea>
    </div>

    <div class="flex justify-end gap-2 mt-2">
      <Button type="button" variant="outline" onclick={() => { proposalCommentDialogOpen = false; selectedProposalForComment = null; }}>Cancel</Button>
      <Button type="submit" variant="primary">Send Request</Button>
    </div>
  </form>
</Dialog>
