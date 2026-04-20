import { ReactNode, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ensureDemoData } from "@/lib/seed";

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  useEffect(() => {
    ensureDemoData().catch(console.error);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger />
            <div className="h-6 w-px bg-border" />
            <h1 className="text-sm font-semibold tracking-tight text-foreground">{title}</h1>
          </header>
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
