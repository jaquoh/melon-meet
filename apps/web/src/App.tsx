import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getMe, logOut } from "./lib/api";
import { usePrelineAutoInit } from "./hooks/use-preline-auto-init";
import { queryClient } from "./lib/query-client";
import { AuthPage } from "./pages/AuthPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { GroupPage } from "./pages/GroupPage";
import { LandingPage } from "./pages/LandingPage";
import { MeetingPage } from "./pages/MeetingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { VenuePage } from "./pages/VenuePage";

export type ThemeMode = "light" | "dark";

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
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage viewer={viewer} />} />
      <Route
        path="/map"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="sessions"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/groups"
        element={
          <DiscoveryPage
            initialDisplayMode="list"
            initialItemMode="groups"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/sessions"
        element={
          <DiscoveryPage
            initialDisplayMode="list"
            initialItemMode="sessions"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
      <Route path="/meetings/:meetingId" element={<Navigate replace to="/sessions/:meetingId" />} />
      <Route
        path="/groups/:groupId"
        element={
          <GroupPage
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/sessions/:meetingId"
        element={
          <MeetingPage
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/profile/:profileId"
        element={
          <ProfilePage
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/venues/:venueId"
        element={
          <VenuePage
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            viewer={viewer}
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  usePrelineAutoInit();
  return <AppShell />;
}
