import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, CheckCircle2, ShieldAlert, History, FileText, 
  Loader2, Download, Shield, ShieldCheck, Lock, AlertTriangle, Calendar, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type SslResult = {
  success: boolean;
  subject: string;
  organization: string;
  issuer: string;
  issuedByOrg: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
  signatureAlgorithm: string;
  publicKeySize: string | number;
  tlsVersion: string;
  san: string[];
  fingerprint: string;
  serialNumber: string;
  error?: string;
};

export function SslCertificate() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentDomain, setCurrentDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SslResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "SSL Certificate").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  const handleAnalyze = async (domainToAnalyze: string = input) => {
    let domain = domainToAnalyze.trim();
    if (!domain) return;

    // Remove http/https and paths automatically
    domain = domain.replace(/^https?:\/\//i, '').split('/')[0];
    
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

    const start = performance.now();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ssl?domain=${encodeURIComponent(domain)}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Backend unavailable or returned invalid JSON.");
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch SSL certificate");
      }
      
      const end = performance.now();
      const rTime = Math.round(end - start);
      setResult(data);
      addHistoryEntry({ target: domain, tool: "SSL Certificate", status: "Success", responseTime: rTime, timestamp: Date.now() });
    } catch (err: any) {
      const message = err.message || "";
      let finalError = "An unexpected error occurred during analysis.";
      if (message.includes("Failed to fetch") || message.includes("Backend unavailable")) {
        finalError = "Server unavailable. Please check your connection or server status.";
      } else if (message.includes("Host unreachable") || message.includes("DNS failure")) {
        finalError = "Website Unreachable (DNS Resolution Failed or Host Down).";
      } else if (message.includes("Connection refused")) {
        finalError = "Connection Refused (Port 443 is likely closed on the target server).";
      } else if (message.includes("timeout")) {
        finalError = "Connection Timeout. The server took too long to respond during the SSL handshake.";
      } else {
        finalError = message;
      }
      setError(finalError);
      addHistoryEntry({ target: domain, tool: "SSL Certificate", status: "Failed", error: finalError, timestamp: Date.now() });
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
    downloadBlob(blob, `ssl-${currentDomain}.json`);
  };

  const exportCSV = () => {
    if (!result) return;
    const flatResult = {
      Domain: currentDomain,
      Subject: result.subject,
      Organization: result.organization,
      Issuer: result.issuer,
      "Issued By": result.issuedByOrg,
      "Valid From": result.validFrom,
      "Valid To": result.validTo,
      "Days Remaining": result.daysRemaining,
      Status: result.status,
      "Signature Algorithm": result.signatureAlgorithm,
      "Public Key Size": result.publicKeySize,
      "TLS Version": result.tlsVersion,
      "Serial Number": result.serialNumber,
      Fingerprint: result.fingerprint
    };
    
    const headers = Object.keys(flatResult);
    const values = Object.values(flatResult);
    
    const csvContent = [
      headers.join(","),
      values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ].join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `ssl-${currentDomain}.csv`);
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

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Valid':
        return <Badge variant="outline" className="text-green-500 border-green-500/30 px-3 py-1 text-sm"><CheckCircle2 className="w-4 h-4 mr-1" /> Valid</Badge>;
      case 'Expiring Soon':
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30 px-3 py-1 text-sm"><AlertTriangle className="w-4 h-4 mr-1" /> Expiring Soon</Badge>;
      case 'Expired':
        return <Badge variant="outline" className="text-destructive border-destructive/30 px-3 py-1 text-sm"><ShieldAlert className="w-4 h-4 mr-1" /> Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  // Security Assessment Logic
  const isValidCert = result?.status !== 'Expired';
  const isTrustedIssuer = result?.issuer && !result.issuer.toLowerCase().includes('self-signed');
  const isModernTls = result?.tlsVersion === 'TLSv1.3' || result?.tlsVersion === 'TLSv1.2';
  const isStrongKey = result?.publicKeySize === 'Unknown' || (typeof result?.publicKeySize === 'number' && result.publicKeySize >= 2048) || (typeof result?.publicKeySize === 'string' && result.publicKeySize.includes('256'));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">SSL Certificate Lookup</h1>
        <p className="text-muted-foreground text-lg">Analyze SSL/TLS certificates, security chains, and expiration dates.</p>
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
              aria-label={isLoading ? "Analyzing..." : "Analyze Certificate"}
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
              <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Ready to Inspect</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Enter a domain name to retrieve its live SSL certificate and assess security configurations.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="text-sm text-muted-foreground self-center">Try examples:</span>
              {["google.com", "github.com", "cloudflare.com"].map(exampleDomain => (
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
          <AlertTitle className="text-lg">Certificate Analysis Failed</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-4">
            <p>{error}</p>
            <Button variant="destructive" size="sm" onClick={() => handleAnalyze()}>
              Retry Connection
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
                <p className="text-xs font-medium text-muted-foreground mb-1">Target Domain</p>
                <div className="text-lg font-bold truncate" title={currentDomain}>{currentDomain}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Certificate Status</p>
                <div className="mt-1">{renderStatusBadge(result.status)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/> Days Remaining</p>
                <div className={`text-xl font-bold ${result.status === 'Valid' ? 'text-green-500' : (result.status === 'Expired' ? 'text-destructive' : 'text-amber-500')}`}>{result.daysRemaining}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 col-span-2 md:col-span-1">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Issuer</p>
                <div className="text-base font-bold truncate" title={result.issuer}>{result.issuer}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1">Valid Until</p>
                <div className="text-sm font-bold truncate" title={formatDate(result.validTo)}>{formatDate(result.validTo)}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Lock className="h-3 w-3"/> TLS Version</p>
                <div className="text-lg font-bold">{result.tlsVersion}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Certificate Details */}
            <Card className="border-border/50 shadow-sm col-span-1 md:col-span-2">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" /> Certificate Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px] w-full rounded-b-xl">
                  <div className="divide-y divide-border/50">
                    {[
                      { label: "Subject Common Name", value: result.subject },
                      { label: "Organization", value: result.organization || "Not Specified" },
                      { label: "Issuer", value: result.issuer },
                      { label: "Issued By (Org)", value: result.issuedByOrg || "Not Specified" },
                      { label: "Valid From", value: formatDate(result.validFrom) },
                      { label: "Valid To", value: formatDate(result.validTo) },
                      { label: "Serial Number", value: result.serialNumber },
                      { label: "Fingerprint (SHA-256)", value: result.fingerprint },
                      { label: "Signature Algorithm", value: result.signatureAlgorithm },
                      { label: "Public Key Size", value: result.publicKeySize !== 'Unknown' ? `${result.publicKeySize} bits` : 'Unknown' },
                    ].map((row, idx) => (
                      <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors gap-2">
                        <span className="font-semibold text-sm text-muted-foreground sm:w-1/3 shrink-0">{row.label}</span>
                        <span className="font-mono text-sm break-all text-foreground sm:text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Security Assessment */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-primary" /> Security Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {[
                      { label: "Valid Certificate", valid: isValidCert, errorMsg: "Certificate Invalid or Expired" },
                      { label: "Trusted Issuer", valid: isTrustedIssuer, errorMsg: "Self-Signed or Untrusted" },
                      { label: "Modern TLS", valid: isModernTls, errorMsg: `Outdated (${result.tlsVersion})` },
                      { label: "Strong Key Length", valid: isStrongKey, errorMsg: `Weak Key (${result.publicKeySize})` },
                      { label: "Not Expired", valid: isValidCert, errorMsg: "Certificate Expired" },
                    ].map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <span className="font-medium text-sm">{item.label}</span>
                        {item.valid ? (
                          <div className="flex items-center text-green-500 font-medium text-sm gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Pass
                          </div>
                        ) : (
                          <div className="flex items-center text-destructive font-medium text-sm gap-1" title={item.errorMsg}>
                            <AlertTriangle className="h-4 w-4" /> Warning
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Subject Alternative Names */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="h-5 w-5 text-primary" /> Subject Alternative Names
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-[150px] pr-4">
                    {result.san && result.san.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {result.san.map((name, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-xs font-normal">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No Subject Alternative Names provided.</p>
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
