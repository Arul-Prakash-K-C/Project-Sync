<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.svelte';
  import { db } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { getDashboardRoute } from '$lib/utils/navigation';
  import { Sparkles, ArrowRight, ShieldCheck, Mail, Lock, User as UserIcon } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
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

  // Load Departments
  const departments = db.getDepartments();

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

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    try {
      const user = await auth.login(loginEmail, loginPassword);
      toast.success(`Welcome back, ${user.name}!`);
      goto(getDashboardRoute(user.role));
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  }

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword) {
      toast.error('Please fill all required fields');
      return;
    }
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
      toast.error(err.message || 'Registration failed');
    }
  }

  function fillDemoCredentials(email: string) {
    loginEmail = email;
    loginPassword = 'demo1234';
  }
</script>

<div class="min-h-screen flex items-center justify-center p-6 bg-grid bg-background relative overflow-hidden">
  <!-- Glowing backgrounds -->
  <div class="absolute w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] top-1/4 left-1/4 pointer-events-none"></div>

  <div class="w-full max-w-lg relative z-10 flex flex-col gap-6">
    <!-- Brand Title -->
    <a href="/" class="flex items-center gap-2 self-center hover:scale-102 transition-transform">
      <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg shadow-primary/30">
        TF
      </div>
      <span class="text-2xl font-bold tracking-tight text-foreground">TeamForge</span>
    </a>

    <Card glass class="p-8">
      <Tabs 
        items={[
          { value: 'login', label: 'Sign In' },
          { value: 'register', label: 'Create Account' }
        ]} 
        bind:active={activeTab} 
        class="mb-6"
      />

      {#if activeTab === 'login'}
        <form onsubmit={handleLogin} class="flex flex-col gap-4">
          <div class="text-center mb-2">
            <h2 class="text-xl font-bold text-foreground">Welcome Back</h2>
            <p class="text-xs text-muted-foreground mt-1">Sign in to coordinate with your teammates</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="email" class="text-xs font-semibold text-foreground">Academic Email</label>
            <div class="relative">
              <span class="absolute left-3.5 top-3 text-muted-foreground"><Mail class="w-4.5 h-4.5" /></span>
              <input 
                id="email"
                type="email" 
                placeholder="you@university.edu" 
                bind:value={loginEmail}
                required
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="password" class="text-xs font-semibold text-foreground">Password</label>
            <div class="relative">
              <span class="absolute left-3.5 top-3 text-muted-foreground"><Lock class="w-4.5 h-4.5" /></span>
              <input 
                id="password"
                type="password"
                placeholder="••••••••"
                bind:value={loginPassword}
                required
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" class="w-full mt-2">
            Sign In
            <ArrowRight class="w-4 h-4" />
          </Button>

          <!-- Quick Login Demos -->
          <div class="mt-6 pt-6 border-t border-border/60">
            <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center mb-3">Quick Demo Profiles</p>
            <div class="grid grid-cols-3 gap-2">
              <button 
                type="button"
                onclick={() => fillDemoCredentials('alex@teamforge.edu')}
                class="py-2 px-1 text-center border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Student
              </button>
              <button 
                type="button"
                onclick={() => fillDemoCredentials('evelyn@teamforge.edu')}
                class="py-2 px-1 text-center border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Faculty
              </button>
              <button 
                type="button"
                onclick={() => fillDemoCredentials('admin@teamforge.edu')}
                class="py-2 px-1 text-center border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Admin
              </button>
            </div>
          </div>
        </form>
      {:else}
        <form onsubmit={handleRegister} class="flex flex-col gap-4">
          <div class="text-center mb-2">
            <h2 class="text-xl font-bold text-foreground">Create Account</h2>
            <p class="text-xs text-muted-foreground mt-1">Get match recommendations based on your profile</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reg-name" class="text-xs font-semibold text-foreground">Full Name</label>
            <div class="relative">
              <span class="absolute left-3.5 top-3 text-muted-foreground"><UserIcon class="w-4.5 h-4.5" /></span>
              <input 
                id="reg-name"
                type="text" 
                placeholder="Jane Doe" 
                bind:value={registerName}
                required
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reg-email" class="text-xs font-semibold text-foreground">Academic Email</label>
            <div class="relative">
              <span class="absolute left-3.5 top-3 text-muted-foreground"><Mail class="w-4.5 h-4.5" /></span>
              <input 
                id="reg-email"
                type="email" 
                placeholder="jane@university.edu" 
                bind:value={registerEmail}
                required
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="reg-password" class="text-xs font-semibold text-foreground">Password</label>
            <div class="relative">
              <span class="absolute left-3.5 top-3 text-muted-foreground"><Lock class="w-4.5 h-4.5" /></span>
              <input
                id="reg-password"
                type="password"
                placeholder="At least 6 characters"
                bind:value={registerPassword}
                required
                minlength="6"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <!-- Role Selector -->
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-foreground">Account Role</span>
            <div class="grid grid-cols-3 gap-2">
              {#each ['student', 'faculty', 'admin'] as r}
                <button
                  type="button"
                  onclick={() => registerRole = r as any}
                  class="py-2.5 border rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer
                    {registerRole === r 
                      ? 'bg-primary/10 border-primary text-primary' 
                      : 'border-border text-muted-foreground hover:bg-muted'}"
                >
                  {r}
                </button>
              {/each}
            </div>
          </div>

          <!-- Department Selector -->
          <div class="flex flex-col gap-1.5">
            <label for="reg-dept" class="text-xs font-semibold text-foreground">Department</label>
            <select
              id="reg-dept"
              bind:value={registerDept}
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            >
              {#each departments as d}
                <option value={d.name}>{d.name}</option>
              {/each}
            </select>
          </div>

          {#if registerRole === 'student'}
            <!-- Academic Year -->
            <div class="flex flex-col gap-1.5">
              <label for="reg-year" class="text-xs font-semibold text-foreground">Academic Standing</label>
              <select
                id="reg-year"
                bind:value={registerYear}
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
              >
                <option value="Year 1">Year 1 (Freshman)</option>
                <option value="Year 2">Year 2 (Sophomore)</option>
                <option value="Year 3">Year 3 (Junior)</option>
                <option value="Year 4">Year 4 (Senior)</option>
              </select>
            </div>
          {/if}

          <Button type="submit" variant="primary" class="w-full mt-2">
            Create Account
            <ArrowRight class="w-4 h-4" />
          </Button>
        </form>
      {/if}
    </Card>
  </div>
</div>
