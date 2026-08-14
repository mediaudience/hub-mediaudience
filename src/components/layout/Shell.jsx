import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import PageSkeleton from "../common/PageSkeleton";
import usePageTransition from "../../hooks/usePageTransition";

const SIDEBAR_WIDTH = 245;

export default function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const loading = usePageTransition(location.pathname);
  const toggleSidebar = () => setCollapsed((c) => !c);

  return (
    <div className="min-h-screen bg-bg-app">
      <Navbar onToggleSidebar={toggleSidebar} />
      <Sidebar collapsed={collapsed} />

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        style={{ left: collapsed ? 0 : SIDEBAR_WIDTH }}
        className="fixed top-24 z-40 w-7 h-7 -translate-x-1/2 flex items-center justify-center rounded-full bg-white border border-brand-purple/30 text-brand-purple shadow transition-all duration-200 hover:bg-brand-purple hover:text-white"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
        >
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <main
        className={`pt-16 transition-all duration-200 ${
          collapsed ? "pl-0" : "pl-[245px]"
        }`}
      >
        <div className="p-6">
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
