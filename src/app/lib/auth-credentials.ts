import type { AuthUser } from "./auth-context";
import { getSellers } from "./mock-store";

interface CredentialRecord {
  otp: string; // demo OTP
  user: AuthUser;
}

/**
 * Phase 1 ships a fixed demo OTP for every account. In production the OTP is
 * generated server-side and delivered over the channel the seller signed in
 * with — SMS for a mobile number, email for an email ID.
 */
export const DEMO_OTP = "1234";

// Demo credentials keyed by mobile number. Each record's `user.email` doubles
// as that account's email login ID, so every persona below can sign in with
// either identifier. Phase 1 is UI-only.
export const DEMO_CREDENTIALS: Record<string, CredentialRecord> = {
  "9900000001": {
    otp: DEMO_OTP,
    user: {
      id: "admin-1",
      name: "Qwipo Super Admin",
      email: "admin@qwipo.com",
      role: "admin",
      avatarInitials: "SA",
      dataMode: "demo",
    },
  },
  // Empty-mode super admin — every master collection is wiped on login so
  // the UI shows its inception-day empty states (no sellers, companies,
  // brands, categories, etc.). Useful for screenshots / demos.
  "9999999999": {
    otp: DEMO_OTP,
    user: {
      id: "admin-empty",
      name: "Qwipo Demo (Empty)",
      email: "admin-empty@qwipo.com",
      role: "admin",
      avatarInitials: "QE",
      dataMode: "empty",
    },
  },
  // Maps to the replicated production roster — RM Traders (Chintha Raja
  // Mouli) carries real Lion Dates + Sri Gantasala beats, so the
  // seller-side demo has serviceability data.
  "9900000002": {
    otp: DEMO_OTP,
    user: {
      id: "seller-prod-rm-traders",
      name: "Chintha Raja Mouli",
      email: "prod-9246172889@qwipo.com",
      role: "seller",
      businessName: "RM Traders",
      avatarInitials: "RM",
      dataMode: "demo",
    },
  },
  // Empty-mode seller — every seller-side page renders its inception-day
  // empty state instead of the seeded mock data. Mirrors the empty super
  // admin login. Useful for screenshots and onboarding demos.
  "8888888888": {
    otp: DEMO_OTP,
    user: {
      id: "seller-empty",
      name: "Demo Seller (Empty)",
      email: "seller-empty@qwipo.com",
      role: "seller",
      businessName: "New Distributor",
      avatarInitials: "NS",
      dataMode: "empty",
    },
  },
  // Design system persona — lands on /design, a self-contained
  // handbook of every token + component + pattern in use. The
  // role exists so PMs, designers, and developers can hand each
  // other a single URL when discussing the design language
  // without seller chrome around it.
  "7777777777": {
    otp: DEMO_OTP,
    user: {
      id: "designer",
      name: "Design System",
      email: "design@qwipo.com",
      role: "designer",
      avatarInitials: "DS",
      dataMode: "demo",
    },
  },
};

// ---- Login identifier ----
// A seller signs in with EITHER a 10-digit Indian mobile number OR the email
// ID captured on their seller record. Everything below funnels the raw text
// the user typed through `detectIdentifier` first, so the rest of the module
// only ever deals with a normalised value.

export type IdentifierKind = "mobile" | "email" | "invalid";

export interface LoginIdentifier {
  kind: IdentifierKind;
  /** Normalised value — bare 10 digits for mobile, lower-cased for email. */
  value: string;
}

// Deliberately permissive: one @, a dot in the domain, no spaces. Anything
// stricter starts rejecting addresses that are perfectly legal in the wild.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim().toLowerCase());
}

/**
 * Strip a mobile number down to its bare 10 digits, tolerating the shapes
 * people actually type: "+91 98765 43210", "091-98765-43210", "9876543210".
 */
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidMobile(raw: string): boolean {
  return /^\d{10}$/.test(normalizeMobile(raw));
}

/**
 * Classify what the user typed. The "@" is the discriminator — an entry
 * containing one can only ever be an email attempt, so we report an
 * email-shaped error for it rather than complaining about digits.
 */
export function detectIdentifier(raw: string): LoginIdentifier {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid", value: "" };

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return { kind: EMAIL_RE.test(email) ? "email" : "invalid", value: email };
  }

  const mobile = normalizeMobile(trimmed);
  return {
    kind: /^\d{10}$/.test(mobile) ? "mobile" : "invalid",
    value: mobile,
  };
}

/** True once the identifier is well-formed enough to request an OTP. */
export function isCompleteIdentifier(raw: string): boolean {
  return detectIdentifier(raw).kind !== "invalid";
}

// ---- Account lookup ----

function initialsFor(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function findDemoRecord(id: LoginIdentifier): CredentialRecord | null {
  if (id.kind === "mobile") return DEMO_CREDENTIALS[id.value] ?? null;
  if (id.kind === "email") {
    return (
      Object.values(DEMO_CREDENTIALS).find(
        (r) => r.user.email.trim().toLowerCase() === id.value,
      ) ?? null
    );
  }
  return null;
}

/**
 * Sellers created through Super Admin → Add Seller carry a mobile number AND
 * an email ID, and both are login identifiers. Resolving them here is what
 * lets a freshly created seller sign in without a code change.
 */
function findSellerRecord(
  id: LoginIdentifier,
): { record: CredentialRecord; isActive: boolean } | null {
  const seller = getSellers().find((s) => {
    if (id.kind === "mobile") return normalizeMobile(s.phone ?? "") === id.value;
    if (id.kind === "email")
      return (s.email ?? "").trim().toLowerCase() === id.value;
    return false;
  });
  if (!seller) return null;

  return {
    isActive: seller.isActive !== false,
    record: {
      otp: DEMO_OTP,
      user: {
        id: seller.id,
        name: seller.name,
        email: seller.email ?? "",
        role: "seller",
        businessName: seller.businessName,
        avatarInitials: initialsFor(seller.businessName || seller.name),
        dataMode: "demo",
      },
    },
  };
}

export type LookupFailure = "invalid-identifier" | "not-found" | "inactive";

export type AccountLookup =
  | { ok: true; record: CredentialRecord }
  | { ok: false; reason: LookupFailure; message: string };

/**
 * Resolve a login identifier to an account. Demo personas win over the seller
 * roster so the fixed demo logins keep working even if a seller record is
 * later created with a clashing identifier.
 */
export function lookupAccount(rawIdentifier: string): AccountLookup {
  const id = detectIdentifier(rawIdentifier);
  if (id.kind === "invalid") {
    return {
      ok: false,
      reason: "invalid-identifier",
      message: rawIdentifier.includes("@")
        ? "Please enter a valid email ID."
        : "Please enter a valid 10-digit mobile number or an email ID.",
    };
  }

  const demo = findDemoRecord(id);
  if (demo) return { ok: true, record: demo };

  const seller = findSellerRecord(id);
  if (!seller) {
    return {
      ok: false,
      reason: "not-found",
      message:
        id.kind === "email"
          ? "No account found with this email ID."
          : "No account found with this mobile number.",
    };
  }
  if (!seller.isActive) {
    return {
      ok: false,
      reason: "inactive",
      message: "This account is inactive. Please contact Qwipo support.",
    };
  }
  return { ok: true, record: seller.record };
}

export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: LookupFailure | "wrong-otp"; message: string };

/**
 * Verify the OTP for whichever identifier the seller signed in with. The OTP
 * itself is channel-agnostic — the identifier only decides where it was sent.
 */
export function verifyOtp(rawIdentifier: string, otp: string): LoginResult {
  const lookup = lookupAccount(rawIdentifier);
  if (!lookup.ok) return lookup;
  if (lookup.record.otp !== otp.trim()) {
    return {
      ok: false,
      reason: "wrong-otp",
      message: "Invalid OTP. Please try again.",
    };
  }
  return { ok: true, user: lookup.record.user };
}
