<script lang="ts">
  import { Check, ImageUp, Smile, Type, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import {
    PRESET_AVATARS,
    avatarKind,
    coverRect,
    encodeAvatar,
    loadImageFile,
    validateAvatar,
    type CropState
  } from '$lib/utils/avatars';

  /**
   * Choose a profile picture: one of ten cartoon characters, an uploaded
   * photo (dragged into place and zoomed inside a round frame, then cropped
   * and compressed in the browser), or initials only. A live preview shows
   * it at the sizes it appears across the app.
   */
  let {
    open = $bindable(false),
    current,
    name,
    onsave
  }: {
    open: boolean;
    current: string;
    name: string;
    /** Receives the new avatar value; throw to keep the dialog open with the message. */
    onsave: (avatar: string) => Promise<void> | void;
  } = $props();

  const VIEW = 224;

  let mode = $state<'presets' | 'upload' | 'initials'>('presets');
  let chosen = $state('');
  let img = $state<HTMLImageElement | null>(null);
  let crop = $state<CropState>({ zoom: 1, x: 0, y: 0 });
  let error = $state('');
  let busy = $state(false);
  let dragOver = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  // Each time the dialog opens it starts from the current picture.
  $effect(() => {
    if (!open) return;
    const kind = avatarKind(current);
    mode = kind === 'upload' ? 'upload' : kind === 'initials' ? 'initials' : 'presets';
    chosen = kind === 'preset' ? current : '';
    img = null;
    crop = { zoom: 1, x: 0, y: 0 };
    error = '';
  });

  const rect = $derived(img ? coverRect(img.naturalWidth, img.naturalHeight, VIEW, crop) : null);

  let previewUrl = $state('');
  let previewTimer: ReturnType<typeof setTimeout>;

  /** What would be saved right now, for the preview (an upload previews from the crop, uncompressed). */
  const preview = $derived(
    mode === 'presets'
      ? chosen || current
      : mode === 'initials'
        ? ''
        : img
          ? previewUrl
          : avatarKind(current) === 'upload'
            ? current
            : ''
  );

  $effect(() => {
    // Re-render the small previews shortly after the crop settles.
    const c = { ...crop };
    const image = img;
    clearTimeout(previewTimer);
    if (!image) return;
    previewTimer = setTimeout(() => {
      try {
        previewUrl = encodeAvatar(image, c, 96);
      } catch {
        previewUrl = '';
      }
    }, 60);
  });

  async function pickFile(file: File | undefined) {
    if (!file) return;
    error = '';
    try {
      img = await loadImageFile(file);
      crop = { zoom: 1, x: 0, y: 0 };
      mode = 'upload';
    } catch (e) {
      error = (e as Error).message;
    }
  }

  // ---------------------------------------------------------------- panning
  let drag: { px: number; py: number; x: number; y: number } | null = null;

  function onPointerDown(e: PointerEvent) {
    if (!img) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag || !img) return;
    setCrop({ x: drag.x + (e.clientX - drag.px) / VIEW, y: drag.y + (e.clientY - drag.py) / VIEW });
  }
  function onPointerUp() {
    drag = null;
  }
  function onWheel(e: WheelEvent) {
    if (!img) return;
    e.preventDefault();
    setCrop({ zoom: crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) });
  }
  function onKey(e: KeyboardEvent) {
    if (!img) return;
    const step = e.shiftKey ? 0.08 : 0.02;
    const moves: Record<string, Partial<CropState>> = {
      ArrowLeft: { x: crop.x - step },
      ArrowRight: { x: crop.x + step },
      ArrowUp: { y: crop.y - step },
      ArrowDown: { y: crop.y + step },
      '+': { zoom: crop.zoom * 1.1 },
      '=': { zoom: crop.zoom * 1.1 },
      '-': { zoom: crop.zoom / 1.1 }
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCrop(moves[e.key]);
    }
  }

  /** Applies a change and clamps it so the photo always fills the circle. */
  function setCrop(next: Partial<CropState>) {
    if (!img) return;
    const merged = { ...crop, ...next };
    merged.zoom = Math.min(4, Math.max(1, merged.zoom));
    const r = coverRect(img.naturalWidth, img.naturalHeight, VIEW, merged);
    crop = { zoom: merged.zoom, x: r.x, y: r.y };
  }

  async function save() {
    error = '';
    let value: string;
    if (mode === 'presets') {
      value = chosen || current;
    } else if (mode === 'initials') {
      value = '';
    } else if (img) {
      value = encodeAvatar(img, crop);
    } else {
      error = 'Choose a photo to upload first.';
      return;
    }
    const problem = validateAvatar(value);
    if (problem) {
      error = problem;
      return;
    }
    busy = true;
    try {
      await onsave(value);
      open = false;
    } catch (e) {
      error = (e as Error).message || "Couldn't save your picture.";
    } finally {
      busy = false;
    }
  }

  const canSave = $derived(
    mode === 'presets' ? !!(chosen || avatarKind(current) === 'preset') : mode === 'initials' ? true : !!img
  );
</script>

<Dialog bind:open title="Profile picture" description="Pick a character, upload a photo, or keep it simple with initials." size="lg">
  <div class="flex flex-col gap-5">
    <!-- Live preview at the sizes the picture appears in. -->
    <div class="flex items-center gap-5 p-4 rounded-lg border border-border bg-muted/30">
      <Avatar src={preview} {name} size="xl" class="rounded-full!" />
      <div class="flex items-end gap-3" aria-hidden="true">
        <Avatar src={preview} {name} size="lg" />
        <Avatar src={preview} {name} size="md" />
        <Avatar src={preview} {name} size="sm" />
        <Avatar src={preview} {name} size="xs" />
      </div>
      <p class="hidden sm:block ml-auto text-2xs text-muted-foreground max-w-40 text-right leading-relaxed">
        How you appear on teams, boards, discussions and in Team Finder.
      </p>
    </div>

    <Tabs
      label="Picture source"
      variant="pills"
      items={[
        { value: 'presets', label: 'Characters' },
        { value: 'upload', label: 'Upload photo' },
        { value: 'initials', label: 'Initials' }
      ]}
      bind:active={mode}
    />

    {#if mode === 'presets'}
      <div role="radiogroup" aria-label="Cartoon characters" class="grid grid-cols-5 gap-3">
        {#each PRESET_AVATARS as p (p.id)}
          {@const selected = (chosen || current) === p.src}
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={p.label}
            onclick={() => (chosen = p.src)}
            class="relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-[transform,border-color,box-shadow] duration-300
              {selected
              ? 'border-accent shadow-[0_8px_24px_-12px_var(--accent)] scale-[1.04]'
              : 'border-transparent hover:border-accent/40 hover:-translate-y-0.5'}"
          >
            <img src={p.src} alt="" class="w-full h-full object-cover" loading="lazy" />
            {#if selected}
              <span class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                <Check class="w-3 h-3" aria-hidden="true" />
              </span>
            {/if}
          </button>
        {/each}
      </div>
      <p class="text-3xs text-muted-foreground flex items-center gap-1.5">
        <Smile class="w-3 h-3" aria-hidden="true" />
        Characters: "Adventurer" by Lisa Wischofsky via DiceBear, CC BY 4.0.
      </p>
    {:else if mode === 'upload'}
      {#if img && rect}
        <div class="flex flex-col sm:flex-row items-center gap-6">
          <!-- Round frame: drag the photo, scroll or use the slider to zoom, or arrow keys and +/-. -->
          <div
            class="relative shrink-0 rounded-full overflow-hidden bg-muted touch-none select-none cursor-grab active:cursor-grabbing
              outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
            style="width: {VIEW}px; height: {VIEW}px"
            role="slider"
            tabindex="0"
            aria-label="Photo position. Drag, or use arrow keys to move and plus or minus to zoom."
            aria-valuemin={100}
            aria-valuemax={400}
            aria-valuenow={Math.round(crop.zoom * 100)}
            aria-valuetext="Zoom {Math.round(crop.zoom * 100)} percent"
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={onPointerUp}
            onwheel={onWheel}
            onkeydown={onKey}
          >
            <img
              src={img.src}
              alt=""
              draggable="false"
              class="absolute max-w-none pointer-events-none"
              style="left: {rect.left}px; top: {rect.top}px; width: {rect.w}px; height: {rect.h}px"
            />
            <span class="absolute inset-0 rounded-full ring-1 ring-inset ring-white/40 pointer-events-none"></span>
          </div>

          <div class="flex-1 w-full flex flex-col gap-4">
            <p class="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
              <Move class="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              Drag the photo to position it in the circle. Scroll or use the slider to zoom.
            </p>
            <div class="flex items-center gap-2.5">
              <button type="button" class="icon-action" aria-label="Zoom out" onclick={() => setCrop({ zoom: crop.zoom / 1.15 })}>
                <ZoomOut class="w-4 h-4" />
              </button>
              <label for="crop-zoom" class="sr-only">Zoom</label>
              <input
                id="crop-zoom"
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={crop.zoom}
                oninput={(e) => setCrop({ zoom: Number((e.target as HTMLInputElement).value) })}
                class="flex-1"
              />
              <button type="button" class="icon-action" aria-label="Zoom in" onclick={() => setCrop({ zoom: crop.zoom * 1.15 })}>
                <ZoomIn class="w-4 h-4" />
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onclick={() => (crop = { zoom: 1, x: 0, y: 0 })}>
                <RotateCcw class="w-3.5 h-3.5" />
                Reset
              </Button>
              <Button type="button" variant="outline" size="sm" onclick={() => fileInput?.click()}>
                <ImageUp class="w-3.5 h-3.5" />
                Choose another
              </Button>
            </div>
          </div>
        </div>
      {:else}
        <label
          for="avatar-file"
          class="flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-lg border-2 border-dashed cursor-pointer text-center transition-colors
            {dragOver ? 'border-accent bg-accent/6' : 'border-border hover:border-accent/50 hover:bg-muted/30'}"
          ondragover={(e) => {
            e.preventDefault();
            dragOver = true;
          }}
          ondragleave={() => (dragOver = false)}
          ondrop={(e) => {
            e.preventDefault();
            dragOver = false;
            pickFile(e.dataTransfer?.files[0]);
          }}
        >
          <span class="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
            <ImageUp class="w-5 h-5" aria-hidden="true" />
          </span>
          <span class="text-sm font-bold text-foreground">Drop a photo here, or click to choose</span>
          <span class="text-2xs text-muted-foreground">
            PNG, JPEG, WebP, GIF or AVIF, up to 8 MB. It's cropped to a circle and shrunk before saving.
          </span>
        </label>
      {/if}
      <input
        bind:this={fileInput}
        id="avatar-file"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        class="sr-only"
        onchange={(e) => {
          const input = e.target as HTMLInputElement;
          pickFile(input.files?.[0]);
          input.value = '';
        }}
      />
    {:else}
      <div class="flex items-center gap-4 p-4 rounded-lg border border-border">
        <span class="w-12 h-12 rounded-md bg-secondary border border-border flex items-center justify-center text-muted-foreground">
          <Type class="w-5 h-5" aria-hidden="true" />
        </span>
        <p class="text-sm text-muted-foreground leading-relaxed">
          No picture: your initials are shown instead, on a neutral tile.
        </p>
      </div>
    {/if}

    {#if error}
      <p class="text-xs font-semibold text-destructive" role="alert">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
    <Button type="button" variant="primary" loading={busy} disabled={!canSave} onclick={save}>
      <Check class="w-4 h-4" />
      Use this picture
    </Button>
  {/snippet}
</Dialog>
