import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo1.png";
import { API_URL } from "../api/config";
import { useAuth } from "../components/AuthContext";

function AppScaleLogo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center p-2.5 shadow-[0_14px_45px_rgba(0,0,0,0.22)] border-4 border-white/90 ring-4 ring-emerald-400/30">
        <img
          src={logo}
          alt="AppScale logo"
          className="w-full h-full object-contain filter-none"
          style={{ imageRendering: "-webkit-optimize-contrast" }}
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
        <span className="text-4xl font-black tracking-tight drop-shadow-md inline-block">
          <span className="text-white">App</span>
          <span className="text-emerald-300">Scale</span>
        </span>
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder, required, inputRef, error, id, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-white border rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all shadow-xs ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            : "border-slate-200 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        }`}
        {...props}
      />
    </div>
  );
}

function LoginCard({ emailInputRef }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [maskedRecipient, setMaskedRecipient] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpHasError, setOtpHasError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotMessageType, setForgotMessageType] = useState("info"); // 'error' | 'success' | 'info'
  const [accountStatus, setAccountStatus] = useState("idle"); // 'idle' | 'checking' | 'valid' | 'invalid'
  const [accountRole, setAccountRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpInputRefs = useRef([]);

  // Timers effect for OTP
  useEffect(() => {
    let cdTimer;
    let expTimer;
    if (resetStep === "otp") {
      if (resendCooldown > 0) {
        cdTimer = setInterval(() => {
          setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
      }
      if (expirySeconds > 0) {
        expTimer = setInterval(() => {
          setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
      }
    }
    return () => {
      clearInterval(cdTimer);
      clearInterval(expTimer);
    };
  }, [resetStep, resendCooldown, expirySeconds]);

  // Clear error and reset states when opening forgot password
  const openForgotPassword = () => {
    setShowForgotPassword(true);
    setResetStep("email");
    setForgotEmail(email.trim());
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpHasError(false);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotMessage("");
    setError("");
  };

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
    if (loading) return; // Prevent double submit
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
      // when the user explicitly opts into "remember me".
      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem("token", data.token);
      store.setItem("role", data.user.role);
      // Normalize and persist profile picture URL if provided
      const normalizedUser = { ...data.user };
      if (normalizedUser.profile_picture && typeof normalizedUser.profile_picture === 'string') {
        const pic = normalizedUser.profile_picture.trim();
        if (pic && !/^https?:\/\//i.test(pic) && pic.startsWith('/')) {
          normalizedUser.profile_picture = `${process.env.REACT_APP_API_BASE || API_URL}${pic}`;
        }
      }
      store.setItem("user", JSON.stringify(normalizedUser));
      if (setUser) setUser(normalizedUser);
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/bhw/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    setForgotMessage("");
    setError("");

    if (!forgotEmail.trim()) {
      setForgotMessageType("error");
      setForgotMessage("Please enter your registered email address.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          platform: "web",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setForgotMessageType("error");
        setForgotMessage(data.message || "Failed to send code.");
        return;
      }

      setForgotMessageType("success");
      setForgotMessage(data.message || "If this account exists, a verification code has been sent to your email.");
      setMaskedRecipient(data.masked_recipient || forgotEmail);
      setResetStep("otp");
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpHasError(false);
      setResendCooldown(60);
      setExpirySeconds(300);
      setTimeout(() => {
        if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
      }, 100);
    } catch (err) {
      setForgotMessageType("error");
      setForgotMessage(err.message || "Unable to send code. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (codeOverride) => {
    const code = codeOverride || otpDigits.join("");
    setForgotMessage("");

    if (!forgotEmail.trim() || code.length !== 6) {
      setForgotMessageType("error");
      setForgotMessage("Please enter the full 6-digit code.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: code, platform: "web" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOtpHasError(true);
        setForgotMessageType("error");
        setForgotMessage("Incorrect or expired code.");
        setTimeout(() => {
          setOtpDigits(["", "", "", "", "", ""]);
          setOtpHasError(false);
          if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
        }, 1200);
        return;
      }

      setResetToken(data.resetToken || "");
      setForgotMessage("");
      setResetStep("password");
    } catch (err) {
      setOtpHasError(true);
      setForgotMessageType("error");
      setForgotMessage("Incorrect or expired code.");
      setTimeout(() => {
        setOtpDigits(["", "", "", "", "", ""]);
        setOtpHasError(false);
        if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
      }, 1200);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
    // Handle paste of 6 digits
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length > 0) {
        const next = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          next[i] = digits[i] || "";
        }
        setOtpDigits(next);
        const nextIndex = Math.min(digits.length, 5);
        if (otpInputRefs.current[nextIndex]) {
          otpInputRefs.current[nextIndex].focus();
        }
        if (digits.length === 6) {
          handleVerifyOtp(digits.join(""));
        }
        return;
      }
    }

    const singleDigit = value.slice(-1).replace(/\D/g, "");
    const next = [...otpDigits];
    next[index] = singleDigit;
    setOtpDigits(next);

    if (singleDigit && index < 5) {
      if (otpInputRefs.current[index + 1]) {
        otpInputRefs.current[index + 1].focus();
      }
    }

    // Auto verify when 6th digit entered
    if (singleDigit && index === 5) {
      const completeCode = next.join("");
      if (completeCode.length === 6) {
        handleVerifyOtp(completeCode);
      }
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      if (otpInputRefs.current[index - 1]) {
        otpInputRefs.current[index - 1].focus();
      }
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotMessage("");
    setError("");

    if (!newPassword || !confirmPassword) {
      setForgotMessageType("error");
      setForgotMessage("Please fill in the new password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setForgotMessageType("error");
      setForgotMessage("New password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setForgotMessageType("error");
      setForgotMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotMessageType("error");
      setForgotMessage("Passwords do not match.");
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          newPassword,
          resetToken,
          platform: "web",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Password reset failed.");

      setForgotMessageType("success");
      setForgotMessage(data.message || "Your password has been changed successfully. You may now log in.");
      setForgotEmail("");
      setOtpDigits(["", "", "", "", "", ""]);
      setNewPassword("");
      setConfirmPassword("");
      setShowForgotPassword(false);
      setTimeout(() => {
        setForgotMessage("");
      }, 5000);
    } catch (err) {
      setForgotMessageType("error");
      setForgotMessage(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md rounded-[28px] border border-white/40 bg-white/95 p-7 shadow-[0_30px_80px_rgba(10,42,20,0.32)] backdrop-blur-xl sm:p-9 transition-all duration-300 hover:shadow-[0_35px_90px_rgba(10,42,20,0.40)]">
      {/* ── Top Navigation Bar (Back & Close buttons) for Forgot Password Modal ── */}
      {showForgotPassword ? (
        <div className="flex items-center justify-between mb-3 -mt-1">
          <button
            type="button"
            onClick={() => {
              setForgotMessage("");
              if (resetStep === "password") {
                setResetStep("otp");
              } else if (resetStep === "otp") {
                setResetStep("email");
              } else {
                setShowForgotPassword(false);
              }
            }}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-[#1b5e20] transition-all duration-200 border border-slate-200 shadow-xs active:scale-90"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>

          <span className="text-[11px] font-bold tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-full px-3 py-0.5">
            Step {resetStep === "email" ? "1" : resetStep === "otp" ? "2" : "3"} of 3
          </span>

          <button
            type="button"
            onClick={() => {
              setShowForgotPassword(false);
              setForgotMessage("");
            }}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200 border border-slate-200 shadow-xs active:scale-90"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      <div className={showForgotPassword ? "mb-4" : "mb-6"}>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          {showForgotPassword
            ? resetStep === "email"
              ? "Reset Password"
              : resetStep === "otp"
              ? "Verify Email Code"
              : "Set New Password"
            : "Welcome back!"}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          {showForgotPassword
            ? resetStep === "email"
              ? "Enter your registered email to receive your 6-digit verification code."
              : resetStep === "otp"
              ? <>We sent a 6-digit code to <span className="font-semibold text-slate-800">{maskedRecipient || forgotEmail}</span></>
              : "Create a new strong password for your account."
            : "Sign in to your account to continue"}
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-shake flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {forgotMessage && (!showForgotPassword || forgotMessageType === "error") && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
            forgotMessageType === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {forgotMessage}
        </div>
      )}

      {showForgotPassword ? (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* ── STEP 1: Email Address ── */}
          {resetStep === "email" && (
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Registered Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. softdev349@gmail.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading || !forgotEmail.trim()}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#1b5e20] py-3 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition-all hover:bg-[#154a1a] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forgotLoading ? (
                  <>
                    <svg className="w-4 h-4 appscale-spinner text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <span>Send Verification Code →</span>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 2: 6-Box OTP Entry ── */}
          {resetStep === "otp" && (
            <div className={`space-y-3.5 ${otpHasError ? "animate-shake" : ""}`}>
              {/* 6 Digit Inputs */}
              <div>
                <label className="mb-2 block text-center text-xs font-semibold text-slate-600">
                  Enter 6-Digit Code
                </label>
                <div className="flex justify-center gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(index, e)}
                      className={`w-10 h-12 sm:w-11 sm:h-12 text-center text-lg sm:text-xl font-bold rounded-xl border outline-none transition shadow-xs ${
                        otpHasError
                          ? "border-red-400 bg-red-50 text-red-700"
                          : digit
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white text-slate-900 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                      }`}
                    />
                  ))}
                </div>
                {otpHasError && (
                  <p className="mt-1.5 text-center text-xs font-semibold text-red-600">
                    Incorrect or expired code
                  </p>
                )}
              </div>

              {/* Timer info */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Code expires in{" "}
                  <strong className={expirySeconds <= 60 ? "text-red-600" : "text-slate-700"}>
                    {Math.floor(expirySeconds / 60).toString().padLeft ? String(Math.floor(expirySeconds / 60)).padStart(2, '0') : Math.floor(expirySeconds / 60)}:
                    {String(expirySeconds % 60).padStart(2, '0')}
                  </strong>
                </span>
              </div>

              {/* Actions */}
              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={forgotLoading || otpDigits.join("").length < 6}
                className="w-full rounded-2xl bg-[#1b5e20] py-3.5 text-xs font-bold text-white shadow-md shadow-green-900/20 transition hover:bg-[#154a1a] disabled:opacity-50"
              >
                {forgotLoading ? "Verifying…" : "Verify Code"}
              </button>

              <div className="flex flex-col items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={(e) => handleForgotPassword(e)}
                  disabled={forgotLoading || resendCooldown > 0}
                  className="text-xs font-semibold text-emerald-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: New Password ── */}
          {resetStep === "password" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                OTP verified! Please create a new strong password.
              </p>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Password Rules Checklist */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-[11px] space-y-1">
                <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                  <span>{newPassword.length >= 8 ? "✓" : "○"}</span>
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                  <span>{/[A-Z]/.test(newPassword) ? "✓" : "○"}</span>
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                  <span>{/[a-z]/.test(newPassword) ? "✓" : "○"}</span>
                  <span>At least one lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                  <span>{/[0-9]/.test(newPassword) ? "✓" : "○"}</span>
                  <span>At least one number (0-9)</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={
                  forgotLoading ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                className="w-full rounded-2xl bg-[#1b5e20] py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/20 transition hover:bg-[#154a1a] disabled:opacity-50"
              >
                {forgotLoading ? "Updating Password…" : "Save New Password & Sign In"}
              </button>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-5">
          <Input
            id="login-email"
            inputRef={emailInputRef}
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">
                Password <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetStep("email");
                  setForgotEmail(email.trim());
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
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
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
            aria-busy={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#2e7d32] py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition-all hover:bg-[#256427] active:bg-[#1b4d22] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[#2e7d32]"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 appscale-spinner text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  const emailInputRef = useRef(null);

  useEffect(() => {
    // Immediately autofocus email input field on mount
    setTimeout(() => emailInputRef.current?.focus(), 100);
  }, []);

  return (
    <>
      {/* ── Main Login View ── */}
      <div
        className="relative flex min-h-screen overflow-hidden bg-[#0a2315] opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(6,28,15,0.92), rgba(18,74,42,0.85), rgba(7,24,14,0.94)), url('https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1600&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-radial-[circle_at_top_left,_rgba(74,222,128,0.08)_0%,_transparent_50%]" />

        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/8 blur-3xl animate-orb-spin" />
        <div className="absolute -bottom-20 -right-20 h-112 w-md rounded-full bg-emerald-300/10 blur-3xl animate-float" />
        <div className="absolute left-1/3 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl animate-pulse" />

        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10 xl:px-20">
          {/* Staggered Entrance Left Column */}
          <div className="flex w-full max-w-xl flex-col items-center justify-center text-center lg:items-center lg:text-center">
            <div className="hidden lg:block animate-fade-up-1">
              <AppScaleLogo />
            </div>
            <div className="mt-8 max-w-lg">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white drop-shadow-xl xl:text-5xl animate-fade-up-1">
                Barangay Nutrition<br />
                <span className="animate-shimmer-text">Monitoring System</span>
              </h1>
              <hr className="mx-auto my-6 h-1 w-24 rounded-full border-0 bg-gradient-to-r from-emerald-400 to-green-200 shadow-sm animate-fade-up-2" />
              <p className="mx-auto max-w-md text-base leading-7 text-emerald-50/90 xl:text-lg animate-fade-up-2">
                Empowering Barangay health workers to monitor and improve the nutritional status of children and mothers in every community.
              </p>
            </div>
          </div>

          {/* Staggered Entrance Right Column */}
          <div className="relative mt-8 flex w-full max-w-lg flex-col items-center justify-center lg:mt-0">
            <div className="lg:hidden mb-8 animate-fade-up-1">
              <AppScaleLogo />
            </div>
            <div className="w-full animate-fade-up-3">
              <LoginCard emailInputRef={emailInputRef} />
            </div>
            <p className="mt-6 text-center text-xs font-semibold tracking-[0.18em] text-white/65 uppercase animate-fade-up-4 select-none">
              Municipality of Gasan — Health Information System
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
