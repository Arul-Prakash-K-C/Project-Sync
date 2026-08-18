<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type ProjectIdea } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    Plus,
    Search,
    Trash2,
    Pencil,
    Lightbulb,
    Eye,
    EyeOff,
    Users,
    Mail,
    Sparkles,
    AlertCircle,
    Info,
    X,
    SlidersHorizontal
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  // Navigation / Tabs
  let activeTab = $state<'explore' | 'my-ideas'>('explore');

  // Search & Filters
  let searchQuery = $state('');
  let selectedDomain = $state('All');
  let selectedSkills = $state<string[]>([]);
  let showAllSkills = $state(false);
  let loaded = $state(false);

  // Data list states
  let projectIdeas = $state<ProjectIdea[]>([]);

  const allSkills = $derived([...new Set(projectIdeas.flatMap((i) => i.requiredSkills))].sort());
  const visibleSkills = $derived(showAllSkills ? allSkills : allSkills.slice(0, 12));

  function toggleSkillFilter(skill: string) {
    selectedSkills = selectedSkills.includes(skill)
      ? selectedSkills.filter((s) => s !== skill)
      : [...selectedSkills, skill];
  }

  // Dialog management
  let formDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let submitting = $state(false);

  // Form states
  let title = $state('');
  let description = $state('');
  let domain = $state('Web Development');
  let teamSizeRequirement = $state(3);
  let visibility = $state<'public' | 'private'>('public');
  let skillsInput = $state('');
  let techInput = $state('');

  // Editing and Deleting Targets
  let activeIdea = $state<ProjectIdea | null>(null);
  let ideaIdToDelete = $state<string | null>(null);

  /** Create and edit shared every field, every validation rule and every helper
      line; they were two near-identical 130-line dialogs that had already begun
      to drift. One dialog in two modes keeps them honest. */
  const isEditing = $derived(activeIdea !== null);

  const domains = [
    'Web Development',
    'AI / Machine Learning',
    'Mobile Applications',
    'Blockchain / Cryptography',
    'Internet of Things (IoT)',
    'Cybersecurity',
    'Cloud / DevOps',
    'Data Analytics'
  ];

  onMount(() => {
    loadData();
    loaded = true;
  });

  function loadData() {
    projectIdeas = db.getProjectIdeas();
  }

  // Parses comma-separated values into clean arrays
  function parseCommaInput(val: string): string[] {
    return val
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  // Pre-fill form for editing
  function openEditModal(idea: ProjectIdea) {
    activeIdea = idea;
    title = idea.title;
    description = idea.description;
    domain = idea.domain;
    teamSizeRequirement = idea.teamSizeRequirement;
    visibility = idea.visibility;
    skillsInput = idea.requiredSkills.join(', ');
    techInput = idea.techStack.join(', ');
    formDialogOpen = true;
  }

  function openCreateModal() {
    activeIdea = null;
    title = '';
    description = '';
    domain = 'Web Development';
    teamSizeRequirement = 3;
    visibility = 'public';
    skillsInput = '';
    techInput = '';
    formDialogOpen = true;
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;

    submitting = true;
    try {
      const parsedSkills = parseCommaInput(skillsInput);
      const parsedTech = parseCommaInput(techInput);

      if (activeIdea) {
        db.updateProjectIdea(activeIdea.id, {
          title,
          description,
          domain,
          teamSizeRequirement,
          visibility,
          requiredSkills: parsedSkills,
          techStack: parsedTech
        });
        toast.success(`Project Idea "${title}" updated successfully!`);
      } else {
        db.createProjectIdea(
          title,
          description,
          parsedSkills,
          teamSizeRequirement,
          parsedTech,
          domain,
          visibility,
          auth.user
        );
        toast.success(`Project Idea "${title}" created successfully!`);
      }

      formDialogOpen = false;
      activeIdea = null;
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save project idea');
    } finally {
      submitting = false;
    }
  }

  function confirmDelete(id: string) {
    ideaIdToDelete = id;
    deleteDialogOpen = true;
  }

  function handleDelete() {
    if (!ideaIdToDelete) return;

    try {
      db.deleteProjectIdea(ideaIdToDelete);
      toast.success('Project idea deleted successfully');
      deleteDialogOpen = false;
      ideaIdToDelete = null;
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project idea');
    }
  }

  function handleConnect(idea: ProjectIdea) {
    toast.success(
      `Expressing interest in "${idea.title}". A notification has been sent to ${idea.ownerName}!`
    );
  }

  // Calculate skill compatibility dynamically
  function calculateCompatibility(idea: ProjectIdea): number {
    if (!auth.user) return 0;
    let score = 30; // base score

    if (idea.requiredSkills.length === 0) return 100;

    const matchedSkills = idea.requiredSkills.filter((s) =>
      auth.user!.skills.some((userSkill) => userSkill.toLowerCase() === s.trim().toLowerCase())
    );

    const skillRatio = matchedSkills.length / idea.requiredSkills.length;
    score += Math.min(skillRatio * 50, 50);

    const domainLower = idea.domain.toLowerCase();
    const matchesInterest = auth.user.interests.some(
      (interest) =>
        domainLower.includes(interest.toLowerCase()) || interest.toLowerCase().includes(domainLower)
    );
    if (matchesInterest) {
      score += 20;
    }

    return Math.round(Math.min(score, 100));
  }

  function matchesFilters(idea: ProjectIdea) {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      idea.title.toLowerCase().includes(q) ||
      idea.description.toLowerCase().includes(q) ||
      idea.requiredSkills.some((s) => s.toLowerCase().includes(q)) ||
      idea.techStack.some((t) => t.toLowerCase().includes(q));

    const matchesDomain = selectedDomain === 'All' || idea.domain === selectedDomain;
    const matchesSkills =
      selectedSkills.length === 0 || selectedSkills.some((s) => idea.requiredSkills.includes(s));

    return matchesSearch && matchesDomain && matchesSkills;
  }

  // Derived filtered arrays
  const exploreIdeas = $derived(
    projectIdeas.filter((idea) => {
      if (idea.visibility !== 'public' || (auth.user && idea.ownerId === auth.user.id)) {
        return false;
      }
      return matchesFilters(idea);
    })
  );

  const myIdeas = $derived(
    projectIdeas.filter((idea) => {
      if (!auth.user || idea.ownerId !== auth.user.id) {
        return false;
      }
      return matchesFilters(idea);
    })
  );

  const currentList = $derived(activeTab === 'explore' ? exploreIdeas : myIdeas);

  const exploreTotal = $derived(
    projectIdeas.filter((i) => i.visibility === 'public' && i.ownerId !== auth.user?.id).length
  );
  const myTotal = $derived(projectIdeas.filter((i) => i.ownerId === auth.user?.id).length);

  const activeFilterCount = $derived(
    (searchQuery ? 1 : 0) + (selectedDomain !== 'All' ? 1 : 0) + selectedSkills.length
  );

  function clearFilters() {
    searchQuery = '';
    selectedDomain = 'All';
    selectedSkills = [];
  }

  const parsedSkillPreview = $derived(parseCommaInput(skillsInput));
  const parsedTechPreview = $derived(parseCommaInput(techInput));
</script>

<svelte:head>
  <title>Project Ideas — TeamForge</title>
  <meta
    name="description"
    content="Students can publish project ideas, requirements, technology stacks, and domain details to attract compatible teammates and form final academic evaluation teams."
  />
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl" id="project-ideas-container">
    <PageHeader
      title="Project Idea Board"
      icon={Lightbulb}
      description="Publish a project sketch with its stack and team requirements, or browse what classmates are recruiting for."
    >
      {#snippet actions()}
        <Button variant="primary" onclick={openCreateModal}>
          <Plus class="w-4 h-4" />
          Create idea
        </Button>
      {/snippet}
    </PageHeader>

    <Tabs
      label="Idea board sections"
      variant="underline"
      items={[
        { value: 'explore', label: 'Explore ideas', badge: exploreTotal },
        { value: 'my-ideas', label: 'My ideas', badge: myTotal }
      ]}
      bind:active={activeTab}
    />

    <!-- Filters -->
    <section aria-label="Filters" class="flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-2.5">
        <div class="relative flex-1">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <label for="ideas-search-input" class="sr-only">Search ideas, skills or technologies</label>
          <input
            id="ideas-search-input"
            type="search"
            placeholder="Search ideas, skills, technologies…"
            bind:value={searchQuery}
            class="field-input field-icon"
          />
        </div>

        <label for="domain-filter-select" class="sr-only">Filter by domain</label>
        <select id="domain-filter-select" bind:value={selectedDomain} class="field-select sm:w-56">
          <option value="All">All domains</option>
          {#each domains as d (d)}
            <option value={d}>{d}</option>
          {/each}
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
          <span class="font-bold text-foreground tabular">{currentList.length}</span>
          idea{currentList.length === 1 ? '' : 's'} shown
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

    <!-- Ideas Grid -->
    {#if !loaded}
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4" aria-busy="true">
        {#each { length: 4 } as _, i (i)}
          <div class="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
            <div class="skeleton h-5 w-2/3"></div>
            <div class="skeleton h-3 w-full"></div>
            <div class="skeleton h-3 w-5/6"></div>
            <div class="skeleton h-8 w-full mt-4"></div>
          </div>
        {/each}
      </div>
    {:else}
      <ul class="grid grid-cols-1 xl:grid-cols-2 gap-4" id="ideas-grid-list">
        {#each currentList as idea (idea.id)}
          {@const score = calculateCompatibility(idea)}
          <li>
            <Card hoverable class="h-full flex flex-col">
              <div class="flex items-start gap-3.5">
                <span
                  class="w-11 h-11 rounded-md bg-warning/12 border border-warning/25 flex items-center
                    justify-center text-warning shrink-0"
                  aria-hidden="true"
                >
                  <Lightbulb class="w-5 h-5" />
                </span>

                <div class="flex-1 min-w-0">
                  <h2 class="text-base font-bold text-foreground leading-snug" title={idea.title}>
                    {idea.title}
                  </h2>
                  <p class="text-xs text-accent font-semibold mt-0.5 truncate">{idea.domain}</p>
                </div>

                <div class="shrink-0 text-right">
                  {#if activeTab === 'explore'}
                    <p class="eyebrow">Match</p>
                    <p class="font-display text-lg text-foreground tabular leading-none mt-1">{score}%</p>
                    <ProgressBar
                      class="mt-2 w-20"
                      value={score}
                      tone={score >= 75 ? 'success' : 'accent'}
                      size="sm"
                      label="Skill match for {idea.title}"
                    />
                  {:else}
                    <Badge variant={idea.visibility === 'public' ? 'success' : 'secondary'} size="sm">
                      {#if idea.visibility === 'public'}
                        <Eye class="w-3 h-3" aria-hidden="true" /> Public
                      {:else}
                        <EyeOff class="w-3 h-3" aria-hidden="true" /> Private
                      {/if}
                    </Badge>
                  {/if}
                </div>
              </div>

              <p class="text-xs text-muted-foreground mt-3.5 line-clamp-3 leading-relaxed">
                {idea.description}
              </p>

              <div class="flex flex-col gap-2 mt-4">
                <div class="flex flex-wrap gap-1.5 items-center">
                  <span class="eyebrow">Skills</span>
                  {#each idea.requiredSkills.slice(0, 3) as skill (skill)}
                    <Badge variant="primary" size="sm">{skill}</Badge>
                  {:else}
                    <span class="text-2xs text-muted-foreground">None specified</span>
                  {/each}
                  {#if idea.requiredSkills.length > 3}
                    <Badge variant="outline" size="sm">+{idea.requiredSkills.length - 3}</Badge>
                  {/if}
                </div>

                <div class="flex flex-wrap gap-1.5 items-center">
                  <span class="eyebrow">Stack</span>
                  {#each idea.techStack.slice(0, 3) as tech (tech)}
                    <Badge variant="info" size="sm">{tech}</Badge>
                  {:else}
                    <span class="text-2xs text-muted-foreground">None specified</span>
                  {/each}
                  {#if idea.techStack.length > 3}
                    <Badge variant="outline" size="sm">+{idea.techStack.length - 3}</Badge>
                  {/if}
                </div>
              </div>

              <div class="mt-auto pt-4 flex items-center justify-between gap-3">
                {#if activeTab === 'explore'}
                  <div class="flex items-center gap-2 min-w-0">
                    <Avatar src={idea.ownerAvatar} name={idea.ownerName} size="xs" class="rounded-full" />
                    <div class="min-w-0 leading-tight">
                      <p class="text-2xs font-bold text-foreground truncate">{idea.ownerName}</p>
                      <p class="text-3xs text-muted-foreground">
                        Needs {idea.teamSizeRequirement} teammate{idea.teamSizeRequirement === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => handleConnect(idea)}
                    id="btn-connect-idea-{idea.id}"
                    class="shrink-0"
                  >
                    <Mail class="w-3.5 h-3.5" />
                    Connect
                  </Button>
                {:else}
                  <p class="inline-flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                    <Users class="w-3.5 h-3.5" aria-hidden="true" />
                    {idea.teamSizeRequirement} teammate{idea.teamSizeRequirement === 1 ? '' : 's'} wanted
                  </p>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      onclick={() => openEditModal(idea)}
                      class="icon-action"
                      aria-label="Edit idea: {idea.title}"
                      id="btn-edit-idea-{idea.id}"
                    >
                      <Pencil class="w-4 h-4" />
                    </button>
                    <button
                      onclick={() => confirmDelete(idea.id)}
                      class="icon-action icon-action-danger"
                      aria-label="Delete idea: {idea.title}"
                      id="btn-delete-idea-{idea.id}"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                {/if}
              </div>
            </Card>
          </li>
        {:else}
          <li class="col-span-full">
            <EmptyState
              icon={Lightbulb}
              title={activeFilterCount > 0
                ? 'No ideas match these filters'
                : activeTab === 'explore'
                  ? 'No public ideas yet'
                  : 'You have not published an idea'}
              description={activeFilterCount > 0
                ? 'Try a different domain, drop a skill, or clear the search.'
                : activeTab === 'explore'
                  ? 'Nobody is recruiting on the public board right now. Publish your own idea and classmates can find you instead.'
                  : 'Publish a sketch of what you want to build — its domain, stack and how many teammates you need.'}
            >
              {#snippet action()}
                {#if activeFilterCount > 0}
                  <Button variant="outline" size="sm" onclick={clearFilters}>Clear filters</Button>
                {:else}
                  <Button variant="primary" size="sm" onclick={openCreateModal}>
                    <Plus class="w-3.5 h-3.5" />
                    Create idea
                  </Button>
                {/if}
              {/snippet}
            </EmptyState>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Create / edit share one dialog so the two forms cannot drift apart. -->
  <Dialog
    bind:open={formDialogOpen}
    size="lg"
    title={isEditing ? 'Modify project idea' : 'Publish project idea'}
    description={isEditing
      ? 'Changes are visible to anyone browsing the board straight away.'
      : 'Describe what you want to build and who you need to build it with.'}
    onclose={() => (activeIdea = null)}
  >
    <form id="idea-form" onsubmit={handleSubmit} class="flex flex-col gap-4">
      <div class="field">
        <label for="idea-title" class="field-label">Idea title</label>
        <input
          id="idea-title"
          type="text"
          placeholder="e.g. Smart Campus Parking Assistant"
          bind:value={title}
          required
          class="field-input"
        />
      </div>

      <div class="field">
        <label for="idea-desc" class="field-label">Detailed description</label>
        <textarea
          id="idea-desc"
          placeholder="Scope, objectives and deliverables…"
          bind:value={description}
          required
          rows="4"
          class="field-textarea"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="field">
          <label for="idea-domain" class="field-label">Domain</label>
          <select id="idea-domain" bind:value={domain} class="field-select">
            {#each domains as d (d)}
              <option value={d}>{d}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="idea-team-size" class="field-label">Teammates wanted</label>
          <input
            id="idea-team-size"
            type="number"
            min="1"
            max="10"
            bind:value={teamSizeRequirement}
            required
            class="field-input"
          />
        </div>
      </div>

      <div class="field">
        <label for="idea-skills" class="field-label">Required skills</label>
        <input
          id="idea-skills"
          type="text"
          placeholder="e.g. Svelte, Python, IoT"
          bind:value={skillsInput}
          aria-describedby="idea-skills-hint"
          class="field-input"
        />
        <p id="idea-skills-hint" class="field-hint">Separate with commas.</p>
        {#if parsedSkillPreview.length > 0}
          <div class="flex flex-wrap gap-1.5 mt-1">
            {#each parsedSkillPreview as skill (skill)}
              <Badge variant="primary" size="sm">{skill}</Badge>
            {/each}
          </div>
        {/if}
      </div>

      <div class="field">
        <label for="idea-tech" class="field-label">Tech stack</label>
        <input
          id="idea-tech"
          type="text"
          placeholder="e.g. OpenCV, Raspberry Pi"
          bind:value={techInput}
          aria-describedby="idea-tech-hint"
          class="field-input"
        />
        <p id="idea-tech-hint" class="field-hint">Separate with commas.</p>
        {#if parsedTechPreview.length > 0}
          <div class="flex flex-wrap gap-1.5 mt-1">
            {#each parsedTechPreview as tech (tech)}
              <Badge variant="info" size="sm">{tech}</Badge>
            {/each}
          </div>
        {/if}
      </div>

      <fieldset class="field border-0 p-0 m-0">
        <legend class="field-label p-0 mb-1.5">Visibility</legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            class="flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition-colors
              {visibility === 'public'
              ? 'border-accent bg-accent/8'
              : 'border-border hover:bg-secondary'}"
          >
            <input type="radio" name="visibility" value="public" bind:group={visibility} class="mt-0.5" />
            <span class="min-w-0">
              <span class="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Eye class="w-3.5 h-3.5 text-success" aria-hidden="true" />
                Public
              </span>
              <span class="block text-2xs text-muted-foreground mt-0.5">
                Listed on the board for everyone.
              </span>
            </span>
          </label>

          <label
            class="flex items-start gap-2.5 p-3 rounded-md border cursor-pointer transition-colors
              {visibility === 'private'
              ? 'border-accent bg-accent/8'
              : 'border-border hover:bg-secondary'}"
          >
            <input type="radio" name="visibility" value="private" bind:group={visibility} class="mt-0.5" />
            <span class="min-w-0">
              <span class="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <EyeOff class="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                Private
              </span>
              <span class="block text-2xs text-muted-foreground mt-0.5">
                Draft mode — only you can see it.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {#if !isEditing}
        <div
          class="p-3 bg-accent/8 border border-accent/25 text-foreground rounded-md flex gap-2.5 text-xs leading-relaxed"
        >
          <Info class="w-4 h-4 shrink-0 mt-0.5 text-accent" aria-hidden="true" />
          <span>
            Public ideas are searchable by other students, who can then express interest in joining
            your team.
          </span>
        </div>
      {/if}
    </form>

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (formDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="idea-form" variant="primary" loading={submitting}>
        {isEditing ? 'Save changes' : 'Publish proposal'}
      </Button>
    {/snippet}
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <Dialog bind:open={deleteDialogOpen} size="sm" title="Delete this project idea?">
    <div id="delete-confirmation-container" class="flex gap-3">
      <AlertCircle class="w-5 h-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
      <p class="text-sm text-muted-foreground leading-relaxed">
        This cannot be undone. The proposal is removed from the board and anyone who had it open will
        no longer see it.
      </p>
    </div>

    {#snippet footer()}
      <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
      <Button variant="danger" onclick={handleDelete}>Delete idea</Button>
    {/snippet}
  </Dialog>
{/if}
