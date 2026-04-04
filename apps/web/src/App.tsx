import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { getMe, logOut } from "./lib/api";
import { usePrelineAutoInit } from "./hooks/use-preline-auto-init";
import { queryClient } from "./lib/query-client";
import { AuthPage } from "./pages/AuthPage";
import { GroupPage } from "./pages/GroupPage";
import { GroupsPage } from "./pages/GroupsPage";
import { HomePage } from "./pages/HomePage";
import { MeetingPage } from "./pages/MeetingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { VenuePage } from "./pages/VenuePage";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem("melon-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function AppShell() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const navigate = useNavigate();
  const meQuery = useQuery({
    queryFn: getMe,
    queryKey: ["me"],
  });

  const logoutMutation = useMutation({
    mutationFn: logOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("melon-theme", theme);
  }, [theme]);

  const viewer = meQuery.data?.viewer ?? null;

  return (
    <div>
      <header className="shell-header">
        <div className="shell-header__inner">
          <Link className="shell-brand" to="/">
            <div className="shell-brand__mark">M</div>
            <div>
              <div className="shell-brand__eyebrow">Berlin court terminal</div>
              <p className="shell-brand__title">Melon Meet</p>
            </div>
          </Link>

          <div className="shell-actions">
            <nav className="app-nav">
              <NavLink className="nav-pill" to="/">
                Map
              </NavLink>
              <NavLink className="nav-pill" to="/groups">
                Groups
              </NavLink>
              {viewer ? (
                <NavLink className="nav-pill" to={`/profile/${viewer.id}`}>
                  Profile
                </NavLink>
              ) : (
                <NavLink className="nav-pill" to="/auth">
                  Access
                </NavLink>
              )}
            </nav>

            <button
              className="button-secondary theme-toggle"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              type="button"
            >
              Theme: {theme}
            </button>

            {viewer ? (
              <button
                className="button-ghost"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                type="button"
              >
                {logoutMutation.isPending ? "Signing out" : "Sign out"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage viewer={viewer} />} />
          <Route path="/auth" element={<AuthPage viewer={viewer} />} />
          <Route path="/groups" element={<GroupsPage viewer={viewer} />} />
          <Route path="/groups/:groupId" element={<GroupPage viewer={viewer} />} />
          <Route path="/meetings/:meetingId" element={<MeetingPage viewer={viewer} />} />
          <Route path="/profile/:profileId" element={<ProfilePage viewer={viewer} />} />
          <Route path="/venues/:venueId" element={<VenuePage viewer={viewer} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  usePrelineAutoInit();
  return <AppShell />;
}
