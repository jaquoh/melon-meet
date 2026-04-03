import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { getMe } from "./lib/api";
import { usePrelineAutoInit } from "./hooks/use-preline-auto-init";
import { AuthPage } from "./pages/AuthPage";
import { GroupPage } from "./pages/GroupPage";
import { GroupsPage } from "./pages/GroupsPage";
import { HomePage } from "./pages/HomePage";
import { MeetingPage } from "./pages/MeetingPage";
import { ProfilePage } from "./pages/ProfilePage";

function AppShell() {
  const meQuery = useQuery({
    queryFn: getMe,
    queryKey: ["me"],
  });

  const viewer = meQuery.data?.viewer ?? null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(253,186,116,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.16),_transparent_28%),linear-gradient(180deg,_#fff8ef_0%,_#fffaf5_100%)] text-stone-800">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-teal-400 text-lg font-semibold text-white shadow-lg shadow-orange-200/80">
              M
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                Melon Meet
              </p>
              <p className="text-sm text-stone-500">
                Outdoor groups, pick-up games, Berlin courts
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/70 p-1 text-sm shadow-sm">
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
                Sign in
              </NavLink>
            )}
          </nav>
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
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  usePrelineAutoInit();
  return <AppShell />;
}
