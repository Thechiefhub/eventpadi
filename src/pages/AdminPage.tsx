import { useState, useEffect } from "react";
import { Shield, Users, Calendar, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";

// Hardcoded admin email — only this account can access the admin page
const ADMIN_EMAIL = "chieftolulope@gmail.com";

interface UserRow {
  user_id: string;
  display_name: string | null;
  created_at: string;
  event_count: number;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profError } = await supabase.functions.invoke("admin-stats", {
        body: {},
      });

      if (profError) {
        console.error("Admin stats error:", profError);
        setUsers([]);
      } else {
        setUsers(profiles?.users || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If ADMIN_EMAIL is set, enforce it; otherwise allow any authenticated user
  if (!user || (ADMIN_EMAIL && user.email !== ADMIN_EMAIL)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Admin Panel</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[hsl(var(--sunset-gold)/0.15)] flex items-center justify-center">
              <Calendar className="h-6 w-6 text-[hsl(var(--sunset-gold))]" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">
                {users.reduce((sum, u) => sum + u.event_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Events Created</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Signed Up</TableHead>
                    <TableHead className="text-xs text-right">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, i) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full gradient-sunset flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                            {(u.display_name || "U").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {u.display_name || "Anonymous"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(u.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{u.event_count}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
