import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Shield, Store, Phone, KeyRound, Palette } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { validateCredentials } from "../../lib/auth-credentials";
import qwipoLogo from "../../../imports/Qwipo_Secondary_Logo_for_Light_BG@4x-8.png";
import qwipoIcon from "../../../imports/Qwipo_Icon_Logo_for_Light_BG@4x-8.png";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Inline field-level errors. We keep popup toasts only for "successful
  // outcomes" (OTP sent, welcome) — anything the user can fix on the form
  // itself shows in red text below the relevant field.
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleSendOtp = () => {
    // Belt-and-braces: the input strips non-digits and the button is
    // disabled until length === 10, so we should never get here with
    // bad input — but keep the guard so a future caller change can't
    // sneak through.
    if (mobile.length !== 10) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
      toast.success("OTP sent to " + mobile);
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setOtpError("Please enter the 4-digit OTP");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const user = validateCredentials(mobile, otp);
      setIsLoading(false);
      if (!user) {
        setOtpError("Invalid OTP. Please try again.");
        setOtp("");
        return;
      }
      setOtpError(null);
      login(user);
      toast.success(`Welcome, ${user.name}!`);
      if (user.role === "admin") {
        navigate("/admin");
      } else if (user.role === "designer") {
        navigate("/design");
      } else {
        navigate("/");
      }
    }, 600);
  };

  const fillDemo = (
    role:
      | "admin"
      | "admin-empty"
      | "seller"
      | "seller-empty"
      | "designer",
  ) => {
    if (role === "admin") {
      setMobile("9900000001");
    } else if (role === "admin-empty") {
      setMobile("9999999999");
    } else if (role === "seller-empty") {
      setMobile("8888888888");
    } else if (role === "designer") {
      setMobile("7777777777");
    } else {
      setMobile("9900000002");
    }
    setOtp("1234");
    setOtpSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-32 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-blue-300/10 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Manage your
            <br />
            distribution business
            <br />
            smarter
          </h2>
          <p className="text-lg text-blue-100 max-w-md mb-8">
            Centralized catalog, real-time inventory sync, ONDC marketplace
            integration — all in one platform.
          </p>

          <div className="flex flex-wrap gap-3">
            {[
              "Catalog Sync",
              "ONDC Ready",
              "DMS Integration",
              "Real-time Inventory",
            ].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full bg-white/15 text-sm font-medium text-white/90 backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="flex gap-10 mt-12">
            <div>
              <p className="text-3xl font-bold">500+</p>
              <p className="text-sm text-blue-200">Brands</p>
            </div>
            <div>
              <p className="text-3xl font-bold">50K+</p>
              <p className="text-sm text-blue-200">Products</p>
            </div>
            <div>
              <p className="text-3xl font-bold">100%</p>
              <p className="text-sm text-blue-200">Verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src={qwipoLogo}
              alt="Qwipo"
              className="h-12 mx-auto mb-2 object-contain"
            />
            <p className="text-gray-500 text-sm">Seller Management Platform</p>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Sign in with your mobile number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {/* Mobile Number — strip non-digits and clamp to 10 chars
                    as the user types so the value is ALWAYS a length-10
                    digit string when valid. The Send OTP button below
                    gates on that exact length. */}
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter 10-digit mobile number"
                      value={mobile}
                      onChange={(e) =>
                        setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className="pl-10"
                      maxLength={10}
                      disabled={otpSent}
                      required
                    />
                  </div>
                </div>

                {/* OTP Section */}
                {!otpSent ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isLoading || mobile.length !== 10}
                    onClick={handleSendOtp}
                  >
                    {isLoading ? "Sending OTP..." : "Send OTP"}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="otp">Enter OTP</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="otp"
                          type="text"
                          placeholder="Enter 4-digit OTP"
                          value={otp}
                          onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, ""));
                            if (otpError) setOtpError(null);
                          }}
                          className="pl-10"
                          maxLength={4}
                          autoFocus
                          required
                          aria-invalid={!!otpError}
                        />
                      </div>
                      {otpError && (
                        <p className="text-xs text-red-600">{otpError}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          OTP sent to {mobile}
                        </p>
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          onClick={() => {
                            setOtpSent(false);
                            setOtp("");
                          }}
                        >
                          Change Number
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || otp.length !== 4}
                    >
                      {isLoading ? "Verifying..." : "Verify OTP"}
                    </Button>
                  </>
                )}
              </form>

              {/* Demo credentials */}
              <div className="mt-5 p-3 border border-blue-100 bg-blue-50/60 rounded-lg">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  Demo accounts — tap to autofill (OTP: 1234)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemo("admin")}
                    className="flex items-start gap-2 p-2 rounded-md bg-white border border-blue-200 hover:border-blue-400 transition-all text-left"
                  >
                    <Shield className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        Super Admin
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        9900000001
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo("admin-empty")}
                    className="flex items-start gap-2 p-2 rounded-md bg-white border border-amber-200 hover:border-amber-400 transition-all text-left"
                    title="Super admin with all empty data — useful to demo inception-day screens"
                  >
                    <Shield className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        Super Admin (Empty)
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        9999999999
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo("seller")}
                    className="flex items-start gap-2 p-2 rounded-md bg-white border border-blue-200 hover:border-blue-400 transition-all text-left"
                  >
                    <Store className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        Seller
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        9900000002
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo("seller-empty")}
                    className="flex items-start gap-2 p-2 rounded-md bg-white border border-amber-200 hover:border-amber-400 transition-all text-left"
                    title="Seller with all empty data — every seller-side page renders its inception-day empty state"
                  >
                    <Store className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        Seller (Empty)
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        8888888888
                      </p>
                    </div>
                  </button>
                  {/* Designer persona — single-page handbook of
                      every token + component + pattern. Spans both
                      grid columns so it stands apart from the live
                      product personas. */}
                  <button
                    type="button"
                    onClick={() => fillDemo("designer")}
                    className="col-span-2 flex items-start gap-2 p-2 rounded-md bg-white border border-fuchsia-200 hover:border-fuchsia-400 transition-all text-left"
                    title="Design System persona — handbook of every token, component, and pattern in the app"
                  >
                    <Palette className="h-4 w-4 text-fuchsia-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        Design System
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        7777777777 · design tokens + components + patterns
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-gray-500 mt-6">
            © 2026 Qwipo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
