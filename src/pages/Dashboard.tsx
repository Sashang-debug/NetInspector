import { useState, useEffect, useCallback } from "react";
import { Activity, ArrowRight, CheckCircle2, Clock, Globe, Search, Server, Shield, ActivitySquare, AlertTriangle, Network, Wifi, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useHistory } from "../contexts/HistoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type DashboardData = {
  overview: {
    totalQueriesToday: number;
    successfulLookups: number;
    failedRequests: number;
    avgResponseTime: number;
    mostUsedTool: string;
  };
  insights: {
    mostQueriedDomain: string;
    avgDnsTime: number;
    avgPingTime: number;
    certsExpiringSoon: number;
    domainsWithoutDnssec: number;
    httpSecurityAvg: number;
  };
  charts: {
    queriesLast7Days: { date: string; count: number }[];
    toolUsage: { name: string; value: number }[];
    avgLatencyByTool: { name: string; latency: number }[];
  };
  recentActivity: {
    id: number;
    tool: string;
    target: string;
    status: string;
    latency: number;
    time: string;
  }[];
};

type StatusData = {
  services: {
    backendApi: string;
    database: string;
    whoisService: string;
    dnsResolver: string;
    tracerouteEngine: string;
  };
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const tools = [
  { name: "DNS Lookup", path: "/tools/dns", icon: Globe, desc: "Resolve A, AAAA, MX, NS records" },
  { name: "Reverse DNS", path: "/tools/reverse-dns", icon: Network, desc: "Map IP addresses to hostnames" },
  { name: "Ping", path: "/tools/ping", icon: ActivitySquare, desc: "Measure network latency" },
  { name: "Traceroute", path: "/tools/traceroute", icon: RouteIcon, desc: "Map network paths" },
  { name: "HTTP Headers", path: "/tools/http-headers", icon: Server, desc: "Analyze server responses" },
  { name: "SSL Certificate", path: "/tools/ssl", icon: Shield, desc: "Inspect certificate chains" },
  { name: "WHOIS Lookup", path: "/tools/whois", icon: Search, desc: "Query domain registration" },
];

function RouteIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>
  );
}

const DashboardSearch = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showToolSelector, setShowToolSelector] = useState(false);
  const { history } = useHistory();
  const recentTargets = Array.from(new Set(history.map(h => h.target))).slice(0, 5);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(query);
    const validTools = tools.filter(t => {
      if (isIP && (t.name === "DNS Lookup" || t.name === "SSL Certificate" || t.name === "HTTP Headers")) return false;
      if (!isIP && t.name === "Reverse DNS") return false;
      return true;
    });

    if (validTools.length === 1) {
      navigate(`${validTools[0].path}?target=${encodeURIComponent(query)}`);
    } else {
      setShowToolSelector(true);
    }
  };

  const handleRunTool = (path: string) => {
    navigate(`${path}?target=${encodeURIComponent(searchInput)}`);
  };

  return (
    <Card className="border-primary/20 shadow-md bg-gradient-to-br from-card to-muted/20 overflow-visible">
      <CardContent className="p-8 sm:p-12 text-center space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Network Operations Center</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Monitor, analyze, and diagnose your network infrastructure in real-time. Enter a domain or IP to begin.
        </p>
        <div className="max-w-xl mx-auto relative z-50">
          <form onSubmit={handleSearchSubmit} className="relative group">
            <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setShowToolSelector(false); }}
              placeholder="e.g., google.com, 8.8.8.8, cloudflare.com"
              className="pl-12 h-14 text-lg rounded-full focus-visible:ring-primary shadow-lg border-primary/20 bg-background"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-2 top-2 h-10 w-10 rounded-full"
              disabled={!searchInput.trim()}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <AnimatePresence>
            {showToolSelector && debouncedSearch && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-16 w-full bg-card border border-border shadow-xl rounded-xl p-2 z-50 flex flex-col gap-1"
              >
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left border-b border-border/50 mb-1">
                  Run Tool for {searchInput}
                </div>
                {tools.map(tool => (
                  <Button key={tool.name} variant="ghost" className="justify-start h-auto py-3 px-4 w-full" onClick={() => handleRunTool(tool.path)}>
                    <tool.icon className="h-5 w-5 mr-3 text-primary" />
                    <div className="text-left flex flex-col">
                      <span className="font-semibold">{tool.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">{tool.desc}</span>
                    </div>
                  </Button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!showToolSelector && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="text-sm text-muted-foreground self-center mr-2">Suggestions:</span>
              {(recentTargets.length > 0 ? recentTargets : ["google.com", "github.com", "cloudflare.com", "8.8.8.8"]).map(example => (
                <Badge 
                  key={example}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors py-1 px-3"
                  onClick={() => { setSearchInput(example); setDebouncedSearch(example); setShowToolSelector(true); }}
                >
                  {example}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const { history, reloadHistory } = useHistory();

  const fetchData = useCallback(() => {
    const today = new Date();
    const last7Days = Array.from({length: 7}).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      return d;
    }).reverse();
    
    const queriesLast7Days = last7Days.map(date => {
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      const count = history.filter(h => h.timestamp >= date.getTime() && h.timestamp < nextDate.getTime()).length;
      return { date: date.toISOString(), count };
    });

    const toolUsage = Object.entries(history.reduce((acc, h) => {
      acc[h.tool] = (acc[h.tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));

    const targetCounts = history.reduce((acc, h) => {
      acc[h.target] = (acc[h.target] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let mostQueriedDomain = "None";
    let maxDomainCount = 0;
    Object.entries(targetCounts).forEach(([domain, count]) => {
      if (count > maxDomainCount) { maxDomainCount = count; mostQueriedDomain = domain; }
    });

    const dnsHistory = history.filter(h => h.tool === "DNS Lookup" && h.responseTime);
    const avgDnsTime = dnsHistory.length ? Math.round(dnsHistory.reduce((acc, h) => acc + (h.responseTime || 0), 0) / dnsHistory.length) : 0;

    setData({
      overview: { totalQueriesToday: 0, successfulLookups: 0, failedRequests: 0, avgResponseTime: 0, mostUsedTool: "" }, 
      charts: { queriesLast7Days, toolUsage, avgLatencyByTool: [] },
      insights: { mostQueriedDomain, avgDnsTime, avgPingTime: 0, certsExpiringSoon: 0, domainsWithoutDnssec: 0, httpSecurityAvg: 100 },
      recentActivity: [] 
    });

    setStatus({
      services: { backendApi: 'Green', database: 'Green', whoisService: 'Green', dnsResolver: 'Green', tracerouteEngine: 'Green' }
    });
    setLoading(false);
  }, [history]);

  useEffect(() => {
    reloadHistory();
    fetchData();
  }, [reloadHistory, fetchData]);

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const MetricCard = ({ title, value, icon: Icon, color }: any) => (
    <motion.div variants={itemVariants}>
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur hover:bg-muted/20 transition-colors h-full flex flex-col justify-center">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1 truncate">{title}</p>
              <h3 className="text-2xl xl:text-3xl font-bold tracking-tight truncate">{value}</h3>
            </div>
            <div className={`p-3 rounded-full shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const StatusBadge = ({ state }: { state: string }) => {
    if (state === 'Green') return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/30">Operational</Badge>;
    if (state === 'Yellow') return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30">Degraded</Badge>;
    return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30">Offline</Badge>;
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="col-span-2 h-[400px]" />
          <Skeleton className="col-span-1 h-[400px]" />
        </div>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const totalQueriesToday = history.filter(h => h.timestamp >= todayStart.getTime()).length;
  const successfulLookups = history.filter(h => h.status === 'Success').length;
  const failedRequests = history.filter(h => h.status === 'Failed').length;
  
  const entriesWithTime = history.filter(h => typeof h.responseTime === 'number');
  const avgResponseTime = entriesWithTime.length 
    ? Math.round(entriesWithTime.reduce((acc, h) => acc + (h.responseTime || 0), 0) / entriesWithTime.length) 
    : 0;

  const toolCounts = history.reduce((acc, h) => {
    acc[h.tool] = (acc[h.tool] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  let mostUsedTool = "None";
  let maxCount = 0;
  Object.entries(toolCounts).forEach(([tool, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostUsedTool = tool;
    }
  });

  const recentActivityData = history.map(h => ({
    id: h.id,
    tool: h.tool,
    target: h.target,
    status: h.status,
    latency: h.responseTime || 0,
    time: h.timestamp
  }));

  const hasHistory = history.length > 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Hero Search Section */}
      <motion.div variants={itemVariants} className="relative">
        <DashboardSearch />
      </motion.div>

      {/* Empty State */}
      {!hasHistory && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 border-dashed bg-muted/5 shadow-none py-16">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Activity className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Awaiting First Analysis</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your Network Operations Center is online. Run a tool above to start populating your dashboards with live data.
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Network Health Overview */}
      {hasHistory && (
        <motion.div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard title="Total Queries Today" value={totalQueriesToday} icon={Activity} color="bg-blue-500/10 text-blue-500" />
          <MetricCard title="Successful Lookups" value={successfulLookups} icon={CheckCircle2} color="bg-green-500/10 text-green-500" />
          <MetricCard title="Failed Requests" value={failedRequests} icon={AlertTriangle} color="bg-destructive/10 text-destructive" />
          <MetricCard title="Avg Response" value={`${avgResponseTime}ms`} icon={Clock} color="bg-amber-500/10 text-amber-500" />
          <MetricCard title="Most Used Tool" value={mostUsedTool} icon={Server} color="bg-purple-500/10 text-purple-500" />
          <MetricCard title="Active Sessions" value="1" icon={Wifi} color="bg-cyan-500/10 text-cyan-500" />
        </motion.div>
      )}

      {/* Main Dashboard Grid */}
      {hasHistory && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="col-span-1 lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <motion.div variants={itemVariants}>
              <h2 className="text-lg font-semibold mb-4 flex items-center"><Play className="h-5 w-5 mr-2 text-primary" /> Quick Launch Tools</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tools.slice(0,6).map((tool) => (
                  <motion.div key={tool.name} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                    <Card 
                      className="cursor-pointer border-border/50 shadow-sm hover:shadow-md hover:border-primary/50 transition-all bg-card/50 backdrop-blur group h-full"
                      onClick={() => navigate(tool.path)}
                    >
                      <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
                        <div className="p-3 bg-muted group-hover:bg-primary/10 group-hover:text-primary rounded-full transition-colors">
                          <tool.icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{tool.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants}>
                <Card className="border-border/50 shadow-sm h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md font-semibold">Queries (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.charts.queriesLast7Days}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month:'short', day:'numeric'})} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/50 shadow-sm h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md font-semibold">Tool Usage Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px] p-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.toolUsage}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {data.charts.toolUsage.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Analysis Table */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Recent Analysis Logs
                    <Button variant="ghost" size="sm" className="text-xs h-8">View All</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full text-sm">
                    <div className="grid grid-cols-12 gap-2 p-4 font-semibold text-muted-foreground border-b border-border/50 bg-muted/20">
                      <div className="col-span-3">Target</div>
                      <div className="col-span-3">Tool</div>
                      <div className="col-span-2 text-center">Status</div>
                      <div className="col-span-2 text-right">Latency</div>
                      <div className="col-span-2 text-right">Time</div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {recentActivityData.slice(0, 5).map((activity) => (
                        <div 
                          key={activity.id} 
                          className="grid grid-cols-12 gap-2 p-4 items-center hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => {
                            const toolObj = tools.find(t => t.name === activity.tool);
                            if (toolObj) navigate(`${toolObj.path}?target=${encodeURIComponent(activity.target)}`);
                          }}
                        >
                          <div className="col-span-3 font-medium truncate group-hover:text-primary transition-colors">{activity.target}</div>
                          <div className="col-span-3 text-muted-foreground flex items-center">
                            {(() => {
                              const Icon = tools.find(t => t.name === activity.tool)?.icon;
                              return Icon ? <Icon className="w-3 h-3 mr-2" /> : null;
                            })()}
                            {activity.tool}
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <Badge variant="outline" className={activity.status === 'Success' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'}>
                              {activity.status}
                            </Badge>
                          </div>
                          <div className="col-span-2 text-right font-mono text-xs">{activity.latency > 0 ? `${activity.latency} ms` : '-'}</div>
                          <div className="col-span-2 text-right text-muted-foreground text-xs">{new Date(activity.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="col-span-1 space-y-6">
            
            {/* Live Activity Feed */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 shadow-sm h-[420px] flex flex-col">
                <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between sticky top-0 bg-card z-10 rounded-t-xl">
                  <CardTitle className="text-md flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2" /> Live Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                    <div className="p-4 space-y-4">
                      <AnimatePresence initial={false}>
                        {recentActivityData.slice(0, 20).map((activity) => (
                          <motion.div 
                            key={activity.id}
                            initial={{ opacity: 0, height: 0, y: -20 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-start gap-3 relative"
                          >
                            <div className="w-10 text-xs font-mono text-muted-foreground pt-1 shrink-0 text-right">
                              {new Date(activity.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${activity.status === 'Success' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
                              {(() => {
                                const Icon = tools.find(t => t.name === activity.tool)?.icon;
                                return Icon ? <Icon className="w-4 h-4" /> : <Activity className="w-4 h-4" />;
                              })()}
                            </div>
                            <div className="flex-1 pb-4 border-b border-border/30">
                              <div className="flex justify-between items-start">
                                <span className="font-semibold text-sm">{activity.tool}</span>
                                {activity.latency > 0 && <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{activity.latency}ms</span>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{activity.target}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>

            {/* Network Insights */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 shadow-sm bg-muted/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-md font-semibold">Network Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Most Queried Domain</span>
                    <span className="text-sm font-semibold truncate max-w-[150px]">{data.insights.mostQueriedDomain}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average DNS Time</span>
                    <span className="text-sm font-semibold">{data.insights.avgDnsTime} ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Certificates Expiring Soon</span>
                    <Badge variant={data.insights.certsExpiringSoon > 0 ? "destructive" : "secondary"}>{data.insights.certsExpiringSoon}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Domains Without DNSSEC</span>
                    <Badge variant={data.insights.domainsWithoutDnssec > 0 ? "destructive" : "secondary"}>{data.insights.domainsWithoutDnssec}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg HTTP Security Score</span>
                    <span className={`text-sm font-bold ${data.insights.httpSecurityAvg >= 90 ? 'text-green-500' : data.insights.httpSecurityAvg >= 70 ? 'text-amber-500' : 'text-destructive'}`}>
                      {data.insights.httpSecurityAvg}/100
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* System Status */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-md font-semibold flex justify-between items-center">
                    System Status
                    {status && Object.values(status.services).every(v => v === 'Green') && <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10 border-green-500/30">All Systems Normal</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {status ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Backend API</span>
                        <StatusBadge state={status.services.backendApi} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Telemetry Database</span>
                        <StatusBadge state={status.services.database} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">WHOIS Service</span>
                        <StatusBadge state={status.services.whoisService} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Traceroute Engine</span>
                        <StatusBadge state={status.services.tracerouteEngine} />
                      </div>
                    </>
                  ) : (
                    <Skeleton className="w-full h-[100px]" />
                  )}
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>
      )}
    </motion.div>
  );
}
