import {
    RESERVED_USERNAMES,
    USERNAME_PATTERN,
    formatFriendCode,
    formatFriendHandle,
    friendInitials,
    friendshipStatusLabel,
    groupFriendSummaries,
    isValidFriendCode,
    normalizeFriendCode,
    normalizeUsername,
    usernameCooldownDaysRemaining,
    validateUsername,
} from "@/lib/social";
import type { FriendSummary } from "@/types";

function makeFriend(overrides: Partial<FriendSummary> = {}): FriendSummary {
    return {
        friendship_id: "f1",
        friend_id: "u1",
        username: "alice",
        full_name: "Alice Nomad",
        avatar_url: null,
        status: "accepted",
        direction: "mutual",
        since: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

describe("USERNAME_PATTERN / validateUsername", () => {
    it("accepts lowercase letters, digits and underscore, 3-20 chars", () => {
        expect(USERNAME_PATTERN.test("chrizz")).toBe(true);
        expect(USERNAME_PATTERN.test("chris_99")).toBe(true);
        expect(validateUsername("chrizz")).toBeNull();
    });

    it("rejects too short, too long, uppercase and invalid characters", () => {
        expect(validateUsername("ab")).not.toBeNull();
        expect(validateUsername("a".repeat(21))).not.toBeNull();
        expect(USERNAME_PATTERN.test("Chris")).toBe(false);
        expect(USERNAME_PATTERN.test("chris-99")).toBe(false);
        expect(USERNAME_PATTERN.test("chris 99")).toBe(false);
    });

    it("normalizes case and whitespace before validating", () => {
        expect(normalizeUsername("  Chrizz  ")).toBe("chrizz");
        expect(validateUsername("  Chrizz  ")).toBeNull();
    });

    it("rejects every reserved word, mirroring nomadix_set_username()", () => {
        for (const word of RESERVED_USERNAMES) {
            expect(validateUsername(word)).not.toBeNull();
        }
    });
});

describe("usernameCooldownDaysRemaining", () => {
    it("returns 0 when the username was never changed", () => {
        expect(usernameCooldownDaysRemaining(null)).toBe(0);
    });

    it("returns 0 once 30 days have passed", () => {
        const now = new Date("2026-03-01T00:00:00Z");
        const changedAt = new Date("2026-01-01T00:00:00Z").toISOString();
        expect(usernameCooldownDaysRemaining(changedAt, now)).toBe(0);
    });

    it("returns the days left within the 30-day window", () => {
        const now = new Date("2026-01-05T00:00:00Z");
        const changedAt = new Date("2026-01-01T00:00:00Z").toISOString();
        // 30 - 4 = 26 days left
        expect(usernameCooldownDaysRemaining(changedAt, now)).toBe(26);
    });
});

describe("FRIEND_CODE_PATTERN / isValidFriendCode / normalizeFriendCode", () => {
    it("accepts the NMDX-XXXX shape, case-insensitively", () => {
        expect(isValidFriendCode("NMDX-4F2K")).toBe(true);
        expect(isValidFriendCode("nmdx-4f2k")).toBe(true);
        expect(normalizeFriendCode(" nmdx-4f2k ")).toBe("NMDX-4F2K");
    });

    it("rejects the excluded ambiguous characters I, O, 0, 1", () => {
        expect(isValidFriendCode("NMDX-I0O1")).toBe(false);
    });

    it("rejects malformed shapes", () => {
        expect(isValidFriendCode("NMDX-4F2")).toBe(false);
        expect(isValidFriendCode("4F2K")).toBe(false);
        expect(isValidFriendCode("NMDX4F2K")).toBe(false);
    });

    it("formatFriendCode is the same normalization as normalizeFriendCode", () => {
        expect(formatFriendCode("nmdx-4f2k")).toBe(normalizeFriendCode("nmdx-4f2k"));
    });
});

describe("formatFriendHandle / friendInitials", () => {
    it("prefers @username over full name", () => {
        expect(formatFriendHandle({ username: "alice", full_name: "Alice Nomad" })).toBe("@alice");
    });

    it("falls back to full name when there is no username", () => {
        expect(formatFriendHandle({ username: null, full_name: "Alice Nomad" })).toBe("Alice Nomad");
    });

    it("falls back to a generic label when both are empty", () => {
        expect(formatFriendHandle({ username: null, full_name: "" })).toBe("Nomad");
    });

    it("derives initials from first + last name", () => {
        expect(friendInitials("Alice Nomad")).toBe("AN");
        expect(friendInitials("Cher")).toBe("CH");
        expect(friendInitials("  ")).toBe("?");
    });
});

describe("groupFriendSummaries", () => {
    it("splits pending requests by direction and keeps only accepted as friends", () => {
        const rows: FriendSummary[] = [
            makeFriend({ friendship_id: "1", status: "pending", direction: "incoming" }),
            makeFriend({ friendship_id: "2", status: "pending", direction: "outgoing" }),
            makeFriend({ friendship_id: "3", status: "accepted", direction: "mutual" }),
            // blocked/declined rows must never surface in any group
            makeFriend({ friendship_id: "4", status: "blocked", direction: "mutual" }),
        ];

        const groups = groupFriendSummaries(rows);
        expect(groups.incomingRequests.map((r) => r.friendship_id)).toEqual(["1"]);
        expect(groups.outgoingRequests.map((r) => r.friendship_id)).toEqual(["2"]);
        expect(groups.friends.map((r) => r.friendship_id)).toEqual(["3"]);
    });
});

describe("friendshipStatusLabel", () => {
    it("maps every (status, direction) pair to the right badge", () => {
        expect(friendshipStatusLabel("none")).toBe("none");
        expect(friendshipStatusLabel("accepted")).toBe("friends");
        expect(friendshipStatusLabel("blocked")).toBe("blocked");
        expect(friendshipStatusLabel("pending", "incoming")).toBe("pending_incoming");
        expect(friendshipStatusLabel("pending", "outgoing")).toBe("pending_outgoing");
        expect(friendshipStatusLabel("declined")).toBe("none");
    });
});
