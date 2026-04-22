import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { getMe, logOut } from "./lib/api";
import { usePrelineAutoInit } from "./hooks/use-preline-auto-init";
import { queryClient } from "./lib/query-client";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { InfoPage } from "./pages/InfoPage";
import { LandingPage } from "./pages/LandingPage";

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
      await queryClient.cancelQueries();
      queryClient.setQueryData(["me"], {
        friends: [],
        groups: [],
        viewer: null,
      });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    },
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("melon-theme", theme);
  }, [theme]);

  const viewer = meQuery.data?.viewer ?? null;
  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));
  const infoPageProps = {
    theme,
    toggleTheme,
    viewer,
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage viewer={viewer} />} />
      <Route path="/auth" element={<Navigate replace to="/" />} />
      <Route path="/info" element={<Navigate replace to="/about" />} />
      <Route path="/about" element={<InfoPage activePage={null} page="info" {...infoPageProps} />} />
      <Route path="/about/details" element={<InfoPage page="info" {...infoPageProps} />} />
      <Route path="/privacy" element={<InfoPage page="privacy" {...infoPageProps} />} />
      <Route path="/terms" element={<InfoPage page="terms" {...infoPageProps} />} />
      <Route path="/impressum" element={<InfoPage page="impressum" {...infoPageProps} />} />
      <Route
        path="/map"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="sessions"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
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
            toggleTheme={toggleTheme}
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
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/venues"
        element={
          <DiscoveryPage
            initialDisplayMode="list"
            initialItemMode="venues"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/discover"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="sessions"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
      <Route path="/meetings/:meetingId" element={<MeetingRedirect />} />
      <Route
        path="/groups/:groupId"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="groups"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/sessions/:meetingId"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="sessions"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/profile/:profileId"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="sessions"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
      <Route
        path="/venues/:venueId"
        element={
          <DiscoveryPage
            initialDisplayMode="map"
            initialItemMode="venues"
            onLogOut={() => logoutMutation.mutate()}
            theme={theme}
            toggleTheme={toggleTheme}
            viewer={viewer}
          />
        }
      />
    </Routes>
  );
}

function MeetingRedirect() {
  const { meetingId } = useParams();
  return <Navigate replace to={meetingId ? `/sessions/${meetingId}` : "/sessions"} />;
}

export default function App() {
  usePrelineAutoInit();
  return <AppShell />;
}
