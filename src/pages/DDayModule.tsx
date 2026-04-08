/**
 * The D-Day Module — Attendance & Check-in System
 *
 * USER GUIDE:
 * 1. Select your event from the dropdown at the top.
 * 2. ATTENDEES tab: Upload a CSV/Excel file with your guest list. Map columns to name, email, phone, etc.
 * 3. CHECK-IN tab: Search attendees by name/email/phone or scan QR codes to check them in.
 * 4. DASHBOARD tab: View live stats — total registered, checked-in, remaining, and a recent check-in feed.
 * 5. TEAM tab: Invite team members by email. Admins get full access; Staff can only check in.
 * 6. Export: Download a CSV of all checked-in attendees from the Attendees tab.
 *
 * Offline: The check-in interface caches attendees locally. If you lose connection,
 * check-ins are queued and synced automatically when back online.
 *
 * Real-time: All stats update live across all logged-in team members via WebSockets.
 */

import { CalendarCheck, UserCheck, Users, Shield, QrCode, Award } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventSelect } from "@/hooks/useEventSelect";
import { useAttendees } from "@/hooks/useAttendees";
import { useAuth } from "@/contexts/AuthContext";
import DDayDashboard from "@/components/dday/DDayDashboard";
import CheckInInterface from "@/components/dday/CheckInInterface";
import AttendeeUpload from "@/components/dday/AttendeeUpload";
import TeamManager from "@/components/dday/TeamManager";
import BadgeGenerator from "@/components/dday/BadgeGenerator";
import CertificateSettings from "@/components/dday/CertificateSettings";

export default function DDayModule() {
  const { user } = useAuth();
  const { events, selectedEventId, setSelectedEventId, loading: eventsLoading } = useEventSelect();
  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const { attendees, loading: attendeesLoading, fetchAttendees, checkIn, undoCheckIn, generateMissingTicketIds } = useAttendees(selectedEventId, selectedEvent ? { name: selectedEvent.name, event_date: selectedEvent.event_date, city: selectedEvent.city, country: selectedEvent.country } : undefined);

  // Event owner is always admin; could extend with team role check in the future
  const isAdmin = !!user && events.some((e) => e.id === selectedEventId);

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-6 text-center">
        <CalendarCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-display text-lg text-foreground">No events yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create an event first to manage attendance.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">The D‑Day</h1>
        </div>
        {events.length > 1 && (
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {events.length === 1 && (
          <span className="text-sm text-muted-foreground">{events[0].name}</span>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 hidden sm:inline" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="checkin" className="text-xs sm:text-sm">
            <UserCheck className="h-4 w-4 mr-1 hidden sm:inline" /> Check-In
          </TabsTrigger>
          <TabsTrigger value="attendees" className="text-xs sm:text-sm">
            Attendees
          </TabsTrigger>
          <TabsTrigger value="badges" className="text-xs sm:text-sm">
            <QrCode className="h-4 w-4 mr-1 hidden sm:inline" /> Badges
          </TabsTrigger>
          <TabsTrigger value="certificates" className="text-xs sm:text-sm">
            <Award className="h-4 w-4 mr-1 hidden sm:inline" /> Certs
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs sm:text-sm">
            <Shield className="h-4 w-4 mr-1 hidden sm:inline" /> Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DDayDashboard attendees={attendees} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="checkin" className="mt-4">
          <CheckInInterface attendees={attendees} onCheckIn={checkIn} onUndoCheckIn={undoCheckIn} />
        </TabsContent>

        <TabsContent value="attendees" className="mt-4">
          <AttendeeUpload eventId={selectedEventId} attendees={attendees} onUploaded={fetchAttendees} />
        </TabsContent>

        <TabsContent value="badges" className="mt-4">
          <BadgeGenerator
            attendees={attendees}
            eventName={events.find((e) => e.id === selectedEventId)?.name || ""}
            onGenerateMissingIds={generateMissingTicketIds}
          />
        </TabsContent>

        <TabsContent value="certificates" className="mt-4">
          <CertificateSettings
            eventId={selectedEventId}
            eventName={events.find((e) => e.id === selectedEventId)?.name || ""}
          />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamManager eventId={selectedEventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
