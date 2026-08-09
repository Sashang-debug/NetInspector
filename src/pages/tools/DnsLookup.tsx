import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useHistory } from "../../contexts/HistoryContext";
import { 
  Search, Copy, Download, CheckCircle2, ChevronDown, ChevronRight, 
  Activity, Clock, Server, Database, ShieldAlert, History, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DnsRecord = {
  type: string;
  name: string;
  ttl: number;
  data: string;
};

const RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"];

function getBadgeColor(type: string) {
  switch (type) {
    case "A": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "AAAA": return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    case "MX": return "bg-green-500/10 text-green-600 border-green-500/20";
    case "NS": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "TXT": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    case "CNAME": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  }
}

function CollapsibleSection({ 
  title, 
  records, 
  onCopy 
}: { 
  title: string; 
  records: DnsRecord[]; 
  onCopy: (records: DnsRecord[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  if (records.length === 0) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(records);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden mb-4">
      <div 
        className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          <h3 className="font-semibold">{title} Records</h3>
          <Badge variant="secondary" className="ml-2">{records.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy} className="h-8">
          {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy Section"}
        </Button>
      </div>
      
      {isOpen && (
        <div className="border-t border-border/50">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[250px]">Name</TableHead>
                <TableHead className="w-[100px]">TTL</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", getBadgeColor(record.type))}>
                      {record.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{record.name}</TableCell>
                  <TableCell className="text-muted-foreground">{record.ttl}s</TableCell>
                  <TableCell className="font-mono text-sm break-all">{record.data}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export function DnsLookup() {
  const [searchParams] = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const [input, setInput] = useState(initialTarget);
  const [currentDomain, setCurrentDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DnsRecord[] | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [copiedAll, setCopiedAll] = useState(false);
  const initialized = useRef(false);
  
  const { history, addHistoryEntry } = useHistory();
  const toolRecentSearches = Array.from(new Set(history.filter(h => h.tool === "DNS Lookup").map(h => h.target))).slice(0, 5);

  useEffect(() => {
    if (initialTarget && !initialized.current) {
      initialized.current = true;
      handleAnalyze(initialTarget);
    }
  }, [initialTarget]);

  const handleAnalyze = async (domainToAnalyze: string = input) => {
    const domain = domainToAnalyze.trim();
    if (!domain) return;
    
    setInput(domain);
    setCurrentDomain(domain);
    setIsLoading(true);
    setError(null);
    setResults(null);
    setResponseTime(0);

    const start = performance.now();
    try {
      if (!domain.includes(".")) throw new Error("Invalid domain name format");
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/dns?domain=${encodeURIComponent(domain)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to fetch DNS records");
      }
      
      const data = await response.json();
      if (data.length === 0) {
        throw new Error("No DNS records found for this domain.");
      }
      
      setResults(data);
      const end = performance.now();
      const rTime = Math.round(end - start);
      setResponseTime(rTime);
      addHistoryEntry({ target: domain, tool: "DNS Lookup", status: "Success", responseTime: rTime, timestamp: Date.now() });
    } catch (err: any) {
      const errMsg = err.message || "An error occurred during analysis.";
      setError(errMsg);
      addHistoryEntry({ target: domain, tool: "DNS Lookup", status: "Failed", error: errMsg, timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (data: any, setCopiedState: any) => {
    navigator.clipboard.writeText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const exportJSON = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${currentDomain}-dns-records.json`);
  };

  const exportCSV = () => {
    if (!results) return;
    const headers = ["Type", "Name", "TTL", "Data"];
    const csvContent = [
      headers.join(","),
      ...results.map(r => `"${r.type}","${r.name}",${r.ttl},"${r.data.replace(/"/g, '""')}"`)
    ].join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${currentDomain}-dns-records.csv`);
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

  const groupedRecords = RECORD_TYPES.reduce((acc, type) => {
    acc[type] = results ? results.filter(r => r.type === type) : [];
    return acc;
  }, {} as Record<string, DnsRecord[]>);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Advanced DNS Lookup</h1>
        <p className="text-muted-foreground text-lg">Query and analyze all DNS records with high-performance routing.</p>
      </div>

      {/* Input Section */}
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter domain (e.g. google.com)"
                className="pl-10 h-12 text-md focus-visible:ring-primary shadow-sm"
              />
            </div>
            <Button type="submit" className="h-12 px-8 shadow-sm" disabled={isLoading || !input.trim()}>
              {isLoading ? "Analyzing..." : "Analyze"}
            </Button>
          </form>
          
          {toolRecentSearches.length > 0 && !results && !isLoading && !error && (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4 mr-1" />
              <span>Recent:</span>
              {toolRecentSearches.map((domain) => (
                <Badge 
                  key={domain} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => handleAnalyze(domain)}
                >
                  {domain}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {!isLoading && !error && !results && (
        <Card className="border-border/50 border-dashed bg-muted/10 shadow-none py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Server className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">Ready to Analyze</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Enter a domain name above to retrieve its A, AAAA, MX, NS, TXT, and CNAME records instantly.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-border/50 shadow-sm"><CardContent className="p-6"><Skeleton className="h-8 w-full" /><Skeleton className="h-4 w-2/3 mt-2" /></CardContent></Card>
            ))}
          </div>
          <Card className="border-border/50 shadow-sm">
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-5 w-5" />
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
      {results && !isLoading && !error && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Target Domain</p>
                <div className="text-lg sm:text-xl font-bold truncate" title={currentDomain}>{currentDomain}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Response Time
                </p>
                <div className="text-xl font-bold">{responseTime} <span className="text-sm font-normal text-muted-foreground">ms</span></div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Database className="h-3 w-3" /> Total Records
                </p>
                <div className="text-xl font-bold">{results.length}</div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Status
                </p>
                <div className="text-xl font-bold text-green-500 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Success
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Record Statistics */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {RECORD_TYPES.map(type => (
              <Card key={type} className="border-border/50 shadow-sm bg-card/50">
                <CardContent className="p-3 text-center flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground mb-1">{type}</span>
                  <Badge variant={groupedRecords[type].length > 0 ? "default" : "secondary"} className={groupedRecords[type].length > 0 ? getBadgeColor(type) : ""}>
                    {groupedRecords[type].length}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(results, setCopiedAll)}>
              {copiedAll ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiedAll ? "Copied All" : "Copy JSON"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <FileText className="mr-2 h-4 w-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          {/* Grouped Records */}
          <div className="space-y-4">
            {RECORD_TYPES.map(type => (
              <CollapsibleSection 
                key={type} 
                title={type} 
                records={groupedRecords[type]} 
                onCopy={(recs) => copyToClipboard(recs, () => {})}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
