

## Auto E-Certificate on Check-In

Build a system that automatically generates a personalized PDF certificate and emails it to each attendee the moment they are checked in.

### How It Works

1. Attendee is checked in (search or QR scan)
2. The check-in hook calls a new edge function
3. The edge function generates a PDF certificate with the attendee's details
4. The certificate is stored in cloud storage
5. An email with the certificate download link is sent to the attendee

### Implementation Steps

**1. Database: Add certificate tracking columns**
- Add `certificate_url` (text, nullable) and `certificate_sent_at` (timestamp, nullable) to the `attendees` table via migration
- This prevents duplicate sends and lets admins see certificate status

**2. Storage: Create `certificates` bucket**
- Public bucket so attendees can download via link
- RLS policy: authenticated users can upload

**3. Edge Function: `send-certificate`**
- Accepts: attendee name, email, event name, event date, event location, attendee ID, certificate ID
- Generates a PDF certificate using a default designed template with:
  - Attendee name (prominent)
  - Event name, date, location
  - Unique certificate ID
  - Organizer signature line
- Uploads PDF to the `certificates` storage bucket
- Sends email to attendee with download link (using Lovable AI for email via the existing email infrastructure pattern)
- Updates the attendee row with `certificate_url` and `certificate_sent_at`
- Also supports a `custom_template` mode where an uploaded background image is used instead of the default design

**4. Frontend: Wire check-in to trigger certificate**
- In `useAttendees.ts`, after a successful check-in update, call `supabase.functions.invoke('send-certificate', ...)` with attendee + event data
- Only trigger if the attendee has an email address
- Show a toast: "Certificate sent to {email}"
- Skip if `certificate_sent_at` is already set (prevent duplicates)

**5. D-Day Dashboard: Certificate status visibility**
- Add a small badge/icon on the Attendees tab showing certificate sent status
- Add a "Resend Certificate" button for admins

**6. Custom Template Upload (future-ready)**
- In the Badges/Certificates tab, allow admins to upload a custom certificate background image (PNG/PDF)
- The edge function overlays attendee details on top of the uploaded template
- Falls back to the built-in designed template if none uploaded

### Email Setup Prerequisite

This feature requires email sending capability. I'll need to set up the email infrastructure first (email domain configuration). Once your certificate template and email copy are ready, I'll style everything to match.

### What I Need From You

1. **Your certificate template** — upload it when ready (image or PDF background)
2. **Your email text** — the message body you want attendees to receive with their certificate

I can start building the infrastructure and default certificate design now, then swap in your custom template and email copy once you provide them.

### Technical Details

- Edge function: `supabase/functions/send-certificate/index.ts`
- PDF generation: Using `jsPDF` or ReportLab-style generation in the edge function
- Storage bucket: `certificates` (public)
- New attendee columns: `certificate_url`, `certificate_sent_at`
- Email: Lovable built-in email infrastructure (requires domain setup)

