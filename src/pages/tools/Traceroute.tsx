import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, CheckCircle2, ShieldAlert, History, FileText, 
  Loader2, Download, Server, Activity, Route
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

type Hop = {
  hop: number;
  ip: string;
  hostname: string;
  latency: number;
  location?: string;
  timeout: boolean;
};

export function Traceroute() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentHost, setCurrentHost] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [resolvedIp, setResolvedIp] = useState<string>("");
  const [hops, setHops] = useState<Hop[]>([]);
  const [totalTime, setTotalTime] = useState(0);
  const [status, setStatus] = useState<'Idle' | 'Tracing' | 'Complete' | 'Failed'>('Idle');
  
  const [copiedAll, setCopiedAll] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "Traceroute").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (isLoading && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hops, isLoading]);

  const handleAnalyze = (hostToAnalyze: string = input) => {
    let host = hostToAnalyze.trim();
    if (!host) return;

    host = host.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(host) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      setError("Invalid host format. Please enter a valid domain name or IP.");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setInput(host);
    setCurrentHost(host);
    setIsLoading(true);
    setError(null);
    setHops([]);
    setResolvedIp("");
    setTotalTime(0);
    setStatus('Tracing');

    const es = new EventSource(`${import.meta.env.VITE_API_URL || ''}/api/traceroute?host=${encodeURIComponent(host)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'start') {
          // Trace started
        } else if (parsed.type === 'hop') {
          setHops(prev => {
            // Prevent duplicate hops just in case
            if (prev.some(h => h.hop === parsed.data.hop)) return prev;
            return [...prev, parsed.data];
          });
        } else if (parsed.type === 'complete') {
          setResolvedIp(parsed.data.resolvedIp);
          setTotalTime(parsed.data.totalTime);
          setStatus('Complete');
          setIsLoading(false);
          addHistoryEntry({ target: host, tool: "Traceroute", status: "Success", responseTime: parsed.data.totalTime, timestamp: Date.now() });
          es.close();
        } else if (parsed.type === 'error') {
          setError(parsed.data.message);
          setStatus('Failed');
          setIsLoading(false);
          addHistoryEntry({ target: host, tool: "Traceroute", status: "Failed", error: parsed.data.message, timestamp: Date.now() });
          es.close();
        }
      } catch {
        console.error("Failed to parse SSE");
      }
    };

    es.onerror = () => {
      // EventSource generic error
      es.close();
      if (status !== 'Complete') {
        const errorMsg = "Connection to server lost or traceroute unavailable.";
        setError(errorMsg);
        setStatus('Failed');
        setIsLoading(false);
        addHistoryEntry({ target: host, tool: "Traceroute", status: "Failed", error: errorMsg, timestamp: Date.now() });
      }
    };
  };

  const cancelTrace = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsLoading(false);
    setStatus('Complete'); // Partial completion
  };

  const getLatencyColor = (latency: number, timeout: boolean) => {
    if (timeout) return "text-muted-foreground";
    if (latency < 30) return "text-green-500";
    if (latency < 80) return "text-blue-500";
    if (latency < 150) return "text-amber-500";
    return "text-destructive";
  };

  const getLatencyBg = (latency: number, timeout: boolean) => {
    if (timeout) return "bg-muted text-muted-foreground border-border/50";
    if (latency < 30) return "bg-green-500/10 text-green-500 border-green-500/30";
    if (latency < 80) return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    if (latency < 150) return "bg-amber-500/10 text-amber-500 border-amber-500/30";
    return "bg-destructive/10 text-destructive border-destructive/30";
  };

  const avgLatency = hops.length > 0 ? (hops.filter(h => !h.timeout).reduce((acc, h) => acc + h.latency, 0) / hops.filter(h => !h.timeout).length) : 0;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify({ target: currentHost, resolvedIp, totalHops: hops.length, totalTime, hops }, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ target: currentHost, resolvedIp, totalHops: hops.length, totalTime, hops }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traceroute-${currentHost}.json`;
    a.click();
  };

  const exportCSV = () => {
    const headers = ["Hop", "Hostname", "IP", "Latency (ms)", "Status"];
    const rows = hops.map(h => `"${h.hop}","${h.hostname}","${h.ip}","${h.latency}","${h.timeout ? 'Timeout' : 'Success'}"`);
    const csv = [headers.join(","), ...rows].join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traceroute-${currentHost}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Traceroute</h1>
        <p className="text-muted-foreground text-lg">Trace the path packets take across the Internet to reach their destination.</p>
      </div>

      {/* Input */}
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter domain or IP (e.g., 8.8.8.8)"
                className="pl-10 h-12 text-md focus-visible:ring-primary shadow-sm"
                disabled={isLoading}
              />
            </div>
            {isLoading ? (
              <Button type="button" variant="destructive" className="h-12 px-8 shadow-sm" onClick={cancelTrace}>
                Stop Trace
              </Button>
            ) : (
              <Button type="submit" className="h-12 px-8 shadow-sm" disabled={!input.trim()}>
                Start Trace
              </Button>
            )}
          </form>
          
          {toolRecentSearches.length > 0 && status === 'Idle' && (
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
                  aria-label={`Trace recent target ${h}`}
                >
                  {h}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {status === 'Idle' && (
        <Card className="border-border/50 border-dashed bg-muted/10 shadow-none py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Route className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Ready to Trace</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Discover every network hop, router, and ISP between you and your target destination.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="text-sm text-muted-foreground self-center">Try examples:</span>
              {["google.com", "8.8.8.8", "github.com"].map(example => (
                <Badge 
                  key={example}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => handleAnalyze(example)}
                >
                  {example}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && status === 'Failed' && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle className="text-lg">Traceroute Failed</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-4">
            <p>{error}</p>
            <Button variant="destructive" size="sm" onClick={() => handleAnalyze()}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Trace Results */}
      {(status === 'Tracing' || status === 'Complete' || (status === 'Failed' && hops.length > 0)) && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          {/* Top Summary */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Destination</p>
                <div className="text-sm font-bold truncate" title={currentHost}>{currentHost}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Resolved IP</p>
                <div className="text-sm font-bold truncate">{resolvedIp || (isLoading ? 'Resolving...' : currentHost)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Hop Count</p>
                <div className="text-xl font-bold text-primary">{hops.length}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Avg Latency</p>
                <div className="text-xl font-bold">{avgLatency > 0 ? `${avgLatency.toFixed(1)} ms` : '-'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                <Badge variant="outline" className={status === 'Tracing' ? 'text-blue-500 border-blue-500/30' : (status === 'Complete' ? 'text-green-500 border-green-500/30' : 'text-amber-500 border-amber-500/30')}>
                  {status === 'Tracing' ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Tracing...</>
                  ) : status === 'Complete' ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</>
                  ) : (
                    'Stopped'
                  )}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Trace Duration</p>
                <div className="text-xl font-bold">{totalTime > 0 ? `${(totalTime / 1000).toFixed(1)}s` : (isLoading ? <span className="animate-pulse">Measuring...</span> : '-')}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visualizer */}
            <Card className="border-border/50 shadow-sm col-span-1 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Route Visualization
                  </div>
                  {isLoading && <span className="text-xs font-normal text-muted-foreground flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Discovering route...</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px] w-full p-6 relative bg-background/50">
                  {/* Origin Node */}
                  <div className="flex items-start gap-4 mb-8">
                    <div className="flex flex-col items-center mt-1">
                      <div className="h-4 w-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center z-10">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="w-0.5 h-full min-h-[40px] bg-primary/30 mt-2 rounded-full relative overflow-hidden">
                        {isLoading && hops.length === 0 && (
                          <motion.div 
                            initial={{ y: -20, opacity: 1 }}
                            animate={{ y: 60, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="absolute top-0 w-full h-8 bg-gradient-to-b from-transparent via-primary to-transparent"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Local Computer</div>
                      <div className="text-xs text-muted-foreground">Trace Origin</div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {hops.map((hop, index) => {
                      const isLast = index === hops.length - 1;
                      return (
                        <motion.div 
                          key={hop.hop}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 24 }}
                          className="flex items-start gap-4 mb-4 relative"
                        >
                          <div className="flex flex-col items-center mt-1 shrink-0">
                            <motion.div 
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center z-10 bg-background
                                ${hop.timeout ? 'border-muted-foreground/50' : 'border-blue-500'}`}
                            >
                              <div className={`h-1.5 w-1.5 rounded-full ${hop.timeout ? 'bg-muted-foreground/50' : 'bg-blue-500'}`} />
                            </motion.div>
                            {(!isLast || isLoading) && (
                              <div className="w-0.5 h-full min-h-[40px] bg-border mt-2 rounded-full relative overflow-hidden">
                                {isLoading && isLast && (
                                  <motion.div 
                                    initial={{ y: -20, opacity: 1 }}
                                    animate={{ y: 60, opacity: 0 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="absolute top-0 w-full h-8 bg-gradient-to-b from-transparent via-blue-500 to-transparent"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className={`flex-1 rounded-lg border p-3 ${hop.timeout ? 'bg-muted/10 border-border/50' : 'bg-card border-border/80'} shadow-sm`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">#{hop.hop}</span>
                                  <span className="font-medium text-sm truncate max-w-[150px] sm:max-w-[200px]" title={hop.hostname}>{hop.hostname}</span>
                                </div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5">{hop.ip}</div>
                              </div>
                              <Badge variant="outline" className={getLatencyBg(hop.latency, hop.timeout)}>
                                {hop.timeout ? 'Timeout' : `${hop.latency.toFixed(1)} ms`}
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Destination Node Placeholder */}
                  {status === 'Complete' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-4 mt-8"
                    >
                      <div className="flex flex-col items-center mt-1">
                        <div className="h-4 w-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(34,197,94,0.4)]">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-500 flex items-center gap-2">
                          Destination Reached <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-muted-foreground">{resolvedIp || currentHost}</div>
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={bottomRef} className="h-4" />
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Data Table */}
            <div className="space-y-6">
              <Card className="border-border/50 shadow-sm h-full flex flex-col">
                <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Server className="h-5 w-5 text-primary" /> Hop Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-[600px] w-full">
                    <div className="w-full text-sm">
                      <div className="grid grid-cols-12 gap-2 p-3 font-semibold text-muted-foreground border-b border-border/50 sticky top-0 bg-card z-10">
                        <div className="col-span-2 text-center">Hop</div>
                        <div className="col-span-5">Host</div>
                        <div className="col-span-3 text-right">Latency</div>
                        <div className="col-span-2 text-center">Status</div>
                      </div>
                      <div className="divide-y divide-border/50">
                        {hops.length > 0 ? hops.map((hop) => (
                          <div key={hop.hop} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-muted/30 transition-colors">
                            <div className="col-span-2 text-center font-mono text-xs">{hop.hop}</div>
                            <div className="col-span-5 overflow-hidden">
                              <div className="font-medium truncate" title={hop.hostname}>{hop.hostname}</div>
                              <div className="text-xs text-muted-foreground font-mono truncate" title={hop.ip}>{hop.ip}</div>
                            </div>
                            <div className={`col-span-3 text-right font-mono text-xs ${getLatencyColor(hop.latency, hop.timeout)}`}>
                              {hop.timeout ? '*' : `${hop.latency.toFixed(1)} ms`}
                            </div>
                            <div className="col-span-2 flex justify-center">
                              {hop.timeout ? (
                                <span className="w-2 h-2 rounded-full bg-muted-foreground" title="Timeout" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" title="Success" />
                              )}
                            </div>
                          </div>
                        )) : (
                          <div className="p-8 text-center text-muted-foreground italic flex flex-col items-center">
                            {isLoading ? (
                              <><Loader2 className="w-6 h-6 animate-spin mb-2" /> Waiting for first hop...</>
                            ) : "No trace data available."}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard} aria-label="Copy JSON to clipboard" disabled={isLoading}>
              {copiedAll ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiedAll ? "Copied" : "Copy JSON"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON} aria-label="Export JSON file" disabled={isLoading}>
              <FileText className="mr-2 h-4 w-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} aria-label="Export CSV file" disabled={isLoading}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

        </div>
      )}
    </div>
  );
}
