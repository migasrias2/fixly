import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/marketplace";

type RequireRoleProps = {
  role: AppRole;
  children: JSX.Element;
};

const RequireRole = ({ role, children }: RequireRoleProps) => {
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!profile?.role) {
    return <Navigate to="/onboarding/role" replace />;
  }

  if (profile.role !== role) {
    return <Navigate to={profile.role === "contractor" ? "/app/contractor" : "/app/user"} replace />;
  }

  return children;
};

export default RequireRole;
