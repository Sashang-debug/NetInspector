import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Search, 
  RefreshCw, 
  Activity, 
  Map, 
  FileJson, 
  Lock, 
  Globe, 
  Settings, 
  History 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const sidebarLinks = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    title: "Network Tools",
    heading: true,
  },
  {
    title: "DNS Lookup",
    icon: Search,
    href: "/tools/dns",
  },
  {
    title: "Reverse DNS",
    icon: RefreshCw,
    href: "/tools/reverse-dns",
  },
  {
    title: "Ping",
    icon: Activity,
    href: "/tools/ping",
  },
  {
    title: "Traceroute",
    icon: Map,
    href: "/tools/traceroute",
  },
  {
    title: "HTTP Headers",
    icon: FileJson,
    href: "/tools/http-headers",
  },
  {
    title: "SSL Certificate",
    icon: Lock,
    href: "/tools/ssl",
  },
  {
    title: "WHOIS Lookup",
    icon: Globe,
    href: "/tools/whois",
  },
  {
    title: "History",
    heading: true,
  },
  {
    title: "Recent Searches",
    icon: History,
    href: "/history",
  },
  {
    title: "Settings",
    heading: true,
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
  }
];

export function Sidebar() {
  return (
    <div className="hidden border-r bg-muted/20 md:block w-64 flex-shrink-0 flex-col h-full">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-lg">NetInspector</span>
        </NavLink>
      </div>
      <ScrollArea className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4 py-4">
          {sidebarLinks.map((link, index) => {
            if (link.heading) {
              return (
                <h4 key={index} className="mb-1 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {link.title}
                </h4>
              );
            }
            
            return (
              <NavLink
                key={index}
                to={link.href!}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                    isActive ? "bg-muted text-primary" : "text-muted-foreground"
                  )
                }
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.title}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
