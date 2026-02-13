import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import RequireAuth from "@/components/routing/RequireAuth";
import RequireRole from "@/components/routing/RequireRole";
import RoleHomeRedirect from "@/components/routing/RoleHomeRedirect";
import AppShell from "@/components/layout/AppShell";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import RoleOnboardingPage from "./pages/RoleOnboardingPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import UserCreatePostPage from "./pages/UserCreatePostPage";
import UserPostDetailPage from "./pages/UserPostDetailPage";
import ContractorDashboardPage from "./pages/ContractorDashboardPage";
import ContractorPostDetailPage from "./pages/ContractorPostDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />

              <Route
                path="/onboarding/role"
                element={
                  <RequireAuth>
                    <RoleOnboardingPage />
                  </RequireAuth>
                }
              />

              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <RoleHomeRedirect />
                  </RequireAuth>
                }
              />

              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route
                  path="/app/user"
                  element={
                    <RequireRole role="user">
                      <UserDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/app/user/posts/new"
                  element={
                    <RequireRole role="user">
                      <UserCreatePostPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/app/user/posts/:postId"
                  element={
                    <RequireRole role="user">
                      <UserPostDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/app/contractor"
                  element={
                    <RequireRole role="contractor">
                      <ContractorDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/app/contractor/posts/:postId"
                  element={
                    <RequireRole role="contractor">
                      <ContractorPostDetailPage />
                    </RequireRole>
                  }
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
