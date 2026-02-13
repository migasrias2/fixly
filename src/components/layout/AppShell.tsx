import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, LogOut, MessageSquare, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";

const AppShell = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const links =
    profile?.role === "contractor"
      ? [
          { to: "/app/contractor", label: "Dashboard", icon: Home },
          { to: "/app/contractor", label: "Browse Jobs", icon: Search },
        ]
      : [
          { to: "/app/user", label: "Dashboard", icon: Home },
          { to: "/app/user/posts/new", label: "Post Damage", icon: PlusCircle },
          { to: "/app/user", label: "Messages", icon: MessageSquare },
        ];

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign out.";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link to="/" className="text-lg font-semibold">
            StormFix Marketplace
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">
              Signed in as {profile?.role ?? "unassigned"}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr] md:px-6">
        <aside className="rounded-lg border bg-card p-3">
          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
