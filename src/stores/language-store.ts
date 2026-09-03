import { create } from "zustand";

export type LanguageCode = "es" | "en" | "de" | "fr" | "pt";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type NumberFormat = "en" | "de"; // en: 1,234.56, de: 1.234,56

export interface RegionalSettings {
    language: LanguageCode;
    dateFormat: DateFormat;
    numberFormat: NumberFormat;
    firstDayOfWeek: "monday" | "sunday";
}

const STORAGE_KEY = "nomadix_regional_preferences";
const LANG_STORAGE_KEY = "nomadix_language";

const DEFAULT_SETTINGS: RegionalSettings = {
    language: "es", // Default to Spanish as requested
    dateFormat: "DD/MM/YYYY",
    numberFormat: "en",
    firstDayOfWeek: "monday",
};

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
    es: {
        // Navigation
        "nav.dashboard": "Panel",
        "nav.vaults": "Bóvedas",
        "nav.expenses": "Gastos",
        "nav.subscriptions": "Suscripciones",
        "nav.reports": "Reportes",
        "nav.identity": "Identidad",
        "nav.travel": "Viajes",
        "nav.settings": "Configuración",
        "nav.signOut": "Cerrar sesión",
        "nav.backToApp": "Volver a la app",

        // Settings Navigation
        "settings.account": "Cuenta",
        "settings.profile": "Perfil",
        "settings.preferences": "Preferencias",
        "settings.categories": "Categorías",
        "settings.ai": "Asistente IA",
        "settings.data": "Datos",
        "settings.security": "Seguridad",
        "settings.notifications": "Notificaciones",
        "settings.billing": "Facturación",
        "settings.language": "Idioma y Región",
        "settings.support": "Soporte",

        // Account Page
        "account.title": "Configuración de la Cuenta",
        "account.subtitle": "Gestiona tus datos personales y monedas de trabajo",
        "account.fullName": "Nombre Completo",
        "account.email": "Correo Electrónico",
        "account.timezone": "Zona Horaria",
        "account.baseCurrency": "Moneda Base",
        "account.saveChanges": "Guardar Cambios",
        "account.saving": "Guardando...",
        "account.saved": "Guardado",

        // Profile Page
        "profile.title": "Perfil Nómada",
        "profile.subtitle": "Tu perfil público, residencia fiscal y resumen",
        "profile.edit": "Editar Perfil",
        "profile.cancel": "Cancelar",
        "profile.save": "Guardar Cambios",
        "profile.occupation": "Profesión / Ocupación",
        "profile.bio": "Biografía / Descripción",
        "profile.taxResidency": "Residencia Fiscal / País",
        "profile.website": "Sitio Web / Portafolio",
        "profile.memberSince": "Miembro desde",
        "profile.activeVaults": "Bóvedas Activas",
        "profile.documents": "Documentos",
        "profile.plan": "Plan Actual",

        // Preferences Page
        "prefs.title": "Preferencias y Monedas",
        "prefs.subtitle": "Tasa de cambio en vivo y ajustes generales del sistema",
        "prefs.rateTitle": "Tasa de Cambio (USD / EUR)",
        "prefs.refreshRate": "Actualizar tasa en vivo",
        "prefs.refreshing": "Consultando...",
        "prefs.liveRateBadge": "Tasa de Mercado en Vivo",
        "prefs.manualRateBadge": "Tasa Manual Fija",
        "prefs.directRate": "Tasa Directa",
        "prefs.inverseRate": "Tasa Inversa",
        "prefs.manualToggle": "Fijar tasa de cambio manual",
        "prefs.manualDesc": "Sobrescribe la consulta automática para fijar tu propio tipo de cambio en conversiones.",
        "prefs.generalPrefs": "Ajustes Generales",
        "prefs.publicProfile": "Perfil Nómada Público",
        "prefs.publicProfileDesc": "Permitir que otros colaboradores vean tu resumen de gastos compartido.",
        "prefs.taxAlerts": "Alertas Fiscales",
        "prefs.taxAlertsDesc": "Avisos automáticos de límites de estancia o días de residencia fiscal.",
        "prefs.autoSync": "Sincronización Automática",
        "prefs.autoSyncDesc": "Actualizar transacciones y saldos en segundo plano periódicamente.",
        "prefs.darkMode": "Modo Oscuro",
        "prefs.darkModeDesc": "Activar tema visual oscuro en toda la interfaz de la aplicación.",
        "prefs.savedToast": "Preferencias actualizadas",

        // Security Page
        "security.title": "Seguridad y Autenticación",
        "security.subtitle": "Protege tus credenciales, contraseñas y sesiones",
        "security.status": "Cuenta Protegida",
        "security.changePass": "Cambiar Contraseña",
        "security.changePassDesc": "Actualiza tu clave para mantener seguras tus bóvedas financieras",
        "security.newPass": "Nueva Contraseña",
        "security.confirmPass": "Confirmar Nueva Contraseña",
        "security.updatePass": "Actualizar Contraseña",
        "security.activeSessions": "Sesiones Activas",
        "security.activeSessionsDesc": "Dispositivos autenticados actualmente",
        "security.signOutOthers": "Cerrar sesión en otros dispositivos",
        "security.passUpdatedToast": "Contraseña actualizada exitosamente",

        // Notifications Page
        "notif.title": "Notificaciones y Alertas",
        "notif.subtitle": "Elige cuándo y cómo recibir avisos de facturas y saldos",
        "notif.push": "Notificaciones Push del Navegador",
        "notif.pushDesc": "Recibe alertas en tiempo real incluso con la app en segundo plano",
        "notif.enablePush": "Activar Notificaciones",
        "notif.subsSection": "Suscripciones y Vencimientos",
        "notif.sub1d": "Aviso 24 horas antes",
        "notif.sub3d": "Aviso con 3 días de anticipación",
        "notif.subPrice": "Cambios de precio y fin de pruebas gratis",
        "notif.vaultsSection": "Bóvedas y Saldos",
        "notif.vaultLow": "Aviso de saldo bajo en bóvedas",
        "notif.vaultLowDesc": "Avisar cuando una bóveda no tenga saldo para cargos recurrentes",
        "notif.emailSection": "Entrega por Correo",
        "notif.emailWeekly": "Resumen semanal de gastos",

        // Billing Page
        "billing.title": "Facturación y Suscripción",
        "billing.subtitle": "Administra tu membresía Nomadix Pro, ciclo de facturación y recibos",
        "billing.planName": "Plan Nomadix Premium",
        "billing.active": "Activo",
        "billing.monthly": "Mensual",
        "billing.annual": "Anual",
        "billing.saveBadge": "Ahorra 25%",
        "billing.manage": "Gestionar Plan",
        "billing.included": "Incluido en tu plan",
        "billing.usage": "Uso de la Cuenta",
        "billing.receipts": "Recibos y Facturas",

        // Language Page
        "lang.title": "Idioma y Configuración Regional",
        "lang.subtitle": "Personaliza el idioma del sistema, formato de fecha y separadores numéricos",
        "lang.preview": "Vista Previa de Formato Regional en Vivo",
        "lang.datePreview": "Fecha Actual",
        "lang.numberPreview": "Muestra de Gasto",
        "lang.firstDayPreview": "Primer día de la semana",
        "lang.displayLang": "Idioma de la Interfaz",
        "lang.formatsSection": "Formatos de Fecha y Números",
        "lang.dateFormat": "Formato de Fecha",
        "lang.numberFormat": "Separador Numérico y Decimal",
        "lang.firstDay": "Primer Día de la Semana",
        "lang.monday": "Lunes (Monday)",
        "lang.sunday": "Domingo (Sunday)",
        "lang.save": "Guardar Preferencias",

        // Support Page
        "support.title": "Ayuda y Soporte",
        "support.subtitle": "Preguntas frecuentes, contacto con el equipo de soporte y estado",
        "support.docs": "Documentación",
        "support.community": "Comunidad Nómada",
        "support.status": "Estado del Sistema",
        "support.faq": "Preguntas Frecuentes",
        "support.contact": "Contactar con Soporte",
        "support.category": "Categoría",
        "support.priority": "Prioridad",
        "support.subject": "Asunto",
        "support.message": "Mensaje",
        "support.send": "Enviar Ticket",

        // Data Page
        "data.title": "Gestión de Datos y Privacidad",
        "data.subtitle": "Exporta tu historial de transacciones, copias de seguridad y control de cuenta",
        "data.exportSection": "Exportar Datos",
        "data.jsonTitle": "Copia de Seguridad Completa (JSON)",
        "data.jsonDesc": "Descarga todas tus bóvedas, suscripciones, documentos y transacciones en JSON.",
        "data.downloadJson": "Descargar JSON",
        "data.csvTitle": "Planilla de Transacciones (CSV)",
        "data.csvDesc": "Exporta tus gastos, transferencias y comisiones para contabilidad, Excel o impuestos.",
        "data.downloadCsv": "Descargar CSV",
        "data.danger": "Zona de Peligro",
        "data.deleteTitle": "Eliminar Cuenta y Datos Personales",
        "data.deleteDesc": "Borra permanentemente tus bóvedas, transacciones y documentos. Acción irreversible.",
        "data.deleteBtn": "Eliminar Datos de Cuenta",
    },
    en: {
        // Navigation
        "nav.dashboard": "Dashboard",
        "nav.vaults": "Vaults",
        "nav.expenses": "Expenses",
        "nav.subscriptions": "Subscriptions",
        "nav.reports": "Reports",
        "nav.identity": "Identity",
        "nav.travel": "Travel",
        "nav.settings": "Settings",
        "nav.signOut": "Sign Out",
        "nav.backToApp": "Back to app",

        // Settings Navigation
        "settings.account": "Account",
        "settings.profile": "Profile",
        "settings.preferences": "Preferences",
        "settings.categories": "Categories",
        "settings.ai": "AI Assistant",
        "settings.data": "Data",
        "settings.security": "Security",
        "settings.notifications": "Notifications",
        "settings.billing": "Billing",
        "settings.language": "Language & Region",
        "settings.support": "Support",

        // Account Page
        "account.title": "Account Settings",
        "account.subtitle": "Manage your personal information and working currencies",
        "account.fullName": "Full Name",
        "account.email": "Email Address",
        "account.timezone": "Timezone",
        "account.baseCurrency": "Base Currency",
        "account.saveChanges": "Save Changes",
        "account.saving": "Saving...",
        "account.saved": "Saved",

        // Profile Page
        "profile.title": "Nomad Profile",
        "profile.subtitle": "Your public profile overview, tax status, and account stats",
        "profile.edit": "Edit Profile",
        "profile.cancel": "Cancel",
        "profile.save": "Save Changes",
        "profile.occupation": "Occupation / Title",
        "profile.bio": "Bio / Description",
        "profile.taxResidency": "Tax Residency / Country",
        "profile.website": "Website / Portfolio",
        "profile.memberSince": "Member since",
        "profile.activeVaults": "Active Vaults",
        "profile.documents": "Vault Documents",
        "profile.plan": "Current Plan",

        // Preferences Page
        "prefs.title": "Preferences & Currencies",
        "prefs.subtitle": "Live market exchange rates and system-wide preferences",
        "prefs.rateTitle": "Exchange Rate (USD / EUR)",
        "prefs.refreshRate": "Refresh live rate",
        "prefs.refreshing": "Refreshing...",
        "prefs.liveRateBadge": "Live Market Rate",
        "prefs.manualRateBadge": "Manual Fixed Rate",
        "prefs.directRate": "Direct Rate",
        "prefs.inverseRate": "Inverse Rate",
        "prefs.manualToggle": "Enable custom manual rate",
        "prefs.manualDesc": "Override live market rates to lock in a specific rate from transfers or withdrawals.",
        "prefs.generalPrefs": "General Preferences",
        "prefs.publicProfile": "Public Nomad Profile",
        "prefs.publicProfileDesc": "Allow other collaborators to view your shared spending overview.",
        "prefs.taxAlerts": "Tax Residency Alerts",
        "prefs.taxAlertsDesc": "Automatic warnings regarding duration limits for fiscal residency.",
        "prefs.autoSync": "Automatic Sync",
        "prefs.autoSyncDesc": "Periodically refresh transactions and vault balances in the background.",
        "prefs.darkMode": "Dark Mode",
        "prefs.darkModeDesc": "Enable the dark visual theme across the entire application interface.",
        "prefs.savedToast": "Preferences updated",

        // Security Page
        "security.title": "Security & Authentication",
        "security.subtitle": "Protect your credentials, passwords, and active sessions",
        "security.status": "Account Protected",
        "security.changePass": "Change Password",
        "security.changePassDesc": "Update your password to keep your financial vaults secure",
        "security.newPass": "New Password",
        "security.confirmPass": "Confirm New Password",
        "security.updatePass": "Update Password",
        "security.activeSessions": "Active Sessions",
        "security.activeSessionsDesc": "Devices currently authenticated to your account",
        "security.signOutOthers": "Sign out other devices",
        "security.passUpdatedToast": "Password updated successfully",

        // Notifications Page
        "notif.title": "Notifications & Alerts",
        "notif.subtitle": "Choose how and when to receive bill reminders and balance warnings",
        "notif.push": "Desktop & Browser Push",
        "notif.pushDesc": "Receive real-time alerts even when Nomadix is running in the background",
        "notif.enablePush": "Enable Push Alerts",
        "notif.subsSection": "Subscriptions & Due Dates",
        "notif.sub1d": "1-Day Due Date Alert",
        "notif.sub3d": "3-Day Advance Warning",
        "notif.subPrice": "Price Changes & Trial Expirations",
        "notif.vaultsSection": "Vaults & Balance Alerts",
        "notif.vaultLow": "Low Balance Warnings",
        "notif.vaultLowDesc": "Notify when a vault has insufficient balance for upcoming charges",
        "notif.emailSection": "Email Delivery",
        "notif.emailWeekly": "Weekly Spending Summary",

        // Billing Page
        "billing.title": "Billing & Subscription",
        "billing.subtitle": "Manage your Nomadix Pro membership, payment cycle, and invoices",
        "billing.planName": "Nomadix Premium Plan",
        "billing.active": "Active",
        "billing.monthly": "Monthly",
        "billing.annual": "Annual",
        "billing.saveBadge": "Save 25%",
        "billing.manage": "Manage Plan",
        "billing.included": "Included in your plan",
        "billing.usage": "Account Usage",
        "billing.receipts": "Payment Receipts & Invoices",

        // Language Page
        "lang.title": "Language & Regional Settings",
        "lang.subtitle": "Customize interface language, numeric decimal formats, and date displays",
        "lang.preview": "Live Regional Formatting Preview",
        "lang.datePreview": "Current Date",
        "lang.numberPreview": "Expense Sample",
        "lang.firstDayPreview": "First Day of Week",
        "lang.displayLang": "Display Language",
        "lang.formatsSection": "Date & Number Formats",
        "lang.dateFormat": "Date Format",
        "lang.numberFormat": "Number & Decimal Separator",
        "lang.firstDay": "First Day of Week",
        "lang.monday": "Monday",
        "lang.sunday": "Sunday",
        "lang.save": "Save Preferences",

        // Support Page
        "support.title": "Help & Support",
        "support.subtitle": "Frequently asked questions, helpdesk contact, and system status",
        "support.docs": "Documentation",
        "support.community": "Nomad Community",
        "support.status": "System Status",
        "support.faq": "Frequently Asked Questions",
        "support.contact": "Contact Nomadix Support",
        "support.category": "Category",
        "support.priority": "Priority",
        "support.subject": "Subject",
        "support.message": "Message",
        "support.send": "Submit Ticket",

        // Data Page
        "data.title": "Data Management & Privacy",
        "data.subtitle": "Export your complete transaction history, backup vaults, and control account data",
        "data.exportSection": "Export Data",
        "data.jsonTitle": "Complete JSON Backup",
        "data.jsonDesc": "Download all your vaults, subscriptions, identity document records, and transactions.",
        "data.downloadJson": "Download JSON",
        "data.csvTitle": "Transactions Spreadsheet (CSV)",
        "data.csvDesc": "Export your spending, transfers, and category metadata for accounting or tax filing.",
        "data.downloadCsv": "Download CSV",
        "data.danger": "Danger Zone",
        "data.deleteTitle": "Delete Account & Personal Data",
        "data.deleteDesc": "Permanently wipe your vaults, transactions, and documents. Cannot be reversed.",
        "data.deleteBtn": "Delete Account Data",
    },
    de: {} as any,
    fr: {} as any,
    pt: {} as any,
};

// Fallbacks for other languages to English
TRANSLATIONS.de = { ...TRANSLATIONS.en, "nav.dashboard": "Übersicht", "nav.vaults": "Tresore", "nav.expenses": "Ausgaben", "nav.settings": "Einstellungen" };
TRANSLATIONS.fr = { ...TRANSLATIONS.en, "nav.dashboard": "Tableau de bord", "nav.vaults": "Coffres", "nav.expenses": "Dépenses", "nav.settings": "Paramètres" };
TRANSLATIONS.pt = { ...TRANSLATIONS.en, "nav.dashboard": "Painel", "nav.vaults": "Cofres", "nav.expenses": "Despesas", "nav.settings": "Configurações" };

function loadSavedSettings(): RegionalSettings {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const legacyLang = localStorage.getItem(LANG_STORAGE_KEY) as LanguageCode | null;
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                language: legacyLang || parsed.language || DEFAULT_SETTINGS.language,
            };
        }
        if (legacyLang) {
            return { ...DEFAULT_SETTINGS, language: legacyLang };
        }
        return DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

interface LanguageState extends RegionalSettings {
    setLanguage: (lang: LanguageCode) => void;
    setRegionalPrefs: (prefs: Partial<RegionalSettings>) => void;
    t: (key: string) => string;
    formatDate: (date: Date | string | number) => string;
    formatNumber: (amount: number, symbol?: string) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
    ...loadSavedSettings(),

    setLanguage: (lang: LanguageCode) => {
        set({ language: lang });
        if (typeof window !== "undefined") {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
            const current = loadSavedSettings();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, language: lang }));
        }
    },

    setRegionalPrefs: (prefs: Partial<RegionalSettings>) => {
        set((state) => {
            const next = { ...state, ...prefs };
            if (typeof window !== "undefined") {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                        language: next.language,
                        dateFormat: next.dateFormat,
                        numberFormat: next.numberFormat,
                        firstDayOfWeek: next.firstDayOfWeek,
                    })
                );
                if (prefs.language) {
                    localStorage.setItem(LANG_STORAGE_KEY, prefs.language);
                }
            }
            return next;
        });
    },

    t: (key: string): string => {
        const lang = get().language;
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.es;
        return dict[key] || TRANSLATIONS.en[key] || key;
    },

    formatDate: (dateInput: Date | string | number): string => {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "";
        const { dateFormat } = get();
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();

        if (dateFormat === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
        if (dateFormat === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
        return `${dd}/${mm}/${yyyy}`;
    },

    formatNumber: (amount: number, symbol = ""): string => {
        const { numberFormat } = get();
        if (numberFormat === "de") {
            return `${amount.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })} ${symbol}`.trim();
        }
        return `${symbol}${amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`.trim();
    },
}));
