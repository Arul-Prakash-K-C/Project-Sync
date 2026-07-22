<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Announcement } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Megaphone } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let projects = $state<Project[]>([]);
  let announcements = $state<Announcement[]>([]);

  // Announcement states
  let announceTargetType = $state<'all' | 'team'>('all');
  let announceTargetIds = $state<string[]>([]);
  let announceTitle = $state('');
  let announceContent = $state('');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      announcements = db.getAnnouncements();
    }
  }

  let activeProjects = $derived(projects.filter(p => p.status === 'active'));

  function handleAnnounceSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!announceTitle || !announceContent) return;

    try {
      const targets = announceTargetType === 'all' ? projects.map(p => p.id) : announceTargetIds;
      db.createAnnouncement(announceTargetType, targets, announceTitle, announceContent, auth.user!.name);
      
      const targetingProjects = projects.filter(p => targets.includes(p.id));
      targetingProjects.forEach(proj => {
        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
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
    }
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Announcements Board</h2>
      <p class="text-sm text-muted-foreground mt-1">Broadcast general updates or select specific project teams to receive targeted announcements.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- New Announcement Form -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Publish Announcement</h3>
        
        <form onsubmit={handleAnnounceSubmit} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-foreground">Target Audience</span>
            <div class="flex flex-col gap-2 mt-1">
              <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
                <input type="radio" value="all" bind:group={announceTargetType} class="cursor-pointer" />
                All Assigned Students
              </label>
              <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
                <input type="radio" value="team" bind:group={announceTargetType} class="cursor-pointer" />
                Specific Project Teams
              </label>
            </div>
          </div>

          {#if announceTargetType === 'team'}
            <div class="flex flex-col gap-1.5 p-3 border rounded-xl bg-muted/10">
              <span class="text-xs font-bold text-foreground mb-1 block">Select Teams:</span>
              {#each activeProjects as p}
                <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground py-0.5 cursor-pointer">
                  <input type="checkbox" value={p.id} bind:group={announceTargetIds} class="cursor-pointer" />
                  {p.name}
                </label>
              {/each}
            </div>
          {/if}

          <div class="flex flex-col gap-1.5">
            <label for="ann-title" class="text-xs font-semibold text-foreground">Announcement Title</label>
            <input 
              id="ann-title"
              type="text" 
              placeholder="e.g. Mid-term source code submission notice" 
              bind:value={announceTitle}
              required
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="ann-content" class="text-xs font-semibold text-foreground">Notice Content</label>
            <textarea 
              id="ann-content"
              placeholder="Write announcement details..." 
              bind:value={announceContent}
              required
              rows="4"
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 mt-2">
            <Button type="submit" variant="primary" size="sm">Broadcast Announcement</Button>
          </div>
        </form>
      </Card>

      <!-- Broadcasted Announcements list -->
      <div class="lg:col-span-2 flex flex-col gap-6">
        <Card>
          <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2 mb-4">Published Announcements History</h3>
          
          <div class="flex flex-col gap-3">
            {#each announcements as ann}
              <div class="p-4 border rounded-xl bg-card flex flex-col gap-2">
                <div class="flex justify-between items-start">
                  <span class="text-sm font-bold text-foreground">{ann.title}</span>
                  <Badge variant={ann.targetType === 'all' ? 'primary' : 'info'}>
                    {ann.targetType === 'all' ? 'All Assigned' : 'Specific Teams'}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                
                <div class="flex justify-between items-center text-3xs text-muted-foreground mt-2 border-t border-border/40 pt-2 font-semibold">
                  <span>Published by: {ann.facultyName}</span>
                  <span>{new Date(ann.createdAt).toLocaleString()}</span>
                </div>
              </div>
            {:else}
              <div class="py-8 text-center text-xs text-muted-foreground italic">No broadcast announcements published yet.</div>
            {/each}
          </div>
        </Card>
      </div>
    </div>
  </div>
{/if}
