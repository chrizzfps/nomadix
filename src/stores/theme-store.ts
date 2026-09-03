import { create } from "zustand";

interface ThemeState {
    isDark: boolean;
    initTheme: () => void;
    toggleDarkMode: () => void;
    setDarkMode: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    isDark: false,

    initTheme: () => {
        if (typeof window === "undefined") return;
        try {
            const saved = localStorage.getItem("nomadix_theme");
            // Check legacy preferences as fallback
            const genPrefs = localStorage.getItem("nomadix_general_preferences");
            let isDark = saved === "dark";
            if (!saved && genPrefs) {
                const parsed = JSON.parse(genPrefs);
                isDark = Boolean(parsed.darkMode);
            }
            set({ isDark });
            if (isDark) {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        } catch {
            // ignore
        }
    },

    toggleDarkMode: () => {
        const next = !get().isDark;
        get().setDarkMode(next);
    },

    setDarkMode: (enabled: boolean) => {
        set({ isDark: enabled });
        if (typeof window !== "undefined") {
            localStorage.setItem("nomadix_theme", enabled ? "dark" : "light");
            // Also sync to general preferences
            try {
                const raw = localStorage.getItem("nomadix_general_preferences");
                const current = raw ? JSON.parse(raw) : {};
                localStorage.setItem(
                    "nomadix_general_preferences",
                    JSON.stringify({ ...current, darkMode: enabled })
                );
            } catch {
                // ignore
            }

            if (enabled) {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        }
    },
}));
