import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const SUPPORTED_LOCALES = [
  { code: "de-DE", flag: "🇩🇪", label: "German" },
  { code: "en-US", flag: "🇺🇸", label: "English" },
  { code: "es-ES", flag: "🇪🇸", label: "Spanish" },
  { code: "fr-FR", flag: "🇫🇷", label: "French" },
  { code: "ru-RU", flag: "🇷🇺", label: "Russian" },
  { code: "uk-UA", flag: "🇺🇦", label: "Ukrainian" },
  { code: "tr-TR", flag: "🇹🇷", label: "Turkish" },
  { code: "vi-VN", flag: "🇻🇳", label: "Vietnamese" },
  { code: "hi-IN", flag: "🇮🇳", label: "Hindi" },
  { code: "zh-CN", flag: "🇨🇳", label: "Chinese" },
  { code: "ja-JP", flag: "🇯🇵", label: "Japanese" },
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

type TranslationValue = string | TranslationDictionary | TranslationValue[];
type TranslationDictionary = { [key: string]: TranslationValue };

const DEFAULT_LOCALE: AppLocale = "en-US";
const LOCALE_STORAGE_KEY = "melon-locale";

function buildInfoContent(localeLabel: string): TranslationDictionary {
  if (localeLabel === "DE") {
    return {
      info: {
        appDescription: {
          title: "Ueber Melon Meet",
          body: [
            "Melon Meet ist ein Community-Tool mit Fokus auf Berlin, um Beachvolleyball-Venues, oeffentliche Sessions und kleine Spielgruppen zu entdecken.",
            "Das Produkt haelt die oeffentliche Entdeckung offen und gibt eingeloggten Nutzerinnen und Nutzern Werkzeuge an die Hand, um Plaetze zu claimen, Gruppen zu verwalten und Sessions zu organisieren.",
          ],
        },
        links: {
          info: "About",
          privacy: "Privacy",
          terms: "Terms",
          impressum: "Impressum",
        },
        pages: {
          info: {
            title: "About",
            eyebrow: "About",
            description:
              "Wofuer Melon Meet da ist, wem es hilft und wie oeffentliche Entdeckung und leichte Koordination in der App zusammenspielen.",
            sections: [
              {
                title: "Was es ist",
                body: [
                  "Melon Meet ist ein Community-Tool mit Fokus auf Berlin, um Beachvolleyball-Venues, oeffentliche Sessions und kleine Spielgruppen zu entdecken.",
                  "Das Produkt haelt die oeffentliche Entdeckung offen und gibt eingeloggten Nutzerinnen und Nutzern Werkzeuge an die Hand, um Plaetze zu claimen, Gruppen zu verwalten und Sessions zu organisieren.",
                  "Melon Meet begann als Weg, Beachvolleyball in Berlin leichter navigierbar zu machen, ohne jeden hilfreichen Ort in denselben grossen Chat-Thread zu zwingen.",
                  "Die App bringt Venues, Gruppen und Sessions in ein gemeinsames, map-first Board, damit Menschen vom Entdecken eines Courts direkt verstehen koennen, wer dort spielt und wann.",
                  "Das oeffentliche Browsen bleibt bewusst leichtgewichtig. Du solltest die App oeffnen, die Stadt scannen und dich orientieren koennen, bevor du entscheidest, ob du einen Account willst.",
                ],
              },
              {
                title: "Wie es funktioniert",
                body: [
                  "Venues sind die stabilen Orte: Courts, Clubs und Spots, die man kennen sollte. Sessions bilden die zeitbezogene Ebene darueber, damit ein Ort lebendig statt statisch wirkt.",
                  "Gruppen helfen wiederkehrenden Crews, sich zu organisieren, ohne den oeffentlichen Discovery-Flow zu verlieren. Manche koennen offen und sichtbar bleiben, andere privat fuer kleinere Kreise.",
                  "Die Karte ist die orientierende Oberflaeche: erst browsen, dann Details oeffnen, wenn etwas vielversprechend wirkt, und zwischen Ort, Gruppe und Session wechseln, ohne das Gefuehl fuer den Kontext zu verlieren.",
                  "Rechts- und Unternehmensseiten bleiben in derselben Shell, damit die App auch dann stimmig bleibt, wenn du die Karte verlaesst und in den informativen Bereich wechselst.",
                ],
              },
            ],
          },
          privacy: {
            title: "Privacy Policy",
            eyebrow: "Privacy",
            description: "Wie Melon Meet Account-, Profil-, Gruppen- und Session-Daten erhebt und verwendet.",
            sections: [
              {
                title: "Ueberblick",
                body: [
                  "Zuletzt aktualisiert: 25. April 2026.",
                  "Diese Datenschutzerklaerung beschreibt, wie Melon Meet deine personenbezogenen Daten erhebt, verwendet und offenlegt, wenn du die Melon-Meet-Website besuchst und ein Nutzerkonto erstellst.",
                ],
              },
              {
                title: "Verantwortliche Stelle",
                body: [
                  "Verantwortlicher: Melon Meet, Jacob Otto, Halskestr. 6, 12167 Berlin, Deutschland.",
                  "Kontakt: hello@melonmeet.example.",
                ],
              },
              {
                title: "Welche Daten wir erheben",
                body: [
                  "Kontoinformationen: Bei der Registrierung erheben wir deine E-Mail-Adresse und dein Passwort. Passwoerter werden gehasht und nicht im Klartext gespeichert.",
                  "Profildaten: Informationen, die du freiwillig in dein Profil eintraegst, z. B. Anzeigename, Profilbild, Bio, Heimgebiet, Spielniveau und Sichtbarkeitseinstellungen.",
                  "Community-Daten: Gruppenmitgliedschaften, Mitgliedschaftsanfragen, Sessions, Session-Claims, Posts und organisatorische Verantwortlichkeiten, die fuer den Betrieb des Dienstes notwendig sind.",
                  "Nutzungs- und Sicherheitsdaten: Authentifizierungs-Sessions, loginbezogene Zeitstempel, IP-Adresse, Browsertyp und Rate-Limit-Informationen koennen zu Sicherheitszwecken verarbeitet werden.",
                ],
              },
              {
                title: "Zweck der Verarbeitung",
                body: [
                  "Wir verarbeiten diese Daten, um dein Nutzerkonto bereitzustellen und zu verwalten, dir die Interaktion mit der Website zu ermoeglichen, oeffentliche und private Community-Inhalte anzuzeigen, Organisatorinnen und Organisatoren beim Verwalten von Gruppen und Sessions zu unterstuetzen und den Dienst gegen unbefugten Zugriff zu schuetzen.",
                ],
              },
              {
                title: "Rechtsgrundlage",
                body: [
                  "Die Verarbeitung basiert auf deiner Einwilligung gemaess Art. 6 Abs. 1 lit. a DSGVO, wenn du ein Konto erstellst, sowie auf der Vertragserfuellung gemaess Art. 6 Abs. 1 lit. b DSGVO zur Bereitstellung des Dienstes.",
                  "Sicherheitsbezogene Verarbeitung kann ausserdem auf unserem berechtigten Interesse gemaess Art. 6 Abs. 1 lit. f DSGVO beruhen, den Dienst und seine Nutzerinnen und Nutzer zu schuetzen.",
                ],
              },
              {
                title: "Speicherdauer",
                body: [
                  "Wir speichern deine personenbezogenen Daten nur so lange, wie es fuer die Bereitstellung des Dienstes und zur Erfuellung gesetzlicher Pflichten erforderlich ist.",
                  "Wenn du dein Konto loeschst, werden deine Daten innerhalb von 30 Tagen geloescht oder anonymisiert, sofern keine laengere gesetzliche Aufbewahrungspflicht besteht.",
                ],
              },
              {
                title: "Deine Rechte",
                body: [
                  "Du hast das Recht auf Auskunft, Berichtigung, Loeschung oder Einschraenkung der Verarbeitung deiner Daten sowie - soweit anwendbar - ein Widerspruchsrecht.",
                  "Kontaktiere hello@melonmeet.example, um diese Rechte auszuueben.",
                ],
              },
            ],
          },
          terms: {
            title: "Terms of Service",
            eyebrow: "Terms",
            description: "Regeln fuer die Nutzung von Melon-Meet-Accounts, Profilen, Gruppen, Sessions und nutzergenerierten Inhalten.",
            sections: [
              {
                title: "Annahme der Bedingungen",
                body: [
                  "Zuletzt aktualisiert: 25. April 2026.",
                  "Mit der Erstellung eines Kontos bei Melon Meet stimmst du diesen Nutzungsbedingungen zu.",
                ],
              },
              {
                title: "Nutzerkonten",
                body: [
                  "Du musst korrekte Informationen angeben.",
                  "Du bist dafuer verantwortlich, dein Passwort vertraulich zu behandeln.",
                  "Du musst mindestens 16 Jahre alt sein, um ein Konto zu erstellen.",
                ],
              },
              {
                title: "Zulaessige Nutzung",
                body: [
                  "Du verpflichtest dich, keine illegalen, verleumderischen, schaedlichen, belaestigenden, spamartigen, betruegerischen oder die Privatsphaere verletzenden Inhalte zu posten.",
                  "Du verpflichtest dich, keine Sicherheitsmassnahmen zu umgehen oder auf Daten zuzugreifen, fuer die du keine Berechtigung hast.",
                ],
              },
              {
                title: "Nutzerinhalte",
                body: [
                  "Du behaeltst das Eigentum an den Inhalten, die du postest, einschliesslich Profilbildern, Profiltexten, Gruppenbeitraegen und Session-Details.",
                  "Du raeumst Melon Meet eine nicht exklusive Lizenz ein, diese Inhalte auf der Website anzuzeigen, soweit dies fuer den Betrieb des Dienstes erforderlich ist.",
                ],
              },
              {
                title: "Beendigung",
                body: [
                  "Wir behalten uns das Recht vor, Konten zu sperren oder zu beenden, die gegen diese Bedingungen verstossen oder ein Risiko fuer die Community oder den Dienst darstellen.",
                ],
              },
              {
                title: "Haftungsbeschraenkung",
                body: [
                  'Melon Meet wird "wie gesehen" bereitgestellt. Soweit gesetzlich zulaessig, haften wir nicht fuer Schaeden, die aus deiner Nutzung der Website entstehen.',
                  "Outdoor-Sportarten bringen ein eigenes Risiko mit sich. Teilnehmende sind fuer ihre eigene Sicherheit, Versicherung, Anreise und Teilnahmeentscheidungen selbst verantwortlich.",
                ],
              },
            ],
          },
          impressum: {
            title: "Impressum",
            eyebrow: "Company",
            description: "Oeffentliche Anbieter- und Kontaktdaten fuer Melon Meet.",
            sections: [
              {
                title: "Anbieterkennzeichnung",
                body: ["Angaben gemaess Section 5 DDG / formerly Section 5 TMG.", "Melon Meet", "Jacob Otto", "Halskestr. 6", "12167 Berlin", "Germany"],
              },
              {
                title: "Kontakt",
                body: ["Email: hello@melonmeet.example", "Telephone: Not provided."],
              },
              {
                title: "Vertretung und USt",
                body: ["Represented by: Jacob Otto", "VAT ID: Not provided."],
              },
              {
                title: "Inhaltlich verantwortlich",
                body: ["Responsible for content according to Section 18 Abs. 2 MStV: Jacob Otto, Halskestr. 6, 12167 Berlin, Germany."],
              },
            ],
          },
        },
      },
    };
  }

  if (localeLabel === "ES") {
    return {
      info: {
        appDescription: {
          title: "Acerca de Melon Meet",
          body: [
            "Melon Meet es una herramienta comunitaria centrada en Berlin para descubrir venues de voley playa, sesiones publicas y pequenos grupos de juego.",
            "El producto mantiene abierta la exploracion publica mientras ofrece a las personas registradas herramientas para reservar plazas, gestionar grupos y organizar sesiones.",
          ],
        },
        links: {
          info: "About",
          privacy: "Privacy",
          terms: "Terms",
          impressum: "Impressum",
        },
        pages: {
          info: {
            title: "About",
            eyebrow: "About",
            description:
              "Para que sirve Melon Meet, a quien ayuda y como encajan dentro de la app el descubrimiento publico y la coordinacion ligera.",
            sections: [
              {
                title: "Que es",
                body: [
                  "Melon Meet es una herramienta comunitaria centrada en Berlin para descubrir venues de voley playa, sesiones publicas y pequenos grupos de juego.",
                  "El producto mantiene abierta la exploracion publica mientras ofrece a las personas registradas herramientas para reservar plazas, gestionar grupos y organizar sesiones.",
                  "Melon Meet nacio como una forma de hacer mas facil orientarse en el voley playa de Berlin sin obligar a meter cada lugar util en el mismo hilo gigante de chat.",
                  "La app reune venues, grupos y sesiones en un tablero centrado en el mapa para que la gente pueda pasar de descubrir una pista a entender quien juega alli y cuando.",
                  "La navegacion publica se mantiene ligera a proposito. Deberias poder abrir la app, recorrer la ciudad y orientarte antes de decidir si quieres una cuenta.",
                ],
              },
              {
                title: "Como funciona",
                body: [
                  "Los venues son los lugares estables: pistas, clubes y spots que merece la pena conocer. Las sesiones son la capa temporal encima, para que un lugar se sienta vivo y no estatico.",
                  "Los grupos ayudan a las crews recurrentes a organizarse sin perder el flujo de descubrimiento publico. Algunos pueden seguir abiertos y visibles; otros pueden mantenerse privados para circulos mas pequenos.",
                  "El mapa esta pensado como la superficie de orientacion: primero explora, luego abre detalles cuando algo parezca prometedor, y cambia entre contexto de ubicacion, grupo y sesion sin perder la nocion del lugar.",
                  "Las paginas legales y corporativas permanecen dentro de la misma shell para que la app siga sintiendose coherente incluso al salir del mapa y entrar en la parte informativa.",
                ],
              },
            ],
          },
          privacy: {
            title: "Privacy Policy",
            eyebrow: "Privacy",
            description: "Como recopila y utiliza Melon Meet los datos de cuenta, perfil, grupo y sesion.",
            sections: [
              {
                title: "Resumen",
                body: [
                  "Ultima actualizacion: 25 de abril de 2026.",
                  "Esta Politica de Privacidad describe como Melon Meet recopila, usa y divulga tu informacion personal cuando visitas el sitio web de Melon Meet y creas una cuenta de usuario.",
                ],
              },
              {
                title: "Responsable del tratamiento",
                body: [
                  "Responsable: Melon Meet, Jacob Otto, Halskestr. 6, 12167 Berlin, Alemania.",
                  "Contacto: hello@melonmeet.example.",
                ],
              },
              {
                title: "Datos que recopilamos",
                body: [
                  "Informacion de la cuenta: cuando te registras, recopilamos tu direccion de correo electronico y tu contrasena. Las contrasenas se almacenan con hash y no en texto plano.",
                  "Datos del perfil: informacion que anades voluntariamente a tu perfil, como nombre visible, foto, bio, zona habitual, nivel de juego y ajustes de visibilidad.",
                  "Datos de la comunidad: membresias en grupos, solicitudes de membresia, sesiones, reservas de plaza, publicaciones y responsabilidades de organizacion necesarias para operar el servicio.",
                  "Datos de uso y seguridad: pueden procesarse sesiones de autenticacion, marcas temporales relacionadas con el inicio de sesion, direccion IP, tipo de navegador e informacion de limites de uso con fines de seguridad.",
                ],
              },
              {
                title: "Finalidad del tratamiento",
                body: [
                  "Tratamos estos datos para proporcionar y gestionar tu cuenta, permitirte interactuar con el sitio web, mostrar contenido comunitario publico y privado, permitir a las personas organizadoras gestionar grupos y sesiones y proteger el servicio frente a accesos no autorizados.",
                ],
              },
              {
                title: "Base juridica",
                body: [
                  "El tratamiento se basa en tu consentimiento conforme al art. 6(1)(a) del RGPD cuando creas una cuenta y en la ejecucion de un contrato conforme al art. 6(1)(b) del RGPD para prestar el servicio.",
                  "El tratamiento relacionado con la seguridad tambien puede basarse en nuestro interes legitimo conforme al art. 6(1)(f) del RGPD para proteger el servicio y a sus usuarios.",
                ],
              },
              {
                title: "Conservacion de datos",
                body: [
                  "Conservamos tus datos personales solo durante el tiempo necesario para prestar el servicio y cumplir con obligaciones legales.",
                  "Si eliminas tu cuenta, tus datos se eliminaran o anonimizaran en un plazo de 30 dias, salvo que la ley exija una conservacion mas prolongada.",
                ],
              },
              {
                title: "Derechos de la persona usuaria",
                body: [
                  "Tienes derecho a acceder, rectificar, borrar o limitar el tratamiento de tus datos, asi como a oponerte al tratamiento cuando corresponda.",
                  "Contacta con hello@melonmeet.example para ejercer estos derechos.",
                ],
              },
            ],
          },
          terms: {
            title: "Terms of Service",
            eyebrow: "Terms",
            description: "Normas para usar cuentas, perfiles, grupos, sesiones y contenido generado por usuarios en Melon Meet.",
            sections: [
              {
                title: "Aceptacion de los terminos",
                body: [
                  "Ultima actualizacion: 25 de abril de 2026.",
                  "Al crear una cuenta en Melon Meet, aceptas estos Terminos del Servicio.",
                ],
              },
              {
                title: "Cuentas de usuario",
                body: [
                  "Debes proporcionar informacion precisa.",
                  "Eres responsable de mantener la confidencialidad de tu contrasena.",
                  "Debes tener al menos 16 anos para crear una cuenta.",
                ],
              },
              {
                title: "Uso aceptable",
                body: [
                  "Aceptas no publicar contenido ilegal, difamatorio, danino, acosador, spam, fraudulento o invasivo para la privacidad.",
                  "Aceptas no intentar eludir medidas de seguridad ni acceder a datos para los que no tengas autorizacion.",
                ],
              },
              {
                title: "Contenido del usuario",
                body: [
                  "Conservas la propiedad del contenido que publiques, incluidas fotos de perfil, texto del perfil, publicaciones de grupo y detalles de sesiones.",
                  "Concedes a Melon Meet una licencia no exclusiva para mostrar este contenido en el sitio web en la medida necesaria para operar el servicio.",
                ],
              },
              {
                title: "Terminacion",
                body: [
                  "Nos reservamos el derecho de suspender o cerrar cuentas que infrinjan estos terminos o generen riesgo para la comunidad o el servicio.",
                ],
              },
              {
                title: "Limitacion de responsabilidad",
                body: [
                  'Melon Meet se ofrece "tal cual". No somos responsables de los danos derivados del uso del sitio en la medida permitida por la ley.',
                  "Los deportes al aire libre implican riesgos inherentes. Las personas participantes son responsables de su propia seguridad, seguro, desplazamiento y decisiones de participacion.",
                ],
              },
            ],
          },
          impressum: {
            title: "Impressum",
            eyebrow: "Company",
            description: "Informacion publica de empresa y contacto de Melon Meet.",
            sections: [
              {
                title: "Identificacion del proveedor",
                body: ["Angaben gemaess Section 5 DDG / formerly Section 5 TMG.", "Melon Meet", "Jacob Otto", "Halskestr. 6", "12167 Berlin", "Germany"],
              },
              {
                title: "Contacto",
                body: ["Email: hello@melonmeet.example", "Telephone: Not provided."],
              },
              {
                title: "Representacion e IVA",
                body: ["Represented by: Jacob Otto", "VAT ID: Not provided."],
              },
              {
                title: "Responsable del contenido",
                body: ["Responsible for content according to Section 18 Abs. 2 MStV: Jacob Otto, Halskestr. 6, 12167 Berlin, Germany."],
              },
            ],
          },
        },
      },
    };
  }

  return {
    info: {
      appDescription: {
        title: "About Melon Meet",
        body: [
          "Melon Meet is a Berlin-first community tool for discovering beach volleyball venues, public sessions, and small playing groups.",
          "The product keeps public discovery open while giving signed-in users tools to claim spots, manage groups, and organise sessions.",
        ],
      },
      links: {
        info: "About",
        privacy: "Privacy",
        terms: "Terms",
        impressum: "Impressum",
      },
      pages: {
        info: {
          title: "About",
          eyebrow: "About",
          description:
            "What Melon Meet is for, who it helps, and how public discovery and lightweight coordination fit together inside the app.",
          sections: [
            {
              title: "What It Is",
              body: [
                "Melon Meet is a Berlin-first community tool for discovering beach volleyball venues, public sessions, and small playing groups.",
                "The product keeps public discovery open while giving signed-in users tools to claim spots, manage groups, and organise sessions.",
                "Melon Meet started as a way to make Berlin beach volleyball easier to navigate without forcing every useful place into the same giant chat thread.",
                "The app brings venues, groups, and sessions into one map-first board so people can move from discovering a court to understanding who plays there and when.",
                "Public browsing stays lightweight on purpose. You should be able to open the app, scan the city, and get oriented before deciding whether you want an account.",
              ],
            },
            {
              title: "How It Works",
              body: [
                "Venues are the stable places: courts, clubs, and spots worth knowing. Sessions are the time-based layer on top, so a place can feel alive instead of static.",
                "Groups help recurring crews organise themselves without losing the public discovery flow. Some can stay open and visible, others can remain private for smaller circles.",
                "The map is meant to be the orienting surface: browse first, open details when something looks promising, and move between location, group, and session context without losing your sense of place.",
                "Legal and company pages stay inside the same shell so the app still feels coherent when you step out of the map and into the informational side.",
              ],
            },
          ],
        },
        privacy: {
          title: "Privacy Policy",
          eyebrow: "Privacy",
          description: "How Melon Meet collects and uses account, profile, group, and session data.",
          sections: [
            {
              title: "Overview",
              body: [
                "Last updated: April 25, 2026.",
                "This Privacy Policy describes how Melon Meet collects, uses, and discloses your personal information when you visit the Melon Meet website and create a user account.",
              ],
            },
            {
              title: "Data Controller",
              body: [
                "Controller: Melon Meet, Jacob Otto, Halskestr. 6, 12167 Berlin, Germany.",
                "Contact: hello@melonmeet.example.",
              ],
            },
            {
              title: "Data We Collect",
              body: [
                "Account information: When you register, we collect your email address and password. Passwords are hashed and are not stored in plain text.",
                "Profile data: Information you voluntarily add to your profile, such as display name, profile picture, bio, home area, playing level, and profile visibility settings.",
                "Community data: Group memberships, membership requests, sessions, session claims, posts, and organiser responsibilities needed to operate the service.",
                "Usage and security data: Authentication sessions, login-related timestamps, IP address, browser type, and rate-limit information may be processed for security purposes.",
              ],
            },
            {
              title: "Purpose of Processing",
              body: [
                "We process this data to provide and manage your user account, allow you to interact with the website, show public and private community content, let organisers manage groups and sessions, and secure the site against unauthorised access.",
              ],
            },
            {
              title: "Legal Basis",
              body: [
                "Processing is based on your consent under Art. 6(1)(a) GDPR when you create an account and on the performance of a contract under Art. 6(1)(b) GDPR to provide the service.",
                "Security-related processing may also be based on our legitimate interest under Art. 6(1)(f) GDPR in protecting the service and its users.",
              ],
            },
            {
              title: "Data Retention",
              body: [
                "We retain your personal data only as long as necessary to provide the service and meet legal obligations.",
                "If you delete your account, your data will be deleted or anonymised within 30 days unless longer retention is legally required.",
              ],
            },
            {
              title: "User Rights",
              body: [
                "You have the right to access, rectify, erase, or restrict processing of your data, and to object to processing where applicable.",
                "Contact hello@melonmeet.example to exercise these rights.",
              ],
            },
          ],
        },
        terms: {
          title: "Terms of Service",
          eyebrow: "Terms",
          description: "Rules for using Melon Meet accounts, profiles, groups, sessions, and user-generated content.",
          sections: [
            {
              title: "Acceptance of Terms",
              body: [
                "Last updated: April 25, 2026.",
                "By creating an account on Melon Meet, you agree to these Terms of Service.",
              ],
            },
            {
              title: "User Accounts",
              body: [
                "You must provide accurate information.",
                "You are responsible for keeping your password confidential.",
                "You must be at least 16 years old to create an account.",
              ],
            },
            {
              title: "Acceptable Use",
              body: [
                "You agree not to post illegal, defamatory, harmful, harassing, spam, fraudulent, or privacy-invasive content.",
                "You agree not to attempt to bypass security measures or access data you are not authorised to access.",
              ],
            },
            {
              title: "User Content",
              body: [
                "You retain ownership of content you post, including profile pictures, profile text, group posts, and session details.",
                "You grant Melon Meet a non-exclusive licence to display this content on the website as needed to operate the service.",
              ],
            },
            {
              title: "Termination",
              body: [
                "We reserve the right to suspend or terminate accounts that violate these terms or create risk for the community or service.",
              ],
            },
            {
              title: "Limitation of Liability",
              body: [
                'Melon Meet is provided "as is". We are not liable for damages arising from your use of the site to the extent permitted by law.',
                "Outdoor sports carry inherent risk. Participants are responsible for their own safety, insurance, travel, and participation decisions.",
              ],
            },
          ],
        },
        impressum: {
          title: "Impressum",
          eyebrow: "Company",
          description: `Public company/contact disclosure for Melon Meet (${localeLabel}).`,
          sections: [
            {
              title: "Provider Identification",
              body: [
                "Angaben gemaess Section 5 DDG / formerly Section 5 TMG.",
                "Melon Meet",
                "Jacob Otto",
                "Halskestr. 6",
                "12167 Berlin",
                "Germany",
              ],
            },
            {
              title: "Contact",
              body: ["Email: hello@melonmeet.example", "Telephone: Not provided."],
            },
            {
              title: "Represented By and VAT",
              body: ["Represented by: Jacob Otto", "VAT ID: Not provided."],
            },
            {
              title: "Responsible for Content",
              body: ["Responsible for content according to Section 18 Abs. 2 MStV: Jacob Otto, Halskestr. 6, 12167 Berlin, Germany."],
            },
          ],
        },
      },
    },
  };
}

const englishTranslations: TranslationDictionary = {
    common: {
      all: "All",
      allSessions: "All sessions",
      browse: "Browse",
      booking: "Booking",
      cancel: "Cancel",
      cancelled: "Cancelled",
      claimed: "Claimed",
      close: "Close",
      copy: "Copy",
      copied: "Copied",
      custom: "Custom",
      edit: "Edit",
      filter: "Filter",
      filters: "Filters",
      free: "Free",
      from: "From",
      groups: "Groups",
      language: "Language",
      list: "List",
      loadingProfile: "Loading profile...",
      map: "Map",
      maps: "Maps",
      members: "members",
      messenger: "Messenger",
      nextWeek: "Next week",
      noDescriptionYet: "No description yet.",
      paid: "Paid",
      post: "Post",
      profile: "Profile",
      public: "public",
      private: "private",
      requestMembership: "Request membership",
      save: "Save",
      sessions: "Sessions",
      signIn: "Sign in",
      signUp: "Sign up",
      thisMonth: "This month",
      thisWeek: "This week",
      timeline: "Timeline",
      to: "To",
      today: "Today",
      tomorrow: "Tomorrow",
      updates: "Updates",
      venue: "Venue",
      venues: "Venues",
      website: "Website",
      working: "Working",
      yourGroups: "Your groups",
    },
    enums: {
      role: { admin: "admin", member: "member", owner: "owner" },
      visibility: { private: "private", public: "public" },
    },
    landing: {
      meta: "Berlin Beach Volleyball",
      heroTitle: "Meet your sporty Mellows!",
      heroText: "Find your Beach and join a Session",
      discoverBeachTitle: "Find your Beach and join a Session",
      discoverBeachCopy:
        "Jump into Berlin beach volleyball with other Mellows who are ready to play. Find Venues, Groups and upcoming Sessions. Catch the vibe and claim a sandy spot when you are ready.",
      joinTitle: "Find your Beach and join a Session",
      joinCopy:
        "Jump into Berlin beach volleyball with other Mellows who are ready to play. Find Venues, Groups and upcoming Sessions. Catch the vibe and claim a sandy spot when you are ready.",
      catchSessionTitle: "Find your Beach and join a Session",
      catchSessionCopy:
        "Jump into Berlin beach volleyball with other Mellows who are ready to play. Find Venues, Groups and upcoming Sessions. Catch the vibe and claim a sandy spot when you are ready.",
      participationEyebrow: "Participation",
      participationTitle: "Sign up when you want to contribute, organise, and unlock the full board.",
      participationText: "Contribute, create public or private groups and attend sessions. Public browsing stays open, but signing in turns discovery into participation.",
      email: "Email",
      password: "Password",
      profile: "Profile",
      consentPrefix: "I have read the",
      consentMiddle: "and agree to the",
      createAccount: "Create account",
      closeAuth: "Close",
    },
    workspace: {
      about: "About",
      backToMap: "Back to map",
      berlinBeachVolleyball: "Berlin Beach Volleyball",
      clearSelection: "Clear selection",
      infoAndLegalPages: "Info and legal pages",
      impressum: "Impressum",
      privacy: "Privacy",
      terms: "Terms",
      toggleTheme: "Toggle theme",
    },
    forms: {
      activity: "Activity",
      activityLabel: "Activity label",
      addSession: "Add session",
      address: "Address",
      amountPerPerson: "Amount / person",
      applyToSeries: "Apply these changes to future weekly occurrences",
      avatarUrl: "Avatar URL",
      bio: "Bio",
      buildSeries: "Build a session series from multiple dates",
      capacity: "Capacity",
      description: "Description",
      displayName: "Display name",
      editingSeriesHint: "Editing the whole session series. Add or remove dates to update every session in it.",
      ends: "Ends",
      group: "Group",
      heroImageUrl: "Hero image URL",
      homeArea: "Home area",
      joinGroupRequirement: "Join a private group or become an owner/admin in a public group before creating meetings.",
      latitude: "Latitude",
      location: "Location",
      locationName: "Location name",
      longitude: "Longitude",
      messengerUrl: "Messenger URL",
      name: "Name",
      otherLocation: "Other location",
      passwordHint: "Use formats like `3`, `3.5`, `2-3`, or `3.5-4`.",
      passwordTitle: "Use formats like 3, 3.5, 2-3, or 3.5-4.",
      playingLevel: "Playing level",
      pricing: "Pricing",
      publicProfile: "Public profile",
      remove: "Remove",
      sessionDates: "Session dates",
      shortName: "Short name",
      showEmailPublicly: "Show email publicly",
      slug: "Slug",
      starts: "Starts",
      title: "Title",
      useAddSessionHint: "Use the add session button next to the start time to build the series.",
      visibility: "Visibility",
    },
    profile: {
      attending: "Attending",
      createdSessions: "Created Sessions",
      groups: "Groups",
      hostedSessions: "Hosted Sessions",
      noBioYet: "No bio yet.",
      noHostedSessions: "No hosted sessions.",
      noUpcomingSessions: "No upcoming sessions.",
      ownCreatedSessions: "Your created Sessions",
      privateProfile: "This profile is private.",
      signInToParticipate: "Sign in to manage private groups and attend sessions.",
    },
    discovery: {
      activityFallback: "Beach volleyball",
      address: "Address",
      attending: "attending",
      attendingPlayers: "Attending Players",
      availability: "Availability",
      booking: "Booking",
      copyAddress: "Copy address",
      editGroup: "Group",
      editMode: "Edit",
      editSeries: "Edit Series",
      emptyWorkspaceTitle: "Pick a court, group, or session.",
      emptyWorkspaceText: "Details, sessions, actions, and updates appear here.",
      freeSpots: "Free spots",
      freeSpotsOnly: "Free spots only",
      group: "Group",
      joinGroup: "Request membership",
      listHeadingGroups: "Groups",
      listHeadingSessions: "Sessions",
      listHeadingVenues: "Venues",
      members: "Members",
      noPostsYet: "No posts yet.",
      nobodyClaimed: "Nobody has claimed a spot yet.",
      noSessionsAvailable: "No sessions available.",
      noSessionsAtLocation: "No sessions at this location.",
      noSessionsAtVenue: "No sessions at this venue yet.",
      noSessionsByGroup: "No sessions created by this group yet.",
      noSessionsFiltered: "No sessions match the current filters.",
      noUpdatesYet: "No updates yet.",
      openingHours: "Opening hours",
      openingHoursFallback: "Check source before you go",
      postToGroup: "Post to group",
      postUpdate: "Post update",
      profileNotFound: "Profile not found.",
      publicGroups: "Public groups",
      releaseSpot: "Release your spot",
      scrollToTop: "Scroll to top",
      selectionCluster: "Session cluster",
      selectionGroup: "Group",
      selectionProfile: "Profile",
      selectionSession: "Session",
      selectionVenue: "Venue",
      sessionSeries: "Session Series",
      sessionsAtLocation: "Sessions at this location",
      time: "Time",
      upcomingSessions: "Upcoming sessions",
      updatesTitle: "Updates",
      venue: "Venue",
      website: "Website",
      youAreAttending: "You are attending",
      yourGroups: "Your groups",
      viewImageClose: "Close image",
    },
    timeline: {
      from: "from {{value}}",
      location: "@{{value}}",
      empty: "No entries.",
      series: "Series",
      today: "Today",
    },
    status: {
      claimedCount: "{{claimed}}/{{capacity}} claimed",
      matchingSessions: "{{count}} matching sessions",
      openSpots: "{{count}} spots open",
      sessions: "{{count}} sessions",
      sessionsAtLocation: "{{count}} sessions at this location",
      upcomingSessions: "{{count}} upcoming sessions",
    },
    postBoard: {
      pinboard: "Pinboard",
      placeholder: "Share a quick update, game note, or meetup detail...",
      sending: "Sending",
    },
    map: {
      next: "Next:",
      noSessionsYet: "No sessions yet",
      noSessionScheduled: "No session scheduled",
      spotsClaimed: "{{claimed}}/{{capacity}} spots claimed",
      cancelledPrefix: "{{prefix}} Cancelled - {{title}}",
      titlePrefix: "{{prefix}} {{title}}",
    },
    ...buildInfoContent("EN"),
  };

function translationsFallback(localeLabel: string): TranslationDictionary {
  return {
    ...englishTranslations,
    ...buildInfoContent(localeLabel),
  };
}

const translations: Record<AppLocale, TranslationDictionary> = {
  "en-US": englishTranslations,
  "de-DE": {
    common: {
      all: "Alle",
      allSessions: "Alle Sessions",
      browse: "Entdecken",
      booking: "Buchung",
      cancel: "Abbrechen",
      cancelled: "Abgesagt",
      claimed: "Reserviert",
      close: "Schliessen",
      copy: "Kopieren",
      copied: "Kopiert",
      custom: "Benutzerdefiniert",
      edit: "Bearbeiten",
      filter: "Filter",
      filters: "Filter",
      free: "Kostenlos",
      from: "Von",
      groups: "Gruppen",
      language: "Sprache",
      list: "Liste",
      loadingProfile: "Profil wird geladen...",
      map: "Karte",
      maps: "Karten",
      members: "Mitglieder",
      messenger: "Messenger",
      nextWeek: "Naechste Woche",
      noDescriptionYet: "Noch keine Beschreibung.",
      paid: "Kostenpflichtig",
      post: "Posten",
      profile: "Profil",
      public: "oeffentlich",
      private: "privat",
      requestMembership: "Mitgliedschaft anfragen",
      save: "Speichern",
      sessions: "Sessions",
      signIn: "Anmelden",
      signUp: "Registrieren",
      thisMonth: "Diesen Monat",
      thisWeek: "Diese Woche",
      timeline: "Zeitplan",
      to: "Bis",
      today: "Heute",
      tomorrow: "Morgen",
      updates: "Updates",
      venue: "Venue",
      venues: "Venues",
      website: "Website",
      working: "Laeuft",
      yourGroups: "Deine Gruppen",
    },
    enums: {
      role: { admin: "admin", member: "mitglied", owner: "owner" },
      visibility: { private: "privat", public: "oeffentlich" },
    },
    landing: {
      meta: "Berlin Beachvolleyball",
      heroTitle: "Triff deine sportlichen Mellows!",
      heroText: "Finde deinen Beach und werde Teil einer Session",
      discoverBeachTitle: "Finde deinen Beach und werde Teil einer Session",
      discoverBeachCopy:
        "Spring mit anderen Mellows in den Berliner Beachvolleyball, die spielbereit sind. Finde Venues, Gruppen und kommende Sessions. Spuere den Vibe und sichere dir einen sandigen Platz, wenn du bereit bist.",
      joinTitle: "Finde deinen Beach und werde Teil einer Session",
      joinCopy:
        "Spring mit anderen Mellows in den Berliner Beachvolleyball, die spielbereit sind. Finde Venues, Gruppen und kommende Sessions. Spuere den Vibe und sichere dir einen sandigen Platz, wenn du bereit bist.",
      catchSessionTitle: "Finde deinen Beach und werde Teil einer Session",
      catchSessionCopy:
        "Spring mit anderen Mellows in den Berliner Beachvolleyball, die spielbereit sind. Finde Venues, Gruppen und kommende Sessions. Spuere den Vibe und sichere dir einen sandigen Platz, wenn du bereit bist.",
      participationEyebrow: "Teilnahme",
      participationTitle: "Registriere dich, wenn du beitragen, organisieren und das volle Board freischalten willst.",
      participationText: "Trage bei, erstelle oeffentliche oder private Gruppen und nimm an Sessions teil. Oeffentliches Browsen bleibt offen, aber mit Login wird Entdecken zu Teilnahme.",
      email: "E-Mail",
      password: "Passwort",
      profile: "Profil",
      consentPrefix: "Ich habe die",
      consentMiddle: "gelesen und stimme den",
      createAccount: "Konto erstellen",
      closeAuth: "Schliessen",
    },
    workspace: {
      about: "Info",
      backToMap: "Zur Karte",
      berlinBeachVolleyball: "Berlin Beachvolleyball",
      clearSelection: "Auswahl loeschen",
      infoAndLegalPages: "Info- und Rechtseiten",
      impressum: "Impressum",
      privacy: "Datenschutz",
      terms: "AGB",
      toggleTheme: "Theme wechseln",
    },
    forms: {
      activity: "Aktivitaet",
      activityLabel: "Aktivitaetslabel",
      addSession: "Session hinzufuegen",
      address: "Adresse",
      amountPerPerson: "Betrag / Person",
      applyToSeries: "Diese Aenderungen auf zukuenftige woechentliche Termine anwenden",
      avatarUrl: "Avatar-URL",
      bio: "Bio",
      buildSeries: "Eine Session-Serie aus mehreren Terminen erstellen",
      capacity: "Kapazitaet",
      description: "Beschreibung",
      displayName: "Anzeigename",
      editingSeriesHint: "Du bearbeitest die gesamte Session-Serie. Fuege Termine hinzu oder entferne sie, um alle Sessions zu aktualisieren.",
      ends: "Endet",
      group: "Gruppe",
      heroImageUrl: "Hero-Bild-URL",
      homeArea: "Heimatgebiet",
      joinGroupRequirement: "Tritt einer privaten Gruppe bei oder werde Owner/Admin in einer oeffentlichen Gruppe, bevor du Meetings erstellst.",
      latitude: "Breitengrad",
      location: "Ort",
      locationName: "Ortsname",
      longitude: "Laengengrad",
      messengerUrl: "Messenger-URL",
      name: "Name",
      otherLocation: "Anderer Ort",
      passwordHint: "Verwende Formate wie `3`, `3.5`, `2-3` oder `3.5-4`.",
      passwordTitle: "Verwende Formate wie 3, 3.5, 2-3 oder 3.5-4.",
      playingLevel: "Spielniveau",
      pricing: "Preis",
      publicProfile: "Oeffentliches Profil",
      remove: "Entfernen",
      sessionDates: "Session-Termine",
      shortName: "Kurzname",
      showEmailPublicly: "E-Mail oeffentlich anzeigen",
      slug: "Slug",
      starts: "Start",
      title: "Titel",
      useAddSessionHint: "Nutze den Button neben der Startzeit, um die Serie aufzubauen.",
      visibility: "Sichtbarkeit",
    },
    profile: {
      attending: "Dabei",
      createdSessions: "Erstellte Sessions",
      groups: "Gruppen",
      hostedSessions: "Gehostete Sessions",
      noBioYet: "Noch keine Bio.",
      noHostedSessions: "Keine gehosteten Sessions.",
      noUpcomingSessions: "Keine kommenden Sessions.",
      ownCreatedSessions: "Deine erstellten Sessions",
      privateProfile: "Dieses Profil ist privat.",
      signInToParticipate: "Melde dich an, um private Gruppen zu verwalten und an Sessions teilzunehmen.",
    },
    discovery: {
      activityFallback: "Beachvolleyball",
      address: "Adresse",
      attending: "dabei",
      attendingPlayers: "Teilnehmende Spieler",
      availability: "Verfuegbarkeit",
      booking: "Buchung",
      copyAddress: "Adresse kopieren",
      editGroup: "Gruppe",
      editMode: "Bearbeiten",
      editSeries: "Serie bearbeiten",
      emptyWorkspaceTitle: "Waehle einen Court, eine Gruppe oder eine Session.",
      emptyWorkspaceText: "Details, Sessions, Aktionen und Updates erscheinen hier.",
      freeSpots: "Freie Plaetze",
      freeSpotsOnly: "Nur freie Plaetze",
      group: "Gruppe",
      joinGroup: "Mitgliedschaft anfragen",
      listHeadingGroups: "Gruppen",
      listHeadingSessions: "Sessions",
      listHeadingVenues: "Venues",
      members: "Mitglieder",
      noPostsYet: "Noch keine Posts.",
      nobodyClaimed: "Noch niemand hat einen Platz reserviert.",
      noSessionsAvailable: "Keine Sessions verfuegbar.",
      noSessionsAtLocation: "Keine Sessions an diesem Ort.",
      noSessionsAtVenue: "Noch keine Sessions an diesem Venue.",
      noSessionsByGroup: "Diese Gruppe hat noch keine Sessions erstellt.",
      noSessionsFiltered: "Keine Sessions entsprechen den aktuellen Filtern.",
      noUpdatesYet: "Noch keine Updates.",
      openingHours: "Oeffnungszeiten",
      openingHoursFallback: "Quelle pruefen, bevor du losgehst",
      postToGroup: "In Gruppe posten",
      postUpdate: "Update posten",
      profileNotFound: "Profil nicht gefunden.",
      publicGroups: "Oeffentliche Gruppen",
      releaseSpot: "Platz freigeben",
      scrollToTop: "Nach oben scrollen",
      selectionCluster: "Session-Cluster",
      selectionGroup: "Gruppe",
      selectionProfile: "Profil",
      selectionSession: "Session",
      selectionVenue: "Venue",
      sessionSeries: "Session-Serie",
      sessionsAtLocation: "Sessions an diesem Ort",
      time: "Zeit",
      upcomingSessions: "Kommende Sessions",
      updatesTitle: "Updates",
      venue: "Venue",
      website: "Website",
      youAreAttending: "Du bist dabei",
      yourGroups: "Deine Gruppen",
      viewImageClose: "Bild schliessen",
    },
    timeline: {
      from: "von {{value}}",
      location: "@{{value}}",
      empty: "Keine Eintraege.",
      series: "Serie",
      today: "Heute",
    },
    status: {
      claimedCount: "{{claimed}}/{{capacity}} reserviert",
      matchingSessions: "{{count}} passende Sessions",
      openSpots: "{{count}} Plaetze frei",
      sessions: "{{count}} Sessions",
      sessionsAtLocation: "{{count}} Sessions an diesem Ort",
      upcomingSessions: "{{count}} kommende Sessions",
    },
    postBoard: {
      pinboard: "Pinnwand",
      placeholder: "Teile ein kurzes Update, eine Spielnotiz oder ein Meetup-Detail...",
      sending: "Sende",
    },
    map: {
      next: "Naechste:",
      noSessionsYet: "Noch keine Sessions",
      noSessionScheduled: "Keine Session geplant",
      spotsClaimed: "{{claimed}}/{{capacity}} Plaetze belegt",
      cancelledPrefix: "{{prefix}} Abgesagt - {{title}}",
      titlePrefix: "{{prefix}} {{title}}",
    },
    ...buildInfoContent("DE"),
  },
  "es-ES": {
    common: {
      all: "Todo",
      allSessions: "Todas las sesiones",
      browse: "Explorar",
      booking: "Reserva",
      cancel: "Cancelar",
      cancelled: "Cancelada",
      claimed: "Reservada",
      close: "Cerrar",
      copy: "Copiar",
      copied: "Copiado",
      custom: "Personalizado",
      edit: "Editar",
      filter: "Filtro",
      filters: "Filtros",
      free: "Gratis",
      from: "Desde",
      groups: "Grupos",
      language: "Idioma",
      list: "Lista",
      loadingProfile: "Cargando perfil...",
      map: "Mapa",
      maps: "Mapas",
      members: "miembros",
      messenger: "Messenger",
      nextWeek: "La proxima semana",
      noDescriptionYet: "Todavia no hay descripcion.",
      paid: "De pago",
      post: "Publicar",
      profile: "Perfil",
      public: "publico",
      private: "privado",
      requestMembership: "Solicitar membresia",
      save: "Guardar",
      sessions: "Sesiones",
      signIn: "Iniciar sesion",
      signUp: "Registrarse",
      thisMonth: "Este mes",
      thisWeek: "Esta semana",
      timeline: "Cronologia",
      to: "Hasta",
      today: "Hoy",
      tomorrow: "Manana",
      updates: "Actualizaciones",
      venue: "Venue",
      venues: "Venues",
      website: "Sitio web",
      working: "Procesando",
      yourGroups: "Tus grupos",
    },
    enums: {
      role: { admin: "admin", member: "miembro", owner: "owner" },
      visibility: { private: "privado", public: "publico" },
    },
    landing: {
      meta: "Voley Playa Berlin",
      heroTitle: "Conoce a tus Mellows deportistas",
      heroText: "Encuentra tu Beach y unete a una Sesion",
      discoverBeachTitle: "Encuentra tu Beach y unete a una Sesion",
      discoverBeachCopy:
        "Sumate al voley playa de Berlin con otros Mellows que ya estan listos para jugar. Encuentra Venues, Grupos y proximas Sesiones. Siente el ambiente y reserva un hueco en la arena cuando quieras.",
      joinTitle: "Encuentra tu Beach y unete a una Sesion",
      joinCopy:
        "Sumate al voley playa de Berlin con otros Mellows que ya estan listos para jugar. Encuentra Venues, Grupos y proximas Sesiones. Siente el ambiente y reserva un hueco en la arena cuando quieras.",
      catchSessionTitle: "Encuentra tu Beach y unete a una Sesion",
      catchSessionCopy:
        "Sumate al voley playa de Berlin con otros Mellows que ya estan listos para jugar. Encuentra Venues, Grupos y proximas Sesiones. Siente el ambiente y reserva un hueco en la arena cuando quieras.",
      participationEyebrow: "Participacion",
      participationTitle: "Registrate cuando quieras contribuir, organizar y desbloquear todo el tablero.",
      participationText: "Contribuye, crea grupos publicos o privados y participa en sesiones. La exploracion publica sigue abierta, pero iniciar sesion convierte el descubrimiento en participacion.",
      email: "Correo electronico",
      password: "Contrasena",
      profile: "Perfil",
      consentPrefix: "He leido la",
      consentMiddle: "y acepto los",
      createAccount: "Crear cuenta",
      closeAuth: "Cerrar",
    },
    workspace: {
      about: "About",
      backToMap: "Volver al mapa",
      berlinBeachVolleyball: "Voley Playa Berlin",
      clearSelection: "Limpiar seleccion",
      infoAndLegalPages: "Paginas informativas y legales",
      impressum: "Impressum",
      privacy: "Privacy",
      terms: "Terms",
      toggleTheme: "Cambiar tema",
    },
    forms: {
      activity: "Actividad",
      activityLabel: "Etiqueta de actividad",
      addSession: "Anadir sesion",
      address: "Direccion",
      amountPerPerson: "Importe / persona",
      applyToSeries: "Aplicar estos cambios a futuras repeticiones semanales",
      avatarUrl: "URL del avatar",
      bio: "Bio",
      buildSeries: "Crear una serie de sesiones con varias fechas",
      capacity: "Capacidad",
      description: "Descripcion",
      displayName: "Nombre visible",
      editingSeriesHint: "Estas editando toda la serie de sesiones. Anade o elimina fechas para actualizar todas las sesiones de la serie.",
      ends: "Termina",
      group: "Grupo",
      heroImageUrl: "URL de imagen hero",
      homeArea: "Zona habitual",
      joinGroupRequirement: "Unete a un grupo privado o conviertete en owner/admin de un grupo publico antes de crear reuniones.",
      latitude: "Latitud",
      location: "Ubicacion",
      locationName: "Nombre del lugar",
      longitude: "Longitud",
      messengerUrl: "URL de Messenger",
      name: "Nombre",
      otherLocation: "Otra ubicacion",
      passwordHint: "Usa formatos como `3`, `3.5`, `2-3` o `3.5-4`.",
      passwordTitle: "Usa formatos como 3, 3.5, 2-3 o 3.5-4.",
      playingLevel: "Nivel de juego",
      pricing: "Precio",
      publicProfile: "Perfil publico",
      remove: "Eliminar",
      sessionDates: "Fechas de sesion",
      shortName: "Nombre corto",
      showEmailPublicly: "Mostrar correo publicamente",
      slug: "Slug",
      starts: "Empieza",
      title: "Titulo",
      useAddSessionHint: "Usa el boton de anadir sesion junto a la hora de inicio para construir la serie.",
      visibility: "Visibilidad",
    },
    profile: {
      attending: "Asistiendo",
      createdSessions: "Sesiones creadas",
      groups: "Grupos",
      hostedSessions: "Sesiones organizadas",
      noBioYet: "Todavia no hay bio.",
      noHostedSessions: "No hay sesiones organizadas.",
      noUpcomingSessions: "No hay sesiones proximas.",
      ownCreatedSessions: "Tus sesiones creadas",
      privateProfile: "Este perfil es privado.",
      signInToParticipate: "Inicia sesion para gestionar grupos privados y participar en sesiones.",
    },
    discovery: {
      activityFallback: "Voley playa",
      address: "Direccion",
      attending: "asistiendo",
      attendingPlayers: "Jugadores asistentes",
      availability: "Disponibilidad",
      booking: "Reserva",
      copyAddress: "Copiar direccion",
      editGroup: "Grupo",
      editMode: "Editar",
      editSeries: "Editar serie",
      emptyWorkspaceTitle: "Elige una pista, grupo o sesion.",
      emptyWorkspaceText: "Los detalles, sesiones, acciones y actualizaciones aparecen aqui.",
      freeSpots: "Plazas libres",
      freeSpotsOnly: "Solo plazas libres",
      group: "Grupo",
      joinGroup: "Solicitar membresia",
      listHeadingGroups: "Grupos",
      listHeadingSessions: "Sesiones",
      listHeadingVenues: "Venues",
      members: "Miembros",
      noPostsYet: "Todavia no hay publicaciones.",
      nobodyClaimed: "Todavia nadie ha reservado una plaza.",
      noSessionsAvailable: "No hay sesiones disponibles.",
      noSessionsAtLocation: "No hay sesiones en esta ubicacion.",
      noSessionsAtVenue: "Todavia no hay sesiones en este venue.",
      noSessionsByGroup: "Este grupo todavia no ha creado sesiones.",
      noSessionsFiltered: "Ninguna sesion coincide con los filtros actuales.",
      noUpdatesYet: "Todavia no hay actualizaciones.",
      openingHours: "Horario de apertura",
      openingHoursFallback: "Comprueba la fuente antes de ir",
      postToGroup: "Publicar en el grupo",
      postUpdate: "Publicar actualizacion",
      profileNotFound: "Perfil no encontrado.",
      publicGroups: "Grupos publicos",
      releaseSpot: "Liberar tu plaza",
      scrollToTop: "Volver arriba",
      selectionCluster: "Cluster de sesiones",
      selectionGroup: "Grupo",
      selectionProfile: "Perfil",
      selectionSession: "Sesion",
      selectionVenue: "Venue",
      sessionSeries: "Serie de sesiones",
      sessionsAtLocation: "Sesiones en esta ubicacion",
      time: "Hora",
      upcomingSessions: "Proximas sesiones",
      updatesTitle: "Actualizaciones",
      venue: "Venue",
      website: "Sitio web",
      youAreAttending: "Estas asistiendo",
      yourGroups: "Tus grupos",
      viewImageClose: "Cerrar imagen",
    },
    timeline: {
      from: "de {{value}}",
      location: "@{{value}}",
      empty: "No hay entradas.",
      series: "Serie",
      today: "Hoy",
    },
    status: {
      claimedCount: "{{claimed}}/{{capacity}} reservadas",
      matchingSessions: "{{count}} sesiones coincidentes",
      openSpots: "{{count}} plazas libres",
      sessions: "{{count}} sesiones",
      sessionsAtLocation: "{{count}} sesiones en esta ubicacion",
      upcomingSessions: "{{count}} proximas sesiones",
    },
    postBoard: {
      pinboard: "Tablon",
      placeholder: "Comparte una actualizacion rapida, una nota de juego o un detalle del encuentro...",
      sending: "Enviando",
    },
    map: {
      next: "Siguiente:",
      noSessionsYet: "Todavia no hay sesiones",
      noSessionScheduled: "No hay ninguna sesion programada",
      spotsClaimed: "{{claimed}}/{{capacity}} plazas reservadas",
      cancelledPrefix: "{{prefix}} Cancelada - {{title}}",
      titlePrefix: "{{prefix}} {{title}}",
    },
    ...buildInfoContent("ES"),
  },
  "fr-FR": { ...translationsFallback("French") },
  "ru-RU": { ...translationsFallback("Russian") },
  "uk-UA": { ...translationsFallback("Ukrainian") },
  "tr-TR": { ...translationsFallback("Turkish") },
  "vi-VN": { ...translationsFallback("Vietnamese") },
  "hi-IN": { ...translationsFallback("Hindi") },
  "zh-CN": { ...translationsFallback("Chinese") },
  "ja-JP": { ...translationsFallback("Japanese") },
};

function interpolate(template: string, values?: Record<string, string | number | null | undefined>) {
  if (!values) return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, key: string) => String(values[key.trim()] ?? ""));
}

function getNestedValue(dictionary: TranslationDictionary, path: string): TranslationValue | undefined {
  return path.split(".").reduce<TranslationValue | undefined>((value, segment) => {
    if (!value || typeof value === "string" || Array.isArray(value)) {
      return undefined;
    }
    return value[segment];
  }, dictionary);
}

function getInitialLocale(): AppLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (SUPPORTED_LOCALES.some((entry) => entry.code === stored)) {
    return stored as AppLocale;
  }

  const browserLanguages = [...window.navigator.languages, window.navigator.language];
  for (const language of browserLanguages) {
    const exactMatch = SUPPORTED_LOCALES.find((entry) => entry.code === language);
    if (exactMatch) {
      return exactMatch.code;
    }
    const baseMatch = SUPPORTED_LOCALES.find((entry) => entry.code.split("-")[0] === language.split("-")[0]);
    if (baseMatch) {
      return baseMatch.code;
    }
  }

  return DEFAULT_LOCALE;
}

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, values?: Record<string, string | number | null | undefined>) => string;
  formatCurrency: (amount: number) => string;
  formatDateTime: (value: string, options?: Intl.DateTimeFormatOptions) => string;
  formatPrice: (pricing: "free" | "paid", costPerPerson?: number | null, withPerson?: boolean) => string;
  formatRole: (role: "owner" | "admin" | "member" | null | undefined) => string;
  formatVisibility: (visibility: "public" | "private" | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(getInitialLocale);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[locale] ?? translations[DEFAULT_LOCALE];

    const t = (key: string, values?: Record<string, string | number | null | undefined>) => {
      const resolved = getNestedValue(dictionary, key) ?? getNestedValue(translations[DEFAULT_LOCALE], key);
      if (typeof resolved !== "string") {
        return key;
      }
      return interpolate(resolved, values);
    };

    return {
      locale,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
          document.documentElement.lang = nextLocale;
        }
      },
      t,
      formatCurrency: (amount: number) =>
        new Intl.NumberFormat(locale, { currency: "EUR", maximumFractionDigits: 1, style: "currency" }).format(amount),
      formatDateTime: (value: string, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options ?? { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)),
      formatPrice: (pricing, costPerPerson, withPerson = false) => {
        if (pricing === "free") {
          return t("common.free");
        }
        if (typeof costPerPerson === "number" && Number.isFinite(costPerPerson)) {
          const amount = new Intl.NumberFormat(locale, { currency: "EUR", maximumFractionDigits: 1, style: "currency" }).format(
            costPerPerson,
          );
          return withPerson ? `${amount} / ${t("forms.amountPerPerson").split(" / ")[1] ?? "person"}` : amount;
        }
        return t("common.paid");
      },
      formatRole: (role) => (role ? t(`enums.role.${role}`) : ""),
      formatVisibility: (visibility) => (visibility ? t(`enums.visibility.${visibility}`) : ""),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
}

export function useInfoContent() {
  const { locale } = useI18n();
  return translations[locale] ?? translations[DEFAULT_LOCALE];
}

export function getLanguageOption(locale: AppLocale) {
  return SUPPORTED_LOCALES.find((entry) => entry.code === locale) ?? SUPPORTED_LOCALES[1];
}

export function useTranslationValue(path: string) {
  const { locale } = useI18n();
  const dictionary = translations[locale] ?? translations[DEFAULT_LOCALE];
  return getNestedValue(dictionary, path);
}
