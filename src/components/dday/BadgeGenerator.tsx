import { useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Sparkles, Search, X, Download, Loader2, Link2, Copy, Check } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Attendee } from "@/hooks/useAttendees";

interface Props {
  attendees: Attendee[];
  eventName: string;
  onGenerateMissingIds?: () => Promise<void>;
}

const BADGE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Space Grotesk', 'Segoe UI', sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; }
  .badge { border: 2px solid #e5e5e5; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
  .badge h3 { font-size: 18px; margin: 8px 0 2px; }
  .badge p { font-size: 12px; color: #666; }
  .badge .code { font-family: monospace; font-size: 10px; color: #888; letter-spacing: 2px; margin: 4px 0; }
  .badge .role { display: inline-block; background: #f97316; color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 99px; margin-top: 6px; }
  .badge .event { font-size: 10px; color: #999; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .badge svg { margin: 0 auto; }
  @media print { .grid { padding: 0; } .badge { border: 1px solid #ccc; } }
`;

function badgeHTML(a: Attendee, eventName: string, innerRef?: React.RefObject<HTMLDivElement>) {
  return (
    <div key={a.id} className="badge" ref={innerRef}>
      <QRCodeSVG value={a.ticket_id || a.id} size={90} level="M" includeMargin />
      <p className="code" style={{ fontFamily: "monospace", fontSize: "10px", color: "#888", letterSpacing: "2px", margin: "4px 0" }}>
        {a.ticket_id || a.id.slice(0, 12).toUpperCase()}
      </p>
      <h3>{a.name}</h3>
      <p>{a.email || a.phone || ""}</p>
      {a.role && <span className="role">{a.role}</span>}
      <p className="event">{eventName}</p>
    </div>
  );
}

export default function BadgeGenerator({ attendees, eventName, onGenerateMissingIds }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const singleBadgeRef = useRef<HTMLDivElement>(null);
  const badgeCardRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPNG = useCallback(async () => {
    if (!badgeCardRef.current || !selectedAttendee) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(badgeCardRef.current, { pixelRatio: 3, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `badge-${selectedAttendee.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Badge downloaded!");
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setDownloading(false);
    }
  }, [selectedAttendee]);
  const missingCount = attendees.filter((a) => !a.ticket_id).length;

  const filtered = search.trim()
    ? attendees.filter((a) => {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.phone?.includes(q) || a.ticket_id?.toLowerCase().includes(q);
      })
    : attendees;

  const openPrintWindow = (html: string, title: string, grid = true) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked — please allow pop-ups"); return; }
    w.document.write(`
      <html><head><title>${title}</title>
      <style>${BADGE_STYLES}${!grid ? ".badge { max-width: 360px; margin: 40px auto; }" : ""}</style></head><body>
      ${grid ? `<div class="grid">${html}</div>` : html}
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); };
  };

  const handlePrintAll = () => {
    if (!printRef.current) return;
    openPrintWindow(printRef.current.innerHTML, `Badges — ${eventName}`);
  };

  const handlePrintSingle = () => {
    if (!singleBadgeRef.current) return;
    openPrintWindow(singleBadgeRef.current.outerHTML, `Badge — ${selectedAttendee?.name || ""}`, false);
  };

  if (attendees.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Upload attendees first to generate QR badges.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{attendees.length} badge(s) ready</p>
          {missingCount > 0 && (
            <p className="text-xs text-destructive">{missingCount} attendee(s) missing ticket IDs</p>
          )}
        </div>
        <div className="flex gap-2">
          {missingCount > 0 && onGenerateMissingIds && (
            <Button variant="outline" size="sm" onClick={onGenerateMissingIds}>
              <Sparkles className="h-4 w-4 mr-1" /> Generate Missing IDs
            </Button>
          )}
          <Button onClick={handlePrintAll} className="gradient-sunset text-primary-foreground">
            <Printer className="h-4 w-4 mr-1" /> Print All Badges
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attendee by name, email, phone, or ticket ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.slice(0, search ? 50 : 6).map((a) => (
          <Card
            key={a.id}
            className="border-border text-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
            onClick={() => setSelectedAttendee(a)}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <QRCodeSVG value={a.ticket_id || a.id} size={100} level="M" includeMargin />
              <p className="font-mono text-[11px] text-muted-foreground tracking-wider bg-muted px-2 py-0.5 rounded">
                {a.ticket_id || a.id.slice(0, 12).toUpperCase()}
              </p>
              <p className="font-display font-bold text-foreground text-sm">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.email || a.phone || ""}</p>
              {a.role && (
                <Badge className="gradient-sunset text-primary-foreground text-xs border-transparent">
                  {a.role}
                </Badge>
              )}
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{eventName}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!search && attendees.length > 6 && (
        <p className="text-xs text-muted-foreground text-center">
          + {attendees.length - 6} more — search or click "Print All Badges"
        </p>
      )}
      {search && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No attendees match "{search}"</p>
      )}
      {search && filtered.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing 50 of {filtered.length} results — refine your search
        </p>
      )}

      {/* Single badge preview modal */}
      <Dialog open={!!selectedAttendee} onOpenChange={(open) => !open && setSelectedAttendee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Badge Preview</DialogTitle>
          </DialogHeader>
          {selectedAttendee && (
            <div className="flex flex-col items-center gap-4">
              <Card className="border-border w-full max-w-xs text-center" ref={badgeCardRef}>
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <QRCodeSVG value={selectedAttendee.ticket_id || selectedAttendee.id} size={140} level="M" includeMargin />
                  <p className="font-mono text-xs text-muted-foreground tracking-widest bg-muted px-3 py-1 rounded">
                    {selectedAttendee.ticket_id || selectedAttendee.id.slice(0, 12).toUpperCase()}
                  </p>
                  <p className="font-display font-bold text-foreground text-lg">{selectedAttendee.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedAttendee.email || selectedAttendee.phone || ""}</p>
                  {selectedAttendee.role && (
                    <Badge className="gradient-sunset text-primary-foreground text-sm border-transparent">
                      {selectedAttendee.role}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{eventName}</p>
                </CardContent>
              </Card>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedAttendee(null)}>
                  Close
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDownloadPNG} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  PNG
                </Button>
                <Button className="flex-1 gradient-sunset text-primary-foreground" onClick={handlePrintSingle}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden: single badge for print */}
      <div className="hidden">
        {selectedAttendee && (
          <div ref={singleBadgeRef}>
            {badgeHTML(selectedAttendee, eventName)}
          </div>
        )}
      </div>

      {/* Hidden: all badges for bulk print */}
      <div ref={printRef} className="hidden">
        {attendees.map((a) => badgeHTML(a, eventName))}
      </div>
    </div>
  );
}
