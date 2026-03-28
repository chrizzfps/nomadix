const nextJest = require("next/jest");

const createJestConfig = nextJest({
    dir: "./",
});

const customJestConfig = {
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testPathIgnorePatterns: [
        "<rootDir>/.next/",
        "<rootDir>/node_modules/",
        "<rootDir>/deploy-hostinger/",
    ],
    modulePathIgnorePatterns: [
        "<rootDir>/.next/",
        "<rootDir>/deploy-hostinger/",
    ],
    watchPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/deploy-hostinger/"],
};

module.exports = createJestConfig(customJestConfig);
