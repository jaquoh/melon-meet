import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import watermelonMark from "./assets/watermelon-mark.svg";
import { getMe, logOut } from "./lib/api";
import { usePrelineAutoInit } from "./hooks/use-preline-auto-init";
import { queryClient } from "./lib/query-client";
import { AuthPage } from "./pages/AuthPage";
import { GroupPage } from "./pages/GroupPage";
import { GroupsPage } from "./pages/GroupsPage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const viewer = meQuery.data?.viewer ?? null;
  const mapSectionActive =
    location.pathname === "/map" || location.pathname.startsWith("/meetings/") || location.pathname.startsWith("/venues/");
  const groupsSectionActive = location.pathname === "/groups" || location.pathname.startsWith("/groups/");

  return (
    <div>
      <header className="shell-header">
        <div className="shell-header__inner shell-header__inner--fresh">
          <Link className="shell-brand" to="/">
            <img alt="Melon Meet" className="shell-brand__fruit" src={watermelonMark} />
            <div>
              <div className="shell-brand__eyebrow">Berlin volleyball meetups</div>
              <p className="shell-brand__title">Melon Meet</p>
            </div>
          </Link>

          <nav className="app-nav app-nav--header">
            <Link className={`nav-pill ${mapSectionActive ? "active" : ""}`} to="/map">
              Map
            </Link>
            <Link className={`nav-pill ${groupsSectionActive ? "active" : ""}`} to="/groups">
              Groups
            </Link>
          </nav>

          <div className="shell-actions">
            {viewer ? (
              <Link className="button-secondary button-secondary--soft shell-access" to={`/profile/${viewer.id}`}>
                Profile
              </Link>
            ) : (
              <Link className="button-secondary button-secondary--soft shell-access" to="/auth">
                Log in
              </Link>
            )}

            <button
              className="button-secondary theme-toggle"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              type="button"
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>

            <button
              aria-expanded={menuOpen}
              className="button-ghost shell-menu-toggle"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="shell-menu">
            <nav className="shell-menu__nav">
              <NavLink className="shell-menu__link" to="/">
                Home
              </NavLink>
              <NavLink className="shell-menu__link" to="/map">
                Map
              </NavLink>
              <NavLink className="shell-menu__link" to="/groups">
                Groups
              </NavLink>
              {viewer ? (
                <NavLink className="shell-menu__link" to={`/profile/${viewer.id}`}>
                  Profile
                </NavLink>
              ) : (
                <NavLink className="shell-menu__link" to="/auth">
                  Access
                </NavLink>
              )}
            </nav>

            {viewer ? (
              <button
                className="button-ghost shell-menu__signout"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                type="button"
              >
                {logoutMutation.isPending ? "Signing out" : "Sign out"}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/map" element={<HomePage viewer={viewer} />} />
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
