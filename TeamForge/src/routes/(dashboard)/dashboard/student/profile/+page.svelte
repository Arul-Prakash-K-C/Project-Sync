<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Plus, X, GraduationCap, Save } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  let bio = $state('');
  let department = $state('');
  let academicYear = $state('Year 1');
  let availability = $state(true);

  let skillInput = $state('');
  let skills = $state<string[]>([]);

  let interestInput = $state('');
  let interests = $state<string[]>([]);

  let saving = $state(false);
  /** Snapshot of the saved profile, so the page can tell the person whether they
      have edits still sitting in the form. */
  let baseline = $state('');

  const departments = db.getDepartments();

  // Recommended skills library
  const skillLibrary = [
    'Svelte', 'Tailwind CSS', 'TypeScript', 'Node.js', 'Firebase',
    'Python', 'TensorFlow', 'Data Analytics', 'Agile/Scrum', 'SQL',
    'Figma', 'System Design', 'Docker', 'Go', 'PostgreSQL', 'Java',
    'C++', 'Git', 'Machine Learning', 'API Development'
  ];

  function snapshot() {
    return JSON.stringify({ bio, department, academicYear, availability, skills, interests });
  }

  const dirty = $derived(baseline !== '' && snapshot() !== baseline);

  onMount(() => {
    if (auth.user) {
      bio = auth.user.bio || '';
      department = auth.user.department || '';
      academicYear = auth.user.academicYear || 'Year 1';
      availability = auth.user.availability ?? true;
      skills = [...auth.user.skills];
      interests = [...auth.user.interests];
      baseline = snapshot();
    }
  });

  function addSkill(skillName: string) {
    const trimmed = skillName.trim();
    if (trimmed && !skills.includes(trimmed)) {
      skills.push(trimmed);
      skillInput = '';
    }
  }

  function removeSkill(skill: string) {
    skills = skills.filter((s) => s !== skill);
  }

  // Interests
  function addInterest(interestName: string) {
    const trimmed = interestName.trim();
    if (trimmed && !interests.includes(trimmed)) {
      interests.push(trimmed);
      interestInput = '';
    }
  }

  function removeInterest(interest: string) {
    interests = interests.filter((i) => i !== interest);
  }

  function handleSave(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;
    saving = true;
    try {
      db.updateUserProfile(auth.user.id, {
        bio,
        department,
        academicYear,
        availability,
        skills: [...skills],
        interests: [...interests]
      });
      auth.refreshUser();
      baseline = snapshot();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>My Profile — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="max-w-4xl flex flex-col gap-6 pb-24">
    <PageHeader
      title="My profile"
      icon={GraduationCap}
      description="Your department, standing and skills are exactly what the matching algorithm reads — keeping them current is what gets you better teammates."
    />

    <!-- How the profile currently reads to other students. -->
    <Card class="flex items-center gap-4">
      <Avatar src={auth.user.avatar} name={auth.user.name} size="lg" />
      <div class="min-w-0">
        <p class="text-base font-bold text-foreground truncate">{auth.user.name}</p>
        <p class="text-xs text-muted-foreground truncate">{auth.user.email}</p>
        <div class="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge variant={availability ? 'success' : 'secondary'} dot size="sm">
            {availability ? 'Open to projects' : 'Not looking right now'}
          </Badge>
          <Badge variant="outline" size="sm">{skills.length} skills</Badge>
          <Badge variant="outline" size="sm">{interests.length} interests</Badge>
        </div>
      </div>
    </Card>

    <form id="profile-form" onsubmit={handleSave} class="flex flex-col gap-4">
      <!-- General Academic Details -->
      <Card title="Academic information">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="field">
            <label for="prof-dept" class="field-label">Department</label>
            <select id="prof-dept" bind:value={department} class="field-select">
              {#each departments as d (d.id)}
                <option value={d.name}>{d.name}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="prof-year" class="field-label">Academic standing</label>
            <select id="prof-year" bind:value={academicYear} class="field-select">
              <option value="Year 1">Year 1 (Freshman)</option>
              <option value="Year 2">Year 2 (Sophomore)</option>
              <option value="Year 3">Year 3 (Junior)</option>
              <option value="Year 4">Year 4 (Senior)</option>
            </select>
          </div>
        </div>

        <div
          class="flex items-center justify-between gap-4 p-3.5 border border-border rounded-md mt-4 bg-muted/30"
        >
          <div class="min-w-0">
            <p class="text-sm font-bold text-foreground">Open to projects</p>
            <p class="text-2xs text-muted-foreground mt-0.5 leading-relaxed">
              When off, team leaders will not see you in Team Finder.
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0">
            <span class="sr-only">Open to projects</span>
            <input type="checkbox" bind:checked={availability} class="sr-only peer" />
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

        <div class="field mt-4">
          <label for="prof-bio" class="field-label">Bio / elevator pitch</label>
          <textarea
            id="prof-bio"
            placeholder="Tell teams about your coding interests…"
            bind:value={bio}
            rows="3"
            aria-describedby="prof-bio-hint"
            class="field-textarea"
          ></textarea>
          <p id="prof-bio-hint" class="field-hint">
            Shown on your card in Team Finder — two sentences is plenty.
          </p>
        </div>
      </Card>

      <!-- Skills Matrix -->
      <Card
        title="Skills &amp; technical expertise"
        description="Overlapping skills are worth up to 30 points of a match score."
      >
        <div class="flex flex-wrap gap-1.5 p-3 border border-border rounded-md bg-muted/30 min-h-12 items-center">
          {#if skills.length === 0}
            <span class="text-xs text-muted-foreground pl-0.5">No skills added yet.</span>
          {/if}
          {#each skills as s (s)}
            <Badge variant="primary" class="pl-2.5 pr-1 py-1 gap-1">
              {s}
              <button
                type="button"
                onclick={() => removeSkill(s)}
                aria-label="Remove skill {s}"
                class="p-0.5 rounded-sm hover:text-destructive cursor-pointer"
              >
                <X class="w-3 h-3" />
              </button>
            </Badge>
          {/each}
        </div>

        <div class="flex gap-2 mt-3">
          <label for="skill-input" class="sr-only">Add a skill</label>
          <input
            id="skill-input"
            type="text"
            placeholder="e.g. Kotlin, Docker"
            bind:value={skillInput}
            onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill(skillInput))}
            class="field-input flex-1"
          />
          <Button type="button" variant="outline" onclick={() => addSkill(skillInput)}>
            <Plus class="w-4 h-4" />
            Add
          </Button>
        </div>

        <div class="mt-5">
          <p class="eyebrow">Suggested skills</p>
          <div class="flex flex-wrap gap-1.5 mt-2">
            {#each skillLibrary as sl (sl)}
              {#if !skills.includes(sl)}
                <button
                  type="button"
                  onclick={() => addSkill(sl)}
                  aria-label="Add skill {sl}"
                  class="inline-flex items-center gap-1 px-2.5 h-7 rounded-full border border-border
                    text-2xs font-semibold text-muted-foreground bg-card
                    hover:border-accent/45 hover:text-accent transition-colors cursor-pointer"
                >
                  <Plus class="w-3 h-3" aria-hidden="true" />
                  {sl}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      </Card>

      <!-- Interests Area -->
      <Card
        title="Interests &amp; fields of interest"
        description="Shared interests add up to 10 points, and drive project-idea matches."
      >
        <div class="flex flex-wrap gap-1.5 p-3 border border-border rounded-md bg-muted/30 min-h-12 items-center">
          {#if interests.length === 0}
            <span class="text-xs text-muted-foreground pl-0.5">No interests added yet.</span>
          {/if}
          {#each interests as i (i)}
            <Badge variant="info" class="pl-2.5 pr-1 py-1 gap-1">
              {i}
              <button
                type="button"
                onclick={() => removeInterest(i)}
                aria-label="Remove interest {i}"
                class="p-0.5 rounded-sm hover:text-destructive cursor-pointer"
              >
                <X class="w-3 h-3" />
              </button>
            </Badge>
          {/each}
        </div>

        <div class="flex gap-2 mt-3">
          <label for="interest-input" class="sr-only">Add an interest</label>
          <input
            id="interest-input"
            type="text"
            placeholder="e.g. FinTech, Game Dev"
            bind:value={interestInput}
            onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest(interestInput))}
            class="field-input flex-1"
          />
          <Button type="button" variant="outline" onclick={() => addInterest(interestInput)}>
            <Plus class="w-4 h-4" />
            Add
          </Button>
        </div>
      </Card>
    </form>
  </div>

  <!--
    A long form with the save button only at the very bottom means scrolling back
    down to commit a change made at the top. The action rides with the page and
    says plainly whether anything is still unsaved.
  -->
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
    <Button type="submit" form="profile-form" variant="primary" loading={saving} disabled={!dirty}>
      <Save class="w-4 h-4" />
      Save changes
    </Button>
  </div>
{/if}
