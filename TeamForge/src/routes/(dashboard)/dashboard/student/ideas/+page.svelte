<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type ProjectIdea, type User } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Plus, Search, Filter, Trash2, Edit, Lightbulb, Eye, EyeOff, Users, 
    Check, Mail, Sparkles, AlertCircle, Info, ChevronRight, X 
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  // Navigation / Tabs
  let activeTab = $state<'explore' | 'my-ideas'>('explore');

  // Search & Filters
  let searchQuery = $state('');
  let selectedDomain = $state('All');
  let selectedSkills = $state<string[]>([]);

  // Data list states
  let projectIdeas = $state<ProjectIdea[]>([]);

  const allSkills = $derived([...new Set(projectIdeas.flatMap((i) => i.requiredSkills))].sort());

  function toggleSkillFilter(skill: string) {
    selectedSkills = selectedSkills.includes(skill)
      ? selectedSkills.filter((s) => s !== skill)
      : [...selectedSkills, skill];
  }

  // Dialog management
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);

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
  });

  function loadData() {
    projectIdeas = db.getProjectIdeas();
  }

  // Parses comma-separated values into clean arrays
  function parseCommaInput(val: string): string[] {
    return val
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
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
    editDialogOpen = true;
  }

  function openCreateModal() {
    title = '';
    description = '';
    domain = 'Web Development';
    teamSizeRequirement = 3;
    visibility = 'public';
    skillsInput = '';
    techInput = '';
    createDialogOpen = true;
  }

  function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;

    try {
      const parsedSkills = parseCommaInput(skillsInput);
      const parsedTech = parseCommaInput(techInput);

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
      createDialogOpen = false;
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project idea');
    }
  }

  function handleEdit(e: SubmitEvent) {
    e.preventDefault();
    if (!activeIdea) return;

    try {
      const parsedSkills = parseCommaInput(skillsInput);
      const parsedTech = parseCommaInput(techInput);

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
      editDialogOpen = false;
      activeIdea = null;
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project idea');
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
    toast.success(`Expressing interest in "${idea.title}". A notification has been sent to ${idea.ownerName}!`);
  }

  // Calculate skill compatibility dynamically
  function calculateCompatibility(idea: ProjectIdea): number {
    if (!auth.user) return 0;
    let score = 30; // base score
    
    if (idea.requiredSkills.length === 0) return 100;
    
    const matchedSkills = idea.requiredSkills.filter(s => 
      auth.user!.skills.some(userSkill => userSkill.toLowerCase() === s.trim().toLowerCase())
    );
    
    const skillRatio = matchedSkills.length / idea.requiredSkills.length;
    score += Math.min(skillRatio * 50, 50);

    const domainLower = idea.domain.toLowerCase();
    const matchesInterest = auth.user.interests.some(interest => 
      domainLower.includes(interest.toLowerCase()) || interest.toLowerCase().includes(domainLower)
    );
    if (matchesInterest) {
      score += 20;
    }
    
    return Math.round(Math.min(score, 100));
  }

  // Derived filtered arrays
  const exploreIdeas = $derived(
    projectIdeas.filter(idea => {
      if (idea.visibility !== 'public' || (auth.user && idea.ownerId === auth.user.id)) {
        return false;
      }
      
      const matchesSearch = idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            idea.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            idea.requiredSkills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            idea.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDomain = selectedDomain === 'All' || idea.domain === selectedDomain;
      const matchesSkills = selectedSkills.length === 0 || selectedSkills.some((s) => idea.requiredSkills.includes(s));

      return matchesSearch && matchesDomain && matchesSkills;
    })
  );

  const myIdeas = $derived(
    projectIdeas.filter(idea => {
      if (!auth.user || idea.ownerId !== auth.user.id) {
        return false;
      }

      const matchesSearch = idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            idea.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            idea.requiredSkills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            idea.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDomain = selectedDomain === 'All' || idea.domain === selectedDomain;
      const matchesSkills = selectedSkills.length === 0 || selectedSkills.some((s) => idea.requiredSkills.includes(s));

      return matchesSearch && matchesDomain && matchesSkills;
    })
  );

  const currentList = $derived(activeTab === 'explore' ? exploreIdeas : myIdeas);
</script>

<svelte:head>
  <title>Project Idea Management - TeamForge</title>
  <meta name="description" content="Students can publish project ideas, requirements, technology stacks, and domain details to attract compatible teammates and form final academic evaluation teams." />
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6" id="project-ideas-container">
    
    <!-- Hero Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Lightbulb class="w-7 h-7 text-amber-500 fill-amber-500/10" />
          Project Idea Board
        </h2>
        <p class="text-sm text-muted-foreground mt-1">Publish project sketches, target tech stacks, and team requirements to gather your ideal project peers.</p>
      </div>
      <Button variant="primary" onclick={openCreateModal} class="group cursor-pointer">
        <Plus class="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
        Create Project Idea
      </Button>
    </div>

    <!-- Sub-navigation & Search & Filter panel -->
    <div class="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
      
      <!-- Custom Tabs -->
      <div class="flex p-1 rounded-xl bg-secondary/50 border border-border max-w-md w-full lg:w-80">
        <button 
          onclick={() => activeTab = 'explore'}
          class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex justify-center items-center gap-1.5
            {activeTab === 'explore' ? 'bg-card text-foreground shadow-xs border' : 'text-muted-foreground hover:text-foreground'}"
          id="tab-explore"
        >
          Explore Ideas
          <Badge variant={activeTab === 'explore' ? 'primary' : 'outline'} class="text-3xs px-1.5 py-0">
            {projectIdeas.filter(idea => idea.visibility === 'public' && idea.ownerId !== auth.user!.id).length}
          </Badge>
        </button>
        <button 
          onclick={() => activeTab = 'my-ideas'}
          class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex justify-center items-center gap-1.5
            {activeTab === 'my-ideas' ? 'bg-card text-foreground shadow-xs border' : 'text-muted-foreground hover:text-foreground'}"
          id="tab-my-ideas"
        >
          My Ideas
          <Badge variant={activeTab === 'my-ideas' ? 'primary' : 'outline'} class="text-3xs px-1.5 py-0">
            {projectIdeas.filter(idea => idea.ownerId === auth.user!.id).length}
          </Badge>
        </button>
      </div>

      <!-- Filters Row -->
      <div class="flex flex-col sm:flex-row gap-3 flex-1 lg:max-w-2xl justify-end">
        <!-- Search -->
        <div class="relative flex-1">
          <span class="absolute left-3 top-3 text-muted-foreground">
            <Search class="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Search ideas, skills, technologies..." 
            bind:value={searchQuery}
            class="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            id="ideas-search-input"
          />
        </div>

        <!-- Domain Selection -->
        <div class="relative shrink-0 min-w-48">
          <select 
            bind:value={selectedDomain}
            class="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
            id="domain-filter-select"
          >
            <option value="All">All Domains</option>
            {#each domains as d}
              <option value={d}>{d}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

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

    <!-- Ideas Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6" id="ideas-grid-list">
      {#each currentList as idea (idea.id)}
        <Card hoverable class="p-6 flex flex-col justify-between relative overflow-hidden h-80 min-h-80">
          
          <!-- Compatibility Meter or Visibility Indicator -->
          <div class="absolute right-0 top-0 pt-4 pr-5 flex flex-col items-end">
            {#if activeTab === 'explore'}
              <span class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Match Score</span>
              <div class="flex items-center gap-1.5 mt-1 font-extrabold text-sm text-foreground bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
                <Sparkles class="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                {calculateCompatibility(idea)}% Match
              </div>
            {:else}
              {#if idea.visibility === 'public'}
                <Badge variant="success" class="flex items-center gap-1">
                  <Eye class="w-3 h-3" />
                  Public
                </Badge>
              {:else}
                <Badge variant="secondary" class="flex items-center gap-1 bg-muted/40">
                  <EyeOff class="w-3 h-3 text-muted-foreground" />
                  Private
                </Badge>
              {/if}
            {/if}
          </div>

          <!-- Card Header & Description -->
          <div>
            <div class="flex gap-4">
              <!-- Avatar or Bulb -->
              <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Lightbulb class="w-6 h-6" />
              </div>
              <div class="flex flex-col min-w-0 pr-28">
                <span class="font-extrabold text-foreground text-base truncate" title={idea.title}>{idea.title}</span>
                <span class="text-xs text-primary font-semibold truncate mt-0.5">{idea.domain}</span>
              </div>
            </div>

            <p class="text-xs text-muted-foreground mt-4 line-clamp-3 leading-relaxed min-h-[4.5rem]">
              {idea.description}
            </p>
          </div>

          <!-- Tech Stacks and Skills Required -->
          <div class="mt-4 flex flex-col gap-2">
            <div class="flex flex-wrap gap-1 items-center">
              <span class="text-3xs font-extrabold text-muted-foreground uppercase mr-1">Skills:</span>
              {#each idea.requiredSkills.slice(0, 3) as skill}
                <Badge variant="primary" class="text-3xs px-2 py-0">
                  {skill}
                </Badge>
              {:else}
                <span class="text-3xs text-muted-foreground">None specified</span>
              {/each}
              {#if idea.requiredSkills.length > 3}
                <span class="text-3xs text-muted-foreground font-semibold">+{idea.requiredSkills.length - 3} more</span>
              {/if}
            </div>

            <div class="flex flex-wrap gap-1 items-center">
              <span class="text-3xs font-extrabold text-muted-foreground uppercase mr-1">Tech:</span>
              {#each idea.techStack.slice(0, 3) as tech}
                <Badge variant="outline" class="text-3xs px-2 py-0 border-primary/20 text-primary">
                  {tech}
                </Badge>
              {:else}
                <span class="text-3xs text-muted-foreground">None specified</span>
              {/each}
              {#if idea.techStack.length > 3}
                <span class="text-3xs text-muted-foreground font-semibold">+{idea.techStack.length - 3} more</span>
              {/if}
            </div>
          </div>

          <!-- Card Footer Action Panel -->
          <div class="mt-6 pt-4 border-t border-border flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              {#if activeTab === 'explore'}
                <img 
                  src={idea.ownerAvatar} 
                  alt={idea.ownerName} 
                  class="w-7 h-7 rounded-full bg-muted border border-border"
                />
                <div class="flex flex-col">
                  <span class="text-[11px] font-bold text-foreground leading-none">{idea.ownerName}</span>
                  <span class="text-[9px] text-muted-foreground mt-0.5">Author</span>
                </div>
              {:else}
                <div class="flex items-center gap-1 text-muted-foreground">
                  <Users class="w-3.5 h-3.5" />
                  <span class="text-2xs font-bold">Team Requirement: {idea.teamSizeRequirement} peers</span>
                </div>
              {/if}
            </div>

            <div class="flex items-center gap-2">
              {#if activeTab === 'my-ideas'}
                <button 
                  onclick={() => openEditModal(idea)}
                  class="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-xl transition-all cursor-pointer"
                  title="Edit Idea"
                  id="btn-edit-idea-{idea.id}"
                >
                  <Edit class="w-4 h-4" />
                </button>
                <button 
                  onclick={() => confirmDelete(idea.id)}
                  class="p-2 border border-rose-500/20 text-rose-500 hover:text-white hover:bg-rose-500 rounded-xl transition-all cursor-pointer"
                  title="Delete Idea"
                  id="btn-delete-idea-{idea.id}"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              {:else}
                <div class="flex items-center gap-1.5 text-muted-foreground pr-2">
                  <Users class="w-3.5 h-3.5" />
                  <span class="text-2xs font-bold">{idea.teamSizeRequirement} positions</span>
                </div>
                <Button variant="outline" size="sm" onclick={() => handleConnect(idea)} class="cursor-pointer" id="btn-connect-idea-{idea.id}">
                  <Mail class="w-3.5 h-3.5" />
                  Connect
                </Button>
              {/if}
            </div>
          </div>

        </Card>
      {:else}
        <div class="col-span-full py-16 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center bg-card/10">
          <Lightbulb class="w-14 h-14 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-muted-foreground">No project ideas found</p>
          <p class="text-xs text-muted-foreground/60 max-w-xs mt-1">Try tweaking your search keywords, changing the domain filter, or launch your own project idea proposal.</p>
        </div>
      {/each}
    </div>

  </div>

  <!-- Create Idea Dialog -->
  <Dialog bind:open={createDialogOpen} title="Publish Project Idea" class="max-w-xl">
    <form onsubmit={handleCreate} class="flex flex-col gap-4" id="create-idea-form">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Title -->
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <label for="idea-title" class="text-xs font-semibold text-foreground">Idea Title</label>
          <input 
            id="idea-title"
            type="text" 
            placeholder="e.g. Smart Campus Parking Assistant" 
            bind:value={title} 
            required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <label for="idea-desc" class="text-xs font-semibold text-foreground">Detailed Description</label>
          <textarea 
            id="idea-desc"
            placeholder="Provide a detailed description of the project, including scope, objectives, and deliverables..." 
            bind:value={description} 
            required
            rows="4"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          ></textarea>
        </div>

        <!-- Domain Selection -->
        <div class="flex flex-col gap-1.5">
          <label for="idea-domain" class="text-xs font-semibold text-foreground">Domain</label>
          <select 
            id="idea-domain"
            bind:value={domain}
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
          >
            {#each domains as d}
              <option value={d}>{d}</option>
            {/each}
          </select>
        </div>

        <!-- Team Size Requirement -->
        <div class="flex flex-col gap-1.5">
          <label for="idea-team-size" class="text-xs font-semibold text-foreground">Target Team Size (Peers)</label>
          <input 
            id="idea-team-size"
            type="number" 
            min="1" 
            max="10"
            bind:value={teamSizeRequirement} 
            required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <!-- Required Skills -->
        <div class="flex flex-col gap-1.5">
          <label for="idea-skills" class="text-xs font-semibold text-foreground">Required Skills (Comma separated)</label>
          <input 
            id="idea-skills"
            type="text" 
            placeholder="e.g. Svelte, Python, IoT" 
            bind:value={skillsInput} 
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {#if parseCommaInput(skillsInput).length > 0}
            <div class="flex flex-wrap gap-1 mt-1">
              {#each parseCommaInput(skillsInput) as skill}
                <Badge variant="primary" class="text-3xs">{skill}</Badge>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Tech Stack -->
        <div class="flex flex-col gap-1.5">
          <label for="idea-tech" class="text-xs font-semibold text-foreground">Tech Stack (Comma separated)</label>
          <input 
            id="idea-tech"
            type="text" 
            placeholder="e.g. OpenCV, Raspberry Pi" 
            bind:value={techInput} 
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {#if parseCommaInput(techInput).length > 0}
            <div class="flex flex-wrap gap-1 mt-1">
              {#each parseCommaInput(techInput) as tech}
                <Badge variant="outline" class="text-3xs text-primary">{tech}</Badge>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Visibility Selection -->
        <fieldset class="flex flex-col gap-1.5 md:col-span-2 border-0 p-0 m-0">
          <legend class="text-xs font-semibold text-foreground p-0">Project Visibility</legend>
          <div class="flex gap-4 mt-1">
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                bind:group={visibility}
                class="accent-primary"
              />
              <span class="flex items-center gap-1 font-medium">
                <Eye class="w-4 h-4 text-emerald-500" />
                Public (Show on board for everyone)
              </span>
            </label>
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="private"
                bind:group={visibility}
                class="accent-primary"
              />
              <span class="flex items-center gap-1 font-medium">
                <EyeOff class="w-4 h-4 text-muted-foreground" />
                Private (Draft mode, only you can see it)
              </span>
            </label>
          </div>
        </fieldset>

      </div>

      <!-- Info Alert -->
      <div class="p-3 bg-primary/5 border border-primary/20 text-primary dark:text-primary-foreground/90 rounded-xl flex gap-2.5 text-xs mt-2">
        <Info class="w-4 h-4 shrink-0 mt-0.5" />
        <span>Publishing public ideas lets other students search for them and express interest in joining your team.</span>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => createDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Publish Proposal</Button>
      </div>
    </form>
  </Dialog>

  <!-- Edit Idea Dialog -->
  <Dialog bind:open={editDialogOpen} title="Modify Project Idea" class="max-w-xl">
    <form onsubmit={handleEdit} class="flex flex-col gap-4" id="edit-idea-form">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Title -->
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <label for="edit-idea-title" class="text-xs font-semibold text-foreground">Idea Title</label>
          <input 
            id="edit-idea-title"
            type="text" 
            placeholder="e.g. Smart Campus Parking Assistant" 
            bind:value={title} 
            required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1.5 md:col-span-2">
          <label for="edit-idea-desc" class="text-xs font-semibold text-foreground">Detailed Description</label>
          <textarea 
            id="edit-idea-desc"
            placeholder="Provide a detailed description of the project, including scope, objectives, and deliverables..." 
            bind:value={description} 
            required
            rows="4"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          ></textarea>
        </div>

        <!-- Domain Selection -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-idea-domain" class="text-xs font-semibold text-foreground">Domain</label>
          <select 
            id="edit-idea-domain"
            bind:value={domain}
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
          >
            {#each domains as d}
              <option value={d}>{d}</option>
            {/each}
          </select>
        </div>

        <!-- Team Size Requirement -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-idea-team-size" class="text-xs font-semibold text-foreground">Target Team Size (Peers)</label>
          <input 
            id="edit-idea-team-size"
            type="number" 
            min="1" 
            max="10"
            bind:value={teamSizeRequirement} 
            required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <!-- Required Skills -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-idea-skills" class="text-xs font-semibold text-foreground">Required Skills (Comma separated)</label>
          <input 
            id="edit-idea-skills"
            type="text" 
            placeholder="e.g. Svelte, Python, IoT" 
            bind:value={skillsInput} 
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {#if parseCommaInput(skillsInput).length > 0}
            <div class="flex flex-wrap gap-1 mt-1">
              {#each parseCommaInput(skillsInput) as skill}
                <Badge variant="primary" class="text-3xs">{skill}</Badge>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Tech Stack -->
        <div class="flex flex-col gap-1.5">
          <label for="edit-idea-tech" class="text-xs font-semibold text-foreground">Tech Stack (Comma separated)</label>
          <input 
            id="edit-idea-tech"
            type="text" 
            placeholder="e.g. OpenCV, Raspberry Pi" 
            bind:value={techInput} 
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {#if parseCommaInput(techInput).length > 0}
            <div class="flex flex-wrap gap-1 mt-1">
              {#each parseCommaInput(techInput) as tech}
                <Badge variant="outline" class="text-3xs text-primary">{tech}</Badge>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Visibility Selection -->
        <fieldset class="flex flex-col gap-1.5 md:col-span-2 border-0 p-0 m-0">
          <legend class="text-xs font-semibold text-foreground p-0">Project Visibility</legend>
          <div class="flex gap-4 mt-1">
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="edit-visibility"
                value="public"
                bind:group={visibility}
                class="accent-primary"
              />
              <span class="flex items-center gap-1 font-medium">
                <Eye class="w-4 h-4 text-emerald-500" />
                Public (Show on board for everyone)
              </span>
            </label>
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="edit-visibility"
                value="private"
                bind:group={visibility}
                class="accent-primary"
              />
              <span class="flex items-center gap-1 font-medium">
                <EyeOff class="w-4 h-4 text-muted-foreground" />
                Private (Draft mode, only you can see it)
              </span>
            </label>
          </div>
        </fieldset>

      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => editDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">Save Changes</Button>
      </div>
    </form>
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <Dialog bind:open={deleteDialogOpen} title="Confirm Deletion">
    <div class="flex flex-col gap-4" id="delete-confirmation-container">
      <div class="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl">
        <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
        <div class="flex flex-col">
          <span class="text-xs font-bold">Are you absolutely sure?</span>
          <span class="text-2xs mt-1">This action cannot be undone. The project idea proposal will be permanently removed from the system.</span>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="outline" onclick={() => deleteDialogOpen = false}>Cancel</Button>
        <Button variant="danger" onclick={handleDelete}>Delete Idea</Button>
      </div>
    </div>
  </Dialog>
{/if}
