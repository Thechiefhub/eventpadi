-- Fix critical security issues identified in security scan
-- 1. event_team_members: replace overly permissive token SELECT policy with secure RPC function
-- 2. event_registrations: replace permissive INSERT policy with validated one
-- 3. Revoke unnecessary EXECUTE privileges on trigger functions

-- ============================================
-- 1. Secure invite lookup by token (replaces "Anyone can read by invitation token" policy)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  invited_email text,
  role text,
  status text,
  token_expires_at timestamptz,
  event_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tm.id,
    tm.event_id,
    tm.invited_email,
    tm.role,
    tm.status,
    tm.token_expires_at,
    e.name as event_name
  FROM public.event_team_members tm
  LEFT JOIN public.events e ON e.id = tm.event_id
  WHERE tm.invitation_token = p_token;
$$;

-- Grant execute to roles that need to accept invites (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;

-- Drop the dangerous policy that exposed all invitation tokens
DROP POLICY IF EXISTS "Anyone can read by invitation token" ON public.event_team_members;

-- ============================================
-- 2. Harden event_registrations INSERT policy
-- ============================================
-- Replace the permissive "Anyone can register" policy with one that validates
-- the registration page is published, payment_status is restricted, and user_id
-- matches the actual event owner.
DROP POLICY IF EXISTS "Anyone can register" ON public.event_registrations;

CREATE POLICY "Anyone can register for published pages"
  ON public.event_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    payment_status IN ('pending', 'free')
    AND amount >= 0
    AND admits >= 1
    AND user_id = (
      SELECT rp.user_id FROM public.event_registration_pages rp WHERE rp.id = registration_page_id
    )
    AND EXISTS (
      SELECT 1 FROM public.event_registration_pages rp
      WHERE rp.id = registration_page_id AND rp.is_published = true
    )
  );

-- ============================================
-- 3. Revoke EXECUTE on internal trigger functions from client roles
-- These functions are only meant to be called by database triggers,
-- not directly by application clients.
-- ============================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_registration_to_attendee() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- Also revoke on any other definer functions that shouldn't be client-callable
REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;
