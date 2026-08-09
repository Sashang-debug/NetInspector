import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, CheckCircle2, ShieldAlert, History, FileText, 
  Loader2, Download, Shield, ShieldCheck, AlertTriangle, Building, Globe, Server, User, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type WhoisResult = {
  success: boolean;
  domainName: string;
  registrar: string;
  whoisServer: string;
  createdDate: string;
  updatedDate: string;
  expirationDate: string;
  domainStatus: string[];
  nameServers: string[];
  dnssec: string;
  registrantCountry: string;
  registrantOrg: string;
  daysUntilExpiration: number;
  registrationAge: string;
  error?: string;
};

export function WhoisLookup() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentDomain, setCurrentDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhoisResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "WHOIS Lookup").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  const handleAnalyze = async (domainToAnalyze: string = input) => {
    let domain = domainToAnalyze.trim();
    if (!domain) return;

    // Sanitize input
    domain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    
    // Basic domain validation
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
      setError("Invalid domain format. Please enter a valid domain name (e.g., google.com).");
      return;
    }

    setInput(domain);
    setCurrentDomain(domain);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const start = performance.now();
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/whois?domain=${encodeURIComponent(domain)}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Backend unavailable or returned invalid JSON.");
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch WHOIS records");
      }
      
      setResult(data);
      const end = performance.now();
      const rTime = Math.round(end - start);
      addHistoryEntry({ target: domain, tool: "WHOIS Lookup", status: "Success", responseTime: rTime, timestamp: Date.now() });
    } catch (err: any) {
      const message = err.message || "";
      let finalError = "An unexpected error occurred during analysis.";
      if (message.includes("Failed to fetch") || message.includes("Backend unavailable")) {
        finalError = "Server unavailable. Please check your connection or server status.";
      } else if (message.includes("Rate limited") || message.includes("Rate limit")) {
        finalError = "WHOIS server rate limit exceeded. Please try again later.";
      } else if (message.includes("unavailable") || message.includes("not registered")) {
        finalError = "WHOIS record unavailable or domain is not registered.";
      } else if (message.includes("timeout")) {
        finalError = "Connection timeout while reaching the WHOIS server.";
      } else {
        finalError = message;
      }
      setError(finalError);
      addHistoryEntry({ target: domain, tool: "WHOIS Lookup", status: "Failed", error: finalError, timestamp: Date.now() });
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
    downloadBlob(blob, `whois-${currentDomain}.json`);
  };

  const exportCSV = () => {
    if (!result) return;
    const flatResult = {
      Domain: result.domainName,
      Registrar: result.registrar,
      "WHOIS Server": result.whoisServer,
      Created: result.createdDate,
      Updated: result.updatedDate,
      Expires: result.expirationDate,
      "Days Until Expiration": result.daysUntilExpiration,
      "Registration Age": result.registrationAge,
      DNSSEC: result.dnssec,
      "Registrant Org": result.registrantOrg,
      "Registrant Country": result.registrantCountry,
      "Name Servers": result.nameServers.join(" | "),
      "Domain Status": result.domainStatus.join(" | ")
    };
    
    const headers = Object.keys(flatResult);
    const values = Object.values(flatResult);
    
    const csvContent = [
      headers.join(","),
      values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ].join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `whois-${currentDomain}.csv`);
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown";
    try {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const getPrimaryStatus = () => {
    if (!result || !result.domainStatus || result.domainStatus.length === 0) return "Unknown";
    return result.domainStatus[0];
  };

  // Security Assessment Logic
  const hasDnssec = result?.dnssec && result.dnssec.toLowerCase().includes('signed') && !result.dnssec.toLowerCase().includes('unsigned');
  const isExpiringSoon = result && result.daysUntilExpiration < 30;
  const isPrivacyEnabled = !result?.registrantOrg || result?.registrantOrg.toLowerCase().includes('privacy') || result?.registrantOrg.toLowerCase().includes('proxy') || result?.registrantOrg.toLowerCase().includes('redacted');
  const isRegistrarVerified = !!result?.registrar;
  const isDomainActive = result && result.domainStatus.some(s => s.toLowerCase().includes('ok') || s.toLowerCase().includes('active') || s.toLowerCase().includes('client') || s.toLowerCase().includes('server'));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">WHOIS Lookup</h1>
        <p className="text-muted-foreground text-lg">Retrieve live domain registration records, contacts, and security statuses.</p>
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
                placeholder="Enter domain (e.g., google.com)"
                className="pl-10 h-12 text-md focus-visible:ring-primary shadow-sm"
                aria-label="Target Domain Input"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="h-12 px-8 shadow-sm" 
              disabled={isLoading || !input.trim()}
              aria-label={isLoading ? "Analyzing..." : "Analyze Domain"}
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
              {toolRecentSearches.map((d) => (
                <Badge 
                  key={d} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(d)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(d)}
                  aria-label={`Analyze recent domain ${d}`}
                >
                  {d}
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
                Enter a domain name to retrieve its registration details, name servers, and WHOIS records.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="text-sm text-muted-foreground self-center">Try examples:</span>
              {["google.com", "github.com", "cloudflare.com", "openai.com"].map(exampleDomain => (
                <Badge 
                  key={exampleDomain}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
                  onClick={() => handleAnalyze(exampleDomain)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze(exampleDomain)}
                  aria-label={`Analyze example domain ${exampleDomain}`}
                >
                  {exampleDomain}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/50 shadow-sm col-span-1 md:col-span-2"><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-6" /><div className="space-y-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
            <div className="space-y-6">
              <Card className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-6 w-1/3 mb-6" /><div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
              <Card className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-[150px] w-full" /></CardContent></Card>
            </div>
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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-border/50 shadow-sm bg-card/50 col-span-2 md:col-span-1">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Domain</p>
                <div className="text-lg font-bold truncate" title={result.domainName}>{result.domainName || currentDomain}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 col-span-2 md:col-span-1">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Registrar</p>
                <div className="text-base font-bold truncate" title={result.registrar}>{result.registrar || 'Unknown'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3"/> Age</p>
                <div className="text-sm font-bold">{result.registrationAge || 'Unknown'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Expires In (Days)</p>
                <div className={`text-xl font-bold ${result.daysUntilExpiration < 30 ? 'text-amber-500' : 'text-green-500'}`}>{result.daysUntilExpiration || '?'}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                <Badge variant="outline" className="w-fit text-primary border-primary/30 truncate" title={getPrimaryStatus()}>{getPrimaryStatus()}</Badge>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3"/> DNSSEC</p>
                <div className={`text-lg font-bold ${hasDnssec ? 'text-green-500' : 'text-muted-foreground'}`}>{hasDnssec ? 'Enabled' : 'Disabled'}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="space-y-6 col-span-1 md:col-span-2">
              {/* Registration Information */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-primary" /> Registration Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {[
                      { label: "Domain Name", value: result.domainName || currentDomain },
                      { label: "Registrar", value: result.registrar || "Unknown" },
                      { label: "WHOIS Server", value: result.whoisServer || "Unknown" },
                      { label: "Created Date", value: formatDate(result.createdDate) },
                      { label: "Updated Date", value: formatDate(result.updatedDate) },
                      { label: "Expiration Date", value: formatDate(result.expirationDate) },
                      { label: "Registration Age", value: result.registrationAge || "Unknown" },
                    ].map((row, idx) => (
                      <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors gap-2">
                        <span className="font-semibold text-sm text-muted-foreground sm:w-1/3 shrink-0">{row.label}</span>
                        <span className="font-mono text-sm break-all text-foreground sm:text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Registrant Information */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" /> Registrant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {[
                      { label: "Organization", value: result.registrantOrg || "Privacy Protected / Not Available" },
                      { label: "Country", value: result.registrantCountry || "Unknown" },
                    ].map((row, idx) => (
                      <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors gap-2">
                        <span className="font-semibold text-sm text-muted-foreground sm:w-1/3 shrink-0">{row.label}</span>
                        <span className="font-mono text-sm break-all text-foreground sm:text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Security Section */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-primary" /> Security Section
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {[
                      { label: "Domain Active", valid: isDomainActive, errorMsg: "Domain Inactive" },
                      { label: "Registrar Verified", valid: isRegistrarVerified, errorMsg: "Registrar Unknown" },
                      { label: "DNSSEC Enabled", valid: hasDnssec, errorMsg: "Missing DNSSEC" },
                      { label: "WHOIS Privacy", valid: !isPrivacyEnabled, warningOnly: true, errorMsg: "Privacy Protected" },
                      { label: "Expiration Bounds", valid: !isExpiringSoon, errorMsg: "Expiring within 30 days" },
                    ].map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <span className="font-medium text-sm">{item.label}</span>
                        {item.valid ? (
                          <div className="flex items-center text-green-500 font-medium text-sm gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Pass
                          </div>
                        ) : (
                          <div className={`flex items-center font-medium text-sm gap-1 ${item.warningOnly ? 'text-amber-500' : 'text-destructive'}`} title={item.errorMsg}>
                            <AlertTriangle className="h-4 w-4" /> {item.warningOnly ? 'Warning' : 'Failed'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Name Servers */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Server className="h-5 w-5 text-primary" /> Name Servers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[120px] pr-4">
                    {result.nameServers && result.nameServers.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {result.nameServers.map((name, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-sm font-normal py-1 px-3 w-fit">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No Name Servers listed.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Domain Statuses */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building className="h-5 w-5 text-primary" /> Domain Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[120px] pr-4">
                    {result.domainStatus && result.domainStatus.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {result.domainStatus.map((status, i) => (
                          <Badge key={i} variant="outline" className="font-mono text-xs font-normal border-primary/30 text-primary">
                            {status}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No Statuses listed.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard} aria-label="Copy JSON to clipboard">
              {copiedAll ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
              {copiedAll ? "Copied" : "Copy JSON"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON} aria-label="Export JSON file">
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} aria-label="Export CSV file">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
