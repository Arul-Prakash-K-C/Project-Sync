import { db, type StaffRequest, type User } from './db';
import { isCloudMode } from '$lib/supabase/config';

/*
  Approving or rejecting a faculty sign-up. In cloud mode this has to happen in
  the database (approve_staff_request / reject_staff_request), because creating
  someone else's account link is something only a checked server-side function
  may do. The admin's synced data then updates through Realtime.
*/

async function rpc(name: string, args: Record<string, unknown>) {
  const { getSupabase } = await import('$lib/supabase/client');
  const sb = await getSupabase();
  const { error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message);
}

export async function approveStaff(request: StaffRequest, admin: User): Promise<void> {
  if (isCloudMode) {
    await rpc('approve_staff_request', { request_id: request.id });
    // Reflect the decision immediately; Realtime brings the new faculty profile.
    db.applyRemote(
      'staff_requests',
      db.getStaffRequests().map((r) => (r.id === request.id ? { ...r, status: 'approved' as const } : r))
    );
    return;
  }
  db.approveStaffRequest(request.id, admin);
}

export async function rejectStaff(request: StaffRequest, admin: User, reason: string): Promise<void> {
  if (isCloudMode) {
    await rpc('reject_staff_request', { request_id: request.id, reason });
    db.applyRemote(
      'staff_requests',
      db.getStaffRequests().map((r) => (r.id === request.id ? { ...r, status: 'rejected' as const, reason } : r))
    );
    return;
  }
  db.rejectStaffRequest(request.id, admin, reason);
}
