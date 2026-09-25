<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth, PendingConfirmationError } from '$lib/stores/auth.svelte';
  import { db } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { getDashboardRoute } from '$lib/utils/navigation';
  import { evaluatePasswordStrength, type PasswordStrength } from '$lib/utils/password';
  import { getRateLimitStatus, type RateLimitStatus } from '$lib/utils/rateLimiter';
  import {
    ArrowRight,
    Mail,
    Lock,
    User as UserIcon,
    Eye,
    EyeOff,
    AlertCircle,
    Clock,
    ShieldAlert
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ForgeScene from '$lib/components/three/ForgeScene.svelte';
  import { isCloudMode, cloudOptions } from '$lib/supabase/config';
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
  let formError = $state('');

  // Rate limit / lockout state
  let lockoutStatus = $state<RateLimitStatus>({
    locked: false,
    remainingSeconds: 0,
    failedAttempts: 0,
    attemptsLeft: 5
  });
  let lockoutTimer: any = null;

  // Password strength derived state
  let passwordStrength = $derived<PasswordStrength>(
    evaluatePasswordStrength(registerPassword)
  );

  // Departments arrive asynchronously in cloud mode, so keep them live.
  let departments = $state(db.getDepartments());

  const roles: { value: 'student' | 'faculty' | 'admin'; label: string; hint: string }[] = [
    { value: 'student', label: 'Student', hint: 'Form teams, run projects' },
    { value: 'faculty', label: 'Faculty', hint: 'Approve and review work' },
    { value: 'admin', label: 'Admin', hint: 'Manage the platform' }
  ];

  /** Demo profiles only exist in local mode, or in a cloud deployment seeded with them. */
  const showDemoProfiles = !isCloudMode || cloudOptions.seedDemo;
  const demoProfiles = [
    { label: 'Student', email: 'alex@teamforge.edu' },
    { label: 'Faculty', email: 'evelyn@teamforge.edu' },
    { label: 'Admin', email: 'admin@teamforge.edu' }
  ];

  function updateLockout() {
    if (loginEmail) {
      lockoutStatus = getRateLimitStatus(loginEmail);
    } else {
      lockoutStatus = { locked: false, remainingSeconds: 0, failedAttempts: 0, attemptsLeft: 5 };
    }
  }

  // Someone already signed in has no business on this page.
  $effect(() => {
    if (!auth.loading && auth.user && !submitting) goto(getDashboardRoute(auth.user.role), { replaceState: true });
  });

  onMount(() => {
    const stopDeptWatch = db.onChange((key) => {
      if (key !== 'departments') return;
      departments = db.getDepartments();
      if (!registerDept && departments.length > 0) registerDept = departments[0].name;
    });
    if (auth.expiredNotice) {
      formError = 'Your session expired after 24 hours. Please sign in again.';
    }

    // Set active tab based on query param
    const tabParam = $page.url.searchParams.get('tab');
    if (tabParam === 'register') {
      activeTab = 'register';
    }
    // Set default department
    if (departments.length > 0) {
      registerDept = departments[0].name;
    }

    // Interval to refresh lockout countdown
    lockoutTimer = setInterval(() => {
      if (loginEmail) {
        updateLockout();
      }
    }, 1000);

    return stopDeptWatch;
  });

  onDestroy(() => {
    if (lockoutTimer) clearInterval(lockoutTimer);
  });

  $effect(() => {
    loginEmail;
    updateLockout();
  });

  // Switching tabs clears stale errors
  let lastTab = 'login';
  $effect(() => {
    if (activeTab !== lastTab) {
      lastTab = activeTab;
      formError = '';
    }
  });

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    formError = '';
    updateLockout();

    if (lockoutStatus.locked) {
      formError = `Account temporarily locked. Please wait ${lockoutStatus.remainingSeconds}s before retrying.`;
      toast.error(formError);
      return;
    }

    submitting = true;
    try {
      const user = await auth.login(loginEmail, loginPassword);
      toast.success(`Welcome back, ${user.name}!`);
      goto(getDashboardRoute(user.role));
    } catch (err: any) {
      formError = err.message || 'Login failed';
      updateLockout();
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

    if (registerPassword.length < 8) {
      formError = 'Password must be at least 8 characters long';
      toast.error(formError);
      return;
    }

    if (passwordStrength.score < 2) {
      formError = 'Please choose a stronger password matching the complexity requirements';
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
      toast.success('Registration successful! Welcome to TeamForge.');
      goto(getDashboardRoute(user.role));
    } catch (err: any) {
      if (err instanceof PendingConfirmationError) {
        // Not a failure: the account exists and is waiting on the email link.
        toast.info(err.message, 8000);
        loginEmail = registerEmail;
        activeTab = 'login';
        return;
      }
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
    updateLockout();
  }
</script>

<svelte:head>
  <title>Sign in — TeamForge</title>
</svelte:head>

<div class="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
  <!-- Left rail -->
  <aside class="hidden lg:flex relative flex-col justify-between border-r border-border p-12 xl:p-14 overflow-hidden">
    <a href="/" class="relative z-10 flex items-center gap-2.5 w-fit rounded-sm">
      <span
        class="chamfer w-8 h-8 bg-accent flex items-center justify-center text-accent-foreground font-display text-xs"
        aria-hidden="true">TF</span
      >
      <span class="font-display text-base text-foreground">TeamForge</span>
    </a>

    <ForgeScene class="absolute inset-x-8 top-[42%] -translate-y-1/2 h-[min(60vh,520px)]" controls={false} count={110} />

    <div class="relative z-10 max-w-sm">
      <h2 class="font-display text-3xl leading-[1.1] text-foreground">
        Build teams on evidence, not luck.
      </h2>
      <p class="mt-4 text-sm text-muted-foreground leading-relaxed">
        Explainable matching, one workspace per project, and faculty review in the same place.
      </p>
    </div>
  </aside>

  <!-- Form column -->
  <main class="flex items-center justify-center p-6 sm:p-10">
    <div class="w-full max-w-md flex flex-col gap-6">
      <a href="/" class="flex items-center gap-2.5 self-center lg:hidden rounded-sm">
        <span
          class="chamfer w-9 h-9 bg-accent flex items-center justify-center text-accent-foreground font-display text-sm font-bold"
          aria-hidden="true">TF</span
        >
        <span class="font-display text-lg text-foreground tracking-tight">TeamForge</span>
      </a>

      <Tabs
        label="Account access"
        items={[
          { value: 'login', label: 'Sign in' },
          { value: 'register', label: 'Create account' }
        ]}
        bind:active={activeTab}
      />

      <!-- Lockout Alert Banner -->
      {#if activeTab === 'login' && lockoutStatus.locked}
        <div
          role="alert"
          class="flex items-start gap-3 p-3.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive"
        >
          <ShieldAlert class="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div class="flex-1">
            <p class="text-xs font-bold">Account Locked (Brute-force protection)</p>
            <p class="text-xs mt-0.5 opacity-90 flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5" />
              Unlocks in <span class="font-mono font-bold text-sm">{lockoutStatus.remainingSeconds}s</span>
            </p>
          </div>
        </div>
      {/if}

      {#if formError && (!lockoutStatus.locked || activeTab !== 'login')}
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
              Sign in with your academic credentials.
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
                disabled={lockoutStatus.locked}
                aria-invalid={formError ? 'true' : undefined}
                class="field-input field-icon pr-11 disabled:opacity-60 disabled:cursor-not-allowed"
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

          <Button
            type="submit"
            variant="primary"
            class="w-full mt-1"
            loading={submitting}
            disabled={lockoutStatus.locked}
          >
            {#if lockoutStatus.locked}
              Locked ({lockoutStatus.remainingSeconds}s)
            {:else}
              Sign in
              <ArrowRight class="w-4 h-4" />
            {/if}
          </Button>

          <!-- Quick Login Demos -->
          {#if showDemoProfiles}
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
            <p class="field-hint text-center mt-2">Fills the form with demo password (<code class="font-mono text-2xs bg-secondary px-1 py-0.5 rounded">demo1234</code>).</p>
          </div>
          {/if}
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
                placeholder="At least 8 characters"
                bind:value={registerPassword}
                required
                minlength="8"
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

            <!-- Strength meter: four segments and a single line saying what is still missing. -->
            {#if registerPassword}
              <div class="mt-1 flex flex-col gap-1.5" aria-live="polite">
                <div class="grid grid-cols-4 gap-1" aria-hidden="true">
                  {#each [1, 2, 3, 4] as seg (seg)}
                    <span
                      class="h-1 rounded-full transition-colors duration-300"
                      style="background-color: {passwordStrength.score >= seg ? passwordStrength.color : 'var(--border)'}"
                    ></span>
                  {/each}
                </div>
                <p class="field-hint flex justify-between gap-3">
                  <span>
                    {#if passwordStrength.feedback.length > 0}
                      Add: {passwordStrength.feedback.join(' · ').toLowerCase()}
                    {:else}
                      Meets every requirement
                    {/if}
                  </span>
                  <span class="font-semibold shrink-0" style="color: {passwordStrength.color}">{passwordStrength.label}</span>
                </p>
              </div>
            {:else}
              <p id="reg-password-hint" class="field-hint">Minimum 8 characters with mixed case, numbers, or symbols.</p>
            {/if}
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

          <!-- Department: students and faculty belong to one (it scopes approvals,
               analytics and matching); administrators run the whole platform. -->
          {#if registerRole !== 'admin'}
            <div class="field">
              <label for="reg-dept" class="field-label">Department</label>
              <select id="reg-dept" bind:value={registerDept} class="field-select">
                {#each departments as d (d.id)}
                  <option value={d.name}>{d.name}</option>
                {/each}
              </select>
            </div>
          {/if}

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
