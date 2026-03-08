import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Attendee } from "@/hooks/useAttendees";

interface Props {
  attendees: Attendee[];
  eventName: string;
  onGenerateMissingIds?: () => Promise<void>;
}

export default function BadgeGenerator({ attendees, eventName, onGenerateMissingIds }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const missingCount = attendees.filter((a) => !a.ticket_id).length;

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked — please allow pop-ups"); return; }
    w.document.write(`
      <html><head><title>Badges — ${eventName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Space Grotesk', 'Segoe UI', sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; }
        .badge { border: 2px solid #e5e5e5; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
        .badge h3 { font-size: 18px; margin: 8px 0 2px; }
        .badge p { font-size: 12px; color: #666; }
        .badge .role { display: inline-block; background: #f97316; color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 99px; margin-top: 6px; }
        .badge .event { font-size: 10px; color: #999; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .badge svg { margin: 0 auto; }
        @media print { .grid { padding: 0; } .badge { border: 1px solid #ccc; } }
      </style></head><body>
      <div class="grid">${printRef.current.innerHTML}</div>
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); };
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{attendees.length} badge(s) ready</p>
        <Button onClick={handlePrint} className="gradient-sunset text-primary-foreground">
          <Printer className="h-4 w-4 mr-1" /> Print All Badges
        </Button>
      </div>

      {/* Visible preview (first 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {attendees.slice(0, 6).map((a) => (
          <Card key={a.id} className="border-border text-center">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <QRCodeSVG
                value={a.ticket_id || a.id}
                size={100}
                level="M"
                includeMargin
              />
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
      {attendees.length > 6 && (
        <p className="text-xs text-muted-foreground text-center">
          + {attendees.length - 6} more — click "Print All Badges" to see all
        </p>
      )}

      {/* Hidden full list for printing */}
      <div ref={printRef} className="hidden">
        {attendees.map((a) => (
          <div key={a.id} className="badge">
            <QRCodeSVG value={a.ticket_id || a.id} size={90} level="M" includeMargin />
            <h3>{a.name}</h3>
            <p>{a.email || a.phone || ""}</p>
            {a.role && <span className="role">{a.role}</span>}
            <p className="event">{eventName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
