"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

interface Checker {
  id: string;
  email: string;
}

export default function AdminSettings() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkers, setCheckers] = useState<Checker[]>([]);

  // Settings state
  const [allowSelfCardRequest, setAllowSelfCardRequest] = useState(false);
  const [defaultCheckerId, setDefaultCheckerId] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();

      if (res.ok) {
        setCheckers(data.checkers || []);
        setAllowSelfCardRequest(data.settings?.allowSelfCardRequest === "true");
        setDefaultCheckerId(data.settings?.defaultCheckerId || "");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch settings",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowSelfCardRequest,
          defaultCheckerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to save settings",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-primary text-primary-foreground">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">VPCard Admin - Super Admin</h1>
          </div>
        </header>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">VPCard Admin - Super Admin</h1>
          <div className="flex items-center gap-4">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            <a
              href="/admin"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Dashboard
            </a>
            <a
              href="/admin/users"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              User Management
            </a>
            <a
              href="/admin/audit"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Audit Logs
            </a>
            <a
              href="/admin/requests"
              className="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-primary transition"
            >
              Card Requests
            </a>
            <a
              href="/admin/settings"
              className="py-4 px-2 border-b-2 border-primary font-medium text-primary"
            >
              Settings
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

        <form onSubmit={handleSaveSettings}>
          <div className="space-y-6">
            {/* Self Card Request Setting */}
            <Card>
              <CardHeader>
                <CardTitle>Self Card Request</CardTitle>
                <CardDescription>
                  Configure whether users can request cards themselves when no
                  card is available
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="allowSelfCardRequest">
                      Allow Self-Initiated Card Requests
                    </Label>
                    <p className="text-sm text-gray-500">
                      When enabled, users can request a card if none is
                      available
                    </p>
                  </div>
                  <Switch
                    id="allowSelfCardRequest"
                    checked={allowSelfCardRequest}
                    onCheckedChange={setAllowSelfCardRequest}
                  />
                </div>

                {allowSelfCardRequest && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="defaultChecker">
                      Default Checker for Self-Initiated Requests
                    </Label>
                    <p className="text-sm text-gray-500">
                      All self-initiated card requests will be assigned to this
                      checker
                    </p>
                    <Select
                      value={defaultCheckerId}
                      onValueChange={setDefaultCheckerId}
                    >
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Select a checker" />
                      </SelectTrigger>
                      <SelectContent>
                        {checkers.map((checker) => (
                          <SelectItem key={checker.id} value={checker.id}>
                            {checker.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
