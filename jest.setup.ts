import "@testing-library/jest-dom";

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;

if (!window.matchMedia) {
    window.matchMedia = () =>
        ({
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList;
}
