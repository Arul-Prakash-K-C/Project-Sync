<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type User, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { calculateCompatibilityBreakdown } from '$lib/utils/compatibility';
  import { Search, Compass, UserPlus, Sparkles, X, PieChart, SlidersHorizontal } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  let searchVal = $state('');
  let filterDept = $state('All');
  let filterYear = $state('All');
  let selectedSkills = $state<string[]>([]);
  /** The skill list is as long as the corpus of skills; only a first row shows
      until asked, so the filter bar cannot push results below the fold. */
  let showAllSkills = $state(false);
  let loaded = $state(false);

  let allUsers = $state<User[]>([]);
  let myProjects = $state<Project[]>([]);

  const allSkills = $derived([...new Set(allUsers.flatMap((u) => u.skills))].sort());
  const visibleSkills = $derived(showAllSkills ? allSkills : allSkills.slice(0, 12));

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
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      allUsers = db.getUsers().filter((u) => u.id !== auth.user!.id && u.role === 'student');
      myProjects = db.getProjects().filter((p) => p.ownerId === auth.user!.id && p.status === 'active');
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
      .map((u) => ({ ...u, compatibility: calculateCompatibility(u) }))
      .filter((u) => {
        const matchesSearch =
          u.name.toLowerCase().includes(searchVal.toLowerCase()) ||
          u.skills.some((s) => s.toLowerCase().includes(searchVal.toLowerCase()));
        const matchesDept = filterDept === 'All' || u.department === filterDept;
        const matchesYear = filterYear === 'All' || u.academicYear === filterYear;
        const matchesSkills = selectedSkills.length === 0 || selectedSkills.some((s) => u.skills.includes(s));
        return matchesSearch && matchesDept && matchesYear && matchesSkills && u.availability;
      })
      .sort((a, b) => b.compatibility - a.compatibility)
  );

  const activeFilterCount = $derived(
    (searchVal ? 1 : 0) +
      (filterDept !== 'All' ? 1 : 0) +
      (filterYear !== 'All' ? 1 : 0) +
      selectedSkills.length
  );

  function clearFilters() {
    searchVal = '';
    filterDept = 'All';
    filterYear = 'All';
    selectedSkills = [];
  }

  function scoreTone(score: number): 'success' | 'accent' | 'neutral' {
    if (score >= 75) return 'success';
    if (score >= 50) return 'accent';
    return 'neutral';
  }

  function openInviteModal(user: User) {
    if (myProjects.length === 0) {
      toast.warning('You must be a project manager of an active project to invite members.');
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

<svelte:head>
  <title>Team Finder — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Team Finder"
      icon={Compass}
      description="Classmates who are open to projects, ranked by how well their department, standing and skills line up with yours."
    />

    <!-- Filter toolbar -->
    <section aria-label="Filters" class="flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-2.5">
        <div class="relative flex-1">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <label for="tf-search" class="sr-only">Search teammates by name or skill</label>
          <input
            id="tf-search"
            type="search"
            placeholder="Search by name or skill…"
            bind:value={searchVal}
            class="field-input field-icon"
          />
        </div>

        <label for="tf-dept" class="sr-only">Filter by department</label>
        <select id="tf-dept" bind:value={filterDept} class="field-select sm:w-52">
          <option value="All">All departments</option>
          {#each departments as d (d.id)}
            <option value={d.name}>{d.name}</option>
          {/each}
        </select>

        <label for="tf-year" class="sr-only">Filter by academic standing</label>
        <select id="tf-year" bind:value={filterYear} class="field-select sm:w-44">
          <option value="All">All standing</option>
          <option value="Year 1">Year 1</option>
          <option value="Year 2">Year 2</option>
          <option value="Year 3">Year 3</option>
          <option value="Year 4">Year 4</option>
        </select>
      </div>

      {#if allSkills.length > 0}
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="eyebrow mr-1 inline-flex items-center gap-1.5">
            <SlidersHorizontal class="w-3 h-3" aria-hidden="true" />
            Skills
          </span>
          {#each visibleSkills as skill (skill)}
            {@const on = selectedSkills.includes(skill)}
            <button
              type="button"
              onclick={() => toggleSkillFilter(skill)}
              aria-pressed={on}
              class="px-2.5 h-7 rounded-full text-2xs font-semibold border transition-colors cursor-pointer
                {on
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card text-muted-foreground border-border hover:border-accent/45 hover:text-foreground'}"
            >
              {skill}
            </button>
          {/each}
          {#if allSkills.length > 12}
            <button
              type="button"
              onclick={() => (showAllSkills = !showAllSkills)}
              class="px-2 h-7 text-2xs font-bold text-accent hover:underline cursor-pointer rounded-sm"
            >
              {showAllSkills ? 'Show fewer' : `+${allSkills.length - 12} more`}
            </button>
          {/if}
        </div>
      {/if}

      <div class="flex items-center justify-between gap-3 border-t border-border pt-3">
        <p class="text-2xs text-muted-foreground" role="status" aria-live="polite">
          <span class="font-bold text-foreground tabular">{teammates.length}</span>
          available teammate{teammates.length === 1 ? '' : 's'}
          {#if activeFilterCount > 0}· {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active{/if}
        </p>
        {#if activeFilterCount > 0}
          <button
            type="button"
            onclick={clearFilters}
            class="inline-flex items-center gap-1 text-2xs font-bold text-muted-foreground hover:text-foreground cursor-pointer rounded-sm"
          >
            <X class="w-3 h-3" aria-hidden="true" />
            Clear filters
          </button>
        {/if}
      </div>
    </section>

    <!-- Results -->
    {#if !loaded}
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4" aria-busy="true">
        {#each { length: 4 } as _, i (i)}
          <div class="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
            <div class="flex gap-3">
              <div class="skeleton w-12 h-12 rounded-md"></div>
              <div class="flex-1 flex flex-col gap-2">
                <div class="skeleton h-4 w-1/3"></div>
                <div class="skeleton h-3 w-1/2"></div>
              </div>
            </div>
            <div class="skeleton h-3 w-full"></div>
            <div class="skeleton h-8 w-full mt-3"></div>
          </div>
        {/each}
      </div>
    {:else}
      <ul class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {#each teammates as t (t.id)}
          <li>
            <Card hoverable class="h-full flex flex-col">
              <div class="flex items-start gap-3.5">
                <Avatar src={t.avatar} name={t.name} size="lg" />

                <div class="flex-1 min-w-0">
                  <h2 class="text-base font-bold text-foreground truncate">{t.name}</h2>
                  <p class="text-xs text-muted-foreground truncate mt-0.5">{t.department}</p>
                  <p class="eyebrow mt-1">{t.academicYear}</p>
                </div>

                <!-- The score is the reason this card is where it is in the
                     list, so it reads as a figure with a meter, not a footnote. -->
                <div class="shrink-0 w-24 text-right">
                  <p class="eyebrow">Match</p>
                  <p class="font-display text-xl text-foreground tabular leading-none mt-1">
                    {t.compatibility}%
                  </p>
                  <ProgressBar
                    class="mt-2"
                    value={t.compatibility}
                    tone={scoreTone(t.compatibility)}
                    size="sm"
                    label="Compatibility with {t.name}"
                  />
                </div>
              </div>

              <p class="text-xs text-muted-foreground mt-3.5 line-clamp-2 leading-relaxed">
                {t.bio || 'No biography provided yet.'}
              </p>

              <div class="flex flex-wrap gap-1.5 mt-3">
                {#each t.skills.slice(0, 5) as s (s)}
                  <!-- Shared skills are tinted so the overlap that drives the
                       score is visible without opening the breakdown. -->
                  <Badge variant={auth.user.skills.includes(s) ? 'primary' : 'secondary'} size="sm">
                    {s}
                  </Badge>
                {:else}
                  <span class="text-2xs text-muted-foreground">No skills listed</span>
                {/each}
                {#if t.skills.length > 5}
                  <Badge variant="outline" size="sm">+{t.skills.length - 5}</Badge>
                {/if}
              </div>

              <div class="mt-auto pt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onclick={() => openBreakdown(t)}>
                  <PieChart class="w-3.5 h-3.5" />
                  Why this score
                </Button>
                <Button variant="outline" size="sm" onclick={() => openInviteModal(t)}>
                  <UserPlus class="w-3.5 h-3.5" />
                  Invite
                </Button>
              </div>
            </Card>
          </li>
        {:else}
          <li class="col-span-full">
            <EmptyState
              icon={Compass}
              title={activeFilterCount > 0 ? 'No teammates match these filters' : 'No teammates available'}
              description={activeFilterCount > 0
                ? 'Try widening the department or standing filter, or removing a skill.'
                : 'Everyone in the directory has turned off "open to projects" for now. Check back later.'}
            >
              {#snippet action()}
                {#if activeFilterCount > 0}
                  <Button variant="outline" size="sm" onclick={clearFilters}>Clear filters</Button>
                {/if}
              {/snippet}
            </EmptyState>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <Dialog bind:open={inviteDialogOpen} title="Send team invitation">
    {#if selectedUserForInvite}
      <form id="invite-form" onsubmit={handleSendInvite} class="flex flex-col gap-4">
        <div class="p-3 border border-border rounded-md flex gap-3 bg-muted/30 items-center">
          <Avatar src={selectedUserForInvite.avatar} name={selectedUserForInvite.name} size="md" />
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-foreground truncate">{selectedUserForInvite.name}</span>
            <span class="text-2xs text-muted-foreground truncate">{selectedUserForInvite.email}</span>
          </div>
        </div>

        <div class="field">
          <label for="inv-proj" class="field-label">Invite to project</label>
          <select id="inv-proj" bind:value={selectedProjectId} class="field-select">
            {#each myProjects as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <p class="field-hint">Only active projects you own can take new members.</p>
        </div>
      </form>
    {/if}

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (inviteDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="invite-form" variant="primary">Send invitation</Button>
    {/snippet}
  </Dialog>

  <Dialog
    bind:open={breakdownDialogOpen}
    title="Compatibility breakdown"
    description="How this match score was calculated."
  >
    {#if breakdownTarget && breakdown}
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
          <Avatar src={breakdownTarget.avatar} name={breakdownTarget.name} size="md" />
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-foreground truncate">{breakdownTarget.name}</span>
            <span class="text-2xs text-muted-foreground truncate">{breakdownTarget.department}</span>
          </div>
          <span class="ml-auto flex items-center gap-1.5 font-display text-xl text-foreground tabular">
            <Sparkles class="w-4 h-4 text-accent" aria-hidden="true" />
            {breakdown.total}%
          </span>
        </div>

        <dl class="flex flex-col text-xs">
          <div class="flex justify-between gap-4 py-2.5 border-b border-border">
            <dt class="font-semibold text-foreground">Base score</dt>
            <dd class="font-bold text-foreground tabular shrink-0">+{breakdown.base}</dd>
          </div>

          <div class="flex justify-between gap-4 py-2.5 border-b border-border">
            <dt class="font-semibold text-foreground">
              Department
              <span class="block font-normal text-muted-foreground mt-0.5">
                {breakdown.departmentMatch
                  ? `Both in ${breakdownTarget.department}`
                  : 'Different departments'}
              </span>
            </dt>
            <dd class="font-bold text-foreground tabular shrink-0">+{breakdown.departmentPoints}</dd>
          </div>

          <div class="flex justify-between gap-4 py-2.5 border-b border-border">
            <dt class="font-semibold text-foreground">
              Academic year
              <span class="block font-normal text-muted-foreground mt-0.5">
                {breakdown.yearMatch ? `Both ${breakdownTarget.academicYear}` : 'Different standing'}
              </span>
            </dt>
            <dd class="font-bold text-foreground tabular shrink-0">+{breakdown.yearPoints}</dd>
          </div>

          <div class="flex justify-between gap-4 py-2.5 border-b border-border">
            <dt class="font-semibold text-foreground min-w-0">
              Shared skills ({breakdown.commonSkills.length})
              {#if breakdown.commonSkills.length > 0}
                <span class="flex flex-wrap gap-1 mt-1.5">
                  {#each breakdown.commonSkills as s (s)}
                    <Badge variant="primary" size="sm">{s}</Badge>
                  {/each}
                </span>
              {:else}
                <span class="block font-normal text-muted-foreground mt-0.5">
                  No overlapping skills listed.
                </span>
              {/if}
            </dt>
            <dd class="font-bold text-foreground tabular shrink-0">+{breakdown.skillPoints}</dd>
          </div>

          <div class="flex justify-between gap-4 py-2.5">
            <dt class="font-semibold text-foreground min-w-0">
              Shared interests ({breakdown.commonInterests.length})
              {#if breakdown.commonInterests.length > 0}
                <span class="flex flex-wrap gap-1 mt-1.5">
                  {#each breakdown.commonInterests as i (i)}
                    <Badge variant="secondary" size="sm">{i}</Badge>
                  {/each}
                </span>
              {:else}
                <span class="block font-normal text-muted-foreground mt-0.5">
                  No overlapping interests listed.
                </span>
              {/if}
            </dt>
            <dd class="font-bold text-foreground tabular shrink-0">+{breakdown.interestPoints}</dd>
          </div>
        </dl>
      </div>
    {/if}

    {#snippet footer()}
      <Button variant="outline" onclick={() => (breakdownDialogOpen = false)}>Close</Button>
    {/snippet}
  </Dialog>
{/if}
