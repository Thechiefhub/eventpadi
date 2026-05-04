import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import SparkModule from "./pages/SparkModule";
import ChaseModule from "./pages/ChaseModule";
import BuzzModule from "./pages/BuzzModule";
import EngineModule from "./pages/EngineModule";
import DDayModule from "./pages/DDayModule";
import ShortlistPage from "./pages/ShortlistPage";
import NarrativeStudioPage from "./pages/NarrativeStudioPage";
import AcceptInvite from "./pages/AcceptInvite";
import CertificateLookup from "./pages/CertificateLookup";
import AdminPage from "./pages/AdminPage";
import ResetPassword from "./pages/ResetPassword";
import RegistrationModule from "./pages/RegistrationModule";
import PublicRegistration from "./pages/PublicRegistration";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/certificate" element={<CertificateLookup />} />
            <Route path="/r/:slug" element={<PublicRegistration />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="registration" element={<RegistrationModule />} />
              <Route path="spark" element={<SparkModule />} />
              <Route path="chase" element={<ChaseModule />} />
              <Route path="buzz" element={<BuzzModule />} />
              <Route path="engine" element={<EngineModule />} />
              <Route path="dday" element={<DDayModule />} />
              <Route path="shortlist" element={<ShortlistPage />} />
              <Route path="spark/studio" element={<NarrativeStudioPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
