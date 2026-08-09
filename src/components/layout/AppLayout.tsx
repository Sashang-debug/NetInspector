import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";

export function AppLayout() {
  return (
    <div className="flex h-screen w-full flex-col bg-background md:flex-row overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 bg-muted/10">
          <div className="mx-auto w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
