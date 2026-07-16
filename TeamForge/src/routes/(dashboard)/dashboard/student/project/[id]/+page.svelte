<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Task, type Thread, type ProjectFile, type Milestone } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    FolderKanban, 
    ChevronRight,
    UserPlus, 
    Plus, 
    CheckCircle2, 
    Circle,
    Calendar,
    FileText,
    Send,
    MessageSquare,
    MessageCircle,
    FolderPlus
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';

  const projectId = $derived($page.params.id);
  
  let project = $derived(db.getProjects().find(p => p.id === projectId));
  let tasks = $state<Task[]>([]);
  let threads = $state<Thread[]>([]);
  let files = $state<ProjectFile[]>([]);

  let activeTab = $state('overview');

  let inviteDialogOpen = $state(false);
  let inviteEmail = $state('');
  
  let taskDialogOpen = $state(false);
  let selectedTask = $state<Task | null>(null);
  let newTaskDialogOpen = $state(false);

  let taskTitle = $state('');
  let taskDesc = $state('');
  let taskPriority = $state<'low' | 'medium' | 'high'>('medium');
  let taskDeadline = $state('');
  let taskAssignee = $state('');

  let commentText = $state('');

  let showMilestoneForm = $state(false);
  let milestoneTitle = $state('');
  let milestoneDeadline = $state('');

  let showThreadForm = $state(false);
  let threadTitle = $state('');
  let threadContent = $state('');
  let selectedThread = $state<Thread | null>(null);
  let replyText = $state('');

  let fileDialogOpen = $state(false);
  let uploadFileName = $state('');
  let uploadFileSize = $state('1.5 MB');
  let uploadFileType = $state('pdf');

  onMount(() => {
    loadData();
  });

  $effect(() => {
    if (projectId) {
      loadData();
    }
  });

  function loadData() {
    if (projectId) {
      tasks = db.getTasks().filter(t => t.projectId === projectId);
      threads = db.getThreads().filter(t => t.projectId === projectId);
      files = db.getFiles().filter(f => f.projectId === projectId);
    }
  }

  function toggleMilestone(mId: string) {
    if (!project) return;
    const updated = project.milestones.map(m => m.id === mId ? { ...m, completed: !m.completed } : m);
    db.updateProject(project.id, { milestones: updated });
    toast.success('Milestone updated');
  }

  function addMilestone(e: SubmitEvent) {
    e.preventDefault();
    if (!project || !milestoneTitle) return;
    const newM: Milestone = {
      id: `m_${Date.now()}`,
      title: milestoneTitle,
      deadline: milestoneDeadline || new Date().toISOString().split('T')[0],
      completed: false
    };
    db.updateProject(project.id, { milestones: [...project.milestones, newM] });
    toast.success('Milestone added!');
    milestoneTitle = '';
    milestoneDeadline = '';
    showMilestoneForm = false;
  }

  function handleInvite(e: SubmitEvent) {
    e.preventDefault();
    if (!project) return;
    try {
      db.inviteToProject(project.id, inviteEmail);
      toast.success('Teammate invited successfully!');
      inviteDialogOpen = false;
      inviteEmail = '';
    } catch (err: any) {
      toast.error(err.message || 'Invitation failed');
    }
  }

  function handleCreateTask(e: SubmitEvent) {
    e.preventDefault();
    if (!project) return;
    try {
      const assignees = taskAssignee ? [taskAssignee] : [];
      db.createTask(project.id, taskTitle, taskDesc, taskPriority, taskDeadline || new Date().toISOString().split('T')[0], assignees);
      toast.success('Task created successfully');
      newTaskDialogOpen = false;
      taskTitle = '';
      taskDesc = '';
      taskPriority = 'medium';
      taskDeadline = '';
      taskAssignee = '';
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    }
  }

  function updateTaskColumn(taskId: string, col: Task['column']) {
    try {
      db.updateTask(taskId, { column: col });
      loadData();
      if (selectedTask && selectedTask.id === taskId) {
        selectedTask.column = col;
      }
    } catch (err) {
      toast.error('Failed to move task');
    }
  }

  function viewTaskDetails(t: Task) {
    selectedTask = t;
    taskDialogOpen = true;
  }

  function postComment(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedTask || !commentText || !auth.user) return;
    try {
      const comment = db.addComment(selectedTask.id, auth.user, commentText);
      selectedTask.comments = [...selectedTask.comments, comment];
      commentText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to submit comment');
    }
  }

  function handleCreateThread(e: SubmitEvent) {
    e.preventDefault();
    if (!project || !auth.user) return;
    try {
      db.createThread(project.id, threadTitle, threadContent, auth.user);
      toast.success('Thread posted successfully!');
      threadTitle = '';
      threadContent = '';
      showThreadForm = false;
      loadData();
    } catch (err) {
      toast.error('Failed to post thread');
    }
  }

  function handleCreateReply(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedThread || !replyText || !auth.user) return;
    try {
      const reply = db.addReply(selectedThread.id, replyText, auth.user);
      selectedThread.replies = [...selectedThread.replies, reply];
      replyText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to reply');
    }
  }

  function handleUploadFile(e: SubmitEvent) {
    e.preventDefault();
    if (!project || !auth.user) return;
    try {
      db.uploadFile(project.id, uploadFileName, uploadFileSize, uploadFileType, auth.user);
      toast.success(`Mock file "${uploadFileName}" uploaded successfully`);
      uploadFileName = '';
      fileDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to upload file');
    }
  }
</script>

{#if !project}
  <div class="h-96 flex flex-col items-center justify-center text-center">
    <FolderKanban class="w-12 h-12 text-muted-foreground/30 mb-3" />
    <p class="text-sm font-bold text-muted-foreground">Project not found</p>
  </div>
{:else}
  <div class="flex flex-col gap-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div class="flex flex-col">
        <div class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <a href="/dashboard/student" class="hover:text-primary transition-colors">Student Dashboard</a>
          <ChevronRight class="w-3 h-3" />
          <span>Project Workspace</span>
        </div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground mt-1 truncate max-w-2xl">{project.name}</h2>
      </div>

      <div class="flex items-center gap-3">
        <Button variant="outline" size="sm" onclick={() => inviteDialogOpen = true}>
          <UserPlus class="w-4 h-4" />
          Invite Teammates
        </Button>
      </div>
    </div>

    <Tabs 
      items={[
        { value: 'overview', label: 'Overview & Milestones' },
        { value: 'kanban', label: 'Kanban Tasks' },
        { value: 'discussions', label: 'Discussion Board' },
        { value: 'files', label: 'File Manager' }
      ]}
      bind:active={activeTab}
    />

    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div class="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h3 class="text-lg font-bold text-foreground mb-3">Project Overview</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
          </Card>

          <Card class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-foreground">Project Milestones</h3>
              <Button variant="outline" size="sm" onclick={() => showMilestoneForm = !showMilestoneForm}>
                <Plus class="w-3.5 h-3.5" />
                Add Milestone
              </Button>
            </div>

            {#if showMilestoneForm}
              <form onsubmit={addMilestone} class="p-4 border rounded-xl flex flex-col md:flex-row gap-3 bg-muted/10 items-end">
                <div class="flex-1 flex flex-col gap-1.5">
                  <label for="m-title" class="text-xs font-semibold text-foreground">Milestone Title</label>
                  <input 
                    id="m-title"
                    type="text" 
                    placeholder="e.g. Setup API Routing" 
                    bind:value={milestoneTitle}
                    required
                    class="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label for="m-date" class="text-xs font-semibold text-foreground">Deadline</label>
                  <input 
                    id="m-date"
                    type="date" 
                    bind:value={milestoneDeadline}
                    class="px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none"
                  />
                </div>
                <Button type="submit" variant="primary" size="sm" class="shrink-0">Create</Button>
              </form>
            {/if}

            <div class="flex flex-col gap-2 mt-2">
              {#each project.milestones as m}
                <div class="flex items-center justify-between p-3 border border-border/80 rounded-xl hover:bg-muted/10 transition-colors">
                  <div class="flex items-center gap-3">
                    <button onclick={() => toggleMilestone(m.id)} class="text-muted-foreground hover:text-primary cursor-pointer transition-colors" aria-label="Toggle completed">
                      {#if m.completed}
                        <CheckCircle2 class="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                      {:else}
                        <Circle class="w-5 h-5" />
                      {/if}
                    </button>
                    <span class="text-sm font-semibold text-foreground {m.completed ? 'line-through text-muted-foreground' : ''}">
                      {m.title}
                    </span>
                  </div>
                  <span class="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Calendar class="w-3.5 h-3.5" />
                    {m.deadline}
                  </span>
                </div>
              {:else}
                <div class="py-6 text-center text-xs text-muted-foreground italic">No milestones defined yet.</div>
              {/each}
            </div>
          </Card>
        </div>

        <Card class="flex flex-col gap-4">
          <h3 class="text-lg font-bold text-foreground">Team Members</h3>
          <div class="flex flex-col gap-3 mt-2">
            {#each project.members as member}
              <div class="flex items-center gap-3">
                <img src={member.avatar} alt={member.name} class="w-9 h-9 rounded-xl bg-muted" />
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-bold text-foreground truncate">{member.name}</span>
                  <span class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{member.role}</span>
                </div>
              </div>
            {/each}
          </div>
        </Card>
      </div>

    {:else}
      {#if activeTab === 'kanban'}
        <div class="flex flex-col gap-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-foreground">Kanban Tasks</h3>
            <Button variant="primary" size="sm" onclick={() => newTaskDialogOpen = true}>
              <Plus class="w-3.5 h-3.5" />
              New Task
            </Button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
            {#each ['todo', 'inprogress', 'review', 'completed'] as col}
              <div class="flex flex-col gap-3 p-3 bg-muted/30 border rounded-2xl min-h-[500px]">
                <div class="flex items-center justify-between pb-1 border-b border-border">
                  <span class="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    {col === 'todo' ? 'To Do' : col === 'inprogress' ? 'In Progress' : col === 'review' ? 'Review' : 'Completed'}
                  </span>
                  <Badge variant="secondary" class="text-3xs text-foreground">
                    {tasks.filter(t => t.column === col).length}
                  </Badge>
                </div>

                <div class="flex-1 flex flex-col gap-3 overflow-y-auto">
                  {#each tasks.filter(t => t.column === col) as t}
                    <div 
                      onclick={() => viewTaskDetails(t)}
                      onkeydown={(e) => e.key === 'Enter' && viewTaskDetails(t)}
                      role="button"
                      tabindex="0"
                      class="p-4 bg-card border border-border hover:border-primary/30 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between h-40 group text-left"
                    >
                      <div>
                        <div class="flex justify-between items-start gap-2">
                          <span class="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{t.title}</span>
                          <Badge variant={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info'} class="text-[9px] px-1.5 py-0">
                            {t.priority}
                          </Badge>
                        </div>
                        <p class="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{t.description}</p>
                      </div>

                      <div class="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-2xs">
                        <span class="text-muted-foreground flex items-center gap-1 font-semibold">
                          <Calendar class="w-3 h-3" />
                          {t.deadline}
                        </span>
                        
                        <div class="flex items-center gap-2">
                          <select 
                            value={t.column} 
                            onclick={(e) => e.stopPropagation()}
                            onchange={(e) => updateTaskColumn(t.id, (e.target as HTMLSelectElement).value as any)}
                            class="px-1.5 py-0.5 rounded border border-border bg-background text-3xs font-semibold text-muted-foreground focus:outline-none"
                            aria-label="Move column"
                          >
                            <option value="todo">To Do</option>
                            <option value="inprogress">In Dev</option>
                            <option value="review">Review</option>
                            <option value="completed">Done</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>

      {:else}
        {#if activeTab === 'discussions'}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <Card class="lg:col-span-2 flex flex-col gap-4">
              <div class="flex justify-between items-center border-b border-border/40 pb-3">
                <h3 class="text-lg font-bold text-foreground">Discussions Space</h3>
                <Button variant="outline" size="sm" onclick={() => showThreadForm = !showThreadForm}>
                  <Plus class="w-3.5 h-3.5" />
                  Start Thread
                </Button>
              </div>

              {#if showThreadForm}
                <form onsubmit={handleCreateThread} class="p-4 border border-border/80 rounded-2xl flex flex-col gap-3 bg-muted/10">
                  <div class="flex flex-col gap-1.5">
                    <label for="th-title" class="text-xs font-semibold text-foreground">Thread Title</label>
                    <input 
                      id="th-title"
                      type="text" 
                      placeholder="e.g. Design assets link" 
                      bind:value={threadTitle}
                      required
                      class="w-full px-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label for="th-content" class="text-xs font-semibold text-foreground">Content Details</label>
                    <textarea 
                      id="th-content"
                      placeholder="Discuss ideas..." 
                      bind:value={threadContent}
                      required
                      rows="4"
                      class="w-full px-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
                    ></textarea>
                  </div>
                  <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onclick={() => showThreadForm = false}>Cancel</Button>
                    <Button type="submit" variant="primary" size="sm">Publish Thread</Button>
                  </div>
                </form>
              {/if}

              <div class="flex flex-col gap-3">
                {#each threads as th}
                  <div 
                    onclick={() => selectedThread = th}
                    onkeydown={(e) => e.key === 'Enter' && (selectedThread = th)}
                    role="button"
                    tabindex="0"
                    class="p-4 border rounded-xl hover:border-primary/20 hover:bg-muted/5 transition-all cursor-pointer flex justify-between items-center text-left"
                  >
                    <div class="flex flex-col gap-1">
                      <span class="text-sm font-bold text-foreground hover:text-primary transition-colors">{th.title}</span>
                      <div class="flex items-center gap-2 text-2xs text-muted-foreground mt-1">
                        <span>Posted by: {th.authorName}</span>
                        <span>•</span>
                        <span>{new Date(th.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 text-2xs text-muted-foreground font-bold">
                      <MessageCircle class="w-4 h-4" />
                      {th.replies.length} replies
                    </div>
                  </div>
                {:else}
                  <div class="py-12 text-center text-xs text-muted-foreground italic">No discussion threads found.</div>
                {/each}
              </div>
            </Card>

            <Card>
              {#if selectedThread}
                <div class="flex flex-col gap-4">
                  <div class="flex justify-between items-start border-b border-border/40 pb-2">
                    <div class="flex flex-col">
                      <span class="text-sm font-extrabold text-foreground">{selectedThread.title}</span>
                      <span class="text-3xs text-muted-foreground font-semibold mt-1">Started by: {selectedThread.authorName}</span>
                    </div>
                    <button onclick={() => selectedThread = null} class="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Close</button>
                  </div>

                  <p class="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/10 border rounded-xl">{selectedThread.content}</p>

                  <div class="flex flex-col gap-3 mt-2 max-h-56 overflow-y-auto pr-1">
                    {#each selectedThread.replies as rep}
                      <div class="p-2.5 border rounded-lg bg-card flex flex-col gap-1">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-foreground">{rep.authorName}</span>
                          <span class="text-[9px] text-muted-foreground">{new Date(rep.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p class="text-xs text-muted-foreground">{rep.content}</p>
                      </div>
                    {/each}
                  </div>

                  <form onsubmit={handleCreateReply} class="flex gap-2 mt-2">
                    <input 
                      type="text" 
                      placeholder="Write a reply..." 
                      bind:value={replyText}
                      required
                      class="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                    />
                    <Button type="submit" variant="primary" size="sm" class="h-8.5 w-8.5 rounded-lg p-0">
                      <Send class="w-3.5 h-3.5" />
                    </Button>
                  </form>
                </div>
              {:else}
                <div class="h-44 flex flex-col items-center justify-center text-center text-xs text-muted-foreground/60 italic">
                  Select a discussion thread on the left to read replies.
                </div>
              {/if}
            </Card>
          </div>

        {:else}
          <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-bold text-foreground">File Library</h3>
              <Button variant="outline" size="sm" onclick={() => fileDialogOpen = true}>
                <FolderPlus class="w-4 h-4" />
                Upload Mock File
              </Button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
              {#each files as f}
                <Card hoverable class="p-4 flex flex-col justify-between h-44 relative text-left">
                  <div>
                    <div class="flex gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <FileText class="w-5 h-5" />
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="text-xs font-bold text-foreground truncate">{f.name}</span>
                        <span class="text-[10px] text-muted-foreground mt-0.5">{f.size} • version {f.version}</span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 pt-3 border-t border-border flex items-center justify-between text-3xs text-muted-foreground">
                    <span>Uploaded by: {f.uploadedByName}</span>
                    <a href="#download" onclick={(e) => (e.preventDefault(), toast.success(`Downloaded: ${f.name} (Simulated)`))}>
                      <Button variant="ghost" size="sm" class="text-3xs h-7 px-2 font-semibold">Download</Button>
                    </a>
                  </div>
                </Card>
              {:else}
                <div class="col-span-full py-12 text-center text-xs text-muted-foreground italic border border-dashed rounded-2xl">
                  No project files uploaded yet.
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <Dialog bind:open={inviteDialogOpen} title="Invite classmate to project">
    <form onsubmit={handleInvite} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="inv-email" class="text-xs font-semibold text-foreground">Classmate's Email Address</label>
        <input 
          id="inv-email"
          type="email" 
          placeholder="classmate@university.edu" 
          bind:value={inviteEmail} 
          required
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => inviteDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Send Invite</Button>
      </div>
    </form>
  </Dialog>

  <Dialog bind:open={newTaskDialogOpen} title="Create Kanban Task">
    <form onsubmit={handleCreateTask} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="t-title" class="text-xs font-semibold text-foreground">Task Title</label>
        <input 
          id="t-title"
          type="text" 
          placeholder="e.g. Implement user authentication" 
          bind:value={taskTitle} 
          required
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="t-desc" class="text-xs font-semibold text-foreground">Task Description</label>
        <textarea 
          id="t-desc"
          placeholder="Detail specifications..." 
          bind:value={taskDesc} 
          required
          rows="3"
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
        ></textarea>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="t-priority" class="text-xs font-semibold text-foreground">Task Priority</label>
          <select 
            id="t-priority"
            bind:value={taskPriority}
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="t-date" class="text-xs font-semibold text-foreground">Deadline Date</label>
          <input 
            id="t-date"
            type="date" 
            bind:value={taskDeadline} 
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="t-assign" class="text-xs font-semibold text-foreground">Assignee</label>
        <select 
          id="t-assign"
          bind:value={taskAssignee}
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
        >
          <option value="">Unassigned</option>
          {#each project.members as member}
            <option value={member.userId}>{member.name}</option>
          {/each}
        </select>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => newTaskDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Create Task</Button>
      </div>
    </form>
  </Dialog>

  <Dialog bind:open={taskDialogOpen} title={selectedTask?.title || "Task Details"}>
    {#if selectedTask}
      <div class="flex flex-col gap-4">
        <div>
          <Badge variant={selectedTask.priority === 'high' ? 'danger' : selectedTask.priority === 'medium' ? 'warning' : 'info'}>
            {selectedTask.priority} Priority
          </Badge>
          <p class="text-xs text-muted-foreground mt-3 leading-relaxed bg-muted/10 p-3 rounded-xl border">{selectedTask.description}</p>
        </div>

        <div class="grid grid-cols-2 gap-4 border-y border-border/40 py-3 text-xs">
          <div class="flex flex-col gap-0.5">
            <span class="text-muted-foreground font-semibold">Assignees:</span>
            <span class="text-foreground font-bold">
              {#if selectedTask.assignees.length > 0}
                {project.members.find(m => m.userId === selectedTask!.assignees[0])?.name || "Assigned User"}
              {:else}
                Unassigned
              {/if}
            </span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-muted-foreground font-semibold">Due Date:</span>
            <span class="text-foreground font-bold">{selectedTask.deadline}</span>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-muted-foreground">Comments ({selectedTask.comments.length})</h4>
          <div class="flex flex-col gap-2 max-h-40 overflow-y-auto">
            {#each selectedTask.comments as comment}
              <div class="p-2 border rounded-xl flex gap-2.5 items-start bg-muted/10">
                <img src={comment.userAvatar} alt={comment.userName} class="w-7 h-7 rounded-lg bg-muted" />
                <div class="flex flex-col min-w-0 text-left">
                  <div class="flex justify-between items-center gap-4">
                    <span class="text-[11px] font-bold text-foreground">{comment.userName}</span>
                    <span class="text-[9px] text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p class="text-[11px] text-muted-foreground mt-0.5">{comment.text}</p>
                </div>
              </div>
            {/each}
          </div>

          <form onsubmit={postComment} class="flex gap-2 mt-2">
            <input 
              type="text" 
              placeholder="Add comment..." 
              bind:value={commentText} 
              required
              class="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none"
            />
            <Button type="submit" variant="primary" size="sm" class="h-9 w-9 rounded-xl p-0">
              <Send class="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      </div>
    {/if}
  </Dialog>

  <Dialog bind:open={fileDialogOpen} title="Upload Project File">
    <form onsubmit={handleUploadFile} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="fl-name" class="text-xs font-semibold text-foreground">File Name</label>
        <input 
          id="fl-name"
          type="text" 
          placeholder="e.g. Design_Blueprint.pdf" 
          bind:value={uploadFileName} 
          required
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="fl-type" class="text-xs font-semibold text-foreground">File Type</label>
          <select 
            id="fl-type"
            bind:value={uploadFileType}
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
          >
            <option value="pdf">PDF Spec</option>
            <option value="image">PNG/JPG Image</option>
            <option value="doc">Word/Slides</option>
            <option value="code">Source Code</option>
          </select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="fl-size" class="text-xs font-semibold text-foreground">Simulated Size</label>
          <input 
            id="fl-size"
            type="text" 
            placeholder="e.g. 2.4 MB" 
            bind:value={uploadFileSize} 
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => fileDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Add File</Button>
      </div>
    </form>
  </Dialog>
{/if}
