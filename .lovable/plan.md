
# EventPadi → Sophistication Roadmap

Goal: make organizers switch from Eventbrite / Hubilo / Luma to **EventPadi** by combining Africa-native payments + logistics, AI everywhere, marketplace discovery, and enterprise polish — across conferences, festivals, hybrid events, and paid trainings.

What's already strong today (don't rebuild): Spark, Chase, Buzz, Engine, D-Day, public registration with tiers, QR check-in, badge sharing, announcements, AI content + perks, e-certificates, team invites, super-admin stats.

What's missing to feel "sophisticated" sits in 4 buckets: **Money, Attendee Experience, Organizer Power, Network Effect.**

---

## P0 — Ship next (biggest unlock, lowest effort)

These close the biggest gaps that organizers immediately notice when comparing to Eventbrite / Luma.

1. **Africa-native paid ticketing**
   - Paystack + Flutterwave + M-Pesa (Daraja) + MTN/Airtel MoMo checkout on the public registration page.
   - Multi-currency (NGN, KES, GHS, ZAR, USD) with FX display; payouts dashboard; refund button.
   - Promo codes, early-bird tiers, group/table tickets, "pay what you want", invoice/bank-transfer with manual approval.
   - Slots into existing `event_registrations` (status: `pending → paid → refunded`).

2. **Event website builder (no-code)**
   - Drag-free block editor on top of the current registration page: Hero, About, Agenda, Speakers, Sponsors, Venue map, FAQ, Gallery, Countdown, Testimonials, Sign-up.
   - Themes (3–5 African-aesthetic presets), custom subdomain (`yourevent.eventpadi.com`) + custom domain.
   - SEO: per-event meta, OG image auto-rendered from flyer + title, JSON-LD `Event` schema, sitemap.

3. **Agenda / Sessions / Speakers module**
   - Multi-track agenda with rooms, tags, capacity; speaker bios + headshots.
   - Personal agenda ("Add to my schedule"), conflict detection, ICS export, Add to Google/Apple calendar.
   - Per-session check-in QR (CPD/training events live or die on this).

4. **Attendee app (PWA) with QR wallet**
   - Attendee-side PWA: My Tickets (QR), schedule, announcements, networking, certificates.
   - Apple Wallet + Google Wallet pass generation for each ticket.
   - Works offline (already a project Core constraint).

5. **Payouts, finance & tax**
   - Organizer wallet: gross sales, fees, net payable, payout history, CSV export.
   - Auto-invoice/receipt PDF per registration (already have PDF infra via jspdf).
   - VAT/withholding presets per country.

---

## P1 — Network effects & differentiation

Where you start to feel different from incumbents.

6. **Public event discovery marketplace** (`eventpadi.com/discover`)
   - Browse by city, country, category, date, free/paid.
   - SEO landing pages per city ("Events in Lagos this weekend") — drives free traffic to every organizer.
   - "Featured" slot (monetizable later).

7. **Attendee profiles & networking**
   - Lightweight profile that follows the user across events (photo, role, company, interests, socials).
   - In-event AI matchmaking: "Top 10 people you should meet" with 1-tap meeting requests + scheduled slots.
   - In-app DMs and group chats per session/track.

8. **Sponsor & Exhibitor Hub** (upgrades Chase)
   - Branded virtual + physical booths with lead capture (badge scan → lead in sponsor CRM).
   - Sponsor portal login: view leads, downloads, impressions, ROI dashboard.
   - Sellable packages (logo placements, push notifications, branded sessions).

9. **AI everywhere v2** (compounds your current AI lead)
   - AI Agenda Builder from theme + duration.
   - AI Sponsor Matchmaker (existing Chase data + event theme → ranked targets + tailored pitch).
   - AI Live Captions + Translate (EN/FR/SW/Yoruba/Igbo/Hausa) for hybrid sessions.
   - AI Recap Reel after the event (highlights post + captions + 30s vertical video).
   - AI Email Reply assistant in the organizer inbox.
   - "Ask my event" chatbot for attendees ("Where is the keynote?", "Is lunch halal?").

10. **Hybrid / virtual rooms**
    - Embedded livestream room per session (start with HLS embed + chat + Q&A + polls).
    - On-demand replays gated by ticket tier.
    - Recording auto-uploaded to storage; transcript searchable.

11. **Communications suite**
    - WhatsApp Business API (template + session messaging) — Africa's #1 channel.
    - SMS fallback via Termii / Africa's Talking.
    - Email domain auth (SPF/DKIM/DMARC) + warmup — extend current email delivery.
    - Drip campaigns (T-30 / T-7 / T-1 / day-of / post-event NPS).
    - Unified inbox: replies from email/WA/IG land in one organizer thread.

12. **Forms & Surveys**
    - Custom registration questions per tier (dietary, t-shirt size, accessibility).
    - Live polls + Q&A during sessions; post-event NPS + session ratings feeding sponsor reports.

---

## P2 — Enterprise polish & moat

What unlocks brands, agencies, governments, universities.

13. **Multi-event workspace & roles**
    - Workspaces (agency view managing 10 events) with billing.
    - Granular roles: Owner, Admin, Finance, Marketing, Door Staff, Speaker, Sponsor — extends `event_team_members`.
    - Activity log + audit trail.

14. **White-label & custom domain**
    - Bring-your-own-domain on the event site, attendee app, and emails.
    - Custom logo, colors, favicon, splash; remove EventPadi badge on Pro+.

15. **Advanced analytics & exports**
    - Funnel (visit → reg start → reg complete → paid → checked in).
    - Cohorts, source attribution (UTM), city heatmap, device/network breakdown (2G/3G awareness).
    - Webhooks + Zapier/Make + open REST API + CSV/PDF reports.

16. **Logistics ops** (uniquely African)
    - Vendor & supplier directory (catering, AV, security, generator hire, decor) per city.
    - Budget tracker with categories, payments, invoices, FX.
    - Run-of-show timeline shared with crew on D-Day.
    - Power/internet backup checklist (already a Core constraint — surface it as a feature).

17. **Compliance & trust**
    - 2FA, SSO (Google Workspace + SAML for enterprise) — `configure_saml_sso` exists.
    - GDPR/NDPR data export & delete; cookie consent on public pages.
    - PCI handled by provider; signed receipts; chargeback workflow.

18. **Monetization (your revenue)**
    - Free tier (≤100 attendees), Pro, Business, Enterprise.
    - Per-ticket fee on paid events (e.g. 1.5% + flat) — competitive vs Eventbrite's ~6.95%+.
    - Sponsor marketplace commission.
    - Affiliate / referral program for organizers (the network-effect flywheel).

---

## Phasing (suggested order)

```text
Phase 1 (Money + site)
  1 Paid ticketing (Paystack/Flutterwave/MoMo/M-Pesa)
  2 Event website builder + custom domain
  5 Payouts & finance
  11 Email domain auth + WhatsApp templates

Phase 2 (Attendee + sessions)
  3 Agenda/Sessions/Speakers
  4 Attendee PWA + Wallet passes
  12 Forms, polls, Q&A, NPS

Phase 3 (Network effect)
  6 Discovery marketplace
  7 Profiles + networking + matchmaking
  8 Sponsor/Exhibitor Hub
  9 AI v2

Phase 4 (Enterprise)
  10 Hybrid rooms
  13 Workspaces + roles
  14 White-label
  15 Analytics + API
  16 Logistics ops
  17 Compliance
  18 Pricing & affiliate
```

---

## Benchmark — EventPadi vs incumbents

```text
Capability                       Eventbrite  Luma   Hubilo  Bizzabo   EventPadi today  EventPadi after roadmap
Paid ticketing (cards)              ✅        ✅      ✅      ✅          ❌                ✅ (P0-1)
Africa local pay (MoMo/M-Pesa)      ⚠️ (few)  ❌      ❌      ❌          ❌                ✅ (P0-1)  ← MOAT
Multi-currency + payouts            ✅        ⚠️      ✅      ✅          ❌                ✅ (P0-5)
No-code event website builder       ✅        ✅      ✅      ✅          ⚠️ (basic)        ✅ (P0-2)
Custom domain / white-label         ⚠️ paid   ❌      ✅      ✅          ❌                ✅ (P2-14)
Agenda / sessions / speakers        ⚠️        ❌      ✅      ✅          ❌                ✅ (P0-3)
Per-session check-in                ⚠️        ❌      ✅      ✅          ❌ (event only)   ✅ (P0-3)
Apple/Google Wallet tickets         ✅        ✅      ⚠️      ⚠️          ❌                ✅ (P0-4)
Attendee mobile/PWA app             ✅        ✅      ✅      ✅          ⚠️                ✅ (P0-4)
Public discovery / SEO pages        ✅        ✅      ❌      ❌          ❌                ✅ (P1-6)  ← MOAT
Networking + AI matchmaking         ⚠️        ✅      ✅      ✅          ❌                ✅ (P1-7,9)
Sponsor lead capture + ROI          ❌        ❌      ✅      ✅          ⚠️ (Chase CRM)   ✅ (P1-8)
WhatsApp + SMS comms                ❌        ❌      ⚠️      ⚠️          ⚠️ (links only)  ✅ (P1-11)  ← MOAT
Live captions + translate           ❌        ❌      ✅      ✅          ❌                ✅ (P1-9)
Hybrid livestream + replays         ⚠️        ⚠️      ✅      ✅          ❌                ✅ (P1-10)
AI agenda / recap / pitch           ❌        ⚠️      ⚠️      ⚠️          ✅ (partial)      ✅ (P1-9)   ← MOAT
Polls / Q&A / surveys / NPS         ⚠️        ⚠️      ✅      ✅          ❌                ✅ (P1-12)
Multi-event workspace + roles       ✅        ⚠️      ✅      ✅          ⚠️ (basic)        ✅ (P2-13)
Analytics + Webhooks + API          ✅        ⚠️      ✅      ✅          ❌                ✅ (P2-15)
SSO / 2FA / GDPR exports            ✅        ⚠️      ✅      ✅          ⚠️                ✅ (P2-17)
Offline-first / 2G/3G mode          ❌        ❌      ❌      ❌          ✅                ✅                ← MOAT
African vendor & logistics ops      ❌        ❌      ❌      ❌          ⚠️                ✅ (P2-16) ← MOAT
Per-ticket fee                      ~6.95%+   2.5%    quote   quote        n/a               target ≤2%        ← MOAT
```

Net read: shipping **Phase 1 + Phase 2** alone closes the table to parity with Luma/Eventbrite while keeping your unique African + AI + offline moat. **Phases 3–4** are what win agencies, brands, and government tenders away from Hubilo / Bizzabo.

---

## What I'd recommend we start building first

If you approve this plan, the highest-ROI first build is **Phase 1, item #1: Paid ticketing with Paystack + Flutterwave + M-Pesa + MoMo** on the existing public registration page, with the payouts dashboard (item #5). That single shipment turns EventPadi from a free-event tool into a revenue platform for both organizers and you — and unlocks every later module.

Want me to draft the Phase 1 build plan next?
