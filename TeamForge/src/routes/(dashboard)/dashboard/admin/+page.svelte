<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type User, type Department, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Users as UsersIcon, Building2, FolderKanban, Plus, Trash2 } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let users = $state<User[]>([]);
  let departments = $state<Department[]>([]);
  let projects = $state<Project[]>([]);

  let addDeptDialogOpen = $state(false);
  let newDeptName = $state('');
  let newDeptCode = $state('');
  let newDeptHead = $state('');
  let newDeptDesc = $state('');

  onMount(() => {
    loadData();
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
      toast.error("You cannot delete your own admin account.");
      return;
    }
    const all = db.getUsers().filter(u => u.id !== userId);
    db.saveUsers(all);
    toast.success('User account removed');
    loadData();
  }

  function handleCreateDept(e: SubmitEvent) {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    try {
      const allDeps = db.getDepartments();
      const newD: Department = {
        id: `dept_${Date.now()}`,
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
</script>

{#if auth.user}
  <div class="flex flex-col gap-8">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Platform Administration</h2>
        <p class="text-sm text-muted-foreground mt-1">Supervise accounts, configure academic departments, and manage global settings.</p>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Building2 class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Registered Accounts</p>
          <p class="text-2xl font-black text-foreground mt-1">{users.length}</p>
        </div>
      </Card>

      <Card class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
          <Building2 class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Academic Departments</p>
          <p class="text-2xl font-black text-foreground mt-1">{departments.length}</p>
        </div>
      </Card>

      <Card class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <FolderKanban class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Total Teams Projects</p>
          <p class="text-2xl font-black text-foreground mt-1">{projects.length}</p>
        </div>
      </Card>
    </div>

    <!-- User Catalog Table -->
    <div class="flex flex-col gap-4">
      <h3 class="text-xl font-bold text-foreground">User Database Management</h3>
      <Card class="p-0 overflow-hidden border border-border">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-border bg-muted/30 text-3xs font-black uppercase tracking-wider text-muted-foreground">
                <th class="p-4">Profile</th>
                <th class="p-4">Role</th>
                <th class="p-4">Department</th>
                <th class="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-xs">
              {#each users as u}
                <tr class="hover:bg-muted/10 transition-colors">
                  <td class="p-4 flex items-center gap-3">
                    <img src={u.avatar} alt={u.name} class="w-9 h-9 rounded-xl bg-muted" />
                    <div class="flex flex-col min-w-0">
                      <span class="font-bold text-foreground truncate">{u.name}</span>
                      <span class="text-3xs text-muted-foreground truncate">{u.email}</span>
                    </div>
                  </td>
                  <td class="p-4">
                    <Badge variant={u.role === 'admin' ? 'danger' : u.role === 'faculty' ? 'primary' : 'secondary'} class="capitalize">
                      {u.role}
                    </Badge>
                  </td>
                  <td class="p-4 text-muted-foreground truncate max-w-xs">{u.department}</td>
                  <td class="p-4 text-right">
                    <div class="flex justify-end gap-2">
                      {#if u.role === 'student'}
                        <button 
                          onclick={() => changeRole(u.id, 'faculty')}
                          class="p-1.5 border border-border rounded-lg text-3xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
                        >
                          Make Faculty
                        </button>
                      {:else if u.role === 'faculty'}
                        <button 
                          onclick={() => changeRole(u.id, 'student')}
                          class="p-1.5 border border-border rounded-lg text-3xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
                        >
                          Make Student
                        </button>
                      {/if}

                      <button 
                        onclick={() => deleteUser(u.id)}
                        disabled={u.id === auth.user?.id}
                        class="p-1.5 border border-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-all cursor-pointer disabled:opacity-30"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <!-- Department Catalogue -->
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-bold text-foreground">Department Catalogue</h3>
        <Button variant="primary" size="sm" onclick={() => addDeptDialogOpen = true}>
          <Plus class="w-3.5 h-3.5" />
          Add Department
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each departments as d}
          <Card hoverable class="p-6 flex flex-col justify-between h-48 text-left">
            <div>
              <div class="flex justify-between items-start gap-4">
                <span class="font-extrabold text-foreground text-lg truncate">{d.name}</span>
                <Badge variant="outline">{d.code}</Badge>
              </div>
              <p class="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{d.description}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-border text-3xs font-bold text-muted-foreground uppercase tracking-widest">
              Head: {d.headName}
            </div>
          </Card>
        {/each}
      </div>
    </div>
  </div>

  <Dialog bind:open={addDeptDialogOpen} title="Register Academic Department">
    <form onsubmit={handleCreateDept} class="flex flex-col gap-4">
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2 flex flex-col gap-1.5">
          <label for="d-name" class="text-xs font-semibold text-foreground">Department Name</label>
          <input 
            id="d-name"
            type="text" 
            placeholder="e.g. Mechanical Engineering" 
            bind:value={newDeptName} 
            required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="d-code" class="text-xs font-semibold text-foreground">Code</label>
          <input 
            id="d-code"
            type="text" 
            placeholder="e.g. ME" 
            bind:value={newDeptCode} 
            required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="d-head" class="text-xs font-semibold text-foreground">Department Head</label>
        <input 
          id="d-head"
          type="text" 
          placeholder="e.g. Dr. Arthur Pendelton" 
          bind:value={newDeptHead} 
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="d-desc" class="text-xs font-semibold text-foreground">Brief Description</label>
        <textarea 
          id="d-desc"
          placeholder="Department objectives..." 
          bind:value={newDeptDesc} 
          rows="3"
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
        ></textarea>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => addDeptDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Register Dept</Button>
      </div>
    </form>
  </Dialog>
{/if}
