<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type User, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { page } from '$app/stores';
  import {
    calculateCompatibilityBreakdown,
    missingTeamSkills,
    type MatchContext
  } from '$lib/utils/compatibility';
  import { Search, Compass, UserPlus, Sparkles, X, SlidersHorizontal, Target } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import DossierCard from '$lib/components/DossierCard.svelte';

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
  /** Projects this student leads that are still forming: matching can target their skill gaps. */
  let ledProjects = $state<Project[]>([]);
  /** '' = general matching, otherwise a led project's id. */
  let matchFor = $state('');

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
    // The command palette links people here as ?q=<name>.
    const q = $page.url.searchParams.get('q');
    if (q) searchVal = q;
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      allUsers = db.getUsers().filter((u) => u.id !== auth.user!.id && u.role === 'student');
      myProjects = db.getProjects().filter((p) => p.ownerId === auth.user!.id && p.status === 'active');
      ledProjects = db
        .getProjects()
        .filter((p) => p.ownerId === auth.user!.id && (p.status === 'active' || p.status === 'pending'));
      if (myProjects.length > 0) {
        selectedProjectId = myProjects[0].id;
      }
    }
  }

  /** The team's missing required skills, when matching for a project. */
  const matchedProject = $derived(ledProjects.find((p) => p.id === matchFor));
  const context = $derived.by((): MatchContext | undefined => {
    const project = matchedProject;
    if (!project?.requiredSkills?.length) return undefined;
    const teamSkills = project.members.flatMap((m) => db.getUser(m.userId)?.skills ?? []);
    return { projectName: project.name, neededSkills: missingTeamSkills(project.requiredSkills, teamSkills) };
  });

  const breakdown = $derived(
    breakdownTarget && auth.user ? calculateCompatibilityBreakdown(auth.user, breakdownTarget, context) : null
  );

  function openBreakdown(user: User) {
    breakdownTarget = user;
    breakdownDialogOpen = true;
  }

  const teammates = $derived(
    allUsers
      .map((u) => {
        const breakdown = calculateCompatibilityBreakdown(auth.user!, u, context);
        return { ...u, breakdown, compatibility: breakdown.total };
      })
      .filter((u) => {
        const matchesSearch =
          u.name.toLowerCase().includes(searchVal.toLowerCase()) ||
          u.skills.some((s) => s.toLowerCase().includes(searchVal.toLowerCase()));
        const matchesDept = filterDept === 'All' || u.department === filterDept;
        const matchesYear = filterYear === 'All' || u.academicYear === filterYear;
        const matchesSkills = selectedSkills.length === 0 || selectedSkills.some((s) => u.skills.includes(s));
        // Matching for a team: people already on it (or invited) aren't candidates.
        const alreadyOnTeam = !!matchedProject?.members.some((m) => m.userId === u.id) || !!matchedProject?.pendingInvites.includes(u.id);
        return matchesSearch && matchesDept && matchesYear && matchesSkills && u.availability && !alreadyOnTeam;
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

  function openInviteModal(user: User) {
    if (myProjects.length === 0) {
      toast.warning('Only a team leader can invite — create a project (it must be approved) to lead a team.');
      return;
    }
    selectedUserForInvite = user;
    inviteDialogOpen = true;
  }

  function handleSendInvite(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedUserForInvite || !selectedProjectId) return;
    try {
      db.inviteToProject(selectedProjectId, selectedUserForInvite.email, auth.user ?? undefined);
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
  <title>Team Finder — Project-Sync</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Team Finder"
      icon={Compass}
      description="Classmates open to projects, ranked by the matching engine: common ground, the skill areas they add, and how well they fill your team's gaps."
    />

    {#if ledProjects.length > 0}
      <section
        aria-label="Matching target"
        class="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-lg border border-accent/30 bg-accent/6"
      >
        <label for="tf-for" class="flex items-center gap-2 text-xs font-bold text-foreground shrink-0">
          <Target class="w-4 h-4 text-accent" aria-hidden="true" />
          Match for
        </label>
        <select id="tf-for" bind:value={matchFor} class="field-select sm:w-72">
          <option value="">Me in general</option>
          {#each ledProjects as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
        <p class="text-2xs text-muted-foreground">
          {#if context && context.neededSkills.length > 0}
            Still needed: <span class="font-semibold text-foreground">{context.neededSkills.join(', ')}</span>
          {:else if context}
            Your team already covers every required skill.
          {:else}
            Ranked on your own profile.
          {/if}
        </p>
      </section>
    {/if}

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
            <DossierCard
              user={t}
              breakdown={t.breakdown}
              mySkills={auth.user.skills}
              neededSkills={context?.neededSkills ?? []}
              onbreakdown={() => openBreakdown(t)}
              oninvite={() => openInviteModal(t)}
            />
          </li>
        {:else}
          <li class="col-span-full">
            <EmptyState
              icon={Compass}
              title={activeFilterCount > 0 ? 'No teammates match these filters' : 'No teammates available'}
              description={activeFilterCount > 0
                ? 'Try widening the department or standing filter, or removing a skill.'
                : matchedProject
                  ? `Everyone open to projects is already on or invited to ${matchedProject.name}. Switch "Match for" to see the whole directory.`
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
          <Avatar src={selectedUserForInvite.avatar} userId={selectedUserForInvite.id} name={selectedUserForInvite.name} size="md" />
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
    size="lg"
  >
    {#if breakdownTarget && breakdown}
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
          <Avatar src={breakdownTarget.avatar} userId={breakdownTarget.id} name={breakdownTarget.name} size="md" />
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
          {#each breakdown.factors as f (f.key)}
            <div class="flex justify-between gap-4 py-2.5 border-b border-border last:border-b-0">
              <dt class="min-w-0">
                <span class="font-semibold text-foreground">{f.label}</span>
                <span class="block font-normal text-muted-foreground mt-0.5">{f.detail}</span>
                {#if f.key === 'common' && (breakdown.sharedSkills.length || breakdown.relatedSkills.length)}
                  <span class="flex flex-wrap gap-1 mt-1.5">
                    {#each breakdown.sharedSkills as s (s)}
                      <Badge variant="primary" size="sm">{s}</Badge>
                    {/each}
                    {#each breakdown.relatedSkills as r (r.theirs)}
                      <Badge variant="outline" size="sm" title="Related to your {r.mine}">{r.theirs} ≈ {r.mine}</Badge>
                    {/each}
                  </span>
                {:else if f.key === 'complement' && breakdown.newFamilies.length}
                  <span class="flex flex-wrap gap-1 mt-1.5">
                    {#each breakdown.newFamilies as fam (fam.family)}
                      <Badge variant="info" size="sm" title={fam.skills.join(', ')}>{fam.label}</Badge>
                    {/each}
                  </span>
                {:else if f.key === 'project' && breakdown.projectFit}
                  <span class="flex flex-wrap gap-1 mt-1.5">
                    {#each breakdown.projectFit.coverage as c (c.need)}
                      <Badge
                        variant={c.score === 1 ? 'success' : c.score > 0 ? 'warning' : 'outline'}
                        size="sm"
                        title={c.score === 1 ? 'Has this skill' : c.score > 0 ? `Related skill: ${c.by}` : 'Not covered'}
                      >
                        {c.need}{c.score > 0 && c.score < 1 ? ` ≈ ${c.by}` : ''}
                      </Badge>
                    {/each}
                  </span>
                {/if}
              </dt>
              <dd class="font-bold text-foreground tabular shrink-0">
                +{f.points}<span class="font-normal text-muted-foreground">/{f.max}</span>
              </dd>
            </div>
          {/each}
        </dl>
        <p class="text-2xs text-muted-foreground">
          The match is the points earned out of the points available{context ? '' : ' (no project fit when matching in general)'}.
          Related skills come from a skill graph: React and Svelte are both frontend, so each counts as half a match for the other.
        </p>
      </div>
    {/if}

    {#snippet footer()}
      <Button variant="outline" onclick={() => (breakdownDialogOpen = false)}>Close</Button>
    {/snippet}
  </Dialog>
{/if}
