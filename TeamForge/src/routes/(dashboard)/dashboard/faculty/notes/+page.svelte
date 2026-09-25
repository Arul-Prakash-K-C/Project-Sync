<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type FacultyNote } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Trash2, Notebook, Lock } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

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
      projects = db.getSupervisedProjects(auth.user!);
      facultyNotes = db.getFacultyNotes().filter((n) => projects.some((p) => p.id === n.projectId));

      const activeP = projects.filter((p) => p.status === 'active');
      if (activeP.length > 0) {
        if (!selectedNotesProjectId) selectedNotesProjectId = activeP[0].id;
      }
    }
  }

  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));
  let currentNotesProject = $derived(activeProjects.find((p) => p.id === selectedNotesProjectId));

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
      const filtered = allNotes.filter((n) => n.id !== id);
      db.saveFacultyNotes(filtered);
      toast.success('Note deleted.');
      loadData();
    } catch (err) {
      toast.error('Failed to delete note');
    }
  }

  const visibleNotes = $derived(
    facultyNotes
      .map((note) => ({ note, project: projects.find((p) => p.id === note.projectId) }))
      .filter((entry) => entry.project)
  );
</script>

<svelte:head>
  <title>Private Notes — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Private notes"
      icon={Notebook}
      description="Confidential records on contributions, meetings or grading."
    />

    <!-- Confidentiality is the whole premise of this page, so it is stated on
         the page rather than tucked into the subtitle. -->
    <p
      class="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40
        border border-border rounded-md px-3.5 py-2.5"
    >
      <Lock class="w-3.5 h-3.5 shrink-0 text-accent" aria-hidden="true" />
      Notes are visible only to you. Students never see them.
    </p>

    {#if activeProjects.length === 0}
      <EmptyState
        icon={Notebook}
        title="No active teams"
        description="Notes are filed against an approved project. Approve a proposal and its team will appear here."
      >
        {#snippet action()}
          <a href="/dashboard/faculty/approvals">
            <Button variant="outline" size="sm">Go to approvals</Button>
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card title="Record a note">
          <form onsubmit={handleSaveNote} class="flex flex-col gap-4">
            <div class="field">
              <label for="note-proj" class="field-label">Project</label>
              <select id="note-proj" bind:value={selectedNotesProjectId} required class="field-select">
                {#each activeProjects as p (p.id)}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label for="note-stud" class="field-label">About</label>
              <select id="note-stud" bind:value={selectedNotesStudentId} class="field-select">
                <option value="">The team as a whole</option>
                {#if currentNotesProject}
                  {#each currentNotesProject.members as member (member.userId)}
                    <option value={member.userId}>{member.name}</option>
                  {/each}
                {/if}
              </select>
            </div>

            <div class="field">
              <label for="note-cont" class="field-label">Note</label>
              <textarea
                id="note-cont"
                placeholder="Evaluation, performance observations, or references for grading…"
                bind:value={notesContent}
                required
                rows="6"
                class="field-textarea"
              ></textarea>
            </div>

            <div class="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={!notesContent}>Save note</Button>
            </div>
          </form>
        </Card>

        <div class="lg:col-span-2">
          <Card title="Your notes">
            <ul class="flex flex-col gap-2.5">
              {#each visibleNotes as { note, project } (note.id)}
                {@const targetStud = note.studentId
                  ? project!.members.find((m) => m.userId === note.studentId)
                  : null}
                <li class="p-4 border border-border rounded-md group">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="text-sm font-bold text-foreground truncate">{project!.name}</h3>
                      <div class="mt-1.5">
                        {#if targetStud}
                          <Badge variant="primary" size="sm">{targetStud.name} · {targetStud.role}</Badge>
                        {:else}
                          <Badge variant="secondary" size="sm">Whole team</Badge>
                        {/if}
                      </div>
                    </div>
                    <button
                      onclick={() => deleteNote(note.id)}
                      aria-label="Delete note about {targetStud?.name ?? project!.name}"
                      class="icon-action icon-action-danger shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>

                  <p
                    class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mt-3 p-3
                      bg-muted/30 border border-border rounded-md"
                  >
                    {note.content}
                  </p>

                  <time class="block text-3xs text-muted-foreground mt-2 tabular" datetime={note.updatedAt}>
                    Updated {new Date(note.updatedAt).toLocaleString()}
                  </time>
                </li>
              {:else}
                <li>
                  <EmptyState
                    icon={Notebook}
                    title="No notes yet"
                    description="Use the form on the left to record your first private observation about a team or a student."
                  />
                </li>
              {/each}
            </ul>
          </Card>
        </div>
      </div>
    {/if}
  </div>
{/if}
