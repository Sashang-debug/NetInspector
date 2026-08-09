import { useState, useMemo, useEffect } from "react";
import { useHistory } from "../contexts/HistoryContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, Activity, Globe, RefreshCw, 
  Trash2, Play, Copy, Check, Route, Network, Server, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const toolIcons: Record<string, any> = {
  "DNS Lookup": Globe,
  "Reverse DNS": Network,
  "Ping": Activity,
  "Traceroute": Route,
  "HTTP Headers": Server,
  "SSL Certificate": Shield,
  "WHOIS Lookup": Search,
};

const quickTools = [
  { name: "DNS Lookup", path: "/tools/dns", icon: Globe },
  { name: "Ping", path: "/tools/ping", icon: Activity },
  { name: "WHOIS", path: "/tools/whois", icon: Search },
  { name: "HTTP Headers", path: "/tools/http-headers", icon: Server },
];

export function History() {
  const { history, removeHistoryEntry, reloadHistory, clearHistory } = useHistory();
  const navigate = useNavigate();

  useEffect(() => {
    reloadHistory();
  }, []);
  
  const [search, setSearch] = useState("");
  const [filterTool, setFilterTool] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredAndSortedHistory = useMemo(() => {
    let result = [...history];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(h => h.target.toLowerCase().includes(q) || h.tool.toLowerCase().includes(q));
    }

    if (filterTool !== "All") {
      result = result.filter(h => h.tool === filterTool);
    }

    if (filterStatus !== "All") {
      result = result.filter(h => h.status === filterStatus);
    }

    result.sort((a, b) => {
      return sortOrder === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });

    return result;
  }, [history, search, filterTool, filterStatus, sortOrder]);

  const uniqueTools = Array.from(new Set(history.map(h => h.tool)));

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReRun = (tool: string, target: string) => {
    let path = "/";
    switch (tool) {
      case "DNS Lookup": path = "/tools/dns"; break;
      case "Reverse DNS": path = "/tools/reverse-dns"; break;
      case "Ping": path = "/tools/ping"; break;
      case "Traceroute": path = "/tools/traceroute"; break;
      case "HTTP Headers": path = "/tools/http-headers"; break;
      case "SSL Certificate": path = "/tools/ssl"; break;
      case "WHOIS Lookup": path = "/tools/whois"; break;
    }
    navigate(`${path}?target=${encodeURIComponent(target)}`);
  };

  if (history.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground text-lg">Review your past network analyses and tool executions.</p>
        </div>
        
        <Card className="border-border/50 border-dashed bg-muted/5 shadow-none py-16">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <HistoryIcon className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">No network analyses yet.</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Run a tool to start populating your history.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {quickTools.map((t) => (
                <Button key={t.name} variant="outline" onClick={() => navigate(t.path)}>
                  <t.icon className="w-4 h-4 mr-2 text-primary" />
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2 flex flex-col md:flex-row md:items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground text-lg">Review your past network analyses and tool executions.</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>A complete log of all queries made from your account.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search targets..." 
                  className="pl-9 bg-background" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <select 
                className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filterTool}
                onChange={(e) => setFilterTool(e.target.value)}
              >
                <option value="All">All Tools</option>
                {uniqueTools.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select 
                className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
              </select>

              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                title={`Sort by Date ${sortOrder === "desc" ? "Ascending" : "Descending"}`}
              >
                <RefreshCw className={`h-4 w-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
              </Button>
              
              <Button 
                variant="destructive"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to permanently clear all history? This action cannot be undone.")) {
                    try {
                      await clearHistory();
                    } catch(e) {
                      console.error(e);
                    }
                  }
                }}
                disabled={history.length === 0}
              >
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Date / Time</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {filteredAndSortedHistory.map((item) => {
                  const Icon = toolIcons[item.tool] || Globe;
                  return (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      layout
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TableCell className="font-medium max-w-[200px] truncate" title={item.target}>
                        {item.target}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {item.tool}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {typeof item.responseTime === 'number' ? `${item.responseTime} ms` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Success" ? "default" : "destructive"} className={item.status === "Success" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/30" : ""}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Re-run Lookup"
                            onClick={() => handleReRun(item.tool, item.target)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Copy Target"
                            onClick={() => handleCopy(item.id, item.target)}
                          >
                            {copiedId === item.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete Entry"
                            onClick={() => removeHistoryEntry(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
          
          {filteredAndSortedHistory.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              No history entries found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
