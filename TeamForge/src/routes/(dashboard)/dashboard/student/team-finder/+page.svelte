<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type User, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { calculateCompatibilityBreakdown, type CompatibilityBreakdown } from '$lib/utils/compatibility';
  import { Search, Filter, Compass, Check, ArrowRight, UserPlus, Sparkles, X, PieChart } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let searchVal = $state('');
  let filterDept = $state('All');
  let filterYear = $state('All');
  let selectedSkills = $state<string[]>([]);

  let allUsers = $state<User[]>([]);
  let myProjects = $state<Project[]>([]);

  const allSkills = $derived([...new Set(allUsers.flatMap((u) => u.skills))].sort());

  function toggleSkillFilter(skill: string) {
    selectedSkills = selectedSkills.includes(skill)
      ? selectedSkills.filter((s) => s !== skill)
      : [...selectedSkills, skill];
  }
  
  // Invite Dialog states
  let inviteDialogOpen = $state(false);
  let selectedUserForInvite = $state<User | null>(null);
  let selectedProjectId = $state('');

  // Compatibility breakdown drawer
  let breakdownDialogOpen = $state(false);
  let breakdownTarget = $state<User | null>(null);

  const departments = db.getDepartments();

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      allUsers = db.getUsers().filter(u => u.id !== auth.user!.id && u.role === 'student');
      myProjects = db.getProjects().filter(p => p.ownerId === auth.user!.id && p.status === 'active');
      if (myProjects.length > 0) {
        selectedProjectId = myProjects[0].id;
      }
    }
  }

  function calculateCompatibility(target: User): number {
    if (!auth.user) return 0;
    return calculateCompatibilityBreakdown(auth.user, target).total;
  }

  const breakdown = $derived(
    breakdownTarget && auth.user ? calculateCompatibilityBreakdown(auth.user, breakdownTarget) : null
  );

  function openBreakdown(user: User) {
    breakdownTarget = user;
    breakdownDialogOpen = true;
  }

  const teammates = $derived(
    allUsers
      .map(u => ({ ...u, compatibility: calculateCompatibility(u) }))
      .filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchVal.toLowerCase()) ||
                              u.skills.some(s => s.toLowerCase().includes(searchVal.toLowerCase()));
        const matchesDept = filterDept === 'All' || u.department === filterDept;
        const matchesYear = filterYear === 'All' || u.academicYear === filterYear;
        const matchesSkills = selectedSkills.length === 0 || selectedSkills.some((s) => u.skills.includes(s));
        return matchesSearch && matchesDept && matchesYear && matchesSkills && u.availability;
      })
      .sort((a, b) => b.compatibility - a.compatibility)
  );

  function openInviteModal(user: User) {
    if (myProjects.length === 0) {
      toast.warning("You must be a project manager of an active project to invite members.");
      return;
    }
    selectedUserForInvite = user;
    inviteDialogOpen = true;
  }

  function handleSendInvite(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedUserForInvite || !selectedProjectId) return;
    try {
      db.inviteToProject(selectedProjectId, selectedUserForInvite.email);
      toast.success(`Invitation sent to ${selectedUserForInvite.name}!`);
      inviteDialogOpen = false;
      selectedUserForInvite = null;
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    }
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Compass class="w-7 h-7 text-primary" />
          Teammate Finder
        </h2>
        <p class="text-sm text-muted-foreground mt-1">Discover compatible peers using dynamic skill-matching vector models.</p>
      </div>
    </div>

    <!-- Filters -->
    <Card class="p-4 flex flex-col md:flex-row gap-3">
      <div class="flex-1 relative">
        <span class="absolute left-3 top-3 text-muted-foreground"><Search class="w-4.5 h-4.5" /></span>
        <input 
          type="text" 
          placeholder="Search by name or skill..." 
          bind:value={searchVal}
          class="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      <select 
        bind:value={filterDept}
        class="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer min-w-44"
      >
        <option value="All">All Departments</option>
        {#each departments as d}
          <option value={d.name}>{d.name}</option>
        {/each}
      </select>

      <select 
        bind:value={filterYear}
        class="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer min-w-40"
      >
        <option value="All">All Standing</option>
        <option value="Year 1">Year 1</option>
        <option value="Year 2">Year 2</option>
        <option value="Year 3">Year 3</option>
        <option value="Year 4">Year 4</option>
      </select>
    </Card>

    {#if allSkills.length > 0}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-2xs font-bold text-muted-foreground uppercase tracking-widest mr-1">Filter by skill:</span>
        {#each allSkills as skill}
          <button
            type="button"
            onclick={() => toggleSkillFilter(skill)}
            class="px-2.5 py-1 rounded-full text-2xs font-semibold border transition-colors cursor-pointer
              {selectedSkills.includes(skill)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'}"
          >
            {skill}
          </button>
        {/each}
        {#if selectedSkills.length > 0}
          <button
            type="button"
            onclick={() => selectedSkills = []}
            class="px-2.5 py-1 rounded-full text-2xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
          >
            <X class="w-3 h-3" />
            Clear ({selectedSkills.length})
          </button>
        {/if}
      </div>
    {/if}

    <!-- Results -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {#each teammates as t}
        <Card hoverable class="p-6 flex flex-col justify-between relative overflow-hidden h-76">
          <div class="absolute right-0 top-0 pt-4 pr-5 flex flex-col items-end">
            <span class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Match Compatibility</span>
            <div class="flex items-center gap-1.5 mt-1 font-extrabold text-lg text-foreground">
              <Sparkles class="w-4 h-4 text-amber-500 fill-amber-500/20" />
              {t.compatibility}%
            </div>
          </div>

          <div>
            <div class="flex gap-4">
              <img src={t.avatar} alt={t.name} class="w-14 h-14 rounded-2xl border border-primary/10 bg-muted" />
              <div class="flex flex-col min-w-0 pr-24">
                <span class="font-extrabold text-foreground text-lg truncate">{t.name}</span>
                <span class="text-xs text-primary font-semibold truncate mt-0.5">{t.department}</span>
                <span class="text-3xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{t.academicYear}</span>
              </div>
            </div>

            <p class="text-xs text-muted-foreground mt-4 line-clamp-2 leading-relaxed">{t.bio || "No biography provided yet."}</p>
          </div>

          <div class="mt-4 flex flex-col gap-2">
            <div class="flex flex-wrap gap-1">
              {#each t.skills.slice(0, 5) as s}
                <Badge variant={auth.user.skills.includes(s) ? 'primary' : 'secondary'} class="text-3xs">
                  {s}
                </Badge>
              {:else}
                <span class="text-3xs text-muted-foreground italic">No skills listed</span>
              {/each}
              {#if t.skills.length > 5}
                <Badge variant="outline" class="text-3xs">+{t.skills.length - 5} more</Badge>
              {/if}
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onclick={() => openBreakdown(t)}>
              <PieChart class="w-3.5 h-3.5" />
              View Breakdown
            </Button>
            <Button variant="outline" size="sm" onclick={() => openInviteModal(t)}>
              <UserPlus class="w-3.5 h-3.5" />
              Invite to Team
            </Button>
          </div>
        </Card>
      {:else}
        <div class="col-span-full py-16 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center">
          <Compass class="w-14 h-14 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-muted-foreground">No matches found</p>
        </div>
      {/each}
    </div>
  </div>

  <Dialog bind:open={inviteDialogOpen} title="Send Team Invitation">
    {#if selectedUserForInvite}
      <form onsubmit={handleSendInvite} class="flex flex-col gap-4">
        <div class="p-4 border rounded-xl flex gap-3.5 bg-muted/10 items-center">
          <img src={selectedUserForInvite.avatar} alt={selectedUserForInvite.name} class="w-12 h-12 rounded-xl bg-muted" />
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-foreground">{selectedUserForInvite.name}</span>
            <span class="text-xs text-muted-foreground">{selectedUserForInvite.email}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="inv-proj" class="text-xs font-semibold text-foreground">Select Active Project</label>
          <select 
            id="inv-proj"
            bind:value={selectedProjectId}
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
          >
            {#each myProjects as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>

        <div class="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onclick={() => inviteDialogOpen = false}>Cancel</Button>
          <Button type="submit" variant="primary">Send Invitation</Button>
        </div>
      </form>
    {/if}
  </Dialog>

  <Dialog bind:open={breakdownDialogOpen} title="Compatibility Breakdown">
    {#if breakdownTarget && breakdown}
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3 p-3 border rounded-xl bg-muted/10">
          <img src={breakdownTarget.avatar} alt={breakdownTarget.name} class="w-12 h-12 rounded-xl bg-muted" />
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-foreground">{breakdownTarget.name}</span>
            <span class="text-xs text-muted-foreground">{breakdownTarget.department}</span>
          </div>
          <div class="ml-auto flex items-center gap-1.5 font-extrabold text-lg text-foreground">
            <Sparkles class="w-4 h-4 text-amber-500 fill-amber-500/20" />
            {breakdown.total}%
          </div>
        </div>

        <div class="flex flex-col gap-3 text-xs">
          <div class="flex flex-col gap-1">
            <div class="flex justify-between font-semibold text-foreground">
              <span>Base score</span>
              <span>+{breakdown.base}</span>
            </div>
            <p class="text-2xs text-muted-foreground">Every match starts here.</p>
          </div>

          <div class="flex flex-col gap-1 pt-2 border-t border-border/40">
            <div class="flex justify-between font-semibold text-foreground">
              <span>Department {breakdown.departmentMatch ? `— both in ${breakdownTarget.department}` : '— different departments'}</span>
              <span>+{breakdown.departmentPoints}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1 pt-2 border-t border-border/40">
            <div class="flex justify-between font-semibold text-foreground">
              <span>Academic year {breakdown.yearMatch ? `— both ${breakdownTarget.academicYear}` : '— different standing'}</span>
              <span>+{breakdown.yearPoints}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 pt-2 border-t border-border/40">
            <div class="flex justify-between font-semibold text-foreground">
              <span>Shared skills ({breakdown.commonSkills.length})</span>
              <span>+{breakdown.skillPoints}</span>
            </div>
            {#if breakdown.commonSkills.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each breakdown.commonSkills as s}
                  <Badge variant="primary" class="text-3xs">{s}</Badge>
                {/each}
              </div>
            {:else}
              <p class="text-2xs text-muted-foreground">No overlapping skills listed.</p>
            {/if}
          </div>

          <div class="flex flex-col gap-1.5 pt-2 border-t border-border/40">
            <div class="flex justify-between font-semibold text-foreground">
              <span>Shared interests ({breakdown.commonInterests.length})</span>
              <span>+{breakdown.interestPoints}</span>
            </div>
            {#if breakdown.commonInterests.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each breakdown.commonInterests as i}
                  <Badge variant="secondary" class="text-3xs">{i}</Badge>
                {/each}
              </div>
            {:else}
              <p class="text-2xs text-muted-foreground">No overlapping interests listed.</p>
            {/if}
          </div>
        </div>

        <div class="flex justify-end mt-2">
          <Button variant="outline" onclick={() => breakdownDialogOpen = false}>Close</Button>
        </div>
      </div>
    {/if}
  </Dialog>
{/if}
