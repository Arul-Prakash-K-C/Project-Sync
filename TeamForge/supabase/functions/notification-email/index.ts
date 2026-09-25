// Emails a person when an in-app notification is created for them.
//
// Wiring (Supabase dashboard → Database → Webhooks → Create):
//   table: public.notifications   events: INSERT
//   type:  Supabase Edge Function → notification-email
//   header: x-webhook-secret: <same value as the WEBHOOK_SECRET secret>
//
// Secrets (supabase secrets set …):
//   RESEND_API_KEY   API key from resend.com
//   MAIL_FROM        e.g. "TeamForge <noreply@your-domain.edu>"
//   APP_URL          public URL of the app, for links in the email
//   WEBHOOK_SECRET   shared secret the webhook sends in x-webhook-secret
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

interface NotificationRecord {
  id: string;
  data: { userId: string; title: string; description: string; actionUrl?: string };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('Forbidden', { status: 403 });
  }

  const payload = await req.json();
  if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return new Response('Ignored', { status: 200 });
  }
  const record = payload.record as NotificationRecord;

  // The service role reads past RLS to find the recipient's address.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: user } = await admin.from('users').select('email, data').eq('id', record.data.userId).maybeSingle();
  if (!user?.email) return new Response('No recipient', { status: 200 });

  const appUrl = Deno.env.get('APP_URL') ?? '';
  const link = `${appUrl}${record.data.actionUrl ?? '/dashboard'}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM'),
      to: user.email,
      subject: `TeamForge · ${record.data.title}`,
      text: `${record.data.description}\n\nOpen TeamForge: ${link}`,
      html: `<p>${escapeHtml(record.data.description)}</p><p><a href="${escapeHtml(link)}">Open in TeamForge</a></p>`
    })
  });

  if (!res.ok) {
    console.error('Resend rejected the email', res.status, await res.text());
    return new Response('Send failed', { status: 502 });
  }
  return new Response('Sent', { status: 200 });
});
