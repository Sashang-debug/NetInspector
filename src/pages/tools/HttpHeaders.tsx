import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, CheckCircle2, ShieldAlert, History, FileText, 
  Clock, Loader2, Download, Shield, Zap, Globe, Table as TableIcon, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type HttpHeadersResult = {
  success: boolean;
  statusCode: number;
  statusText: string;
  httpVersion: string;
  responseTimeMs: number;
  finalUrl: string;
  redirectCount: number;
  headers: Record<string, string>;
  error?: string;
};

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy"
];

const PERFORMANCE_HEADERS = [
  "cache-control",
  "etag",
  "last-modified",
  "content-encoding"
];

export function HttpHeaders() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HttpHeadersResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "HTTP Headers").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  const handleAnalyze = async (urlToAnalyze: string = input) => {
    let url = urlToAnalyze.trim();
    if (!url) return;
    
    // Basic validation
    if (!/^[a-zA-Z0-9.\-:]+/.test(url)) {
      setError("Invalid URL format. Please enter a valid website address.");
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setInput(url);
    setCurrentUrl(url);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSearchFilter("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/http-headers?url=${encodeURIComponent(url)}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Backend unavailable or returned invalid JSON.");
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch headers");
      }
      
      setResult(data);
      addHistoryEntry({ target: url, tool: "HTTP Headers", status: "Success", responseTime: data.responseTimeMs, timestamp: Date.now() });
    } catch (err: any) {
      const message = err.message || "";
      let finalError = "An unexpected error occurred during analysis.";
      if (message.includes("Failed to fetch") || message.includes("Backend unavailable")) {
        finalError = "Server unavailable. Please check your connection or server status.";
      } else {
        finalError = message;
      }
      setError(finalError);
      addHistoryEntry({ target: url, tool: "HTTP Headers", status: "Failed", error: finalError, timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.headers, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const exportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    downloadBlob(blob, `headers-${new URL(currentUrl).hostname}.json`);
  };

  const exportCSV = () => {
    if (!result) return;
    const headers = ["Header Name", "Value"];
    const csvContent = [
      headers.join(","),
      ...Object.entries(result.headers).map(([k, v]) => `"${k}","${v.replace(/"/g, '""')}"`)
    ].join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `headers-${new URL(currentUrl).hostname}.csv`);
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

  const filteredHeaders = result ? Object.entries(result.headers).filter(([key, value]) => 
    key.toLowerCase().includes(searchFilter.toLowerCase()) || 
    value.toLowerCase().includes(searchFilter.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">HTTP Headers</h1>
        <p className="text-muted-foreground text-lg">Analyze HTTP response headers, security policies, and performance metrics.</p>
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
                placeholder="Enter URL (e.g., https://google.com)"
                className="pl-10 h-12 text-md focus-visible:ring-primary shadow-sm"
                aria-label="Target URL Input"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="h-12 px-8 shadow-sm" 
              disabled={isLoading || !input.trim()}
              aria-label={isLoading ? "Analyzing..." : "Analyze Headers"}
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
              {toolRecentSearches.map((u) => (
                <Badge 
                  key={u} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(u)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(u)}
                  aria-label={`Analyze recent url ${u}`}
                >
                  {u.replace(/^https?:\/\//, '')}
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
              <Globe className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Ready to Inspect</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Enter a website URL to retrieve and analyze its HTTP response headers.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="text-sm text-muted-foreground self-center">Try examples:</span>
              {["https://google.com", "https://github.com", "https://openai.com"].map(exampleUrl => (
                <Badge 
                  key={exampleUrl}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(exampleUrl)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(exampleUrl)}
                  aria-label={`Analyze example URL ${exampleUrl}`}
                >
                  {exampleUrl.replace('https://', '')}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-6" /><div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
            <Card className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-6" /><div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
          </div>
          <Card className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="text-lg">Analysis Failed</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-4">
            <p>{error}</p>
            <Button variant="destructive" size="sm" onClick={() => handleAnalyze()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Results State */}
      {result && !isLoading && !error && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2" aria-live="polite">
          
          {/* Main Summary Section */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Status Code</p>
                <div className={`text-xl font-bold ${result.statusCode >= 400 ? 'text-destructive' : (result.statusCode >= 300 ? 'text-amber-500' : 'text-green-500')}`}>
                  {result.statusCode} <span className="text-sm font-normal opacity-70">{result.statusText}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3"/> Response Time</p>
                <div className="text-xl font-bold">{result.responseTimeMs}<span className="text-sm font-normal text-muted-foreground">ms</span></div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Server</p>
                <div className="text-lg font-bold truncate" title={result.headers['server'] || 'Unknown'}>{result.headers['server'] || 'Unknown'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 col-span-2 md:col-span-1">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Content Type</p>
                <div className="text-base font-bold truncate" title={result.headers['content-type'] || 'Unknown'}>{result.headers['content-type']?.split(';')[0] || 'Unknown'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Content Length</p>
                <div className="text-xl font-bold">{result.headers['content-length'] ? (parseInt(result.headers['content-length']) / 1024).toFixed(1) + ' KB' : 'Dynamic'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Redirects</p>
                <div className="text-xl font-bold">{result.redirectCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Security Analysis */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" /> Security Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {SECURITY_HEADERS.map(header => {
                    const isPresent = !!result.headers[header];
                    return (
                      <div key={header} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <span className="font-mono text-sm">{header}</span>
                        <Badge variant={isPresent ? "outline" : "secondary"} className={isPresent ? "text-green-500 border-green-500/30" : "text-muted-foreground"}>
                          {isPresent ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                          {isPresent ? "Present" : "Missing"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Performance Analysis */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-primary" /> Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {PERFORMANCE_HEADERS.map(header => {
                    const val = result.headers[header];
                    return (
                      <div key={header} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                        <span className="font-mono text-sm shrink-0">{header}</span>
                        {val ? (
                          <div className="text-xs font-mono text-right truncate text-muted-foreground max-w-[200px]" title={val}>{val}</div>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            <XCircle className="mr-1 h-3 w-3" /> Missing
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard} aria-label="Copy headers to clipboard">
              {copiedAll ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
              {copiedAll ? "Copied" : "Copy Headers"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON} aria-label="Export JSON file">
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} aria-label="Export CSV file">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
          </div>

          {/* Headers Table */}
          <Card className="border-border/50 shadow-sm bg-card/50">
            <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TableIcon className="h-5 w-5 text-primary" /> Raw Headers
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search headers..."
                  className="pl-9 h-9 text-sm"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  aria-label="Search Headers"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] w-full rounded-b-xl">
                <div className="min-w-full divide-y divide-border/50">
                  {filteredHeaders.length > 0 ? (
                    filteredHeaders.map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start p-4 hover:bg-muted/30 transition-colors gap-2 sm:gap-6">
                        <div className="font-mono text-sm font-semibold sm:w-1/3 shrink-0 text-primary/90 break-all">{key}</div>
                        <div className="font-mono text-sm text-muted-foreground break-all">{value}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground italic">
                      No headers matched your search filter.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
