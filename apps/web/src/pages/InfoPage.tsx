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
          "Information pursuant to Section 5 DDG.",
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
          "Email: hello@melonmeet.com",
        ],
        title: "Contact",
      },
      {
        body: [
          "Represented by: Jacob Otto",
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
      "How Melon Meet processes personal data for accounts, profiles, groups, sessions, moderation, and platform security.",
    eyebrow: "Privacy",
    sections: [
      {
        body: [
          "Last updated: May 11, 2026.",
          "This Privacy Policy explains how Melon Meet processes personal data when you browse the website, create an account, use community features, contact us, or interact with security and moderation features.",
        ],
        title: "Overview",
      },
      {
        body: [
          "Controller: Melon Meet, Jacob Otto, Halskestr. 6, 12167 Berlin, Germany.",
          "Contact: hello@melonmeet.com.",
        ],
        title: "Data Controller",
      },
      {
        body: [
          "Account data: email address, password hash, email verification status, and account status.",
          "Profile data: display name, avatar URL, bio, home area, playing level, and profile visibility settings that you choose to add or change.",
          "Community data: groups, memberships, membership requests, sessions, session series, invite links, spot claims, posts, friend connections, and organiser responsibilities needed to run the service.",
          "Security and moderation data: authentication sessions, verification and reset tokens, request metadata, IP address, rate-limit records, moderation reports, moderation notes, audit log entries, and operational error records.",
          "Communication data: recipient address and message content required to send account-related emails such as verification, password reset, and email-change emails.",
          "Device preference data: theme and language preferences stored locally in your browser.",
        ],
        title: "Data We Process",
      },
      {
        body: [
          "We process account, profile, group, session, and participation data to provide the Melon Meet service you request, including account access, profile management, group coordination, session discovery, attendance flows, and user-generated content.",
          "We process security, moderation, and abuse-prevention data to protect the platform, enforce platform rules, investigate reports, prevent misuse, and maintain service integrity.",
          "We also process data where necessary to respond to support requests and comply with legal obligations.",
        ],
        title: "Purposes of Processing",
      },
      {
        body: [
          "Art. 6(1)(b) GDPR: we process core account and community data where this is necessary to provide the service you request.",
          "Art. 6(1)(f) GDPR: we process security, anti-abuse, moderation, and audit data based on our legitimate interests in protecting the service, our users, and our systems.",
          "Art. 6(1)(c) GDPR: we may process data where necessary to comply with legal obligations.",
        ],
        title: "Legal Basis",
      },
      {
        body: [
          "Infrastructure and processors: Melon Meet uses Cloudflare for hosting, delivery, database infrastructure, and signup bot protection, and Resend for transactional email delivery.",
          "Other users may see profile, group, session, and post data to the extent that your settings and the product design make that content visible to them.",
          "Some processors may handle personal data outside the EU or EEA, including in the United States. Where this happens, we rely on the provider's contractual safeguards and applicable transfer mechanisms.",
        ],
        title: "Recipients and Transfers",
      },
      {
        body: [
          "Account and community data is retained while your account is active and as long as needed to operate the service.",
          "Verification, reset, and email-change tokens are short-lived and are deleted or invalidated after use or expiry.",
          "Session records are retained while they remain active or until they are revoked or expire.",
          "Moderation, audit, and security records are retained for as long as reasonably needed to investigate abuse, enforce platform rules, secure the service, and meet legal obligations.",
          "If you delete your account, access is removed immediately and your account enters a deletion-pending state. Personal data is then deleted or anonymised within 30 days under the current account lifecycle model unless longer retention is legally required.",
        ],
        title: "Retention",
      },
      {
        body: [
          "You have the right to request access, rectification, erasure, restriction of processing, objection, and data portability where applicable.",
          "To exercise these rights, contact hello@melonmeet.com.",
          "You also have the right to lodge a complaint with the Berliner Beauftragte fuer Datenschutz und Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin, Germany, mailbox@datenschutz-berlin.de.",
        ],
        title: "Your Rights",
      },
      {
        body: [
          "Melon Meet uses a strictly necessary authentication cookie for signed-in sessions.",
          "The frontend also stores theme and language preferences in local browser storage.",
          "Melon Meet does not currently use a separate analytics or advertising stack.",
          "Melon Meet does not use solely automated decision-making with legal or similarly significant effects within the meaning of Art. 22 GDPR. The service does use technical anti-bot and security measures such as Turnstile and rate limiting.",
        ],
        title: "Cookies, Local Storage, and Automated Checks",
      },
    ],
    title: "Privacy Policy",
  },
  terms: {
    description:
      "Rules for using Melon Meet accounts, profiles, groups, sessions, user-generated content, and moderation features.",
    eyebrow: "Terms",
    sections: [
      {
        body: [
          "Last updated: May 11, 2026.",
          "These Terms govern your use of Melon Meet. By creating an account or using signed-in features, you agree to them.",
        ],
        title: "Scope",
      },
      {
        body: [
          "You must provide accurate account information and keep it up to date.",
          "You are responsible for maintaining the confidentiality of your password and for activity that happens through your account.",
          "You must be at least 16 years old to create an account.",
          "We may require email verification before full participation features are available.",
        ],
        title: "User Accounts",
      },
      {
        body: [
          "You must not post illegal, defamatory, harmful, threatening, harassing, privacy-invasive, deceptive, or spam content.",
          "You must not misuse invite flows, impersonate others, scrape protected areas, bypass security measures, interfere with the service, or access data you are not authorised to access.",
          "You must not use Melon Meet to organise or promote unlawful activity.",
        ],
        title: "Acceptable Use",
      },
      {
        body: [
          "You retain responsibility for the content you publish, including profile text, profile images, group details, session details, and posts.",
          "Depending on your settings and the feature involved, some content may be visible publicly, to group members, or to other signed-in users.",
          "You grant Melon Meet a non-exclusive right to host, display, and process your content as needed to operate and secure the service.",
        ],
        title: "User Content",
      },
      {
        body: [
          "Melon Meet helps people coordinate around venues, groups, and sessions, but Melon Meet is not the operator of the underlying sports venues and is not a party to arrangements between participants.",
          "Group owners and session organisers are responsible for the accuracy of the details they publish, including time, location, capacity, access conditions, and updates.",
          "Melon Meet does not guarantee that a listed venue, session, group, or claimed spot will remain available, accurate, safe, or suitable for you.",
        ],
        title: "Groups, Sessions, and Organiser Responsibility",
      },
      {
        body: [
          "Users can report profiles, groups, sessions, posts, and invite misuse. Melon Meet may review reported content and take action where needed.",
          "Moderation action can include review, internal notes, content removal, invite-link revocation, session cancellation or archival, group archival, and account suspension.",
          "We may suspend or restrict accounts and content that violate these Terms, create risk for the community, or interfere with the safe operation of the service.",
        ],
        title: "Moderation and Enforcement",
      },
      {
        body: [
          "You can delete your account through the product settings. Deletion removes access immediately and is completed under the account lifecycle described in the Privacy Policy.",
          "We may suspend or terminate access where required for legal, security, moderation, or operational reasons.",
        ],
        title: "Suspension, Deletion, and Termination",
      },
      {
        body: [
          "Melon Meet is provided as a coordination platform. We do not guarantee uninterrupted availability, complete accuracy of all user-supplied content, or the conduct of other users.",
          "Beach volleyball and other sports activities involve inherent risks. You are responsible for your own participation decisions, travel, insurance, equipment, and physical safety.",
          "Nothing in these Terms excludes liability where exclusion is not permitted by applicable law.",
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
  const content = page === "info" ? pages[page] ?? PAGE_CONTENT[page] : PAGE_CONTENT[page];
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
