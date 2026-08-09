import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { HistoryProvider } from "./contexts/HistoryContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "./components/ui/button";

// Pages
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";

// Tools
import { DnsLookup } from "./pages/tools/DnsLookup";
import { ReverseDns } from "./pages/tools/ReverseDns";
import { Ping } from "./pages/tools/Ping";
import { Traceroute } from "./pages/tools/Traceroute";
import { HttpHeaders } from "./pages/tools/HttpHeaders";
import { SslCertificate } from "./pages/tools/SslCertificate";
import { WhoisLookup } from "./pages/tools/WhoisLookup";

function LoginScreen() {
  const { login } = useAuth();
  console.log("[Audit] Rendering LoginScreen");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute h-full w-full bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-sm">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">NetInspector</h1>
          <p className="text-muted-foreground text-lg">
            Advanced network diagnostics & analysis
          </p>
        </div>

        <Button 
          size="lg" 
          onClick={login}
          className="w-full max-w-sm h-12 text-base font-medium shadow-lg hover:shadow-primary/25 transition-all"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AuthenticatedApp() {
  console.log("[Audit] Rendering AuthenticatedApp");
  return (
    <HistoryProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tools/dns" element={<DnsLookup />} />
            <Route path="/tools/reverse-dns" element={<ReverseDns />} />
            <Route path="/tools/ping" element={<Ping />} />
            <Route path="/tools/traceroute" element={<Traceroute />} />
            <Route path="/tools/http-headers" element={<HttpHeaders />} />
            <Route path="/tools/ssl" element={<SslCertificate />} />
            <Route path="/tools/whois" element={<WhoisLookup />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HistoryProvider>
  );
}

import { Toaster } from 'sonner';

function App() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <>
      <AuthenticatedApp />
      <Toaster richColors position="top-right" />
    </>
  );
}

export default App;