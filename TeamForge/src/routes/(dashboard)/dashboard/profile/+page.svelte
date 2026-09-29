<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type ProfilePatch, type User } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    Camera,
    Save,
    CircleUser,
    CodeXml,
    Briefcase,
    Globe,
    Clock,
    MapPin,
    Lock,
    Check,
    Circle,
    Users
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import SkillInput from '$lib/components/ui/SkillInput.svelte';
  import AvatarPicker from '$lib/components/AvatarPicker.svelte';

  /*
    One profile page for every role. Everyone edits their picture, bio,
    pronouns and links; students add their academic standing, skills,
    interests and past projects (what Team Finder matches on); faculty add
    their title, office hours, areas of expertise and whether they are taking
    new mentees (what students see when they choose a mentor); admins add a
    title. Name, email and role are identity: only an administrator changes them.
  */

  const role = $derived(auth.user?.role ?? 'student');

  let bio = $state('');
  let pronouns = $state('');
  let github = $state('');
  let linkedin = $state('');
  let portfolio = $state('');
  // Student
  let department = $state('');
  let academicYear = $state('Year 1');
  let availability = $state(true);
  let skills = $state<string[]>([]);
  let interests = $state<string[]>([]);
  let previousProjects = $state<string[]>([]);
  // Faculty and admin
  let designation = $state('');
  let officeHours = $state('');
  let officeLocation = $state('');
  let maxMentees = $state<number | null>(null);

  let saving = $state(false);
  let pickerOpen = $state(false);
  let baseline = $state('');

  const departments = db.getDepartments();

  /** Skills already used on the platform plus a starter library, so spellings converge. */
  const skillSuggestions = $derived.by(() => {
    const library =
      role === 'faculty'
        ? ['Research Supervision', 'Machine Learning', 'Software Architecture', 'Distributed Systems', 'Human-Computer Interaction', 'Data Science', 'Cybersecurity', 'Quality Assurance', 'DevOps', 'Algorithms']
        : ['Svelte', 'React', 'TypeScript', 'Node.js', 'Python', 'SQL', 'Docker', 'Figma', 'Git', 'Machine Learning', 'Java', 'Go', 'Flutter', 'AWS', 'UI/UX Design'];
    const used = db.getUsers().filter((u) => u.role === role).flatMap((u) => u.skills);
    return [...new Set([...library, ...used])].sort((a, b) => a.localeCompare(b));
  });
  const interestSuggestions = $derived(
    [...new Set(db.getUsers().flatMap((u) => u.interests))].sort((a, b) => a.localeCompare(b))
  );

  const load = $derived(auth.user && role === 'faculty' ? db.mentorLoad({ ...auth.user, availability, maxMentees: maxMentees ?? undefined }) : null);

  function snapshot() {
    return JSON.stringify({
      bio, pronouns, github, linkedin, portfolio, department, academicYear, availability,
      skills, interests, previousProjects, designation, officeHours, officeLocation, maxMentees
    });
  }
  const dirty = $derived(baseline !== '' && snapshot() !== baseline);

  function fill(u: User) {
    bio = u.bio ?? '';
    pronouns = u.pronouns ?? '';
    github = u.links?.github ?? '';
    linkedin = u.links?.linkedin ?? '';
    portfolio = u.links?.portfolio ?? '';
    department = u.department;
    academicYear = u.academicYear ?? 'Year 1';
    availability = u.availability ?? true;
    skills = [...u.skills];
    interests = [...u.interests];
    previousProjects = [...(u.previousProjects ?? [])];
    designation = u.designation ?? '';
    officeHours = u.officeHours ?? '';
    officeLocation = u.officeLocation ?? '';
    maxMentees = u.maxMentees ?? null;
    baseline = snapshot();
  }

  onMount(() => {
    if (auth.user) fill(db.getUser(auth.user.id) ?? auth.user);
  });

  // Leaving with unsaved edits asks first.
  onMount(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });

  function buildPatch(): ProfilePatch {
    const common: ProfilePatch = { bio, pronouns, links: { github, linkedin, portfolio } };
    if (role === 'student') {
      return { ...common, department, academicYear, availability, skills, interests, previousProjects };
    }
    if (role === 'faculty') {
      return {
        ...common,
        designation,
        officeHours,
        officeLocation,
        availability,
        skills,
        interests,
        ...(maxMentees !== null ? { maxMentees } : {})
      };
    }
    return { ...common, designation };
  }

  function handleSave(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;
    saving = true;
    try {
      const saved = db.updateOwnProfile(auth.user.id, buildPatch());
      auth.refreshUser();
      fill(saved);
      toast.success('Profile saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      saving = false;
    }
  }

  function saveAvatar(avatar: string) {
    if (!auth.user) return;
    db.updateOwnProfile(auth.user.id, { avatar });
    auth.refreshUser();
    toast.success(avatar ? 'Profile picture updated' : 'Showing your initials');
  }

  /** What makes this role's profile useful to others, as a checklist. */
  const checklist = $derived.by(() => {
    const items = [
      { label: 'Profile picture', done: !!auth.user?.avatar },
      { label: 'Bio', done: bio.trim().length >= 20 },
      { label: 'A profile link', done: !!(github || linkedin || portfolio) }
    ];
    if (role === 'student') {
      items.push(
        { label: 'At least 3 skills', done: skills.length >= 3 },
        { label: 'At least 2 interests', done: interests.length >= 2 },
        { label: 'A past project', done: previousProjects.length > 0 }
      );
    } else if (role === 'faculty') {
      items.push(
        { label: 'Title', done: !!designation.trim() },
        { label: 'Office hours', done: !!officeHours.trim() },
        { label: 'Areas of expertise', done: skills.length >= 2 }
      );
    } else {
      items.push({ label: 'Title', done: !!designation.trim() });
    }
    return items;
  });
  const strength = $derived(Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100));

  const roleLabel = { student: 'Student', faculty: 'Faculty', admin: 'Administrator' } as const;
  const bioMax = 600;
</script>

<svelte:head>
  <title>My Profile — Project-Sync</title>
</svelte:head>

{#if auth.user}
  <div class="max-w-5xl flex flex-col gap-6 pb-24">
    <PageHeader
      title="My profile"
      icon={CircleUser}
      description={role === 'student'
        ? 'Your standing, skills and interests are exactly what the matching engine reads. Keep them current for better teammates.'
        : role === 'faculty'
          ? 'Students see your title, expertise and mentoring availability when they choose a mentor for their project.'
          : 'How you appear to the students and faculty you support.'}
    />

    <!-- Identity plate: picture, identity, how complete the profile is. -->
    <Card variant="ember" class="grid md:grid-cols-[auto_1fr_16rem] gap-6 items-center">
      <button
        type="button"
        onclick={() => (pickerOpen = true)}
        class="group relative w-24 h-24 rounded-full cursor-pointer justify-self-center md:justify-self-start"
        aria-label="Change profile picture"
      >
        <Avatar src={auth.user.avatar} userId={auth.user.id} name={auth.user.name} size="xl" class="rounded-full! w-24! h-24!" />
        <span
          class="absolute inset-0 rounded-full bg-black/45 text-white flex flex-col items-center justify-center gap-1 text-3xs font-bold uppercase tracking-wider
            opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
          aria-hidden="true"
        >
          <Camera class="w-5 h-5" />
          Change
        </span>
        <span class="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-accent text-accent-foreground border-2 border-card flex items-center justify-center" aria-hidden="true">
          <Camera class="w-3.5 h-3.5" />
        </span>
      </button>

      <div class="min-w-0 text-center md:text-left">
        <p class="font-display text-2xl text-foreground truncate">{auth.user.name}</p>
        <p class="text-xs text-muted-foreground truncate mt-0.5">
          {designation || roleLabel[role]}{pronouns ? ` · ${pronouns}` : ''} · {auth.user.department}
        </p>
        <div class="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-3">
          <Badge variant="primary" size="sm">{roleLabel[role]}</Badge>
          {#if role === 'student'}
            <Badge variant={availability ? 'success' : 'secondary'} dot size="sm">
              {availability ? 'Open to projects' : 'Not looking right now'}
            </Badge>
          {:else if role === 'faculty' && load}
            <Badge variant={load.open ? 'success' : 'secondary'} dot size="sm">
              {load.open ? 'Accepting mentees' : availability ? 'At mentee limit' : 'Not taking mentees'}
            </Badge>
          {/if}
          {#each [{ url: github, icon: CodeXml, label: 'GitHub' }, { url: linkedin, icon: Briefcase, label: 'LinkedIn' }, { url: portfolio, icon: Globe, label: 'Portfolio' }] as l (l.label)}
            {#if l.url}
              <a href={l.url} target="_blank" rel="noopener noreferrer" class="icon-action w-7! h-7!" aria-label="{l.label} (opens in a new tab)" title={l.label}>
                <l.icon class="w-3.5 h-3.5" />
              </a>
            {/if}
          {/each}
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <p class="eyebrow">Profile strength</p>
          <p class="font-display text-lg text-foreground tabular">{strength}%</p>
        </div>
        <div class="h-1.5 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
          <div class="h-full rounded-full transition-[width] duration-700" style="width: {strength}%; background: linear-gradient(90deg, var(--ember), var(--ember-hot))"></div>
        </div>
        <ul class="flex flex-col gap-1 mt-1">
          {#each checklist as c (c.label)}
            <li class="flex items-center gap-1.5 text-2xs {c.done ? 'text-muted-foreground' : 'text-foreground font-semibold'}">
              {#if c.done}<Check class="w-3 h-3 text-success" aria-hidden="true" />{:else}<Circle class="w-3 h-3 text-muted-foreground" aria-hidden="true" />{/if}
              {c.label}<span class="sr-only">{c.done ? ' (done)' : ' (to do)'}</span>
            </li>
          {/each}
        </ul>
      </div>
    </Card>

    <form id="profile-form" onsubmit={handleSave} class="grid lg:grid-cols-[1fr_20rem] gap-4 items-start">
      <div class="flex flex-col gap-4 min-w-0">
        <Card title="About you" description="Shown on your profile card{role === 'student' ? ' in Team Finder' : role === 'faculty' ? ' when students choose a mentor' : ''}.">
          <div class="grid sm:grid-cols-2 gap-4">
            {#if role !== 'student'}
              <div class="field">
                <label for="p-title" class="field-label">Title</label>
                <input id="p-title" class="field-input" bind:value={designation} maxlength="80" placeholder={role === 'faculty' ? 'e.g. Associate Professor' : 'e.g. Platform administrator'} />
              </div>
            {/if}
            <div class="field">
              <label for="p-pronouns" class="field-label">Pronouns <span class="text-muted-foreground font-normal">(optional)</span></label>
              <input id="p-pronouns" class="field-input" bind:value={pronouns} maxlength="30" placeholder="e.g. she/her, they/them" />
            </div>
          </div>

          <div class="field mt-4">
            <div class="flex items-baseline justify-between">
              <label for="p-bio" class="field-label">{role === 'student' ? 'Bio / elevator pitch' : 'Bio'}</label>
              <span class="text-3xs tabular {bio.length > bioMax - 40 ? 'text-warning' : 'text-muted-foreground'}">{bio.length}/{bioMax}</span>
            </div>
            <textarea
              id="p-bio"
              bind:value={bio}
              rows="4"
              maxlength={bioMax}
              class="field-textarea"
              placeholder={role === 'student'
                ? 'What you like building, and the kind of team you want to join…'
                : role === 'faculty'
                  ? 'Your research, the projects you enjoy mentoring, how you like to work with teams…'
                  : 'What you look after on the platform…'}
            ></textarea>
          </div>
        </Card>

        {#if role === 'student'}
          <Card title="Skills" description="The matching engine groups these into areas, so related skills (React and Svelte) still count towards a match.">
            <SkillInput id="p-skills" bind:skills suggestions={skillSuggestions} placeholder="Type a skill and press Enter" />
          </Card>
          <Card title="Interests" description="Shared interests add up to 10 points and drive project-idea matches.">
            <SkillInput id="p-interests" bind:skills={interests} suggestions={interestSuggestions} placeholder="e.g. FinTech, Game Dev" />
          </Card>
          <Card title="Past projects" description="Shown on your dossier in Team Finder.">
            <SkillInput id="p-projects" bind:skills={previousProjects} placeholder="Project name, then Enter" />
          </Card>
        {:else if role === 'faculty'}
          <Card title="Areas of expertise" description="Listed under your name when students pick a mentor.">
            <SkillInput id="p-skills" bind:skills suggestions={skillSuggestions} placeholder="e.g. Distributed Systems" />
          </Card>
          <Card title="Research interests">
            <SkillInput id="p-interests" bind:skills={interests} suggestions={interestSuggestions} placeholder="e.g. AI Ethics" />
          </Card>
        {/if}

        <Card title="Links" description="Full https:// addresses. They open in a new tab from your profile.">
          <div class="flex flex-col gap-3">
            {#each [{ id: 'github', label: 'GitHub', icon: CodeXml, ph: 'https://github.com/you' }, { id: 'linkedin', label: 'LinkedIn', icon: Briefcase, ph: 'https://linkedin.com/in/you' }, { id: 'portfolio', label: 'Portfolio or website', icon: Globe, ph: 'https://you.dev' }] as l (l.id)}
              <div class="field">
                <label for="p-{l.id}" class="field-label">{l.label}</label>
                <div class="relative">
                  <l.icon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  {#if l.id === 'github'}
                    <input id="p-github" type="url" class="field-input field-icon" bind:value={github} placeholder={l.ph} />
                  {:else if l.id === 'linkedin'}
                    <input id="p-linkedin" type="url" class="field-input field-icon" bind:value={linkedin} placeholder={l.ph} />
                  {:else}
                    <input id="p-portfolio" type="url" class="field-input field-icon" bind:value={portfolio} placeholder={l.ph} />
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </Card>
      </div>

      <!-- Side column: role settings and identity. -->
      <div class="flex flex-col gap-4 min-w-0">
        {#if role === 'student'}
          <Card title="Academic">
            <div class="flex flex-col gap-4">
              <div class="field">
                <label for="p-dept" class="field-label">Department</label>
                <select id="p-dept" bind:value={department} class="field-select">
                  {#each departments as d (d.id)}<option value={d.name}>{d.name}</option>{/each}
                </select>
              </div>
              <div class="field">
                <label for="p-year" class="field-label">Academic standing</label>
                <select id="p-year" bind:value={academicYear} class="field-select">
                  <option value="Year 1">Year 1</option>
                  <option value="Year 2">Year 2</option>
                  <option value="Year 3">Year 3</option>
                  <option value="Year 4">Year 4</option>
                </select>
              </div>
              {@render toggle('p-open', 'Open to projects', 'When off, team leaders will not see you in Team Finder.')}
            </div>
          </Card>
        {:else if role === 'faculty'}
          <Card title="Mentoring">
            <div class="flex flex-col gap-4">
              {@render toggle('p-open', 'Accepting new mentees', 'When off, students can\'t choose you as mentor for a new project.')}
              <div class="field">
                <label for="p-max" class="field-label">Mentee limit <span class="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  id="p-max"
                  type="number"
                  min="1"
                  max="20"
                  class="field-input"
                  value={maxMentees ?? ''}
                  oninput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    maxMentees = v === '' ? null : Number(v);
                  }}
                  placeholder="No limit"
                />
                {#if load}
                  <p class="field-hint flex items-center gap-1.5">
                    <Users class="w-3 h-3" aria-hidden="true" />
                    Mentoring {load.count} team{load.count === 1 ? '' : 's'} now{load.limit ? ` of ${load.limit}` : ''} (pending and active).
                  </p>
                {/if}
              </div>
              <div class="field">
                <label for="p-hours" class="field-label">Office hours</label>
                <div class="relative">
                  <Clock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <input id="p-hours" class="field-input field-icon" bind:value={officeHours} maxlength="120" placeholder="e.g. Tue & Thu 14:00–16:00" />
                </div>
              </div>
              <div class="field">
                <label for="p-office" class="field-label">Office</label>
                <div class="relative">
                  <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <input id="p-office" class="field-input field-icon" bind:value={officeLocation} maxlength="80" placeholder="e.g. Block C, Room 214" />
                </div>
              </div>
            </div>
          </Card>
        {/if}

        <Card title="Account" variant="blueprint">
          <dl class="flex flex-col gap-3 text-xs">
            <div>
              <dt class="eyebrow">Name</dt>
              <dd class="text-foreground font-semibold mt-0.5">{auth.user.name}</dd>
            </div>
            <div>
              <dt class="eyebrow">Email</dt>
              <dd class="text-foreground font-semibold mt-0.5 break-all">{auth.user.email}</dd>
            </div>
            <div>
              <dt class="eyebrow">Role</dt>
              <dd class="text-foreground font-semibold mt-0.5">{roleLabel[role]}</dd>
            </div>
            {#if role !== 'student'}
              <div>
                <dt class="eyebrow">Department</dt>
                <dd class="text-foreground font-semibold mt-0.5">{auth.user.department}</dd>
              </div>
            {/if}
          </dl>
          <p class="text-3xs text-muted-foreground mt-4 flex items-start gap-1.5 leading-relaxed">
            <Lock class="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
            Only an administrator can change these.
          </p>
        </Card>
      </div>
    </form>
  </div>

  <div
    class="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 -mb-4 sm:-mb-6 lg:-mb-8 px-4 sm:px-6 lg:px-8 py-3
      border-t border-border chrome-blur flex items-center justify-between gap-4"
  >
    <p class="text-2xs text-muted-foreground" role="status" aria-live="polite">
      {#if dirty}
        <span class="font-bold text-warning">Unsaved changes</span>
      {:else}
        All changes saved
      {/if}
    </p>
    <div class="flex items-center gap-2">
      {#if dirty}
        <Button type="button" variant="ghost" onclick={() => auth.user && fill(db.getUser(auth.user.id) ?? auth.user)}>Discard</Button>
      {/if}
      <Button type="submit" form="profile-form" variant="primary" loading={saving} disabled={!dirty}>
        <Save class="w-4 h-4" />
        Save changes
      </Button>
    </div>
  </div>

  <AvatarPicker bind:open={pickerOpen} current={auth.user.avatar} name={auth.user.name} onsave={saveAvatar} />
{/if}

{#snippet toggle(id: string, label: string, hint: string)}
  <div class="flex items-center justify-between gap-4 p-3.5 border border-border rounded-md bg-muted/30">
    <div class="min-w-0">
      <p class="text-sm font-bold text-foreground" id="{id}-label">{label}</p>
      <p class="text-2xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
    </div>
    <label class="relative inline-flex items-center cursor-pointer shrink-0">
      <span class="sr-only">{label}</span>
      <input {id} type="checkbox" bind:checked={availability} class="sr-only peer" />
      <span
        class="w-11 h-6 bg-muted border border-border rounded-full transition-colors
          peer-checked:bg-accent peer-checked:border-accent
          peer-focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]
          after:content-[''] after:absolute after:top-0.75 after:left-0.75 after:bg-card
          after:border after:border-border after:rounded-full after:h-4.5 after:w-4.5
          after:transition-transform peer-checked:after:translate-x-5"
      ></span>
    </label>
  </div>
{/snippet}
