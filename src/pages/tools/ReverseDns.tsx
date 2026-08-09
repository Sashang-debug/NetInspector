import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, CheckCircle2, ShieldAlert, History, FileText, 
  Activity, Loader2, Download, Network, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type ReverseDnsResult = {
  success: boolean;
  hostnames: string[];
  lookupTimeMs: number;
  error?: string;
};

export function ReverseDns() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentIp, setCurrentIp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseDnsResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedHostname, setCopiedHostname] = useState<string | null>(null);
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "Reverse DNS").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  const getIpVersion = (ip: string) => {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return "IPv4";
    if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip) || ip.includes('::')) return "IPv6";
    return "Unknown";
  };

  const handleAnalyze = async (ipToAnalyze: string = input) => {
    const ip = ipToAnalyze.trim();
    if (!ip) return;
    
    setInput(ip);
    setCurrentIp(ip);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const ipVersion = getIpVersion(ip);
    if (ipVersion === "Unknown") {
      setError("Invalid IP format. Please enter a valid IPv4 or IPv6 address.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/reverse-dns?ip=${encodeURIComponent(ip)}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Backend unavailable or returned invalid JSON.");
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch reverse DNS records.");
      }
      
      setResult(data);
      addHistoryEntry({ target: ip, tool: "Reverse DNS", status: "Success", responseTime: data.lookupTimeMs, timestamp: Date.now() });
    } catch (err: any) {
      const message = err.message || "";
      let finalError = "An unexpected error occurred during analysis.";
      if (message.includes("Failed to fetch") || message.includes("Backend unavailable")) {
        finalError = "Backend is currently unavailable. Please check your connection or server status.";
      } else if (message.includes("No reverse DNS record found")) {
        finalError = "No PTR record found for this IP address.";
      } else if (message.includes("timeout")) {
        finalError = "Network timeout occurred while querying the DNS server.";
      } else {
        finalError = message;
      }
      setError(finalError);
      addHistoryEntry({ target: ip, tool: "Reverse DNS", status: "Failed", error: finalError, timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (data: any, setCopiedState: any) => {
    navigator.clipboard.writeText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const copyHostname = (hostname: string) => {
    navigator.clipboard.writeText(hostname);
    setCopiedHostname(hostname);
    setTimeout(() => setCopiedHostname(null), 2000);
  };

  const exportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${currentIp}-reverse-dns.json`);
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ["IP Address", "Hostname", "Lookup Time (ms)"];
    const csvContent = [
      headers.join(","),
      ...result.hostnames.map(h => `"${currentIp}","${h}",${result.lookupTimeMs}`)
    ].join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${currentIp}-reverse-dns.csv`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatLastLookup = () => {
    const historyEntry = history.find(h => h.tool === "Reverse DNS" && h.target === currentIp);
    if (historyEntry) {
      return new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date(historyEntry.timestamp));
    }
    return new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date());
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reverse DNS Lookup</h1>
        <p className="text-muted-foreground text-lg">Resolve IPv4 and IPv6 addresses into domain hostnames using PTR records.</p>
      </div>

      {/* Input Section */}
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" aria-hidden="true" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter IP address (e.g., 8.8.8.8)"
                className="pl-10 h-12 text-md focus-visible:ring-primary shadow-sm"
                aria-label="IP Address Input"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="h-12 px-8 shadow-sm" 
              disabled={isLoading || !input.trim()}
              aria-label={isLoading ? "Analyzing..." : "Analyze IP Address"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Analyzing...
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </form>
          
          {toolRecentSearches.length > 0 && !result && !isLoading && !error && (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4 mr-1" aria-hidden="true" />
              <span>Recent:</span>
              {toolRecentSearches.map((ipAddr) => (
                <Badge 
                  key={ipAddr} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(ipAddr)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(ipAddr)}
                  aria-label={`Search recent IP ${ipAddr}`}
                >
                  {ipAddr}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {!isLoading && !error && !result && (
        <Card className="border-border/50 border-dashed bg-muted/10 shadow-none py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Network className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Ready to Resolve</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Enter an IPv4 or IPv6 address to perform a Reverse DNS lookup and reveal associated hostnames.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="text-sm text-muted-foreground self-center">Try examples:</span>
              {["8.8.8.8", "1.1.1.1", "208.67.222.222"].map(exampleIp => (
                <Badge 
                  key={exampleIp}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(exampleIp)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(exampleIp)}
                  aria-label={`Test example IP ${exampleIp}`}
                >
                  {exampleIp}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6" aria-live="polite" aria-busy="true">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-4 w-1/2 mb-2" /><Skeleton className="h-8 w-full" /></CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={`small-${i}`} className="border-border/50 shadow-sm"><CardContent className="p-4"><Skeleton className="h-4 w-1/3 mx-auto mb-2" /><Skeleton className="h-6 w-1/2 mx-auto" /></CardContent></Card>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <Skeleton key={`card-${i}`} className="h-20 w-full rounded-xl" />)}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="text-lg">Lookup Failed</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-4">
            <p>{error}</p>
            <Button variant="destructive" size="sm" onClick={() => handleAnalyze()}>
              Retry Lookup
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Results State */}
      {result && !isLoading && !error && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2" aria-live="polite">
          
          {/* Main Summary Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Target IP</p>
                <div className="text-lg sm:text-xl font-bold truncate" title={currentIp}>{currentIp}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Primary Hostname</p>
                <div className="text-lg sm:text-xl font-bold truncate text-primary" title={result.hostnames[0] || "None"}>
                  {result.hostnames[0] || "None"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Activity className="h-3 w-3" aria-hidden="true" /> Status
                </p>
                <div className="text-xl font-bold text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Success
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Database className="h-3 w-3" aria-hidden="true" /> Total PTR Records
                </p>
                <div className="text-xl font-bold">{result.hostnames.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Information Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">IP Version</span>
                <Badge variant="outline" className="font-mono">{getIpVersion(currentIp)}</Badge>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">PTR Count</span>
                <span className="font-semibold text-lg">{result.hostnames.length}</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">Response Time</span>
                <span className="font-semibold text-lg">{result.lookupTimeMs}ms</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">Last Lookup</span>
                <span className="font-semibold text-sm">{formatLastLookup()}</span>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(result, setCopiedAll)} aria-label="Copy JSON to clipboard">
              {copiedAll ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
              {copiedAll ? "Copied JSON" : "Copy JSON"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON} aria-label="Export JSON file">
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} aria-label="Export CSV file">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
          </div>

          {/* Hostnames List */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b border-border/50 pb-2 mb-4">Resolved Hostnames</h3>
            {result.hostnames.length === 0 ? (
              <p className="text-muted-foreground italic">No hostnames returned by the server.</p>
            ) : (
              result.hostnames.map((hostname, index) => {
                const isPrimary = index === 0;
                return (
                  <Card 
                    key={index} 
                    className={`shadow-sm transition-shadow relative overflow-hidden group ${isPrimary ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border hover:shadow-md'}`}
                  >
                    {isPrimary && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" aria-hidden="true"></div>
                    )}
                    <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        {isPrimary && <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Primary Hostname</span>}
                        <div className="font-mono text-sm sm:text-base break-all">{hostname}</div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => copyHostname(hostname)}
                        aria-label={`Copy hostname ${hostname}`}
                        className="shrink-0 group-hover:bg-muted"
                      >
                        {copiedHostname === hostname ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
                        ) : (
                          <Copy className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
