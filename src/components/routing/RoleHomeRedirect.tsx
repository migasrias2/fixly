import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const RoleHomeRedirect = () => {
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

  return <Navigate to={profile.role === "contractor" ? "/app/contractor" : "/app/user"} replace />;
};

export default RoleHomeRedirect;
