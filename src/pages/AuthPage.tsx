import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "@/components/ui/sonner";

const AuthPage = () => {
  const { user, profile, signIn, signUp } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const nextPath = useMemo(() => {
    if (!user) return null;
    if (!profile?.role) return "/onboarding/role";
    return redirectTarget || (profile.role === "contractor" ? "/app/contractor" : "/app/user");
  }, [profile?.role, redirectTarget, user]);

  if (nextPath) {
    return <Navigate to={nextPath} replace state={location.state} />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success("Signed in.");
      } else {
        await signUp(email, password, fullName);
        toast.success("Account created. Check your inbox if email verification is enabled.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>Access your storm damage marketplace account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupabaseConfigured && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Supabase env vars are missing. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to continue.
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Miguel Gomez"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading || !isSupabaseConfigured}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <Button variant="ghost" className="w-full" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to the platform terms for storm repair contracting.
          </p>
          <div className="text-center text-sm">
            <Link to="/" className="text-primary underline">
              Back to landing page
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
