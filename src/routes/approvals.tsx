
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Trash2, Users, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");

  useEffect(() => {
    const savedRole = localStorage.getItem("user_role")?.trim().toLowerCase();
    setRole(savedRole || "");

    if (savedRole !== "admin") {
      toast.error("Only admins can access this page.");
      window.location.href = "/";
      return;
    }

    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers();
      setUsers(data as any);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (identifier: string) => {
    try {
      await authApi.updateUserStatus(identifier, "active" as any);
      toast.success("User approved successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve user");
    }
  };

  const handleReject = async (identifier: string) => {
    try {
      await authApi.updateUserStatus(identifier, "disabled" as any);
      toast.success("User rejected successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject user");
    }
  };

  const handleDelete = async (identifier: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await authApi.deleteUser(identifier);
      toast.success("User deleted successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const activeUsers = users.filter((u) => u.status === "active");
  const disabledUsers = users.filter((u) => u.status === "disabled");

  const getIdentifier = (user: User) => user.phone || user.email || user._id;

  const getRoleBadgeColor = (role: string) => {
    if (role === "admin") return "bg-red-100 text-red-800 border-red-300";
    if (role === "reception") return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-green-100 text-green-800 border-green-300";
  };

  const getRoleLabel = (role: string) => {
    if (role === "admin") return "👤 Admin";
    if (role === "reception") return "🏢 Reception";
    return "👨‍💼 Employee";
  };

  if (role !== "admin") {
    return null;
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">User Management</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl flex items-center gap-3">
            <Users className="w-8 h-8 text-gold" />
            Staff Approvals
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage employees and reception staff approvals
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : (
        <div className="space-y-6">
          {/* Pending Approvals */}
          {pendingUsers.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Pending Approvals ({pendingUsers.length})
                </CardTitle>
                <CardDescription>Users waiting for admin approval</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {pendingUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-background"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          <Badge className={`${getRoleBadgeColor(user.role)} border`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded border border-amber-200">PENDING</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                        {user.email && (
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(getIdentifier(user))}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReject(getIdentifier(user))}
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Active Staff ({activeUsers.length})
              </CardTitle>
              <CardDescription>Approved and active users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {activeUsers.length === 0 ? (
                  <p className="text-muted-foreground">No active users yet</p>
                ) : (
                  activeUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg hover:bg-secondary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          <Badge className={`${getRoleBadgeColor(user.role)} border`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200">ACTIVE</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                        {user.email && (
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(getIdentifier(user))}
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Disabled Users */}
          {disabledUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Rejected/Disabled ({disabledUsers.length})
                </CardTitle>
                <CardDescription>Rejected or disabled user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {disabledUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-red-200 rounded-lg bg-red-50/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          <Badge className={`${getRoleBadgeColor(user.role)} border`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded border border-red-200">REJECTED</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                        {user.email && (
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(getIdentifier(user))}
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
