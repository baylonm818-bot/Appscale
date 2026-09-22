import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { API_URL } from "../api/config";


function AppScaleLogo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-28 h-28 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-[0_18px_60px_rgba(0,0,0,0.18)] overflow-hidden border-4 border-white/70 ring-4 ring-white/20">
        <img
          src={logo}
          alt="AppScale logo"
          className="w-24 h-24 object-contain drop-shadow-md"
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentElement.innerHTML = `
              <div style="width:96px;height:96px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e8f5e9">
                <span style="font-size:32px;font-weight:700;color:#2e7d32">A</span>
              </div>`;
          }}
        />
      </div>
      <div className="text-center">
        <span className="text-4xl font-black tracking-tight drop-shadow-sm">
          <span className="text-white">App</span>
          <span className="text-emerald-100">Scale</span>
        </span>
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#2e7d32]/20 transition shadow-sm"
      />
    </div>
  );
}

function LoginCard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Load saved email on mount ──
  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    const savedRemember = localStorage.getItem("remember_me") === "true";
    if (savedRemember && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed.");

      // ── Handle Remember Me ──
      if (rememberMe) {
        localStorage.setItem("remembered_email", email.trim());
        localStorage.setItem("remember_me", "true");
      } else {
        localStorage.removeItem("remembered_email");
        localStorage.removeItem("remember_me");
      }

      // prefer sessionStorage by default (less persistent). Only use localStorage
      // when the user explicitly opts into "remember me". Consider using
      // HttpOnly secure cookies for production to mitigate XSS risks.
      if (rememberMe) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("role", data.user.role);
        sessionStorage.setItem("user", JSON.stringify(data.user));
      }
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/bhw/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMessage("");
    setError("");

    if (!forgotEmail.trim()) {
      setForgotMessage("Please enter the admin email.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Password reset failed.");

      setForgotMessage(data.message);
      setResetStep("otp");
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setForgotMessage(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setForgotMessage("");

    if (!forgotEmail.trim() || !otpCode.trim()) {
      setForgotMessage("Please enter the OTP sent to your email.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, otp: otpCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed.");

      setForgotMessage(data.message);
      setResetStep("password");
    } catch (err) {
      setForgotMessage(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotMessage("");
    setError("");

    if (!forgotEmail.trim() || !otpCode.trim()) {
      setForgotMessage("Please enter your email and OTP.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setForgotMessage("Please fill in the new password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setForgotMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotMessage("Passwords do not match.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Password reset failed.");

      setForgotMessage(data.message);
      setForgotEmail("");
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      setShowForgotPassword(false);
      setTimeout(() => {
        setForgotMessage("");
      }, 5000);
    } catch (err) {
      setForgotMessage(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-[28px] border border-white/40 bg-white/85 p-7 shadow-[0_30px_80px_rgba(10,42,20,0.28)] backdrop-blur-xl sm:p-9">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Welcome back!</h2>
        <p className="mt-2 text-sm text-slate-500">Sign in to your account to continue</p>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {forgotMessage && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {forgotMessage}
        </div>
      )}

      {showForgotPassword ? (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              {resetStep === "email" && "Forgot password"}
              {resetStep === "otp" && "Enter OTP"}
              {resetStep === "password" && "Change password"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setForgotMessage("");
              }}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          {resetStep === "email" && <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="Enter admin email"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>}

          {resetStep === "otp" && <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              OTP code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter 6-digit OTP"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>}

          {resetStep === "password" && <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              New password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter a new password"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>}

          {resetStep === "password" && <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>}

          {resetStep === "email" && <button
            type="button"
            onClick={handleForgotPassword}
            disabled={forgotLoading}
            className="w-full rounded-2xl bg-[#1b5e20] py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition hover:bg-[#154a1a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {forgotLoading ? "Sending…" : "Send OTP"}
          </button>}

          {resetStep === "otp" && <div className="flex gap-3">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgotLoading ? "Sending…" : "Resend OTP"}
            </button>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={forgotLoading}
              className="flex-1 rounded-2xl bg-[#1b5e20] py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition hover:bg-[#154a1a] active:bg-[#113d15] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgotLoading ? "Verifying…" : "Verify OTP"}
            </button>
          </div>}

          {resetStep === "password" && <button
            type="button"
            onClick={handleResetPassword}
            disabled={forgotLoading}
            className="w-full rounded-2xl bg-[#1b5e20] py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition hover:bg-[#154a1a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {forgotLoading ? "Changing…" : "Change password"}
          </button>}
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-5">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">
                Password <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetStep("email");
                  setForgotEmail("");
                  setOtpCode("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setForgotMessage("");
                  setError("");
                }}
                className="text-sm font-medium text-[#2e7d32] transition hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-16 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 transition hover:text-slate-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                rememberMe
                  ? "border-[#2e7d32] bg-[#2e7d32]"
                  : "border-slate-300 bg-white hover:border-[#2e7d32]"
              }`}
            >
              {rememberMe && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span
              className="cursor-pointer select-none text-sm text-slate-600"
              onClick={() => setRememberMe(!rememberMe)}
            >
              Remember me
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#2e7d32] py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition hover:bg-[#256427] active:bg-[#1b4d22] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-screen overflow-hidden bg-[#0f2b1b]"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(9,42,24,0.88), rgba(35,123,78,0.72), rgba(12,34,22,0.9)), url('https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1600&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_25%)]" />

      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/8 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-112 w-md rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="absolute left-1/3 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl" />

      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10 xl:px-20">
        <div className="flex w-full max-w-xl flex-col items-center justify-center text-center lg:items-center lg:text-center">
          <div className="hidden lg:block">
            <AppScaleLogo />
          </div>
          <div className="mt-8 max-w-lg">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-white drop-shadow-xl xl:text-5xl">
              Barangay Nutrition<br />Monitoring System
            </h1>
            <hr className="mx-auto my-6 h-px w-24 border-0 bg-white/30" />
            <p className="mx-auto max-w-md text-base leading-7 text-emerald-50/80 xl:text-lg">
              Empowering Barangay health workers to monitor and improve the nutritional status of children and mothers in every community.
            </p>
          </div>
        </div>

        <div className="relative mt-8 flex w-full max-w-lg flex-col items-center justify-center lg:mt-0">
          <div className="lg:hidden mb-8">
            <AppScaleLogo />
          </div>
          <LoginCard />
          <p className="mt-6 text-center text-xs tracking-[0.16em] text-white/55">
            MUNICIPALITY OF GASAN — HEALTH INFORMATION SYSTEM
          </p>
        </div>
      </div>
    </div>
  );
}
