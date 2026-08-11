<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Plus, X, GraduationCap, Award, Compass, Save, Check } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let bio = $state('');
  let department = $state('');
  let academicYear = $state('Year 1');
  let availability = $state(true);
  
  let skillInput = $state('');
  let skills = $state<string[]>([]);

  let interestInput = $state('');
  let interests = $state<string[]>([]);

  const departments = db.getDepartments();

  // Recommended skills library
  const skillLibrary = [
    'Svelte', 'Tailwind CSS', 'TypeScript', 'Node.js', 'Firebase', 
    'Python', 'TensorFlow', 'Data Analytics', 'Agile/Scrum', 'SQL', 
    'Figma', 'System Design', 'Docker', 'Go', 'PostgreSQL', 'Java',
    'C++', 'Git', 'Machine Learning', 'API Development'
  ];

  onMount(() => {
    if (auth.user) {
      bio = auth.user.bio || '';
      department = auth.user.department || '';
      academicYear = auth.user.academicYear || 'Year 1';
      availability = auth.user.availability ?? true;
      skills = [...auth.user.skills];
      interests = [...auth.user.interests];
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
    skills = skills.filter(s => s !== skill);
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
    interests = interests.filter(i => i !== interest);
  }

  function handleSave(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;
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
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    }
  }
</script>

{#if auth.user}
  <div class="max-w-4xl mx-auto flex flex-col gap-8">
    <div class="flex items-center justify-between border-b border-border/40 pb-4">
      <div>
        <h2 class="text-3xl font-extrabold text-foreground">Edit Profile</h2>
        <p class="text-xs text-muted-foreground mt-1">Configure your skill vectors and academic details to find matching teams.</p>
      </div>
    </div>

    <form onsubmit={handleSave} class="flex flex-col gap-6">
      
      <!-- General Academic Details -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground flex items-center gap-2">
          <GraduationCap class="w-5 h-5 text-primary" />
          Academic Information
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div class="flex flex-col gap-1.5">
            <label for="prof-dept" class="text-xs font-semibold text-foreground">Department</label>
            <select
              id="prof-dept"
              bind:value={department}
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              {#each departments as d}
                <option value={d.name}>{d.name}</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="prof-year" class="text-xs font-semibold text-foreground">Academic Standing</label>
            <select
              id="prof-year"
              bind:value={academicYear}
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="Year 1">Year 1 (Freshman)</option>
              <option value="Year 2">Year 2 (Sophomore)</option>
              <option value="Year 3">Year 3 (Junior)</option>
              <option value="Year 4">Year 4 (Senior)</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-between p-4 border border-border/80 rounded-md mt-2 bg-muted/10">
          <div class="flex flex-col">
            <span class="text-sm font-bold text-foreground">Open to Projects</span>
            <span class="text-xs text-muted-foreground">Toggles whether other team leaders can discover you in Teammate Finder.</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              bind:checked={availability}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div class="flex flex-col gap-1.5 mt-2">
          <label for="prof-bio" class="text-xs font-semibold text-foreground">Bio / Elevator Pitch</label>
          <textarea
            id="prof-bio"
            placeholder="Tell teams about your coding interests..."
            bind:value={bio}
            rows="3"
            class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          ></textarea>
        </div>
      </Card>

      <!-- Skills Matrix -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground flex items-center gap-2">
          <Award class="w-5 h-5 text-primary" />
          Skills & Technical Expertise
        </h3>

        <div class="flex flex-col gap-2 mt-2">
          <span class="text-xs text-muted-foreground">Click your skills below or add custom tags:</span>
          
          <div class="flex flex-wrap gap-1.5 p-3 border border-border/80 rounded-md bg-muted/10 min-h-12 items-center">
            {#if skills.length === 0}
              <span class="text-xs text-muted-foreground italic pl-1">No skills added yet...</span>
            {/if}
            {#each skills as s}
              <Badge variant="primary" class="gap-1 pl-3.5 pr-2 py-1">
                {s}
                <button type="button" onclick={() => removeSkill(s)} class="hover:text-destructive cursor-pointer">
                  <X class="w-3 h-3" />
                </button>
              </Badge>
            {/each}
          </div>

          <div class="flex gap-2 mt-1">
            <input 
              type="text" 
              placeholder="e.g. Kotlin, Docker" 
              bind:value={skillInput}
              onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill(skillInput))}
              class="flex-1 px-4 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Button type="button" variant="outline" onclick={() => addSkill(skillInput)}>
              <Plus class="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-2 mt-2">
          <span class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Suggested Skills Library</span>
          <div class="flex flex-wrap gap-1.5">
            {#each skillLibrary as sl}
              {#if !skills.includes(sl)}
                <button
                  type="button"
                  onclick={() => addSkill(sl)}
                  class="text-xs px-3 py-1 border border-border hover:border-primary/45 rounded-lg hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                >
                  +{sl}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      </Card>

      <!-- Interests Area -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground flex items-center gap-2">
          <Compass class="w-5 h-5 text-primary" />
          Interests & Fields of Interest
        </h3>

        <div class="flex flex-col gap-2 mt-2">
          <span class="text-xs text-muted-foreground">Select topics that you want to work on:</span>
          
          <div class="flex flex-wrap gap-1.5 p-3 border border-border/80 rounded-md bg-muted/10 min-h-12 items-center">
            {#if interests.length === 0}
              <span class="text-xs text-muted-foreground italic pl-1">No interests added yet...</span>
            {/if}
            {#each interests as i}
              <Badge variant="info" class="gap-1 pl-3.5 pr-2 py-1">
                {i}
                <button type="button" onclick={() => removeInterest(i)} class="hover:text-destructive cursor-pointer">
                  <X class="w-3 h-3" />
                </button>
              </Badge>
            {/each}
          </div>

          <div class="flex gap-2 mt-1">
            <input 
              type="text" 
              placeholder="e.g. FinTech, Game Dev" 
              bind:value={interestInput}
              onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest(interestInput))}
              class="flex-1 px-4 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Button type="button" variant="outline" onclick={() => addInterest(interestInput)}>
              <Plus class="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
      </Card>

      <!-- Save Button -->
      <div class="flex justify-end mt-2">
        <Button type="submit" variant="primary" class="w-full md:w-auto shadow-md">
          <Save class="w-4 h-4" />
          Save Changes
        </Button>
      </div>

    </form>
  </div>
{/if}
