/**
 * AttendeeListModal — Interactive modal showing a filtered, sortable, paginated
 * list of attendees. Opens when a user clicks a stat card on the D-Day Dashboard.
 *
 * Features:
 * - Real-time search by name / email / phone
 * - Column sorting (asc / desc)
 * - Pagination (20 per page)
 * - CSV export of the current filtered view
 * - Responsive: full-screen on mobile
 * - Offline-aware: shows cached data with a warning banner
 */

import { useState, useMemo } from "react";
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, WifiOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Attendee } from "@/hooks/useAttendees";
import { format } from "date-fns";

export type AttendeeFilter = "all" | "checked_in" | "remaining";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendees: Attendee[];
  filter: AttendeeFilter;
  title: string;
  isAdmin?: boolean;
}

type SortKey = "name" | "email" | "phone" | "role" | "checked_in" | "checked_in_at" | "certificate";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

export default function AttendeeListModal({ open, onOpenChange, attendees, filter, title, isAdmin = false }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [isOffline] = useState(() => !navigator.onLine);

  // Reset page when search/filter changes
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // 1. Apply status filter
  const filtered = useMemo(() => {
    let list = attendees;
    if (filter === "checked_in") list = list.filter((a) => a.checked_in);
    if (filter === "remaining") list = list.filter((a) => !a.checked_in);
    return list;
  }, [attendees, filter]);

  // 2. Apply search
  const searched = useMemo(() => {
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.phone && a.phone.toLowerCase().includes(q))
    );
  }, [filtered, search]);

  // 3. Sort
  const sorted = useMemo(() => {
    const arr = [...searched];
    arr.sort((a, b) => {
      let aVal: string | boolean | null = null;
      let bVal: string | boolean | null = null;
      switch (sortKey) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        case "phone": aVal = a.phone || ""; bVal = b.phone || ""; break;
        case "role": aVal = a.role || ""; bVal = b.role || ""; break;
        case "checked_in": aVal = a.checked_in; bVal = b.checked_in; break;
        case "checked_in_at": aVal = a.checked_in_at || ""; bVal = b.checked_in_at || ""; break;
        case "certificate": aVal = a.certificate_sent_at || ""; bVal = b.certificate_sent_at || ""; break;
      }
      if (typeof aVal === "boolean") {
        return sortDir === "asc" ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [searched, sortKey, sortDir]);

  // 4. Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // CSV export
  const exportCSV = () => {
    const rows = [["Name", "Email", "Phone", "Role", "Status", "Check-In Time", "Certificate"]];
    sorted.forEach((a) => {
      rows.push([
        a.name,
        a.email || "",
        a.phone || "",
        a.role || "attendee",
        a.checked_in ? "Checked In" : "Not Checked In",
        a.checked_in_at ? format(new Date(a.checked_in_at), "yyyy-MM-dd HH:mm:ss") : "",
        a.certificate_sent_at ? "Sent" : "—",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendees-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 sm:rounded-lg">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          {isOffline && (
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--kente-red))] bg-[hsl(var(--kente-red))/0.1] rounded-md px-3 py-1.5 mt-2">
              <WifiOff className="h-3.5 w-3.5" />
              Offline — showing cached data
            </div>
          )}
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-4 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {sorted.length} result{sorted.length !== 1 ? "s" : ""}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4">
          <Table>
            <TableHeader>
              <TableRow>
                {([
                  ["name", "Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["role", "Role"],
                  ["checked_in", "Status"],
                  ["checked_in_at", "Check-In Time"],
                  ["certificate", "Certificate"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <TableHead
                    key={key}
                    className={`cursor-pointer select-none whitespace-nowrap ${
                      key === "phone" || key === "email" || key === "certificate" ? "hidden md:table-cell" : ""
                    }`}
                    onClick={() => toggleSort(key)}
                  >
                    <span className="inline-flex items-center">
                      {label}
                      <SortIcon col={key} />
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No attendees found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{a.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{a.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.role || "attendee"}</TableCell>
                    <TableCell>
                      {a.checked_in ? (
                        <Badge className="bg-[hsl(var(--earth-green))] text-primary-foreground border-0">
                          Checked In
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {a.checked_in_at ? format(new Date(a.checked_in_at), "HH:mm:ss") : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.certificate_sent_at ? (
                        <Badge className="bg-[hsl(var(--earth-green))] text-primary-foreground border-0 text-[10px]">
                          Sent
                        </Badge>
                      ) : a.checked_in && a.email ? (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          Pending
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={currentPage <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  // Show pages around current
                  let start = Math.max(1, currentPage - 2);
                  if (start + 4 > totalPages) start = Math.max(1, totalPages - 4);
                  const pageNum = start + i;
                  if (pageNum > totalPages) return null;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pageNum === currentPage}
                        onClick={() => setPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
