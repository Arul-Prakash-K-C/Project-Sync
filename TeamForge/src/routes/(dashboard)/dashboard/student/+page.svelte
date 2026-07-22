<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Task, type Announcement, type Meeting } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Plus, FolderKanban, CheckSquare, Clock, ArrowRight, UserPlus, Check, X, ShieldAlert, Bell, Calendar } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let projects = $state<Project[]>([]);
  let invitations = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let announcements = $state<Announcement[]>([]);
  let meetings = $state<Meeting[]>([]);
  let createDialogOpen = $state(false);

  // Form states
  let newProjectName = $state('');
  let newProjectDesc = $state('');
  let newProjectDept = $state('');

  const departments = db.getDepartments();

  onMount(() => {
    loadData();
    if (departments.length > 0) {
      newProjectDept = departments[0].name;
    }
  });

  function loadData() {
    if (auth.user) {
      // Load student projects
      projects = db.getProjects().filter(p => p.members.some(m => m.userId === auth.user!.id));
      // Load invites
      invitations = db.getProjects().filter(p => p.pendingInvites.includes(auth.user!.id));
      // Load tasks
      allTasks = db.getTasks().filter(t => t.assignees.includes(auth.user!.id));
      
      // Load announcements for any project the student is part of
      const studentProjectIds = projects.map(p => p.id);
      announcements = db.getAnnouncements().filter(a => a.targetType === 'all' || a.targetIds.some(id => studentProjectIds.includes(id)));
      
      // Load scheduled meetings for student's projects
      meetings = db.getMeetings().filter(m => studentProjectIds.includes(m.projectId) && m.status === 'scheduled');
    }
  }

  function handleCreateProject(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;
    try {
      const newP = db.createProject(newProjectName, newProjectDesc, newProjectDept, auth.user);
      toast.success(`Project "${newP.name}" created. Pending faculty approval.`);
      createDialogOpen = false;
      newProjectName = '';
      newProjectDesc = '';
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  }

  function acceptInvitation(projId: string) {
    if (!auth.user) return;
    db.acceptInvite(projId, auth.user.id);
    toast.success('Invitation accepted!');
    loadData();
  }

  function declineInvitation(projId: string) {
    if (!auth.user) return;
    db.declineInvite(projId, auth.user.id);
    toast.success('Invitation declined');
    loadData();
  }

  // Derived stats
  const activeCount = $derived(projects.filter(p => p.status === 'active').length);
  const pendingCount = $derived(projects.filter(p => p.status === 'pending').length);
  const completedTaskCount = $derived(allTasks.filter(t => t.column === 'completed').length);
  const totalTaskCount = $derived(allTasks.length);
</script>

{#if auth.user}
  <div class="flex flex-col gap-8">
    <!-- Greeting & Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Welcome back, {auth.user.name}!</h2>
        <p class="text-sm text-muted-foreground mt-1">Here is a summary of your academic teams and tasks.</p>
      </div>

      <Button variant="primary" onclick={() => createDialogOpen = true}>
        <Plus class="w-4 h-4" />
        Create Project
      </Button>
    </div>

    <!-- Alert Panel for Invitations -->
    {#if invitations.length > 0}
      <div class="p-4 border border-primary/20 bg-primary/5 rounded-2xl flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <UserPlus class="w-5 h-5 text-primary" />
          <h4 class="text-sm font-bold text-foreground">Pending Project Invitations</h4>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each invitations as inv}
            <div class="flex items-center justify-between p-4 bg-card border rounded-xl shadow-xs">
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-bold text-foreground truncate">{inv.name}</span>
                <span class="text-xs text-muted-foreground">Invited by: {inv.ownerName}</span>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  onclick={() => acceptInvitation(inv.id)}
                  class="p-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Accept Invite"
                >
                  <Check class="w-4 h-4" />
                </button>
                <button 
                  onclick={() => declineInvitation(inv.id)}
                  class="p-2 bg-rose-500/10 text-rose-600 hover:bg-rose-50 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Decline Invite"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <FolderKanban class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Active Projects</p>
          <p class="text-2xl font-black text-foreground mt-1">{activeCount}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
          <Clock class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Pending Approvals</p>
          <p class="text-2xl font-black text-foreground mt-1">{pendingCount}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <CheckSquare class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">My Tasks Progress</p>
          <p class="text-2xl font-black text-foreground mt-1">
            {completedTaskCount} <span class="text-sm font-semibold text-muted-foreground">/ {totalTaskCount} done</span>
          </p>
        </div>
      </Card>
    </div>

    <!-- Announcements & Meetings Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Announcements Panel -->
      <Card class="flex flex-col gap-4">
        <div class="flex items-center gap-2 border-b border-border/40 pb-2">
          <Bell class="w-5 h-5 text-primary" />
          <h3 class="text-lg font-bold text-foreground">Announcements</h3>
        </div>
        <div class="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
          {#each announcements as ann}
            <div class="p-4 border border-border/80 rounded-xl bg-muted/5 flex flex-col gap-1.5">
              <div class="flex justify-between items-start gap-4">
                <span class="text-sm font-bold text-foreground">{ann.title}</span>
                <Badge variant="info" class="text-3xs">Announcement</Badge>
              </div>
              <p class="text-xs text-muted-foreground leading-relaxed">{ann.content}</p>
              <div class="flex justify-between items-center text-3xs text-muted-foreground mt-1 font-semibold">
                <span>By: {ann.facultyName}</span>
                <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          {:else}
            <div class="py-8 text-center text-xs text-muted-foreground italic">No active announcements.</div>
          {/each}
        </div>
      </Card>

      <!-- Meetings Panel -->
      <Card class="flex flex-col gap-4">
        <div class="flex items-center gap-2 border-b border-border/40 pb-2">
          <Calendar class="w-5 h-5 text-emerald-500" />
          <h3 class="text-lg font-bold text-foreground">Upcoming Project Reviews</h3>
        </div>
        <div class="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
          {#each meetings as meet}
            <div class="p-4 border border-emerald-500/10 rounded-xl bg-emerald-500/5 flex flex-col gap-2">
              <div class="flex justify-between items-start gap-4">
                <span class="text-sm font-bold text-foreground">{meet.title}</span>
                <Badge variant="success" class="text-3xs">Scheduled</Badge>
              </div>
              <div class="flex flex-col gap-1 text-xs text-muted-foreground">
                <span class="font-bold text-foreground/80">Project: {meet.projectName}</span>
                <span class="flex items-center gap-1.5 mt-0.5">
                  <Clock class="w-3.5 h-3.5" />
                  {meet.date} at {meet.time}
                </span>
                <span class="truncate mt-0.5 font-semibold text-primary">
                  Location/Link: {meet.linkOrLocation}
                </span>
              </div>
            </div>
          {:else}
            <div class="py-8 text-center text-xs text-muted-foreground italic">No review meetings scheduled.</div>
          {/each}
        </div>
      </Card>
    </div>

    <!-- Active Projects List -->
    <div class="flex flex-col gap-4">
      <h3 class="text-xl font-bold text-foreground">My Teams & Projects</h3>

      {#if projects.length === 0}
        <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center">
          <FolderKanban class="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-muted-foreground">No active academic projects</p>
          <p class="text-xs text-muted-foreground/60 max-w-xs mt-1">Create a new project or seek invitations from classmates to get started.</p>
          <Button variant="outline" size="sm" class="mt-4" onclick={() => createDialogOpen = true}>
            Create Project
          </Button>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each projects as p}
            <Card hoverable class="flex flex-col justify-between h-56">
              <div>
                <div class="flex justify-between items-start gap-4">
                  <h4 class="text-lg font-bold text-foreground truncate">{p.name}</h4>
                  <Badge variant={p.status === 'active' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}>
                    {p.status}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">{p.description}</p>
              </div>

              <div class="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <!-- Team Avatars -->
                <div class="flex -space-x-2">
                  {#each p.members.slice(0, 4) as member}
                    <img 
                      src={member.avatar} 
                      alt={member.name} 
                      title={`${member.name} (${member.role})`}
                      class="w-8 h-8 rounded-full border-2 border-card bg-muted"
                    />
                  {/each}
                  {#if p.members.length > 4}
                    <div class="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-3xs font-bold text-muted-foreground">
                      +{p.members.length - 4}
                    </div>
                  {/if}
                </div>

                <a href="/dashboard/student/project/{p.id}">
                  <Button variant="outline" size="sm">
                    Enter Workspace
                    <ArrowRight class="w-4 h-4" />
                  </Button>
                </a>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Create Project Dialog -->
  <Dialog bind:open={createDialogOpen} title="Launch Academic Project">
    <form onsubmit={handleCreateProject} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="p-name" class="text-xs font-semibold text-foreground">Project Name</label>
        <input 
          id="p-name"
          type="text" 
          placeholder="e.g. Decentralized Study Hub" 
          bind:value={newProjectName} 
          required
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="p-desc" class="text-xs font-semibold text-foreground">Project Description</label>
        <textarea 
          id="p-desc"
          placeholder="What is this project about? Highlight core deliverables..." 
          bind:value={newProjectDesc} 
          required
          rows="4"
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
        ></textarea>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="p-dept" class="text-xs font-semibold text-foreground">Target Department</label>
        <select
          id="p-dept"
          bind:value={newProjectDept}
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        >
          {#each departments as d}
            <option value={d.name}>{d.name}</option>
          {/each}
        </select>
      </div>

      <!-- Warning note about approvals -->
      <div class="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex gap-2.5 text-xs">
        <ShieldAlert class="w-4 h-4 shrink-0 mt-0.5" />
        <span>New projects must be approved by faculty members before matching teams and tasks can be managed.</span>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => createDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Submit Proposal</Button>
      </div>
    </form>
  </Dialog>
{/if}
