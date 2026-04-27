import { useEffect, useRef, useState } from "react";
import { ArrowUp, Moon, Sun, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import landingHeroMelonDark from "../assets/landing-hero-melon-dark.png";
import landingHeroMelon from "../assets/landing-hero-melon.png";
import watermelonMark from "../assets/watermelon-mark.svg";
import { useI18n, useTranslationValue } from "../lib/i18n";

export const APP_DESCRIPTION = {
  body: [
    "Melon Meet is a Berlin-first community tool for discovering beach volleyball venues, public sessions, and small playing groups.",
    "The product keeps public discovery open while giving signed-in users tools to claim spots, manage groups, and organise sessions.",
  ],
  title: "About Melon Meet",
};

export const PAGE_CONTENT = {
  impressum: {
    description: "Public company/contact disclosure for Melon Meet.",
    eyebrow: "Company",
    sections: [
      {
        body: [
          "Angaben gemaess Section 5 DDG / formerly Section 5 TMG.",
          "Melon Meet",
          "Jacob Otto",
          "Halskestr. 6",
          "12167 Berlin",
          "Germany",
        ],
        title: "Provider Identification",
      },
      {
        body: [
          "Email: hello@melonmeet.example",
          "Telephone: Not provided.",
        ],
        title: "Contact",
      },
      {
        body: [
          "Represented by: Jacob Otto",
          "VAT ID: Not provided.",
        ],
        title: "Represented By and VAT",
      },
      {
        body: [
          "Responsible for content according to Section 18 Abs. 2 MStV: Jacob Otto, Halskestr. 6, 12167 Berlin, Germany.",
        ],
        title: "Responsible for Content",
      },
    ],
    title: "Impressum",
  },
  info: {
    description: "What Melon Meet is for, who it helps, and how public discovery and lightweight coordination fit together inside the app.",
    eyebrow: "About",
    sections: [
      {
        body: [
          ...APP_DESCRIPTION.body,
          "Melon Meet started as a way to make Berlin beach volleyball easier to navigate without forcing every useful place into the same giant chat thread.",
          "The app brings venues, groups, and sessions into one map-first board so people can move from discovering a court to understanding who plays there and when.",
          "Public browsing stays lightweight on purpose. You should be able to open the app, scan the city, and get oriented before deciding whether you want an account.",
        ],
        title: "What It Is",
      },
      {
        body: [
          "Venues are the stable places: courts, clubs, and spots worth knowing. Sessions are the time-based layer on top, so a place can feel alive instead of static.",
          "Groups help recurring crews organise themselves without losing the public discovery flow. Some can stay open and visible, others can remain private for smaller circles.",
          "The map is meant to be the orienting surface: browse first, open details when something looks promising, and move between location, group, and session context without losing your sense of place.",
          "Legal and company pages stay inside the same shell so the app still feels coherent when you step out of the map and into the informational side.",
        ],
        title: "How It Works",
      },
    ],
    title: "About",
  },
  privacy: {
    description:
      "How Melon Meet collects and uses account, profile, group, and session data.",
    eyebrow: "Privacy",
    sections: [
      {
        body: [
          "Last updated: April 25, 2026.",
          "This Privacy Policy describes how Melon Meet collects, uses, and discloses your personal information when you visit the Melon Meet website and create a user account.",
        ],
        title: "Overview",
      },
      {
        body: [
          "Controller: Melon Meet, Jacob Otto, Halskestr. 6, 12167 Berlin, Germany.",
          "Contact: hello@melonmeet.example.",
        ],
        title: "Data Controller",
      },
      {
        body: [
          "Account information: When you register, we collect your email address and password. Passwords are hashed and are not stored in plain text.",
          "Profile data: Information you voluntarily add to your profile, such as display name, profile picture, bio, home area, playing level, and profile visibility settings.",
          "Community data: Group memberships, membership requests, sessions, session claims, posts, and organiser responsibilities needed to operate the service.",
          "Usage and security data: Authentication sessions, login-related timestamps, IP address, browser type, and rate-limit information may be processed for security purposes.",
        ],
        title: "Data We Collect",
      },
      {
        body: [
          "We process this data to provide and manage your user account, allow you to interact with the website, show public and private community content, let organisers manage groups and sessions, and secure the site against unauthorised access.",
        ],
        title: "Purpose of Processing",
      },
      {
        body: [
          "Processing is based on your consent under Art. 6(1)(a) GDPR when you create an account and on the performance of a contract under Art. 6(1)(b) GDPR to provide the service.",
          "Security-related processing may also be based on our legitimate interest under Art. 6(1)(f) GDPR in protecting the service and its users.",
        ],
        title: "Legal Basis",
      },
      {
        body: [
          "We retain your personal data only as long as necessary to provide the service and meet legal obligations.",
          "If you delete your account, your data will be deleted or anonymised within 30 days unless longer retention is legally required.",
        ],
        title: "Data Retention",
      },
      {
        body: [
          "You have the right to access, rectify, erase, or restrict processing of your data, and to object to processing where applicable.",
          "Contact hello@melonmeet.example to exercise these rights.",
        ],
        title: "User Rights",
      },
    ],
    title: "Privacy Policy",
  },
  terms: {
    description:
      "Rules for using Melon Meet accounts, profiles, groups, sessions, and user-generated content.",
    eyebrow: "Terms",
    sections: [
      {
        body: [
          "Last updated: April 25, 2026.",
          "By creating an account on Melon Meet, you agree to these Terms of Service.",
        ],
        title: "Acceptance of Terms",
      },
      {
        body: [
          "You must provide accurate information.",
          "You are responsible for keeping your password confidential.",
          "You must be at least 16 years old to create an account.",
        ],
        title: "User Accounts",
      },
      {
        body: [
          "You agree not to post illegal, defamatory, harmful, harassing, spam, fraudulent, or privacy-invasive content.",
          "You agree not to attempt to bypass security measures or access data you are not authorised to access.",
        ],
        title: "Acceptable Use",
      },
      {
        body: [
          "You retain ownership of content you post, including profile pictures, profile text, group posts, and session details.",
          "You grant Melon Meet a non-exclusive licence to display this content on the website as needed to operate the service.",
        ],
        title: "User Content",
      },
      {
        body: [
          "We reserve the right to suspend or terminate accounts that violate these terms or create risk for the community or service.",
        ],
        title: "Termination",
      },
      {
        body: [
          "Melon Meet is provided \"as is\". We are not liable for damages arising from your use of the site to the extent permitted by law.",
          "Outdoor sports carry inherent risk. Participants are responsible for their own safety, insurance, travel, and participation decisions.",
        ],
        title: "Limitation of Liability",
      },
    ],
    title: "Terms of Service",
  },
} as const;

export type InfoPageKey = keyof typeof PAGE_CONTENT;

export const INFO_LINKS: Array<{ key: InfoPageKey; label: string; to: string }> = [
  { key: "info", label: "About", to: "/about" },
  { key: "privacy", label: "Privacy", to: "/privacy" },
  { key: "terms", label: "Terms", to: "/terms" },
  { key: "impressum", label: "Impressum", to: "/impressum" },
];

export function InfoPage({
  activePage,
  page,
  theme,
  toggleTheme,
  viewer,
}: {
  activePage?: InfoPageKey | null;
  page: InfoPageKey;
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const { t } = useI18n();
  const pages = useTranslationValue("info.pages") as Record<string, { description: string; sections: Array<{ body: string[]; title: string }>; title: string }>;
  const appDescription = useTranslationValue("info.appDescription") as { body: string[]; title: string };
  const infoLinks = [
    { key: "info", label: t("info.links.info"), to: "/about" },
    { key: "privacy", label: t("info.links.privacy"), to: "/privacy" },
    { key: "terms", label: t("info.links.terms"), to: "/terms" },
    { key: "impressum", label: t("info.links.impressum"), to: "/impressum" },
  ] as const;
  const location = useLocation();
  const content = pages[page] ?? PAGE_CONTENT[page];
  const locationState =
    location.state && typeof location.state === "object"
      ? (location.state as { infoReturnTo?: string })
      : {};
  const closeTo = locationState.infoReturnTo ?? "/map";
  const landingBackgroundImage = theme === "dark" ? landingHeroMelonDark : landingHeroMelon;
  const [isDesktopInfoLayout, setIsDesktopInfoLayout] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 901px)").matches,
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const infoShellRef = useRef<HTMLDivElement | null>(null);
  const infoContentRef = useRef<HTMLElement | null>(null);
  const infoLinkState = { infoReturnTo: closeTo };
  const renderHeaderControls = () => (
    <div className="landing-shell__right-header">
      <div className="landing-shell__right-header-left">
        <LanguageSwitcher compact />
        <button
          aria-label={t("workspace.toggleTheme")}
          className="landing-theme-toggle"
          onClick={toggleTheme}
          type="button"
        >
          {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>
      </div>
      <Link className="landing-header-button landing-header-button--label" to={closeTo}>
        <X size={16} strokeWidth={2} />
        <span>{t("common.close")}</span>
      </Link>
    </div>
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 901px)");
    const updateLayout = () => setIsDesktopInfoLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (activePage !== undefined) {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 1120px)");
    let scrollElement: HTMLElement | null = null;

    const updateScrollElement = () => {
      scrollElement?.removeEventListener("scroll", updateScrollState);
      scrollElement = mobileQuery.matches ? infoShellRef.current : infoContentRef.current;
      scrollElement?.addEventListener("scroll", updateScrollState, { passive: true });
      updateScrollState();
    };

    const updateScrollState = () => {
      setShowScrollTop((scrollElement?.scrollTop ?? 0) > 12);
    };

    updateScrollElement();
    mobileQuery.addEventListener("change", updateScrollElement);

    return () => {
      scrollElement?.removeEventListener("scroll", updateScrollState);
      mobileQuery.removeEventListener("change", updateScrollElement);
    };
  }, [activePage]);

  function scrollInfoPageToTop() {
    const scrollElement = window.matchMedia("(max-width: 1120px)").matches ? infoShellRef.current : infoContentRef.current;
    scrollElement?.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (activePage === undefined) {
    return (
      <div className="workspace-page landing-workspace-page info-landing-page">
        <div className="workspace-frame landing-shell-frame info-landing-frame">
          <div className="landing-scene" aria-hidden="true">
            <img alt="" className="landing-scene__image" src={landingBackgroundImage} />
          </div>
          <div className="landing-shell landing-shell--info-page" ref={infoShellRef}>
            <section className="landing-shell__center landing-shell__center--welcome" ref={infoContentRef}>
              <div className="landing-mobile-header">
                <div className="landing-brand-lockup landing-brand-lockup--stacked">
                  <img alt="Melon Meet" className="landing-shell__logo" src={watermelonMark} />
                  <div className="landing-brand-lockup__copy">
                    <h1 className="landing-brand-lockup__title">Melon Meet</h1>
                    <p className="landing-brand-lockup__meta">{t("workspace.berlinBeachVolleyball")}</p>
                  </div>
                </div>
                <div className="landing-mobile-actions">{renderHeaderControls()}</div>
              </div>

              <div className="landing-info-content landing-info-content--page">
                <div className="stack-sm">
                  <h2 className="landing-info-content__title">{content.title}</h2>
                  <p className="landing-hero__text">{content.description}</p>
                </div>
                {content.sections.map((section) => (
                  <section className="stack-sm" key={section.title}>
                    <h3 className="column-title">{section.title}</h3>
                    {section.body.map((paragraph) => (
                      <p className="muted-copy" key={paragraph}>
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            </section>

            <section className="landing-shell__right">
              {renderHeaderControls()}
            </section>
          </div>
          <div className="landing-legal-links landing-legal-links--floating" aria-label={t("workspace.infoAndLegalPages")}>
            {infoLinks.map((link) => (
              <Link
                className={page === link.key ? "is-active" : undefined}
                key={link.key}
                state={infoLinkState}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <button
            aria-label={t("discovery.scrollToTop")}
            className={`info-scroll-top ${showScrollTop ? "is-visible" : ""}`}
            onClick={scrollInfoPageToTop}
            type="button"
          >
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  const selectedPage = activePage === undefined ? page : activePage === null && isDesktopInfoLayout ? page : activePage;
  const isDetailPage = selectedPage !== null;

  const infoNavigation = (
    <div className="stack-md info-nav">
      <div className="info-rail-header">
        <Link aria-label={t("workspace.backToMap")} className="button-secondary info-rail-close" to="/map">
          <X size={18} strokeWidth={2} />
        </Link>
      </div>

      <div className="stack-sm">
        <p className="eyebrow">Melon Meet</p>
        <h2 className="column-title">{appDescription.title}</h2>
        {appDescription.body.map((paragraph) => (
          <p className="muted-copy" key={paragraph}>
            {paragraph}
          </p>
        ))}
      </div>

      <nav aria-label={t("workspace.infoAndLegalPages")} className="info-nav__links">
        {infoLinks.map((link) => (
          <Link className={`info-nav__link ${selectedPage === link.key ? "is-active" : ""}`} key={link.key} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );

  const center = (
    <div className="workspace-detail-scroll info-shell-main">
      <div className="stack-md info-page__content">
        {isDetailPage ? (
          <div className="info-page__mobile-close">
            <Link className="button-secondary button-inline" to="/about">
              <X size={14} strokeWidth={2} />
              <span>{t("common.close")}</span>
            </Link>
          </div>
        ) : null}
        {page !== "info" ? (
          <div className="stack-sm">
            <h1 className="section-title">{content.title}</h1>
            <p className="muted-copy">{content.description}</p>
          </div>
        ) : null}

        {content.sections.map((section) => (
          <section className="stack-sm" key={section.title}>
            <h2 className="column-title">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p className="muted-copy" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );

  return (
    <WorkspaceShell
      centerHeader={<div aria-hidden="true" />}
      center={center}
      layoutVariant={isDetailPage ? "info-detail" : "info-index"}
      left={null}
      leftHeader={null}
      profileLinkState={{ from: "Info" }}
      right={infoNavigation}
      rightHeader={undefined}
      theme={theme}
      toggleTheme={toggleTheme}
      utilityNavigation="map"
      viewer={viewer}
    />
  );
}
