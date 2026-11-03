/**
 * The screenshots of the Lang docs, taken on the Helio demo. The onboarding
 * runs first and creates the administrator every other scene signs in as. The
 * setup scenes then create the `customer-portal` workspace, its languages, its
 * keys and one project override. No scene signs out, because every scene
 * shares one browser session.
 */
const WORKSPACE = "customer-portal";

/** The texts of one key, in the order the Add key dialog lists its fields: en, de, fr, nl. */
interface KeyTexts {
  path: string;
  en: string;
  de?: string;
  fr?: string;
  nl?: string;
}

const KEYS: KeyTexts[] = [
  {
    path: "portal.installation.status",
    en: "Your installation is producing",
    fr: "Votre installation produit",
    nl: "Uw installatie produceert",
  },
  {
    path: "portal.installation.next_visit",
    en: "Next maintenance visit on {date}",
    de: "Nächster Wartungsbesuch am {date}",
    fr: "Prochaine visite d'entretien le {date}",
    nl: "Volgend onderhoudsbezoek op {date}",
  },
  {
    path: "portal.installation.yield_today",
    en: "{kwh} kWh produced today",
    fr: "{kwh} kWh produits aujourd'hui",
  },
  {
    path: "portal.quote.accept",
    en: "Accept the quote",
    fr: "Accepter le devis",
    nl: "Offerte aanvaarden",
  },
  {
    path: "portal.quote.total",
    en: "Total {amount} incl. VAT",
    de: "Gesamt {amount} inkl. MwSt.",
    fr: "Total {amount} TVAC",
    nl: "Totaal {amount} incl. btw",
  },
  {
    path: "portal.invoice.download",
    en: "Download the invoice",
    fr: "Télécharger la facture",
  },
  {
    path: "portal.invoice.due",
    en: "Due on {date}",
    de: "Fällig am {date}",
    fr: "À payer le {date}",
    nl: "Te betalen op {date}",
  },
  {
    path: "portal.support.contact",
    en: "Contact your installer",
    de: "Kontaktieren Sie Ihren Installateur",
    fr: "Contacter votre installateur",
    nl: "Contacteer uw installateur",
  },
  {
    path: "portal.support.hours",
    en: "Our team answers on weekdays from 8:00 to 17:00",
    fr: "Notre équipe répond en semaine de 8 h à 17 h",
  },
  {
    path: "account.sign_in",
    en: "Sign in",
    de: "Anmelden",
    fr: "Se connecter",
    nl: "Aanmelden",
  },
  {
    path: "account.sign_out",
    en: "Sign out",
    fr: "Se déconnecter",
    nl: "Afmelden",
  },
];

const FIELD_ORDER = ["en", "de", "fr", "nl"] as const;

function addLanguage(code: string) {
  return {
    id: `add-language-${code}`,
    route: `/modules/lang/overview?workspace=${WORKSPACE}&action=add-language`,
    setup: true,
    steps: [
      {
        action: "fill",
        selector: '[role="dialog"] input[role="combobox"]',
        value: code,
      },
      {
        action: "click",
        selector: `[role="dialog"] button:has-text("· ${code}")`,
      },
      { action: "wait", selector: `text="${code}"` },
    ],
  };
}

function addKey(key: KeyTexts) {
  const texts = FIELD_ORDER.flatMap((code, index) => {
    const value = key[code];
    return value === undefined
      ? []
      : [
          {
            action: "fill",
            selector: `[role="dialog"] textarea >> nth=${index}`,
            value,
          },
        ];
  });
  return {
    id: `add-key-${key.path.replaceAll(/[._]/g, "-")}`,
    route: `/modules/lang/translations?workspace=${WORKSPACE}&action=add-key`,
    setup: true,
    steps: [
      { action: "wait", selector: '[role="dialog"] textarea' },
      {
        action: "click",
        selector: '[role="dialog"] button:has-text("more language")',
      },
      {
        action: "fill",
        selector: '[role="dialog"] input >> nth=0',
        value: key.path,
      },
      ...texts,
      {
        action: "click",
        selector: '[role="dialog"] button:has-text("Add key")',
      },
      { action: "wait", selector: `text="Key ${key.path} added"` },
    ],
  };
}

export default [
  {
    id: "onboarding",
    route: "/onboarding",
    setup: true,
    steps: [
      { action: "fill", selector: 'input[name="name"]', value: "Helio" },
      {
        action: "click",
        selector: 'button:has-text("Continue to administrator")',
      },
      { action: "wait", selector: 'input[name="firstName"]' },
      { action: "fill", selector: 'input[name="firstName"]', value: "Sophie" },
      { action: "fill", selector: 'input[name="lastName"]', value: "Lambert" },
      {
        action: "fill",
        selector: 'input[name="email"]',
        value: "sophie.lambert@helio.be",
      },
      {
        action: "fill",
        selector: 'input[name="password"]',
        value: "HelioDocs2026!",
      },
      {
        action: "click",
        selector: 'button:has-text("Create administrator account")',
      },
      { action: "wait", selector: 'button:has-text("Open the dashboard")' },
      { action: "click", selector: 'button:has-text("Open the dashboard")' },
    ],
  },
  {
    id: "create-workspace",
    route: "/modules/lang/workspaces?action=new-workspace",
    setup: true,
    steps: [
      {
        action: "fill",
        selector: '[role="dialog"] input >> nth=0',
        value: WORKSPACE,
      },
      {
        action: "fill",
        selector: '[role="dialog"] textarea',
        value:
          "Texts of the Helio customer portal, where owners follow their installation.",
      },
      {
        action: "click",
        selector: '[role="dialog"] button:has-text("Website")',
      },
      {
        action: "click",
        selector: '[role="dialog"] button:has-text("Create workspace")',
      },
      { action: "wait", selector: `text="${WORKSPACE}"` },
    ],
  },
  addLanguage("de"),
  addLanguage("fr"),
  addLanguage("nl"),
  ...KEYS.map(addKey),
  {
    id: "override-save-changes",
    route: "/modules/lang/translations?workspace=default&action=add-key",
    setup: true,
    steps: [
      { action: "wait", selector: '[role="dialog"] textarea' },
      {
        action: "fill",
        selector: '[role="dialog"] input >> nth=0',
        value: "dms.button.save_changes",
      },
      {
        action: "fill",
        selector: '[role="dialog"] textarea >> nth=1',
        value: "Enregistrer mes changements",
      },
      {
        action: "click",
        selector: '[role="dialog"] button:has-text("Override key")',
      },
      {
        action: "wait",
        selector: 'text="Key dms.button.save_changes added"',
      },
    ],
  },
  {
    id: "lang-overview",
    route: `/modules/lang/overview?workspace=${WORKSPACE}`,
    viewport: { width: 1440, height: 1100 },
    steps: [{ action: "wait", selector: 'text="portal"' }],
    output: "docs/images/captures/lang-overview.webp",
  },
  {
    id: "lang-matrix",
    route: `/modules/lang/translations?workspace=${WORKSPACE}`,
    steps: [{ action: "wait", selector: 'text="Accept the quote"' }],
    output: "docs/images/captures/lang-matrix.webp",
  },
  {
    id: "lang-cell-edit",
    route: `/modules/lang/translations?workspace=${WORKSPACE}`,
    steps: [
      { action: "wait", selector: 'text="Accept the quote"' },
      { action: "press", key: "n" },
      {
        action: "fill",
        selector: "textarea:focus",
        value: "Ihre Anlage produziert",
      },
    ],
    output: "docs/images/captures/lang-cell-edit.webp",
  },
  {
    id: "lang-key-panel",
    route: `/modules/lang/translations?workspace=${WORKSPACE}&key=portal.installation.next_visit`,
    steps: [{ action: "wait", selector: 'button:has-text("Rename")' }],
    output: "docs/images/captures/lang-key-panel.webp",
  },
  {
    id: "lang-module-source",
    route: "/modules/lang/translations?workspace=modules&key=dms.button.cancel",
    steps: [{ action: "wait", selector: 'button:has-text("Override")' }],
    output: "docs/images/captures/lang-module-source.webp",
  },
  {
    id: "lang-module-override",
    route:
      "/modules/lang/translations?workspace=default&key=dms.button.save_changes",
    steps: [{ action: "wait", selector: 'text="Use the module text"' }],
    output: "docs/images/captures/lang-module-override.webp",
  },
  {
    id: "lang-queue",
    route: `/modules/lang/language?workspace=${WORKSPACE}&locale=de`,
    steps: [
      { action: "wait", selector: 'text="Your installation is producing"' },
    ],
    output: "docs/images/captures/lang-queue.webp",
  },
  {
    id: "lang-workspaces",
    route: "/modules/lang/workspaces",
    steps: [{ action: "wait", selector: `text="${WORKSPACE}"` }],
    output: "docs/images/captures/lang-workspaces.webp",
  },
  {
    id: "lang-new-workspace",
    route: "/modules/lang/workspaces?action=new-workspace",
    steps: [
      {
        action: "fill",
        selector: '[role="dialog"] input >> nth=0',
        value: "installer-app",
      },
      {
        action: "fill",
        selector: '[role="dialog"] textarea',
        value: "Texts of the field app Helio installers use on site.",
      },
      {
        action: "click",
        selector: '[role="dialog"] button:has-text("Mobile app")',
      },
    ],
    crop: '[role="dialog"]',
    output: "docs/images/captures/lang-new-workspace.webp",
  },
  {
    id: "lang-workspace-settings",
    route: `/modules/lang/workspace?workspace=${WORKSPACE}`,
    viewport: { width: 1440, height: 1800 },
    steps: [{ action: "wait", selector: 'text="Danger zone"' }],
    output: "docs/images/captures/lang-workspace-settings.webp",
  },
];
