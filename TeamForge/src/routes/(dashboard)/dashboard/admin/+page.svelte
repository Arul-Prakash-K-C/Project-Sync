<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { newId } from '$lib/utils/id';
  import { db, type User, type Department, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { isCloudMode } from '$lib/supabase/config';
  import {
    Users as UsersIcon,
    Building2,
    FolderKanban,
    Plus,
    Trash2,
    Download,
    Upload,
    RotateCcw,
    Search,
    AlertTriangle
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  let users = $state<User[]>([]);
  let departments = $state<Department[]>([]);
  let projects = $state<Project[]>([]);
  let loaded = $state(false);

  let addDeptDialogOpen = $state(false);
  let newDeptName = $state('');
  let newDeptCode = $state('');
  let newDeptHead = $state('');
  let newDeptDesc = $state('');

  let resetDialogOpen = $state(false);
  let importFileInput = $state<HTMLInputElement | null>(null);

  /** The account table is the one place an admin hunts for a specific person. */
  let userSearch = $state('');
  let roleFilter = $state<'all' | User['role']>('all');

  const usersByRole = $derived(
    (['student', 'faculty', 'admin'] as const).map((role) => ({
      label: role.charAt(0).toUpperCase() + role.slice(1),
      count: users.filter((u) => u.role === role).length
    }))
  );

  const usersByDepartment = $derived(
    departments
      .map((d) => ({ label: d.name, code: d.code, count: users.filter((u) => u.department === d.name).length }))
      .sort((a, b) => b.count - a.count)
  );

  const projectsByStatus = $derived(
    (
      [
        { status: 'active', label: 'Active', tone: 'success' },
        { status: 'pending', label: 'Pending', tone: 'warning' },
        { status: 'archived', label: 'Archived', tone: 'neutral' },
        { status: 'rejected', label: 'Rejected', tone: 'danger' }
      ] as const
    ).map((s) => ({ ...s, count: projects.filter((p) => p.status === s.status).length }))
  );

  const platformMilestoneCompletion = $derived.by(() => {
    const allMilestones = projects.flatMap((p) => p.milestones);
    if (allMilestones.length === 0) return 0;
    return Math.round((allMilestones.filter((m) => m.completed).length / allMilestones.length) * 100);
  });

  const filteredUsers = $derived(
    users.filter((u) => {
      const q = userSearch.toLowerCase();
      const matchesQuery =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesQuery && matchesRole;
    })
  );

  onMount(() => {
    loadData();
    loaded = true;
  });

  function loadData() {
    users = db.getUsers();
    departments = db.getDepartments();
    projects = db.getProjects();
  }

  function changeRole(userId: string, newRole: 'student' | 'faculty' | 'admin') {
    try {
      db.updateUserProfile(userId, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update role');
    }
  }

  function deleteUser(userId: string) {
    if (userId === auth.user?.id) {
      toast.error('You cannot delete your own admin account.');
      return;
    }
    try {
      const all = db.getUsers().filter((u) => u.id !== userId);
      db.saveUsers(all);
      toast.success('User account removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove user account');
    }
  }

  function exportData() {
    const data = db.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  }

  function triggerImport() {
    importFileInput?.click();
  }

  async function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      db.importAllData(parsed);
      if (isCloudMode) {
        // Let every imported record reach Supabase before the page reloads.
        const { flushWrites } = await import('$lib/services/cloudSync');
        await flushWrites();
      }
      toast.success('Data imported — reloading...');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error('Invalid backup file');
    } finally {
      (e.target as HTMLInputElement).value = '';
    }
  }

  async function confirmReset() {
    db.resetAllData();
    resetDialogOpen = false;
    toast.success('Demo data reset');
    await auth.logout();
    setTimeout(() => goto('/auth'), 400);
  }

  function handleCreateDept(e: SubmitEvent) {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    try {
      const allDeps = db.getDepartments();
      const newD: Department = {
        id: newId('dept'),
        name: newDeptName,
        code: newDeptCode.toUpperCase(),
        headName: newDeptHead || 'Unassigned',
        description: newDeptDesc
      };
      allDeps.push(newD);
      db.saveDepartments(allDeps);
      toast.success(`Department "${newDeptCode}" registered`);
      addDeptDialogOpen = false;
      newDeptName = '';
      newDeptCode = '';
      newDeptHead = '';
      newDeptDesc = '';
      loadData();
    } catch (err) {
      toast.error('Failed to register department');
    }
  }

  const roleTone = { admin: 'danger', faculty: 'primary', student: 'secondary' } as const;
</script>

<svelte:head>
  <title>Administration — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-7 max-w-7xl">
    <PageHeader
      title="Platform administration"
      description="Accounts, departments and the platform-wide data store."
    >
      {#snippet actions()}
        <Button variant="outline" onclick={exportData}>
          <Download class="w-4 h-4" />
          Export
        </Button>
        <Button variant="outline" onclick={triggerImport}>
          <Upload class="w-4 h-4" />
          Import
        </Button>
        <input
          bind:this={importFileInput}
          type="file"
          accept="application/json"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
          onchange={handleImportFile}
        />
        <!-- Resetting is a demo convenience. Against a shared cloud database it
             would wipe every user's work, so it is not offered there. -->
        {#if !isCloudMode}
          <Button variant="ghost" onclick={() => (resetDialogOpen = true)}>
            <RotateCcw class="w-4 h-4" />
            Reset data
          </Button>
        {/if}
      {/snippet}
    </PageHeader>

    <section aria-label="Platform totals" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Registered accounts"
        value={users.length}
        icon={UsersIcon}
        tone="accent"
        hint="{usersByRole[0].count} students · {usersByRole[1].count} faculty"
      />
      <StatCard
        label="Departments"
        value={departments.length}
        icon={Building2}
        tone="info"
        hint="Available when registering an account"
      />
      <StatCard
        label="Projects"
        value={projects.length}
        icon={FolderKanban}
        tone="success"
        hint="{platformMilestoneCompletion}% of all milestones complete"
      />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Accounts by role">
        <div class="flex flex-col gap-3">
          {#each usersByRole as r (r.label)}
            <ProgressBar
              value={r.count}
              max={Math.max(users.length, 1)}
              label={r.label}
              valueLabel={String(r.count)}
              tone="accent"
              size="sm"
            />
          {/each}
        </div>
      </Card>

      <Card title="Accounts by department">
        <div class="flex flex-col gap-3">
          {#each usersByDepartment as d (d.code)}
            <ProgressBar
              value={d.count}
              max={Math.max(users.length, 1)}
              label={d.code}
              valueLabel={String(d.count)}
              tone="info"
              size="sm"
            />
          {:else}
            <p class="text-2xs text-muted-foreground">No departments registered yet.</p>
          {/each}
        </div>
      </Card>

      <Card title="Projects by status">
        <div class="flex flex-col gap-3">
          {#each projectsByStatus as s (s.status)}
            <ProgressBar
              value={s.count}
              max={Math.max(projects.length, 1)}
              label={s.label}
              valueLabel={String(s.count)}
              tone={s.tone}
              size="sm"
            />
          {/each}
        </div>
        <div class="mt-4 pt-3 border-t border-border flex justify-between items-baseline gap-3">
          <span class="eyebrow">Milestone completion</span>
          <span class="font-display text-lg text-foreground tabular">{platformMilestoneCompletion}%</span>
        </div>
      </Card>
    </div>

    <!-- User accounts -->
    <Card flush title="User accounts">
      {#snippet actions()}
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <label for="user-search" class="sr-only">Search accounts</label>
          <input
            id="user-search"
            type="search"
            placeholder="Search name, email, department"
            bind:value={userSearch}
            class="field-input field-icon h-9 w-44 sm:w-64"
          />
        </div>
        <label for="role-filter" class="sr-only">Filter by role</label>
        <select id="role-filter" bind:value={roleFilter} class="field-select h-9 w-auto text-xs font-semibold">
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admins</option>
        </select>
      {/snippet}

      {#if !loaded}
        <div class="p-5 flex flex-col gap-3" aria-busy="true">
          {#each { length: 4 } as _, i (i)}
            <div class="skeleton h-10 w-full"></div>
          {/each}
        </div>
      {:else if filteredUsers.length === 0}
        <div class="p-5">
          <EmptyState
            icon={UsersIcon}
            title={users.length === 0 ? 'No accounts registered' : 'No accounts match'}
            description={users.length === 0
              ? 'Accounts appear here as people register on the platform.'
              : 'Try a different search term, or switch the role filter back to all roles.'}
            size="sm"
          />
        </div>
      {:else}
        <div class="table-scroll hidden md:block">
          <table class="data-table">
            <caption class="sr-only">Registered platform accounts</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Role</th>
                <th scope="col">Department</th>
                <th scope="col" class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredUsers as u (u.id)}
                <tr>
                  <th scope="row" class="p-4 font-normal">
                    <span class="flex items-center gap-3">
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <span class="flex flex-col min-w-0 leading-tight">
                        <span class="text-sm font-bold text-foreground truncate">{u.name}</span>
                        <span class="text-2xs text-muted-foreground truncate">{u.email}</span>
                      </span>
                    </span>
                  </th>
                  <td>
                    <Badge variant={roleTone[u.role]} size="sm" class="capitalize">{u.role}</Badge>
                  </td>
                  <td class="text-xs text-muted-foreground max-w-xs truncate">{u.department}</td>
                  <td>
                    <div class="flex justify-end items-center gap-2">
                      {#if u.role === 'student'}
                        <Button variant="outline" size="sm" onclick={() => changeRole(u.id, 'faculty')}>
                          Make faculty
                        </Button>
                      {:else if u.role === 'faculty'}
                        <Button variant="outline" size="sm" onclick={() => changeRole(u.id, 'student')}>
                          Make student
                        </Button>
                      {/if}

                      <button
                        onclick={() => deleteUser(u.id)}
                        disabled={u.id === auth.user?.id}
                        class="icon-action icon-action-danger"
                        aria-label="Delete account: {u.name}"
                        title={u.id === auth.user?.id ? 'You cannot delete your own account' : 'Delete account'}
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Mobile: the same accounts and the same actions, stacked. -->
        <ul class="md:hidden divide-y divide-border">
          {#each filteredUsers as u (u.id)}
            <li class="p-4">
              <div class="flex items-start gap-3">
                <Avatar src={u.avatar} name={u.name} size="sm" />
                <div class="min-w-0 flex-1 leading-tight">
                  <p class="text-sm font-bold text-foreground truncate">{u.name}</p>
                  <p class="text-2xs text-muted-foreground truncate">{u.email}</p>
                  <div class="flex items-center gap-1.5 mt-1.5">
                    <Badge variant={roleTone[u.role]} size="sm" class="capitalize">{u.role}</Badge>
                    <span class="text-2xs text-muted-foreground truncate">{u.department}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 mt-3">
                {#if u.role === 'student'}
                  <Button variant="outline" size="sm" onclick={() => changeRole(u.id, 'faculty')}>
                    Make faculty
                  </Button>
                {:else if u.role === 'faculty'}
                  <Button variant="outline" size="sm" onclick={() => changeRole(u.id, 'student')}>
                    Make student
                  </Button>
                {/if}
                <button
                  onclick={() => deleteUser(u.id)}
                  disabled={u.id === auth.user?.id}
                  class="icon-action icon-action-danger ml-auto"
                  aria-label="Delete account: {u.name}"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <!-- Departments -->
    <Card title="Departments">
      {#snippet actions()}
        <Button variant="primary" size="sm" onclick={() => (addDeptDialogOpen = true)}>
          <Plus class="w-3.5 h-3.5" />
          Add department
        </Button>
      {/snippet}

      <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {#each departments as d (d.id)}
          <li class="p-4 border border-border rounded-md flex flex-col">
            <div class="flex justify-between items-start gap-3">
              <h3 class="text-sm font-bold text-foreground min-w-0">{d.name}</h3>
              <Badge variant="outline" size="sm" class="shrink-0 font-mono">{d.code}</Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{d.description}</p>
            <p class="text-2xs text-muted-foreground mt-auto pt-3">
              Head: <span class="font-semibold text-foreground">{d.headName}</span>
              · <span class="tabular">{users.filter((u) => u.department === d.name).length}</span> account(s)
            </p>
          </li>
        {:else}
          <li class="md:col-span-2">
            <EmptyState
              icon={Building2}
              title="No departments registered"
              description="Departments populate the sign-up form and scope faculty supervision. Add the first one to get started."
              size="sm"
            >
              {#snippet action()}
                <Button variant="outline" size="sm" onclick={() => (addDeptDialogOpen = true)}>
                  Add department
                </Button>
              {/snippet}
            </EmptyState>
          </li>
        {/each}
      </ul>
    </Card>
  </div>

  <Dialog bind:open={addDeptDialogOpen} title="Register department">
    <form id="dept-form" onsubmit={handleCreateDept} class="flex flex-col gap-4">
      <div class="grid grid-cols-3 gap-4">
        <div class="field col-span-2">
          <label for="d-name" class="field-label">Department name</label>
          <input
            id="d-name"
            type="text"
            placeholder="e.g. Mechanical Engineering"
            bind:value={newDeptName}
            required
            class="field-input"
          />
        </div>
        <div class="field">
          <label for="d-code" class="field-label">Code</label>
          <input
            id="d-code"
            type="text"
            placeholder="e.g. ME"
            bind:value={newDeptCode}
            required
            class="field-input uppercase"
          />
        </div>
      </div>

      <div class="field">
        <label for="d-head" class="field-label">Department head</label>
        <input
          id="d-head"
          type="text"
          placeholder="e.g. Dr. Arthur Pendelton"
          bind:value={newDeptHead}
          aria-describedby="d-head-hint"
          class="field-input"
        />
        <p id="d-head-hint" class="field-hint">Optional — recorded as "Unassigned" if left blank.</p>
      </div>

      <div class="field">
        <label for="d-desc" class="field-label">Description</label>
        <textarea
          id="d-desc"
          placeholder="Department objectives…"
          bind:value={newDeptDesc}
          rows="3"
          class="field-textarea"
        ></textarea>
      </div>
    </form>

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (addDeptDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="dept-form" variant="primary">Register department</Button>
    {/snippet}
  </Dialog>

  <Dialog bind:open={resetDialogOpen} title="Reset all data?">
    <div class="flex gap-3">
      <AlertTriangle class="w-5 h-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
      <div class="text-sm text-muted-foreground leading-relaxed">
        <p>
          This clears every account, project, task and message stored in this browser and re-seeds the
          built-in demo data.
        </p>
        <p class="mt-2">
          It cannot be undone, and you will be signed out. Export a backup first if you want to keep the
          current state.
        </p>
      </div>
    </div>

    {#snippet footer()}
      <Button variant="outline" onclick={() => (resetDialogOpen = false)}>Cancel</Button>
      <Button
        variant="outline"
        onclick={() => {
          exportData();
        }}
      >
        <Download class="w-3.5 h-3.5" />
        Export first
      </Button>
      <Button variant="danger" onclick={confirmReset}>Reset everything</Button>
    {/snippet}
  </Dialog>
{/if}
