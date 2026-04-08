import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Loader2, Download, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Attendee } from "@/hooks/useAttendees";
import * as XLSX from "xlsx";

interface Props {
  eventId: string;
  attendees: Attendee[];
  onUploaded: () => void;
}

type FieldMapping = {
  name: string;
  email: string;
  phone: string;
  role: string;
  ticket_id: string;
  admits: string;
};

export default function AttendeeUpload({ eventId, attendees, onUploaded }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({ name: "", email: "", phone: "", role: "", ticket_id: "", admits: "" });
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        if (json.length === 0) { toast.error("File is empty"); return; }
        setRawData(json);
        const cols = Object.keys(json[0]);
        setColumns(cols);
        // Auto-map common column names
        const autoMap: FieldMapping = { name: "", email: "", phone: "", role: "", ticket_id: "", admits: "" };
        for (const col of cols) {
          const lc = col.toLowerCase();
          if (lc.includes("name") && !autoMap.name) autoMap.name = col;
          else if (lc.includes("email") && !autoMap.email) autoMap.email = col;
          else if ((lc.includes("phone") || lc.includes("mobile") || lc.includes("whatsapp")) && !autoMap.phone) autoMap.phone = col;
          else if (lc.includes("role") || lc.includes("type") || lc.includes("category")) { if (!autoMap.role) autoMap.role = col; }
          else if (lc.includes("ticket") || lc.includes("code")) { if (!autoMap.ticket_id) autoMap.ticket_id = col; }
          else if (lc.includes("admit") || lc.includes("guest") || lc.includes("pax")) { if (!autoMap.admits) autoMap.admits = col; }
        }
        setMapping(autoMap);
        setStep("map");
      } catch {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Generate a short unique ticket ID (e.g., "TKT-A1B2C3")
  const generateTicketId = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return `TKT-${code}`;
  };

  const handleSubmit = async () => {
    if (!mapping.name) { toast.error("Name field is required"); return; }
    if (!user) return;
    setUploading(true);
    const rows = rawData.map((row) => {
      const existingTicket = mapping.ticket_id ? String(row[mapping.ticket_id] || "").trim() : "";
      const admitsRaw = mapping.admits ? parseInt(String(row[mapping.admits] || "1").trim(), 10) : 1;
      return {
        event_id: eventId,
        user_id: user.id,
        name: String(row[mapping.name] || "").trim(),
        email: mapping.email ? String(row[mapping.email] || "").trim() || null : null,
        phone: mapping.phone ? String(row[mapping.phone] || "").trim() || null : null,
        role: mapping.role ? String(row[mapping.role] || "").trim() || "attendee" : "attendee",
        ticket_id: existingTicket || generateTicketId(),
        admits: isNaN(admitsRaw) || admitsRaw < 1 ? 1 : admitsRaw,
      };
    }).filter((r) => r.name.length > 0);

    // Batch insert in chunks of 500
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("attendees").insert(chunk);
      if (error) { toast.error(`Error inserting batch: ${error.message}`); break; }
      inserted += chunk.length;
    }
    toast.success(`Uploaded ${inserted} attendees`);
    setStep("upload");
    setRawData([]);
    onUploaded();
    setUploading(false);
  };

  const exportCSV = () => {
    const checkedIn = attendees.filter((a) => a.checked_in);
    if (checkedIn.length === 0) { toast.error("No checked-in attendees to export"); return; }
    const ws = XLSX.utils.json_to_sheet(
      checkedIn.map((a) => ({
        Name: a.name,
        Email: a.email || "",
        Phone: a.phone || "",
        Role: a.role || "",
        "Checked In At": a.checked_in_at || "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checked In");
    XLSX.writeFile(wb, "checked-in-attendees.csv");
    toast.success("Exported CSV");
  };

  const fields: { key: keyof FieldMapping; label: string; required?: boolean }[] = [
    { key: "name", label: "Name", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Role" },
    { key: "ticket_id", label: "Ticket / QR ID" },
    { key: "admits", label: "Admit(s)" },
  ];

  // Manual add attendee state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", email: "", phone: "", role: "", admits: "1" });
  const [addingManual, setAddingManual] = useState(false);

  const handleManualAdd = async () => {
    if (!manualForm.name.trim()) { toast.error("Name is required"); return; }
    if (!user) return;
    setAddingManual(true);
    const admitsVal = parseInt(manualForm.admits, 10);
    const { error } = await supabase.from("attendees").insert({
      event_id: eventId,
      user_id: user.id,
      name: manualForm.name.trim(),
      email: manualForm.email.trim() || null,
      phone: manualForm.phone.trim() || null,
      role: manualForm.role.trim() || "attendee",
      ticket_id: generateTicketId(),
      admits: isNaN(admitsVal) || admitsVal < 1 ? 1 : admitsVal,
    });
    if (error) {
      toast.error(`Failed to add attendee: ${error.message}`);
    } else {
      toast.success(`${manualForm.name.trim()} added!`);
      setManualForm({ name: "", email: "", phone: "", role: "", admits: "1" });
      setShowManualForm(false);
      onUploaded();
    }
    setAddingManual(false);
  };

  return (
    <div className="space-y-4">
      {step === "upload" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <Card
              className="flex-1 border-dashed border-2 border-border cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv,.xlsx,.xls";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              <CardContent className="p-8 flex flex-col items-center text-center gap-3">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-display font-semibold text-foreground">Upload Attendee List</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Drag & drop a CSV or Excel file, or click to browse
                  </p>
                </div>
                <Badge variant="outline">CSV, XLSX, XLS</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Manual Add Attendee */}
          <Button variant="outline" className="w-full" onClick={() => setShowManualForm(!showManualForm)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {showManualForm ? "Hide Form" : "Add Walk-in Guest Manually"}
          </Button>

          {showManualForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Register Walk-in Guest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm">Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Full name" value={manualForm.name} onChange={(e) => setManualForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Email</Label>
                    <Input type="email" placeholder="email@example.com" value={manualForm.email} onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Phone</Label>
                    <Input placeholder="+234..." value={manualForm.phone} onChange={(e) => setManualForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Role</Label>
                    <Input placeholder="e.g. Speaker, VIP, Guest" value={manualForm.role} onChange={(e) => setManualForm((p) => ({ ...p, role: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Admit(s)</Label>
                    <Input type="number" min="1" placeholder="1" value={manualForm.admits} onChange={(e) => setManualForm((p) => ({ ...p, admits: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setShowManualForm(false)}>Cancel</Button>
                  <Button onClick={handleManualAdd} disabled={addingManual || !manualForm.name.trim()} className="gradient-sunset text-primary-foreground">
                    {addingManual ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Adding...</> : "Add Attendee"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {attendees.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{attendees.length} attendees loaded</p>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> Export Checked-In CSV
              </Button>
            </div>
          )}
        </>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Map Columns ({rawData.length} rows found)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-sm">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={mapping[f.key]}
                  onValueChange={(v) => setMapping((prev) => ({ ...prev, [f.key]: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Skip —</SelectItem>
                    {columns.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* Preview first 3 rows */}
            {rawData.length > 0 && mapping.name && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Preview (first 3 rows):</p>
                <div className="space-y-1 text-sm">
                  {rawData.slice(0, 3).map((row, i) => (
                    <div key={i} className="p-2 rounded bg-muted">
                      <span className="font-medium">{row[mapping.name]}</span>
                      {mapping.email && row[mapping.email] && <span className="text-muted-foreground"> · {row[mapping.email]}</span>}
                      {mapping.phone && row[mapping.phone] && <span className="text-muted-foreground"> · {row[mapping.phone]}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setRawData([]); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!mapping.name || uploading} className="gradient-sunset text-primary-foreground">
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Uploading...</> : `Upload ${rawData.length} Attendees`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
