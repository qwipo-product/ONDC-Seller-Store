import type { AuthUser } from "./auth-context";

interface CredentialRecord {
  otp: string; // demo OTP
  user: AuthUser;
}

// Demo credentials keyed by mobile number. Phase 1 is UI-only.
export const DEMO_CREDENTIALS: Record<string, CredentialRecord> = {
  "9900000001": {
    otp: "1234",
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
    otp: "1234",
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
    otp: "1234",
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
    otp: "1234",
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
    otp: "1234",
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

export function validateCredentials(
  mobile: string,
  otp: string,
): AuthUser | null {
  const key = mobile.trim().replace(/\D/g, ""); // strip non-digits
  const record = DEMO_CREDENTIALS[key];
  if (!record) return null;
  if (record.otp !== otp) return null;
  return record.user;
}
