<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Meeting, type CategorizedFeedback } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Plus, Calendar, Clock, MessageSquare } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let projects = $state<Project[]>([]);
  let meetings = $state<Meeting[]>([]);

  // Meeting scheduler states
  let scheduleProjectId = $state('');
  let meetingTitle = $state('');
  let meetingDate = $state('');
  let meetingTime = $state('');
  let meetingLocation = $state('');
  let editingMeeting = $state<Meeting | null>(null);
  let scheduleDialogOpen = $state(false);

  // Feedback states
  let feedbackProjectId = $state('');
  let feedbackCategory = $state<'code' | 'documentation' | 'ui' | 'testing' | 'presentation'>('code');
  let feedbackText = $state('');
  let feedbackDialogOpen = $state(false);

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      meetings = db.getMeetings();

      const activeP = projects.filter(p => p.status === 'active');
      if (activeP.length > 0) {
        if (!scheduleProjectId) scheduleProjectId = activeP[0].id;
        if (!feedbackProjectId) feedbackProjectId = activeP[0].id;
      }
    }
  }

  let activeProjects = $derived(projects.filter(p => p.status === 'active'));
  let upcomingMeetings = $derived(meetings.filter(m => m.status === 'scheduled'));

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

  function handleFeedbackSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!feedbackProjectId || !feedbackText) return;
    const proj = projects.find(p => p.id === feedbackProjectId);
    if (!proj) return;

    try {
      const fb = db.addFeedback(feedbackProjectId, feedbackCategory, feedbackText, auth.user!.name);
      db.logAudit(auth.user!.id, auth.user!.name, `Added ${feedbackCategory} feedback`, 'feedback', fb.id, proj.name);

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
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div class="flex flex-col">
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Review Scheduler & Feedback</h2>
        <p class="text-sm text-muted-foreground mt-1">Schedule mentor reviews or record categorized quality feedback.</p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="primary" size="sm" onclick={() => { editingMeeting = null; scheduleDialogOpen = true; }}>
          <Plus class="w-4 h-4" />
          Schedule Meeting
        </Button>
        <Button variant="outline" size="sm" onclick={() => feedbackDialogOpen = true}>
          <MessageSquare class="w-4 h-4" />
          Submit Feedback
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
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
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
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
                class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="sch-time" class="text-xs font-semibold text-foreground">Time</label>
              <input 
                id="sch-time"
                type="time" 
                bind:value={meetingTime}
                required
                class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
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
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
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
              <div class="p-4 border rounded-md bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/20 transition-all">
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
                    class="px-2.5 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/100 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
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
  </div>
{/if}

<!-- Dialog Modals -->

<!-- Meeting Scheduler Dialog Overlay -->
<Dialog bind:open={scheduleDialogOpen} title={editingMeeting ? "Reschedule Review Meeting" : "Schedule Project Review Meeting"}>
  <form onsubmit={handleScheduleSubmit} class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="dlg-sch-proj" class="text-xs font-semibold text-foreground">Target Team</label>
      <select 
        id="dlg-sch-proj"
        bind:value={scheduleProjectId}
        required
        class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
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
        class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
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
          class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="dlg-sch-time" class="text-xs font-semibold text-foreground">Time</label>
        <input 
          id="dlg-sch-time"
          type="time" 
          bind:value={meetingTime}
          required
          class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
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
        class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
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

<!-- Categorized Feedback Dialog Overlay -->
<Dialog bind:open={feedbackDialogOpen} title="Add Categorized Faculty Feedback">
  <form onsubmit={handleFeedbackSubmit} class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="dlg-fb-proj" class="text-xs font-semibold text-foreground">Target Team</label>
      <select 
        id="dlg-fb-proj"
        bind:value={feedbackProjectId}
        required
        class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
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
        class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
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
        class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
      ></textarea>
    </div>

    <div class="flex justify-end gap-2 mt-2">
      <Button type="button" variant="outline" onclick={() => feedbackDialogOpen = false}>Cancel</Button>
      <Button type="submit" variant="primary">Submit Feedback</Button>
    </div>
  </form>
</Dialog>
