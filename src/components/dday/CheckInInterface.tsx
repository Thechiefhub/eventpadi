import { useState, useEffect, useRef, useMemo } from "react";
import { Search, QrCode, UserCheck, Undo2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Attendee } from "@/hooks/useAttendees";

interface Props {
  attendees: Attendee[];
  onCheckIn: (id: string) => Promise<boolean>;
  onUndoCheckIn: (id: string) => Promise<void>;
}

export default function CheckInInterface({ attendees, onCheckIn, onUndoCheckIn }: Props) {
  const [query, setQuery] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [lastCheckedIn, setLastCheckedIn] = useState<Attendee | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [visibleCount, setVisibleCount] = useState(30);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const isSearching = query.trim().length >= 2;

  const searchResults = isSearching
    ? attendees.filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          (a.email && a.email.toLowerCase().includes(query.toLowerCase())) ||
          (a.phone && a.phone.includes(query)) ||
          (a.ticket_id && a.ticket_id.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  // Sort: unchecked first, then by name
  const sortedAttendees = useMemo(() => {
    return [...attendees].sort((a, b) => {
      if (a.checked_in !== b.checked_in) return a.checked_in ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [attendees]);

  const displayList = isSearching ? searchResults : sortedAttendees.slice(0, visibleCount);
  const hasMore = !isSearching && visibleCount < sortedAttendees.length;

  const handleCheckIn = async (attendee: Attendee) => {
    const ok = await onCheckIn(attendee.id);
    if (ok) {
      setLastCheckedIn({ ...attendee, checked_in: true });
      setQuery("");
    }
  };

  // QR Scanner
  const startScanner = async () => {
    setScannerActive(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    setTimeout(() => {
      if (!scannerContainerRef.current) return;
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const found = attendees.find(
            (a) =>
              a.ticket_id === decodedText ||
              a.email === decodedText ||
              a.id === decodedText
          );
          if (found && !found.checked_in) {
            onCheckIn(found.id).then((ok) => {
              if (ok) setLastCheckedIn({ ...found, checked_in: true });
            });
          } else if (found?.checked_in) {
            setLastCheckedIn(found);
          } else {
            setQuery(decodedText);
          }
          stopScanner();
        },
        () => {}
      ).catch(() => {
        setScannerActive(false);
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const checkedInCount = attendees.filter(a => a.checked_in).length;

  const renderAttendeeCard = (a: Attendee) => (
    <Card key={a.id} className="border-border">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full gradient-sunset flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            {a.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{a.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {a.email || a.phone || a.role || "attendee"}
              <span className="ml-1.5 font-medium text-primary">
                · Admit {a.admits}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {a.checked_in ? (
            <>
              <Badge variant="secondary" className="bg-[hsl(var(--earth-green)/0.15)] text-[hsl(var(--earth-green))]">
                Checked In
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => onUndoCheckIn(a.id)} title="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => handleCheckIn(a)} className="gradient-sunset text-primary-foreground">
              Check In
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Success Banner */}
      {lastCheckedIn && (
        <Card className="border-[hsl(var(--earth-green))] bg-[hsl(var(--earth-green)/0.1)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-[hsl(var(--earth-green))]" />
              <div>
                <p className="font-display font-bold text-foreground">{lastCheckedIn.name}</p>
                <p className="text-xs text-muted-foreground">
                  ✓ Checked in · Admit {lastCheckedIn.admits}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setLastCheckedIn(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, or ticket ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          autoFocus
        />
      </div>

      {/* QR Scanner Toggle */}
      <div className="flex gap-2">
        <Button
          variant={scannerActive ? "destructive" : "outline"}
          className="flex-1"
          onClick={scannerActive ? stopScanner : startScanner}
        >
          <QrCode className="h-4 w-4 mr-2" />
          {scannerActive ? "Stop Scanner" : "Scan QR Code"}
        </Button>
      </div>

      {/* QR Scanner View */}
      {scannerActive && (
        <div className="rounded-lg overflow-hidden border border-border">
          <div id="qr-reader" ref={scannerContainerRef} className="w-full" />
        </div>
      )}

      {/* Attendee List Header */}
      {!isSearching && attendees.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-medium">
            All Attendees ({attendees.length}) · <span className="text-[hsl(var(--earth-green))]">{checkedInCount} checked in</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs">
            {showAll ? <><ChevronUp className="h-3 w-3 mr-1" /> Collapse</> : <><ChevronDown className="h-3 w-3 mr-1" /> Expand</>}
          </Button>
        </div>
      )}

      {/* Search Results or Full Attendee List */}
      {isSearching && searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{searchResults.length} result(s)</p>
          {searchResults.map(renderAttendeeCard)}
        </div>
      )}

      {isSearching && searchResults.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No attendees found for "{query}"</p>
      )}

      {!isSearching && showAll && attendees.length > 0 && (
        <div className="space-y-2">
          {displayList.map(renderAttendeeCard)}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisibleCount((c) => c + 30)}
            >
              Load more ({sortedAttendees.length - visibleCount} remaining)
            </Button>
          )}
        </div>
      )}

      {attendees.length === 0 && !scannerActive && (
        <div className="text-center py-12 text-muted-foreground">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-display">No attendees uploaded yet</p>
          <p className="text-sm mt-1">Upload attendees in the Attendees tab first</p>
        </div>
      )}
    </div>
  );
}
