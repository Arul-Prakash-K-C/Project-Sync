<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { newId } from '$lib/utils/id';
  import { db, type Project, type Announcement } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Megaphone, Send } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  let projects = $state<Project[]>([]);
  let announcements = $state<Announcement[]>([]);

  // Announcement states
  let announceTargetType = $state<'all' | 'team'>('all');
  let announceTargetIds = $state<string[]>([]);
  let announceTitle = $state('');
  let announceContent = $state('');
  let submitting = $state(false);

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter((p) => p.department === auth.user!.department);
      announcements = db.getAnnouncements();
    }
  }

  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));

  /** How many people will actually receive this — shown before sending, because
      a broadcast cannot be recalled. */
  const recipientCount = $derived.by(() => {
    const targets =
      announceTargetType === 'all' ? projects : projects.filter((p) => announceTargetIds.includes(p.id));
    const ids = new Set(targets.flatMap((p) => p.members.map((m) => m.userId)));
    return ids.size;
  });

  const canSubmit = $derived(
    Boolean(announceTitle) &&
      Boolean(announceContent) &&
      (announceTargetType === 'all' || announceTargetIds.length > 0)
  );

  function handleAnnounceSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!announceTitle || !announceContent) return;

    submitting = true;
    try {
      const targets = announceTargetType === 'all' ? projects.map((p) => p.id) : announceTargetIds;
      const ann = db.createAnnouncement(
        announceTargetType,
        targets,
        announceTitle,
        announceContent,
        auth.user!.name
      );
      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        'Posted announcement',
        'announcement',
        ann.id,
        `${announceTitle} (${announceTargetType === 'all' ? 'all teams' : `${targets.length} team(s)`})`
      );

      const targetingProjects = projects.filter((p) => targets.includes(p.id));
      targetingProjects.forEach((proj) => {
        proj.members.forEach((member) => {
          db.saveNotifications([
            {
              id: newId('notif'),
              userId: member.userId,
              title: 'New Announcement Posted',
              description: `Supervisor posted: "${announceTitle}"`,
              type: 'announcement',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student`
            }
          ]);
        });
      });

      toast.success('Announcement broadcasted successfully!');
      announceTitle = '';
      announceContent = '';
      announceTargetIds = [];
      loadData();
    } catch (err) {
      toast.error('Failed to post announcement');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Announcements — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Announcements"
      icon={Megaphone}
      description="Broadcast a notice to every student you supervise, or target specific project teams."
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <Card title="Publish announcement">
        <form onsubmit={handleAnnounceSubmit} class="flex flex-col gap-4">
          <fieldset class="field border-0 p-0 m-0">
            <legend class="field-label p-0 mb-1.5">Audience</legend>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer">
                <input type="radio" value="all" bind:group={announceTargetType} />
                All assigned students
              </label>
              <label class="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer">
                <input type="radio" value="team" bind:group={announceTargetType} />
                Specific project teams
              </label>
            </div>
          </fieldset>

          {#if announceTargetType === 'team'}
            <fieldset class="border border-border rounded-md p-3 bg-muted/30 m-0">
              <legend class="text-xs font-bold text-foreground px-1">Select teams</legend>
              <div class="flex flex-col gap-1.5 mt-1">
                {#each activeProjects as p (p.id)}
                  <label class="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground cursor-pointer">
                    <input type="checkbox" value={p.id} bind:group={announceTargetIds} />
                    <span class="min-w-0 truncate text-foreground">{p.name}</span>
                  </label>
                {:else}
                  <p class="text-2xs text-muted-foreground">No active teams in your department yet.</p>
                {/each}
              </div>
            </fieldset>
          {/if}

          <div class="field">
            <label for="ann-title" class="field-label">Title</label>
            <input
              id="ann-title"
              type="text"
              placeholder="e.g. Mid-term source code submission notice"
              bind:value={announceTitle}
              required
              class="field-input"
            />
          </div>

          <div class="field">
            <label for="ann-content" class="field-label">Notice</label>
            <textarea
              id="ann-content"
              placeholder="Write the announcement details…"
              bind:value={announceContent}
              required
              rows="5"
              class="field-textarea"
            ></textarea>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-border pt-3">
            <p class="text-2xs text-muted-foreground" role="status" aria-live="polite">
              Reaching <span class="font-bold text-foreground tabular">{recipientCount}</span>
              student{recipientCount === 1 ? '' : 's'}
            </p>
            <Button type="submit" variant="primary" size="sm" loading={submitting} disabled={!canSubmit}>
              <Send class="w-3.5 h-3.5" />
              Broadcast
            </Button>
          </div>
        </form>
      </Card>

      <div class="lg:col-span-2">
        <Card title="Published history">
          <ul class="flex flex-col gap-2.5">
            {#each announcements as ann (ann.id)}
              <li class="p-4 border border-border rounded-md">
                <div class="flex justify-between items-start gap-3">
                  <h3 class="text-sm font-bold text-foreground">{ann.title}</h3>
                  <Badge variant={ann.targetType === 'all' ? 'primary' : 'info'} size="sm" class="shrink-0">
                    {ann.targetType === 'all' ? 'All students' : `${ann.targetIds.length} team(s)`}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mt-2">
                  {ann.content}
                </p>
                <p class="flex justify-between items-center gap-3 text-3xs text-muted-foreground mt-3 pt-2.5 border-t border-border">
                  <span>{ann.facultyName}</span>
                  <time class="tabular" datetime={ann.createdAt}>
                    {new Date(ann.createdAt).toLocaleString()}
                  </time>
                </p>
              </li>
            {:else}
              <li>
                <EmptyState
                  icon={Megaphone}
                  title="No announcements published"
                  description="Anything you broadcast appears here, and lands on the dashboard of every student it reaches."
                />
              </li>
            {/each}
          </ul>
        </Card>
      </div>
    </div>
  </div>
{/if}
