"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import DataPagination from "@/components/data-pagination";
import TableSkeleton from "@/components/table-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import { Plus, RefreshCw, Search, SearchX, Users } from "lucide-react";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UserManagement() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("MAKER");

  // Presentation-only filter over the loaded users.
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/auth/register");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create user",
        });
        return;
      }

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setIsCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("MAKER");
      fetchUsers();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to send reset link",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Password reset link sent successfully to user email",
      });

      setIsResetOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openResetDialog(user: User) {
    setSelectedUser(user);
    setIsResetOpen(true);
  }

  const filteredUsers = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term),
    );
  }, [users, filter]);

  const pagination = usePagination(filteredUsers, 10);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Users"
        description="Manage the maker and checker accounts that can raise and review card requests."
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new user</DialogTitle>
                <DialogDescription>
                  Create a new Maker or Checker user account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={10}
                    autoComplete="new-password"
                    placeholder="Minimum 10 characters"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 10 characters long.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAKER">Maker</SelectItem>
                      <SelectItem value="CHECKER">Checker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Creating&hellip;
                      </>
                    ) : (
                      "Create user"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="animate-fade-in-up overflow-hidden">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-0.5">
            <CardTitle>All users</CardTitle>
            <CardDescription>Manage user accounts and roles</CardDescription>
          </div>
          {users.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search by email or role"
                aria-label="Search users"
                className="h-9 pl-9"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton
                  columns={4}
                  widths={[
                    "h-4 w-48",
                    "h-5 w-24 rounded-full",
                    "h-4 w-24",
                    "h-8 w-36 ml-auto",
                  ]}
                />
              </TableBody>
            </Table>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Create the first maker or checker account to get started."
              action={
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus />
                  Add user
                </Button>
              }
            />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching users"
              description="Try a different email address or role."
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created at</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={user.role} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResetDialog(user)}
                          >
                            <RefreshCw />
                            Reset password
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataPagination pagination={pagination} itemLabel="users" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request password reset</DialogTitle>
            <DialogDescription>
              This will send a password reset link to{" "}
              <span className="font-medium text-foreground">
                {selectedUser?.email}
              </span>
              . The user will be able to set their own password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword}>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending&hellip;
                  </>
                ) : (
                  <>
                    <RefreshCw />
                    Send reset link
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
