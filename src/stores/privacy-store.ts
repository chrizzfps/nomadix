import { create } from "zustand";

interface PrivacyState {
    isPrivacyMode: boolean;
    togglePrivacy: () => void;
    setPrivacyMode: (value: boolean) => void;
}

export const usePrivacyStore = create<PrivacyState>((set) => ({
    isPrivacyMode: false,
    togglePrivacy: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
    setPrivacyMode: (value) => set({ isPrivacyMode: value }),
}));
