import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import PageSkeleton from "../common/PageSkeleton";
import usePageTransition from "../../hooks/usePageTransition";

const DESKTOP_QUERY = "(min-width: 768px)";

export default function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
  );
  const location = useLocation();
  const loading = usePageTransition(location.pathname);
  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const closeSidebar = () => setSidebarOpen(false);
  // Desktop keeps the sidebar open across navigation (it's a push panel, not a drawer).
  const closeSidebarOnMobile = () => {
    if (!window.matchMedia(DESKTOP_QUERY).matches) setSidebarOpen(false);
  };

  // On mobile the sidebar is a drawer that defaults closed; on desktop it's an
  // always-visible push panel. Crossing the breakpoint re-syncs to that default.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = (e) => setSidebarOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="min-h-screen bg-bg-app">
      <Navbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      <Sidebar open={sidebarOpen} onNavigate={closeSidebarOnMobile} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <main className={`pt-16 transition-all duration-200 pl-0 ${sidebarOpen ? "md:pl-[245px]" : "md:pl-0"}`}>
        <div className="p-4 sm:p-6">
          {loading ? (
            <PageSkeleton />
          ) : (
            <div className="page-fade-in">
              <Outlet />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
