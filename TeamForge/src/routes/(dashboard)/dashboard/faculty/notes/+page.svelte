<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type FacultyNote } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Trash2 } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  let projects = $state<Project[]>([]);
  let facultyNotes = $state<FacultyNote[]>([]);
  let selectedNotesProjectId = $state('');
  let selectedNotesStudentId = $state('');
  let notesContent = $state('');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      facultyNotes = db.getFacultyNotes();

      const activeP = projects.filter(p => p.status === 'active');
      if (activeP.length > 0) {
        if (!selectedNotesProjectId) selectedNotesProjectId = activeP[0].id;
      }
    }
  }

  let activeProjects = $derived(projects.filter(p => p.status === 'active'));
  let currentNotesProject = $derived(activeProjects.find(p => p.id === selectedNotesProjectId));

  function handleSaveNote(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedNotesProjectId || !notesContent) return;
    try {
      db.saveFacultyNote(selectedNotesProjectId, selectedNotesStudentId || undefined, notesContent);
      toast.success('Private note saved.');
      notesContent = '';
      loadData();
    } catch (err) {
      toast.error('Failed to save private note');
    }
  }

  function deleteNote(id: string) {
    try {
      const allNotes = db.getFacultyNotes();
      const filtered = allNotes.filter(n => n.id !== id);
      db.saveFacultyNotes(filtered);
      toast.success('Note deleted.');
      loadData();
    } catch (err) {
      toast.error('Failed to delete note');
    }
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Private Evaluation Notes</h2>
      <p class="text-sm text-muted-foreground mt-1">Keep confidential logs on student contributions, team meeting items, or grading details. (Visible ONLY to you)</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- New Note Form -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Record Private Note</h3>
        
        <form onsubmit={handleSaveNote} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="note-proj" class="text-xs font-semibold text-foreground">Assigned Project</label>
            <select 
              id="note-proj"
              bind:value={selectedNotesProjectId}
              required
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
            >
              {#each activeProjects as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="note-stud" class="text-xs font-semibold text-foreground">Target Student (Optional)</label>
            <select 
              id="note-stud"
              bind:value={selectedNotesStudentId}
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
            >
              <option value="">Entire Team Workspace</option>
              {#if currentNotesProject}
                {#each currentNotesProject.members as member}
                  <option value={member.userId}>{member.name}</option>
                {/each}
              {/if}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="note-cont" class="text-xs font-semibold text-foreground">Private Notes Content</label>
            <textarea 
              id="note-cont"
              placeholder="Only visible to you. Document evaluation, performance notes, or feedback references..." 
              bind:value={notesContent}
              required
              rows="5"
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 mt-2">
            <Button type="submit" variant="primary" size="sm">Save Note</Button>
          </div>
        </form>
      </Card>

      <!-- Saved Notes list -->
      <div class="lg:col-span-2 flex flex-col gap-6">
        <Card>
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2 mb-4">Your Private Evaluation Notes</h3>
          
          <div class="flex flex-col gap-3">
            {#each facultyNotes as note}
              {@const proj = projects.find(p => p.id === note.projectId)}
              {#if proj}
                {@const targetStud = note.studentId ? proj.members.find(m => m.userId === note.studentId) : null}
                <div class="p-4 border rounded-md bg-card flex flex-col gap-2 relative group hover:border-primary/20 transition-all">
                  <button 
                    onclick={() => deleteNote(note.id)}
                    class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 bg-destructive/10 text-destructive rounded-lg transition-opacity cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>

                  <div class="flex flex-col text-left">
                    <span class="text-xs font-bold text-foreground truncate">{proj.name}</span>
                    {#if targetStud}
                      <span class="text-3xs text-muted-foreground mt-0.5">Target: {targetStud.name} ({targetStud.role})</span>
                    {:else}
                      <span class="text-3xs text-muted-foreground mt-0.5">Target: General Team Workspace</span>
                    {/if}
                  </div>

                  <p class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mt-1 bg-muted/10 p-3 rounded-md border">{note.content}</p>
                  
                  <span class="text-[10px] text-muted-foreground mt-1 font-semibold">Last updated: {new Date(note.updatedAt).toLocaleString()}</span>
                </div>
              {/if}
            {:else}
              <div class="py-8 text-center text-xs text-muted-foreground italic">No evaluation notes stored yet. Use the form on the left to write one.</div>
            {/each}
          </div>
        </Card>
      </div>
    </div>
  </div>
{/if}
