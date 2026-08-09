import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, CheckCircle2, ShieldAlert, History, FileText, 
  Clock, Loader2, Download, Radio, BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

type PingAttempt = {
  attempt: number;
  latency: number;
};

type PingStats = {
  sent: number;
  received: number;
  packetLoss: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
};

type PingResult = {
  success: boolean;
  attempts: PingAttempt[];
  stats: PingStats;
  error?: string;
};

export function Ping() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentHost, setCurrentHost] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PingResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [requestTime, setRequestTime] = useState(0);
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "Ping").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  const handleAnalyze = async (hostToAnalyze: string = input) => {
    const host = hostToAnalyze.trim();
    if (!host) return;
    
    // Basic validation for hostname/IP
    if (!/^[a-zA-Z0-9.\-:]+$/.test(host)) {
      setError("Invalid host format. Please enter a valid domain or IP address.");
      return;
    }

    setInput(host);
    setCurrentHost(host);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const startReq = performance.now();

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ping?host=${encodeURIComponent(host)}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Backend unavailable or returned invalid JSON.");
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to execute ping");
      }
      
      setResult(data);
      const endReq = performance.now();
      const rTime = Math.round(endReq - startReq);
      setRequestTime(rTime);
      addHistoryEntry({ target: host, tool: "Ping", status: "Success", responseTime: rTime, timestamp: Date.now() });
    } catch (err: any) {
      const message = err.message || "";
      let finalError = "An unexpected error occurred during analysis.";
      if (message.includes("Failed to fetch") || message.includes("Backend unavailable")) {
        finalError = "Server unavailable. Please check your connection or server status.";
      } else if (message.includes("DNS resolution failure")) {
        finalError = "Invalid hostname or DNS resolution failure.";
      } else if (message.includes("Host unreachable")) {
        finalError = "Host is unreachable. All packets were lost.";
      } else if (message.includes("timeout")) {
        finalError = "Network timeout occurred during the ping operation.";
      } else {
        finalError = message;
      }
      setError(finalError);
      const endReq = performance.now();
      setRequestTime(Math.round(endReq - startReq));
      addHistoryEntry({ target: host, tool: "Ping", status: "Failed", error: finalError, timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const exportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${currentHost}-ping.json`);
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ["Attempt", "Latency (ms)"];
    const csvContent = [
      headers.join(","),
      ...result.attempts.map(a => `${a.attempt},${a.latency}`)
    ].join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${currentHost}-ping.csv`);
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Ping Tool</h1>
        <p className="text-muted-foreground text-lg">Measure network latency and connectivity to any domain or IP address.</p>
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
                placeholder="Enter domain or IP (e.g., google.com, 8.8.8.8)"
                className="pl-10 h-12 text-md focus-visible:ring-primary shadow-sm"
                aria-label="Target Host Input"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="h-12 px-8 shadow-sm" 
              disabled={isLoading || !input.trim()}
              aria-label={isLoading ? "Pinging target..." : "Ping Target"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Pinging...
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
              {toolRecentSearches.map((h) => (
                <Badge 
                  key={h} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(h)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(h)}
                  aria-label={`Ping recent target ${h}`}
                >
                  {h}
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
              <Radio className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Ready to Measure</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Enter a domain or IP address to measure network latency and check connectivity.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="text-sm text-muted-foreground self-center">Try examples:</span>
              {["google.com", "github.com", "8.8.8.8", "1.1.1.1"].map(exampleHost => (
                <Badge 
                  key={exampleHost}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(exampleHost)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(exampleHost)}
                  aria-label={`Ping example host ${exampleHost}`}
                >
                  {exampleHost}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6" aria-live="polite" aria-busy="true">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border/50 shadow-sm"><CardContent className="p-4"><Skeleton className="h-4 w-1/2 mb-2" /><Skeleton className="h-8 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="text-lg">Ping Failed</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-4">
            <p>{error}</p>
            <Button variant="destructive" size="sm" onClick={() => handleAnalyze()}>
              Retry Ping
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Results State */}
      {result && !isLoading && !error && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2" aria-live="polite">
          
          {/* Main Summary Section */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-border/50 shadow-sm bg-card/50 col-span-2 md:col-span-1">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Target Host</p>
                <div className="text-lg font-bold truncate" title={currentHost}>{currentHost}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 text-green-500">Avg Latency</p>
                <div className="text-xl font-bold">{result.stats.avgLatency}<span className="text-sm font-normal text-muted-foreground">ms</span></div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Min Latency</p>
                <div className="text-xl font-bold">{result.stats.minLatency}<span className="text-sm font-normal text-muted-foreground">ms</span></div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Max Latency</p>
                <div className="text-xl font-bold">{result.stats.maxLatency}<span className="text-sm font-normal text-muted-foreground">ms</span></div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 text-amber-500">Packet Loss</p>
                <div className="text-xl font-bold">{result.stats.packetLoss}<span className="text-sm font-normal text-muted-foreground">%</span></div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                <div className={`text-lg font-bold flex items-center gap-2 ${result.stats.packetLoss > 0 ? (result.stats.packetLoss === 100 ? 'text-destructive' : 'text-amber-500') : 'text-green-500'}`}>
                  {result.stats.packetLoss === 100 ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {result.stats.packetLoss === 100 ? "Failed" : (result.stats.packetLoss > 0 ? "Degraded" : "Success")}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Information Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">Packets Sent</span>
                <span className="font-semibold text-lg">{result.stats.sent}</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">Packets Received</span>
                <span className="font-semibold text-lg">{result.stats.received}</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1">Success Rate</span>
                <span className="font-semibold text-lg">{100 - result.stats.packetLoss}%</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-center"><Clock className="h-3 w-3"/> Response Time</span>
                <span className="font-semibold text-lg">{requestTime}ms</span>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard} aria-label="Copy Results to clipboard">
              {copiedAll ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
              {copiedAll ? "Copied" : "Copy Results"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON} aria-label="Export JSON file">
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} aria-label="Export CSV file">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
          </div>

          {/* Latency Chart */}
          <Card className="border-border/50 shadow-sm bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Latency Over Time</h3>
              </div>
              <div className="h-[300px] w-full">
                {result.attempts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.attempts} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="attempt" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `Attempt ${value}`}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `${value}ms`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                          color: 'hsl(var(--foreground))'
                        }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        formatter={(value: any) => [`${value} ms`, 'Latency']}
                        labelFormatter={(label) => `Ping Attempt ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No latency data available to chart (all packets lost).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
