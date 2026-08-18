<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.svelte';
  import { db } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { getDashboardRoute } from '$lib/utils/navigation';
  import {
    ArrowRight,
    Mail,
    Lock,
    User as UserIcon,
    Eye,
    EyeOff,
    AlertCircle,
    Cpu,
    Layers,
    ShieldCheck
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';

  let activeTab = $state('login');

  // Login Form
  let loginEmail = $state('');
  let loginPassword = $state('');

  // Register Form
  let registerName = $state('');
  let registerEmail = $state('');
  let registerPassword = $state('');
  let registerRole = $state<'student' | 'faculty' | 'admin'>('student');
  let registerDept = $state('');
  let registerYear = $state('Year 1');

  let showPassword = $state(false);
  let submitting = $state(false);
  /*
    Failures used to surface only as a toast that vanished after three seconds,
    which is the worst possible place for "your password was wrong" — it is gone
    before the person has re-read the field. The message now also stays put
    above the form until the next attempt.
  */
  let formError = $state('');

  // Load Departments
  const departments = db.getDepartments();

  const roles: { value: 'student' | 'faculty' | 'admin'; label: string; hint: string }[] = [
    { value: 'student', label: 'Student', hint: 'Form teams, run projects' },
    { value: 'faculty', label: 'Faculty', hint: 'Approve and review work' },
    { value: 'admin', label: 'Admin', hint: 'Manage the platform' }
  ];

  const demoProfiles = [
    { label: 'Student', email: 'alex@teamforge.edu' },
    { label: 'Faculty', email: 'evelyn@teamforge.edu' },
    { label: 'Admin', email: 'admin@teamforge.edu' }
  ];

  onMount(() => {
    // Set active tab based on query param
    const tabParam = $page.url.searchParams.get('tab');
    if (tabParam === 'register') {
      activeTab = 'register';
    }
    // Set default department
    if (departments.length > 0) {
      registerDept = departments[0].name;
    }
  });

  // Switching tabs should not carry a stale failure from the other form.
  $effect(() => {
    activeTab;
    formError = '';
  });

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    formError = '';
    submitting = true;
    try {
      const user = await auth.login(loginEmail, loginPassword);
      toast.success(`Welcome back, ${user.name}!`);
      goto(getDashboardRoute(user.role));
    } catch (err: any) {
      formError = err.message || 'Login failed';
      toast.error(formError);
    } finally {
      submitting = false;
    }
  }

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault();
    formError = '';
    if (!registerName || !registerEmail || !registerPassword) {
      formError = 'Please fill all required fields';
      toast.error(formError);
      return;
    }
    submitting = true;
    try {
      const user = await auth.register(
        registerName,
        registerEmail,
        registerPassword,
        registerRole,
        registerDept,
        registerRole === 'student' ? registerYear : undefined
      );
      toast.success('Registration successful!');
      goto(getDashboardRoute(user.role));
    } catch (err: any) {
      formError = err.message || 'Registration failed';
      toast.error(formError);
    } finally {
      submitting = false;
    }
  }

  function fillDemoCredentials(email: string) {
    loginEmail = email;
    loginPassword = 'demo1234';
    formError = '';
  }
</script>

<svelte:head>
  <title>Sign in — TeamForge</title>
</svelte:head>

<div class="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
  <!--
    Left rail carries the product's reason to exist. It is hidden below `lg`
    rather than stacked, so a phone gets straight to the form instead of
    scrolling past marketing to reach the password field.
  -->
  <aside
    class="hidden lg:flex flex-col justify-between bg-grid bg-secondary/40 border-r border-border p-12 xl:p-16"
  >
    <a href="/" class="flex items-center gap-2.5 w-fit rounded-sm">
      <span
        class="chamfer w-9 h-9 bg-accent flex items-center justify-center text-accent-foreground font-display text-sm"
        aria-hidden="true">TF</span
      >
      <span class="font-display text-lg text-foreground">TeamForge</span>
    </a>

    <div class="max-w-md">
      <h2 class="font-display text-3xl xl:text-4xl leading-[1.15] text-foreground">
        Build teams the way you build
        <span class="text-accent">anything worth building</span>.
      </h2>
      <p class="mt-5 text-sm text-muted-foreground leading-relaxed">
        Match with classmates on skills and standing, run the work on a shared board, and keep
        faculty review in the same place as the project.
      </p>

      <ul class="mt-10 flex flex-col gap-5">
        <li class="flex gap-3.5">
          <span
            class="w-9 h-9 rounded-md bg-accent/12 text-accent flex items-center justify-center shrink-0"
            aria-hidden="true"><Cpu class="w-4.5 h-4.5" /></span
          >
          <div>
            <p class="text-sm font-bold text-foreground">Explainable matching</p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Every compatibility score shows the reasoning behind it.
            </p>
          </div>
        </li>
        <li class="flex gap-3.5">
          <span
            class="w-9 h-9 rounded-md bg-info/12 text-info flex items-center justify-center shrink-0"
            aria-hidden="true"><Layers class="w-4.5 h-4.5" /></span
          >
          <div>
            <p class="text-sm font-bold text-foreground">One workspace per project</p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Milestones, tasks, threads, files and weekly reports together.
            </p>
          </div>
        </li>
        <li class="flex gap-3.5">
          <span
            class="w-9 h-9 rounded-md bg-success/12 text-success flex items-center justify-center shrink-0"
            aria-hidden="true"><ShieldCheck class="w-4.5 h-4.5" /></span
          >
          <div>
            <p class="text-sm font-bold text-foreground">Faculty in the loop</p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Approvals, reviews and feedback recorded against the work itself.
            </p>
          </div>
        </li>
      </ul>
    </div>

    <p class="text-2xs text-muted-foreground">© 2026 TeamForge · Built for academic teams</p>
  </aside>

  <!-- Form column -->
  <main class="flex items-center justify-center p-6 sm:p-10">
    <div class="w-full max-w-md flex flex-col gap-6">
      <a href="/" class="flex items-center gap-2.5 self-center lg:hidden rounded-sm">
        <span
          class="chamfer w-9 h-9 bg-accent flex items-center justify-center text-accent-foreground font-display text-sm"
          aria-hidden="true">TF</span
        >
        <span class="font-display text-lg text-foreground">TeamForge</span>
      </a>

      <Tabs
        label="Account access"
        items={[
          { value: 'login', label: 'Sign in' },
          { value: 'register', label: 'Create account' }
        ]}
        bind:active={activeTab}
      />

      {#if formError}
        <div
          role="alert"
          class="flex items-start gap-2.5 p-3 rounded-md border border-destructive/30 bg-destructive/8 text-destructive"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p class="text-xs font-semibold leading-relaxed">{formError}</p>
        </div>
      {/if}

      {#if activeTab === 'login'}
        <form onsubmit={handleLogin} class="flex flex-col gap-4">
          <div>
            <h1 class="font-display text-xl text-foreground">Welcome back</h1>
            <p class="text-xs text-muted-foreground mt-1">
              Sign in to coordinate with your teammates.
            </p>
          </div>

          <div class="field">
            <label for="email" class="field-label">Academic email</label>
            <div class="relative">
              <Mail
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="email"
                type="email"
                autocomplete="email"
                placeholder="you@university.edu"
                bind:value={loginEmail}
                required
                aria-invalid={formError ? 'true' : undefined}
                class="field-input field-icon"
              />
            </div>
          </div>

          <div class="field">
            <label for="password" class="field-label">Password</label>
            <div class="relative">
              <Lock
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autocomplete="current-password"
                placeholder="Your password"
                bind:value={loginPassword}
                required
                aria-invalid={formError ? 'true' : undefined}
                class="field-input field-icon pr-11"
              />
              <button
                type="button"
                onclick={() => (showPassword = !showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                class="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-sm text-muted-foreground
                  hover:text-foreground transition-colors cursor-pointer"
              >
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" class="w-full mt-1" loading={submitting}>
            Sign in
            <ArrowRight class="w-4 h-4" />
          </Button>

          <!-- Quick Login Demos -->
          <div class="mt-4 pt-5 border-t border-border">
            <p class="eyebrow text-center">Quick demo profiles</p>
            <div class="grid grid-cols-3 gap-2 mt-3">
              {#each demoProfiles as profile (profile.email)}
                <button
                  type="button"
                  onclick={() => fillDemoCredentials(profile.email)}
                  class="h-9 rounded-md border border-border bg-card text-xs font-semibold text-foreground
                    hover:border-accent/45 hover:bg-secondary transition-colors cursor-pointer"
                >
                  {profile.label}
                </button>
              {/each}
            </div>
            <p class="field-hint text-center mt-2">Fills the form — press Sign in to continue.</p>
          </div>
        </form>
      {:else}
        <form onsubmit={handleRegister} class="flex flex-col gap-4">
          <div>
            <h1 class="font-display text-xl text-foreground">Create account</h1>
            <p class="text-xs text-muted-foreground mt-1">
              Your department, standing and skills drive your match recommendations.
            </p>
          </div>

          <div class="field">
            <label for="reg-name" class="field-label">Full name</label>
            <div class="relative">
              <UserIcon
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="reg-name"
                type="text"
                autocomplete="name"
                placeholder="Jane Doe"
                bind:value={registerName}
                required
                class="field-input field-icon"
              />
            </div>
          </div>

          <div class="field">
            <label for="reg-email" class="field-label">Academic email</label>
            <div class="relative">
              <Mail
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="reg-email"
                type="email"
                autocomplete="email"
                placeholder="jane@university.edu"
                bind:value={registerEmail}
                required
                class="field-input field-icon"
              />
            </div>
          </div>

          <div class="field">
            <label for="reg-password" class="field-label">Password</label>
            <div class="relative">
              <Lock
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autocomplete="new-password"
                placeholder="At least 6 characters"
                bind:value={registerPassword}
                required
                minlength="6"
                aria-describedby="reg-password-hint"
                class="field-input field-icon pr-11"
              />
              <button
                type="button"
                onclick={() => (showPassword = !showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                class="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-sm text-muted-foreground
                  hover:text-foreground transition-colors cursor-pointer"
              >
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
            <p id="reg-password-hint" class="field-hint">Minimum 6 characters.</p>
          </div>

          <!-- Role Selector -->
          <fieldset class="field border-0 p-0 m-0">
            <legend class="field-label p-0 mb-1.5">Account role</legend>
            <div class="grid grid-cols-3 gap-2">
              {#each roles as r (r.value)}
                <label
                  class="flex flex-col items-center text-center gap-0.5 px-2 py-2.5 rounded-md border cursor-pointer
                    transition-colors
                    {registerRole === r.value
                    ? 'bg-accent/10 border-accent text-foreground'
                    : 'border-border text-muted-foreground hover:bg-secondary'}"
                >
                  <input
                    type="radio"
                    name="account-role"
                    value={r.value}
                    bind:group={registerRole}
                    class="sr-only"
                  />
                  <span class="text-xs font-bold">{r.label}</span>
                  <span class="text-3xs leading-tight">{r.hint}</span>
                </label>
              {/each}
            </div>
          </fieldset>

          <!-- Department Selector -->
          <div class="field">
            <label for="reg-dept" class="field-label">Department</label>
            <select id="reg-dept" bind:value={registerDept} class="field-select">
              {#each departments as d (d.id)}
                <option value={d.name}>{d.name}</option>
              {/each}
            </select>
          </div>

          {#if registerRole === 'student'}
            <!-- Academic Year -->
            <div class="field">
              <label for="reg-year" class="field-label">Academic standing</label>
              <select id="reg-year" bind:value={registerYear} class="field-select">
                <option value="Year 1">Year 1 (Freshman)</option>
                <option value="Year 2">Year 2 (Sophomore)</option>
                <option value="Year 3">Year 3 (Junior)</option>
                <option value="Year 4">Year 4 (Senior)</option>
              </select>
            </div>
          {/if}

          <Button type="submit" variant="primary" class="w-full mt-1" loading={submitting}>
            Create account
            <ArrowRight class="w-4 h-4" />
          </Button>
        </form>
      {/if}
    </div>
  </main>
</div>
