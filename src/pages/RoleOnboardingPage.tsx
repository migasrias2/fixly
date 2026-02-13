import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";

const RoleOnboardingPage = () => {
  const { user, profile, updateRole } = useAuth();
  const [loading, setLoading] = useState<"user" | "contractor" | null>(null);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (profile?.role === "user") {
    return <Navigate to="/app/user" replace />;
  }
  if (profile?.role === "contractor") {
    return <Navigate to="/app/contractor" replace />;
  }

  const handleSelectRole = async (role: "user" | "contractor") => {
    setLoading(role);
    try {
      await updateRole(role);
      toast.success(`Profile configured as ${role}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save role.";
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Choose your role</CardTitle>
          <CardDescription>This controls your dashboard, permissions, and workflows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSelectRole("user")}
            className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"
            disabled={Boolean(loading)}
          >
            <h3 className="font-semibold">Homeowner / Property Manager</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Post storm damage, compare quotes, accept proposals, and fund jobs in escrow.
            </p>
            <Button className="mt-4 w-full" disabled={Boolean(loading)}>
              {loading === "user" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue as User
            </Button>
          </button>
          <button
            type="button"
            onClick={() => handleSelectRole("contractor")}
            className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"
            disabled={Boolean(loading)}
          >
            <h3 className="font-semibold">Contractor</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse damage posts, send structured quotes, chat with homeowners, and get paid on completion.
            </p>
            <Button className="mt-4 w-full" disabled={Boolean(loading)}>
              {loading === "contractor" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue as Contractor
            </Button>
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleOnboardingPage;
