import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { LogOut, Shield, Settings, Check, AtSign, Globe, Palette, Moon, Sun, Monitor, Pipette, WandSparkles, Sparkles, Music, Volume2, VolumeX, Clock, Lock, Eye, EyeOff, ImageOff, KeyRound, Layout, Type, Square, Grid, Bell, BellOff, Smile } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTheme, type ThemePreset } from "@/components/theme-provider";
import TwemojiText from "@/components/TwemojiText";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { hashPin, verifyPin, APP_LOCK_HASH_KEY, APP_LOCK_SESSION_KEY, APP_LOCK_Q1_KEY, APP_LOCK_Q2_KEY, APP_LOCK_A1_HASH_KEY, APP_LOCK_A2_HASH_KEY, PREDEFINED_QUESTIONS, formatAnswer } from "@/lib/pin";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type MfaSetupState = {
    factorId: string;
    qrCode: string;
    secret: string;
    uri: string;
};

const buildQrImageSrc = (qrCode: string) => {
    const normalized = qrCode.trim();
    if (!normalized) return "";

    if (normalized.startsWith("data:image/")) return normalized;
    if (normalized.startsWith("<svg") || normalized.startsWith("<?xml")) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
    }

    const maybeBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(normalized);
    if (maybeBase64) {
        return `data:image/svg+xml;base64,${normalized.replace(/\s+/g, "")}`;
    }

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
};

const SettingsPage = () => {
    const { user, signOut, isAdmin, updateEmail, updatePassword, getLinkedIdentities } = useAuth();
    const { profile, changeUsername, getNextUsernameChangeDate, deleteAccount } = useProfile();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme, preset, color, customColor, font, radius, emojiPack, animateColor, cursorTrail, grid, dataSaver, soundEnabled, shadowWalk, setTheme, setPreset, setColor, setCustomColor, setFont, setRadius, setEmojiPack, setAnimateColor, setCursorTrail, setGrid, setDataSaver, setSoundEnabled, setShadowWalk } = useTheme();
    const pushNotifications = usePushNotifications();
    
    // Skeleton loader state
    const [isLoading, setIsLoading] = useState(true);

    const [mfaStatusLoading, setMfaStatusLoading] = useState(false);
    const [mfaStatusReady, setMfaStatusReady] = useState(false);
    const [mfaStatusError, setMfaStatusError] = useState<string | null>(null);
    const [mfaActionLoading, setMfaActionLoading] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
    const [mfaAalLevel, setMfaAalLevel] = useState<"aal1" | "aal2" | null>(null);
    const [mfaSetup, setMfaSetup] = useState<MfaSetupState | null>(null);
    const [mfaCode, setMfaCode] = useState("");

    const [newEmail, setNewEmail] = useState("");
    const [emailActionLoading, setEmailActionLoading] = useState(false);
    const [authSecurityLoading, setAuthSecurityLoading] = useState(false);
    const [authSecurityError, setAuthSecurityError] = useState<string | null>(null);
    const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
    const [accountPassword, setAccountPassword] = useState("");
    const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
    const [showAccountPassword, setShowAccountPassword] = useState(false);
    const [passwordActionLoading, setPasswordActionLoading] = useState(false);

    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "language" | "theme" | "appearance" | "data" | "audio" | "security" | "notifications" | "danger">("general");
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // App Lock state
    const [appLockEnabled, setAppLockEnabled] = useState(() => !!localStorage.getItem(APP_LOCK_HASH_KEY));
    const [pinStep, setPinStep] = useState<"idle" | "set-new" | "confirm-new" | "security-questions" | "verify-current" | "change-new" | "change-confirm">("idle");
    const [pinValue, setPinValue] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [pinError, setPinError] = useState<string | null>(null);
    const [pinSaving, setPinSaving] = useState(false);

    // Security Questions state
    const [q1, setQ1] = useState(PREDEFINED_QUESTIONS[0]);
    const [q2, setQ2] = useState(PREDEFINED_QUESTIONS[1]);
    const [a1, setA1] = useState("");
    const [a2, setA2] = useState("");

    const [dangerUnlockedSession, setDangerUnlockedSession] = useState(false);
    const [dangerTimeLeft, setDangerTimeLeft] = useState<number>(0);

    // Simulate initial skeleton loading
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    const getDangerLockTime = useCallback(() => {
        if (!user) return 0;
        const stored = localStorage.getItem(`genjutsu-danger-lock-${user.id}`);
        return stored ? parseInt(stored) : 0;
    }, [user]);

    const handleDangerClick = () => {
        if (!user) return;
        const lockedUntil = getDangerLockTime();
        if (Date.now() < lockedUntil) {
            setDangerUnlockedSession(false);
        } else {
            const newLock = Date.now() + 60 * 60 * 1000;
            localStorage.setItem(`genjutsu-danger-lock-${user.id}`, newLock.toString());
            setDangerUnlockedSession(true);
        }
        setActiveTab("danger");
    };

    useEffect(() => {
        if (activeTab !== "danger" || dangerUnlockedSession) return;
        
        const interval = setInterval(() => {
            const lockedUntil = getDangerLockTime();
            const diff = lockedUntil - Date.now();
            if (diff <= 0) {
                setDangerTimeLeft(0);
                clearInterval(interval);
            } else {
                setDangerTimeLeft(diff);
            }
        }, 1000);
        
        const initDiff = getDangerLockTime() - Date.now();
        setDangerTimeLeft(initDiff > 0 ? initDiff : 0);

        return () => clearInterval(interval);
    }, [activeTab, dangerUnlockedSession, getDangerLockTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (profile?.username) {
            setNewUsername(profile.username);
        }
    }, [profile?.username]);

    useEffect(() => {
        setNewEmail(user?.email ?? "");
    }, [user?.email]);

    useEffect(() => {
        if (!user) {
            navigate("/auth");
        }
    }, [user, navigate]);

    useEffect(() => {
        const fonts = ['Inter', 'Space Grotesk', 'Fira Code', 'JetBrains Mono', 'Comic Neue', 'Reddit Mono'];
        fonts.forEach(f => {
            const fontName = f.replace(/ /g, "+");
            const linkId = `preview-font-${fontName}`;
            if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
                document.head.appendChild(link);
            }
        });
    }, []);

    const validateUsername = (value: string): string | null => {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return "Username is required";
        if (normalized.length < 3) return "Must be at least 3 characters";
        if (normalized.length > 20) return "Must be 20 characters or less";
        if (!/^[a-z0-9_]+$/.test(normalized)) return "Only lowercase letters, numbers, and underscores";
        return null;
    };

    const handleUsernameChange = (value: string) => {
        const lower = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
        setNewUsername(lower);
        setUsernameError(validateUsername(lower));
    };

    const handleSaveUsername = async () => {
        const validationError = validateUsername(newUsername);
        if (validationError) {
            setUsernameError(validationError);
            return;
        }

        setIsSaving(true);
        const { error } = await changeUsername(newUsername);
        setIsSaving(false);

        if (error) {
            setUsernameError(error);
            toast.error(error);
        } else {
            setUsernameError(null);
            toast.success("Username updated!");
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            toast.success("Signed out successfully");
            navigate("/auth");
        } catch (error) {
            toast.error("Failed to sign out");
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== profile?.username) return;

        setIsDeleting(true);
        const { error } = await deleteAccount();
        setIsDeleting(false);

        if (error) {
            toast.error(error);
        } else {
            toast.success("Account permanently deleted");
            navigate("/auth");
        }
    };

    const handlePresetChange = (nextPreset: ThemePreset) => {
        setPreset(nextPreset);
        setAnimateColor(false);

        if (nextPreset === "default") {
            setColor("purple");
            setCustomColor("#8b5cf6");
            setFont("Inter");
            setRadius("default");
            setGrid("none");
            return;
        }

        if (nextPreset === "minecraft") {
            setColor("custom");
            setCustomColor("#6ea24a");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "win95") {
            setColor("custom");
            setCustomColor("#008080");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "papyrus") {
            setColor("custom");
            setCustomColor("#7c2d12");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "hackernews") {
            setColor("custom");
            setCustomColor("#ff6600");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "winxp") {
            setColor("custom");
            setCustomColor("#0055e5");
            setRadius("md");
            setGrid("none");
            return;
        }

        if (nextPreset === "gameboy") {
            setColor("custom");
            setCustomColor("#306230");
            setRadius("none");
            setGrid("none");
            return;
        }

        if (nextPreset === "nord") {
            setColor("custom");
            setCustomColor("#88c0d0");
            setRadius("md");
            setGrid("none");
            return;
        }

        if (nextPreset === "terminal") {
            setColor("custom");
            setCustomColor("#00ff41");
            setRadius("none");
            setGrid("scanlines");
            setFont("Reddit Mono");
        }
    };

    const loadMfaStatus = useCallback(async () => {
        if (!user) return;

        setMfaStatusLoading(true);
        setMfaStatusReady(false);
        setMfaStatusError(null);
        try {
            const [{ data: factorsData, error: factorsError }, { data: aalData, error: aalError }] = await Promise.all([
                supabase.auth.mfa.listFactors(),
                supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            ]);

            if (factorsError) throw factorsError;
            if (aalError) throw aalError;

            const totpFactor = factorsData?.totp?.[0] ?? null;
            setMfaFactorId(totpFactor?.id ?? null);
            setMfaAalLevel((aalData?.currentLevel as "aal1" | "aal2" | null) ?? null);
            setMfaStatusReady(true);
        } catch (error: any) {
            console.error("Failed to load MFA status:", error);
            toast.error("Couldn't load authenticator status.");
            setMfaStatusError("Couldn't load authenticator status.");
            setMfaFactorId(null);
            setMfaAalLevel(null);
        } finally {
            setMfaStatusLoading(false);
        }
    }, [user]);

    const loadAuthSecurityStatus = useCallback(async () => {
        if (!user) return;

        setAuthSecurityLoading(true);
        setAuthSecurityError(null);
        try {
            const { data, error } = await getLinkedIdentities();
            if (error) throw error;
            setLinkedProviders([...(new Set((data?.identities ?? []).map((identity) => identity.provider)))]);
        } catch (error: any) {
            console.error("Failed to load linked sign-in methods:", error);
            setAuthSecurityError("Couldn't load linked sign-in methods.");
            setLinkedProviders([]);
        } finally {
            setAuthSecurityLoading(false);
        }
    }, [getLinkedIdentities, user]);

    useEffect(() => {
        if (activeTab === "security") {
            void loadMfaStatus();
            void loadAuthSecurityStatus();
        }
    }, [activeTab, loadMfaStatus, loadAuthSecurityStatus]);

    const handleStartMfaSetup = async () => {
        if (!mfaStatusReady || mfaStatusLoading || mfaActionLoading || !!mfaSetup) return;
        if (mfaFactorId) {
            toast.message("Authenticator app is already enabled.");
            return;
        }

        setMfaActionLoading(true);
        try {
            const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError) throw listError;

            const staleUnverifiedTotp = (factorsData?.all ?? []).filter(
                (factor) => factor.factor_type === "totp" && factor.status === "unverified"
            );

            for (const factor of staleUnverifiedTotp) {
                const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
                if (error) {
                    console.warn("Failed to clean stale unverified MFA factor:", error.message);
                }
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "Genjutsu Authenticator",
            });

            if (error) throw error;
            if (!data?.totp?.qr_code) throw new Error("Authenticator setup data is missing.");

            setMfaSetup({
                factorId: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
                uri: data.totp.uri,
            });
            setMfaCode("");
            toast.success("Scan the QR code and enter your 6-digit code.");
        } catch (error: any) {
            console.error("Failed to start MFA setup:", error);
            toast.error(error?.message || "Couldn't start authenticator setup.");
        } finally {
            setMfaActionLoading(false);
        }
    };

    const handleCancelMfaSetup = async () => {
        if (!mfaSetup) return;

        setMfaActionLoading(true);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaSetup.factorId });
            if (error) throw error;
        } catch (error) {
            console.warn("Failed to clean up unverified MFA factor:", error);
        } finally {
            setMfaSetup(null);
            setMfaCode("");
            setMfaActionLoading(false);
        }
    };

    const handleVerifyMfaSetup = async () => {
        if (!mfaSetup || mfaCode.length !== 6) return;

        setMfaActionLoading(true);
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: mfaSetup.factorId,
                code: mfaCode,
            });

            if (error) throw error;

            toast.success("Authenticator app enabled.");
            setMfaSetup(null);
            setMfaCode("");
            await loadMfaStatus();
        } catch (error: any) {
            console.error("Failed to verify MFA setup:", error);
            toast.error(error?.message || "Invalid code. Please try again.");
        } finally {
            setMfaActionLoading(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!mfaStatusReady || mfaStatusLoading || !mfaFactorId) return;

        setMfaActionLoading(true);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
            if (error) throw error;

            toast.success("Authenticator app disabled.");
            setMfaFactorId(null);
            setMfaAalLevel("aal1");
            await loadMfaStatus();
        } catch (error: any) {
            console.error("Failed to disable MFA:", error);
            const message = String(error?.message || "").toLowerCase();
            if (message.includes("aal2")) {
                toast.error("Re-authenticate with 2FA before disabling it.");
            } else {
                toast.error(error?.message || "Couldn't disable authenticator.");
            }
        } finally {
            setMfaActionLoading(false);
        }
    };

    const validateEmail = (value: string): string | null => {
        const normalized = value.trim();
        if (!normalized) return "Email is required";
        if (normalized.length > 255) return "Email must be 255 characters or less";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return "Enter a valid email address";
        if (user?.email && normalized.toLowerCase() === user.email.toLowerCase()) return "Enter a different email address";
        return null;
    };

    const validateAccountPassword = (): string | null => {
        if (accountPassword.length < 6) return "Password must be at least 6 characters";
        if (accountPassword.length > 72) return "Password must be 72 characters or less";
        if (accountPassword !== accountPasswordConfirm) return "Passwords do not match";
        return null;
    };

    const handleUpdateEmail = async () => {
        const validationError = validateEmail(newEmail);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setEmailActionLoading(true);
        const { error } = await updateEmail(newEmail.trim());
        setEmailActionLoading(false);

        if (error) {
            const message = String(error.message || "").toLowerCase();
            if (message.includes("rate limit") || message.includes("too many requests")) {
                toast.error("Email change limit reached. Please try again later.");
            } else if (message.includes("already") || message.includes("exists")) {
                toast.error("That email is already in use. Try a different address.");
            } else {
                toast.error(error.message || "Couldn't start email change.");
            }
            return;
        }

        toast.success("Confirmation email sent. Check your new email, and your current email too if secure email change is enabled.");
    };

    const handleUpdateAccountPassword = async () => {
        const validationError = validateAccountPassword();
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setPasswordActionLoading(true);
        const { error } = await updatePassword(accountPassword);
        setPasswordActionLoading(false);

        if (error) {
            const message = String(error.message || "").toLowerCase();
            if (message.includes("rate limit") || message.includes("too many requests")) {
                toast.error("Password update limit reached. Please try again later.");
            } else if (message.includes("reauth") || message.includes("nonce") || message.includes("session")) {
                toast.error("Please sign in again, then retry the password update.");
            } else {
                toast.error(error.message || "Couldn't update password.");
            }
            return;
        }

        setAccountPassword("");
        setAccountPasswordConfirm("");
        toast.success(hasEmailIdentity ? "Password updated." : "Password added. You can now sign in with email and password.");
        await loadAuthSecurityStatus();
    };

    if (!user) {
        return null;
    }

    const metadataProviders = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers as string[] : [];
    const hasEmailIdentity = linkedProviders.includes("email") || user.app_metadata?.provider === "email" || metadataProviders.includes("email");
    const oauthProviders = (linkedProviders.length > 0 ? linkedProviders : metadataProviders).filter((provider) => provider === "google" || provider === "github");

    const isUsernameChanged = newUsername !== (profile?.username || "");
    const cooldownUntil = getNextUsernameChangeDate();
    const isOnCooldown = !!cooldownUntil;
    const canSave = isUsernameChanged && !usernameError && !isSaving && !isOnCooldown;

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
            <Helmet>
                <title>{t("settings.title")} — genjutsu</title>
            </Helmet>
            <Navbar />

            {/* Main Full-Screen Dashboard Container */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col overflow-hidden">
                {/* Modern Dashboard Header */}
                <div className="flex items-center justify-between pb-6 border-b border-border mb-6 shrink-0">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">{t("settings.title")}</h1>
                        <p className="text-sm text-muted-foreground mt-1">Manage your preferences, account security, and dashboard experience.</p>
                    </div>
                </div>

                {isLoading ? (
                    /* Refined Skeleton Loader State */
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 overflow-hidden pb-6">
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                <div key={i} className="h-10 w-full bg-muted/40 animate-pulse rounded-[3px]" />
                            ))}
                        </div>
                        <div className="space-y-6 overflow-y-auto pr-2">
                            <div className="gum-card p-6 space-y-4">
                                <div className="h-6 w-40 bg-muted/60 animate-pulse rounded-[3px]" />
                                <div className="h-20 w-full bg-muted/40 animate-pulse rounded-[3px]" />
                                <div className="h-10 w-32 bg-muted/60 animate-pulse rounded-[3px]" />
                            </div>
                            <div className="gum-card p-6 space-y-4">
                                <div className="h-6 w-48 bg-muted/60 animate-pulse rounded-[3px]" />
                                <div className="h-16 w-full bg-muted/40 animate-pulse rounded-[3px]" />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Dashboard Grid Content */
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 overflow-hidden pb-6">
                        {/* Sidebar Navigation */}
                        <aside className="space-y-1.5 overflow-y-auto pr-1 shrink-0">
                            <button
                                onClick={() => setActiveTab("general")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "general"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Settings size={18} />
                                {t("settings.general")}
                            </button>
                            <button
                                onClick={() => setActiveTab("notifications")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "notifications"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Bell size={18} />
                                Notifications
                            </button>
                            <button
                                onClick={() => setActiveTab("theme")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "theme"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Sparkles size={18} />
                                {t("nav.theme", "Theme")}
                            </button>
                            <button
                                onClick={() => setActiveTab("appearance")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "appearance"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Palette size={18} />
                                {t("settings.appearance", "Appearance")}
                            </button>
                            <button
                                onClick={() => setActiveTab("data")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "data"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <ImageOff size={18} />
                                Data Saving
                            </button>
                            <button
                                onClick={() => setActiveTab("audio")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "audio"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Music size={18} />
                                Sound
                            </button>
                            <button
                                onClick={() => setActiveTab("security")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "security"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <KeyRound size={18} />
                                Security
                            </button>
                            <button
                                onClick={() => setActiveTab("language")}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "language"
                                    ? "bg-primary text-primary-foreground gum-shadow-sm"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Globe size={18} />
                                {t("settings.language")}
                            </button>
                            <button
                                onClick={handleDangerClick}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[3px] text-sm font-semibold transition-all ${activeTab === "danger"
                                    ? "bg-destructive text-destructive-foreground gum-shadow-sm"
                                    : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                    }`}
                            >
                                <Shield size={18} />
                                {t("settings.dangerZone")}
                            </button>
                        </aside>

                        {/* Main Scrollable Content Area */}
                        <div className="overflow-y-auto pr-2 space-y-6">
                            <AnimatePresence mode="wait">
                                {activeTab === "general" && (
                                    <motion.div
                                        key="general"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-bold mb-4">{t("settings.account")}</h2>
                                                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-[3px] border border-border/50">
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("settings.signedInAs")}</p>
                                                        <p className="font-bold">{profile?.display_name || user.email}</p>
                                                        <p className="text-sm text-muted-foreground">@{profile?.username || "user"}</p>
                                                    </div>
                                                    <div className="w-12 h-12 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-lg overflow-hidden">
                                                        {profile?.avatar_url ? (
                                                            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
                                                        ) : (profile?.display_name?.[0] || "?")}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1">{t("settings.changeUsername")}</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.changeUsernameDesc")} <span className="font-mono text-foreground">genjutsu.xyz/u/{newUsername || "..."}</span>
                                                </p>
                                                {isOnCooldown && (
                                                    <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-[3px] text-sm">
                                                        <p className="font-bold text-destructive">🔒 {t("settings.usernameCooldown")}</p>
                                                        <p className="text-muted-foreground text-xs mt-1">
                                                            {t("settings.usernameCooldownDesc")}{" "}
                                                            <span className="font-mono text-foreground">
                                                                {cooldownUntil!.toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <div className="flex-1 relative">
                                                        <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            value={newUsername}
                                                            onChange={(e) => handleUsernameChange(e.target.value)}
                                                            maxLength={20}
                                                            disabled={isOnCooldown}
                                                            id="new-username"
                                                            name="username"
                                                            autoComplete="username"
                                                            className={`w-full pl-9 pr-4 py-2.5 bg-background border-2 rounded-[3px] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${usernameError
                                                                ? "border-destructive"
                                                                : isUsernameChanged && !usernameError
                                                                    ? "border-green-500"
                                                                    : "border-border"
                                                                }`}
                                                            placeholder={profile?.username || "username"}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleSaveUsername}
                                                        disabled={!canSave}
                                                        className="gum-btn bg-primary text-primary-foreground text-sm px-6 py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                                    >
                                                        {isSaving ? (
                                                            <FrogLoader size={16} className="" />
                                                        ) : (
                                                            <Check size={16} />
                                                        )}
                                                        {isSaving ? "Saving..." : "Save"}
                                                    </button>
                                                </div>
                                                {usernameError && (
                                                    <p className="text-xs text-destructive mt-2 font-medium">{usernameError}</p>
                                                )}
                                                {isUsernameChanged && !usernameError && (
                                                    <p className="text-xs text-green-500 mt-2 font-medium">Looks good!</p>
                                                )}
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1">{t("settings.exitSession")}</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.exitSessionDesc")}
                                                </p>
                                                <button
                                                    onClick={handleSignOut}
                                                    className="gum-btn border-2 border-foreground bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold w-full sm:w-auto"
                                                >
                                                    <LogOut size={18} />
                                                    {t("settings.logOut")}
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "language" && (
                                    <motion.div
                                        key="language"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-bold mb-1">{t("settings.language")}</h2>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {t("settings.languageDesc")}
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    {([
                                                        { code: 'en', label: 'English' },
                                                        { code: 'bn', label: 'বাংলা' },
                                                        { code: 'ja', label: '日本語' },
                                                        { code: 'fil', label: 'Tagalog' },
                                                        { code: 'hi', label: 'हिंदी' },
                                                        { code: 'es', label: 'Español' },
                                                        { code: 'pt', label: 'Português' },
                                                        { code: 'ko', label: '한국어' },
                                                        { code: 'ru', label: 'Русский' },
                                                    ]).map((lang) => (
                                                        <button
                                                            key={lang.code}
                                                            onClick={() => i18n.changeLanguage(lang.code)}
                                                            className={`gum-btn px-6 py-2.5 text-sm font-bold transition-colors ${i18n.language.startsWith(lang.code) ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                        >
                                                            {lang.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "theme" && (
                                    <motion.div
                                        key="theme"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Palette size={18} className="text-primary" /> Theme Presets</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Apply a complete look in one click, then fine-tune below.</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {([
                                                        { id: 'default', name: 'Default', desc: 'Current Genjutsu style' },
                                                        { id: 'minecraft', name: 'Minecraft', desc: 'Blocky earth tones and pixel-style mood' },
                                                        { id: 'win95', name: 'Windows 95', desc: 'Classic PC aesthetic with 3D beveled edges' },
                                                        { id: 'papyrus', name: 'Papyrus/Ink', desc: 'Old manuscript with parchment texture' },
                                                        { id: 'hackernews', name: 'Hacker News', desc: 'Classic orange accents on stark backgrounds' },
                                                        { id: 'winxp', name: 'Windows XP', desc: 'The legendary Luna aesthetic with blue gradients' },
                                                        { id: 'gameboy', name: 'GameBoy', desc: 'Retro 4-shade green dot matrix aesthetic' },
                                                        { id: 'nord', name: 'Nord', desc: 'Arctic blue and slate grey for calm focus' },
                                                        { id: 'terminal', name: 'Terminal', desc: 'Neon green matrix aesthetic with scanlines' },
                                                    ] as const).map((p) => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => handlePresetChange(p.id)}
                                                            className={`gum-btn text-left px-4 py-3 transition-all ${preset === p.id ? "bg-primary text-primary-foreground gum-shadow-sm" : "bg-background hover:bg-secondary text-foreground"}`}
                                                        >
                                                            <p className="font-bold text-sm">{p.name}</p>
                                                            <p className={`text-xs mt-1 ${preset === p.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{p.desc}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Layout size={18} className="text-primary" /> Theme Mode</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Choose how you experience the illusion.</p>
                                                <div className="flex flex-wrap gap-3">
                                                    {(["light", "dark", "system"] as const).map((m) => (
                                                        <button 
                                                            key={m}
                                                            onClick={() => setTheme(m)}
                                                            className={`gum-btn px-6 py-2.5 text-sm font-bold flex items-center gap-2 capitalize transition-all ${theme === m ? 'bg-primary text-primary-foreground gum-shadow-sm scale-105' : 'bg-background hover:bg-secondary border-border/50 text-foreground'}`}
                                                        >
                                                            {m === "light" && <Sun size={16}/>}
                                                            {m === "dark" && <Moon size={16}/>}
                                                            {m === "system" && <Monitor size={16}/>}
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "appearance" && (
                                    <motion.div
                                        key="appearance"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Pipette size={18} className="text-primary" /> Aura Color</h2>
                                                        <p className="text-sm text-muted-foreground">Select the primary resonance of your spells.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setAnimateColor(!animateColor)}
                                                        className={`gum-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${animateColor ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                    >
                                                        <span className={`inline-block ${animateColor ? 'animate-spin-slow' : ''}`}>🌈</span>
                                                        {animateColor ? 'Animated' : 'Animate'}
                                                    </button>
                                                </div>
                                                <div className={`flex flex-wrap gap-3 transition-opacity ${animateColor ? 'opacity-40 pointer-events-none' : ''}`}>
                                                    {(['purple', 'blue', 'green', 'orange', 'rose', 'zinc'] as const).map((c) => (
                                                        <button 
                                                            key={c}
                                                            onClick={() => setColor(c)}
                                                            className={`w-12 h-12 rounded-full border-4 transition-all flex items-center justify-center ${color === c ? 'border-primary/50 shadow-lg scale-110 shadow-primary/20' : 'border-transparent hover:scale-105'}`}
                                                            style={{
                                                                backgroundColor: `hsl(${
                                                                    c === 'purple' ? '270 30% 63%' :
                                                                    c === 'blue' ? '220 70% 50%' :
                                                                    c === 'green' ? '142 60% 45%' :
                                                                    c === 'orange' ? '24 85% 55%' :
                                                                    c === 'rose' ? '346 80% 60%' :
                                                                    '240 5% 50%'
                                                                })`
                                                            }}
                                                        >
                                                            {color === c && <Check size={20} className="text-primary-foreground" />}
                                                        </button>
                                                    ))}
                                                    <label
                                                        className={`w-12 h-12 rounded-full border-4 transition-all flex items-center justify-center cursor-pointer overflow-hidden relative group ${color === 'custom' ? 'border-primary/50 shadow-lg scale-110 shadow-primary/20' : 'border-border/30 hover:border-border/60 bg-muted hover:bg-secondary border-dashed'}`}
                                                        style={color === 'custom' ? { backgroundColor: customColor } : undefined}
                                                        title="Pick custom color"
                                                    >
                                                        {color === 'custom' ? (
                                                            <Check size={20} className="text-white drop-shadow" />
                                                        ) : (
                                                            <Palette size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                                        )}
                                                        <input
                                                            type="color"
                                                            value={customColor}
                                                            onChange={(e) => {
                                                                setCustomColor(e.target.value);
                                                                setColor('custom');
                                                            }}
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                            aria-label="Custom primary color"
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-border">
                                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Type size={18} className="text-primary" /> Typography</h2>
                                                <p className="text-sm text-muted-foreground mb-4">Set the textual vibe of the illusion.</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {(['Inter', 'Space Grotesk', 'Fira Code', 'JetBrains Mono', 'Comic Neue', 'Reddit Mono'] as const).map((f) => (
                                                        <button 
                                                            key={f}
                                                            onClick={() => setFont(f)}
                                                            className={`gum-btn px-4 py-3 text-sm font-bold truncate transition-colors ${font === f ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground'}`}
                                                        >
                                                            {f}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "data" && (
                                    <motion.div
                                        key="data"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                                                    <ImageOff className={dataSaver ? "text-primary" : "text-muted-foreground"} />
                                                    Data Saving
                                                </h2>
                                                <p className="text-sm text-muted-foreground">Control how media loads to reduce data usage.</p>
                                            </div>

                                            <div className="flex items-start justify-between gap-4 rounded-[3px] border border-border bg-secondary/30 p-4">
                                                <div className="pr-0 sm:pr-4">
                                                    <h3 className="font-bold mb-1">Manual Image Loading</h3>
                                                    <p className="text-sm text-muted-foreground">Blocks auto-loading for remote images. Tap each image to load it manually.</p>
                                                </div>
                                                <button
                                                    onClick={() => setDataSaver(!dataSaver)}
                                                    className={`gum-btn px-4 py-2 text-sm font-bold shrink-0 transition-all ${dataSaver ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground border-2 border-border'}`}
                                                >
                                                    {dataSaver ? 'Enabled' : 'Disabled'}
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "audio" && (
                                    <motion.div
                                        key="audio"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                    <Music className="text-primary" />
                                                    Audio & SFX
                                                </h2>
                                                <div className="flex items-start justify-between bg-secondary/30 p-4 rounded-[3px] border border-border">
                                                    <div className="pr-4">
                                                        <h3 className="font-bold mb-1 flex items-center gap-2">
                                                            {soundEnabled ? <Volume2 size={18} className="text-primary" /> : <VolumeX size={18} className="text-muted-foreground" />}
                                                            {soundEnabled ? "Audio Engine Enabled" : "Audio Engine Muted"}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">Synthesize responsive sound effects directly from your browser.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSoundEnabled(!soundEnabled)}
                                                        className={`gum-btn shrink-0 w-20 h-10 text-sm font-bold transition-all ${soundEnabled ? 'bg-primary text-primary-foreground gum-shadow-sm' : 'bg-background hover:bg-secondary text-foreground border-2 border-border'}`}
                                                    >
                                                        {soundEnabled ? "ON" : "OFF"}
                                                    </button>
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "security" && (
                                    <motion.div
                                        key="security"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                    <KeyRound className="text-primary" />
                                                    Security
                                                </h2>

                                                <div className="bg-secondary/30 p-4 rounded-[3px] border border-border space-y-4">
                                                    <div>
                                                        <h3 className="font-bold mb-1 flex items-center gap-2">
                                                            <AtSign size={18} className="text-primary" />
                                                            Email Address
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">Change the email used for sign-in and account notifications.</p>
                                                    </div>
                                                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                                        <input
                                                            type="email"
                                                            value={newEmail}
                                                            onChange={(e) => setNewEmail(e.target.value)}
                                                            className="w-full px-4 py-3 bg-background gum-border rounded-[3px] text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                            placeholder={user.email ?? "you@dev.com"}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleUpdateEmail}
                                                            disabled={emailActionLoading || !newEmail.trim()}
                                                            className="gum-btn bg-primary text-primary-foreground px-4 py-3 text-sm font-bold disabled:opacity-50"
                                                        >
                                                            {emailActionLoading ? <FrogLoader size={16} /> : "Change Email"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "notifications" && (
                                    <motion.div
                                        key="notifications"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6 space-y-6">
                                            <div>
                                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                                    <Bell className="text-primary" />
                                                    Push Notifications
                                                </h2>
                                                <div className="flex flex-col sm:flex-row items-start justify-between bg-secondary/30 p-4 rounded-[3px] border border-border gap-4">
                                                    <div>
                                                        <h3 className="font-bold mb-2 flex items-center gap-2">
                                                            {pushNotifications.isSubscribed ? <Bell size={18} className="text-primary" /> : <BellOff size={18} className="text-muted-foreground" />}
                                                            {pushNotifications.isSubscribed ? "Notifications Enabled" : "Notifications Disabled"}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">Get instantly notified when you receive a new whisper or engagement.</p>
                                                    </div>
                                                    {pushNotifications.isSupported && pushNotifications.permission !== "denied" && (
                                                        <button
                                                            onClick={async () => {
                                                                const { error } = await pushNotifications.toggle();
                                                                if (error) {
                                                                    toast.error(error);
                                                                } else {
                                                                    toast.success(pushNotifications.isSubscribed ? "Push notifications disabled" : "Push notifications enabled!");
                                                                }
                                                            }}
                                                            disabled={pushNotifications.loading}
                                                            className={`gum-btn shrink-0 w-full sm:w-28 h-10 flex items-center justify-center text-sm font-bold ${pushNotifications.isSubscribed ? 'bg-background hover:bg-secondary text-foreground border-2 border-border' : 'bg-primary text-primary-foreground gum-shadow-sm'}`}
                                                        >
                                                            {pushNotifications.loading ? <FrogLoader size={16} /> : pushNotifications.isSubscribed ? "Disable" : "Enable"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {activeTab === "danger" && dangerUnlockedSession && (
                                    <motion.div
                                        key="danger"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >
                                        <section className="gum-card p-6">
                                            <h2 className="text-lg font-bold mb-2 text-destructive uppercase tracking-tight">{t("settings.dangerZone")}</h2>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                {t("settings.dangerZoneDesc")}
                                            </p>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <button className="gum-btn bg-destructive hover:bg-destructive/90 text-white w-full sm:w-auto font-bold flex items-center justify-center gap-2">
                                                        <Shield size={18} className="animate-pulse" />
                                                        {t("settings.exterminateAccount")}
                                                    </button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="gum-card border-destructive/50">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                                            <Shield size={20} />
                                                            {t("settings.areYouSure")}
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription asChild className="space-y-3">
                                                            <div>
                                                                <p>{t("settings.deleteConfirmDesc")} <span className="font-mono font-bold text-foreground">@{profile?.username}</span></p>
                                                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[3px]">
                                                                    <input
                                                                        type="text"
                                                                        autoFocus
                                                                        placeholder={profile?.username}
                                                                        className="w-full bg-background border-2 border-destructive/30 rounded-[3px] px-3 py-2 text-sm font-mono focus:outline-none focus:border-destructive"
                                                                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="rounded-[3px]">{t("settings.cancel")}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            disabled={deleteConfirmation !== profile?.username || isDeleting}
                                                            onClick={handleDeleteAccount}
                                                            className="bg-destructive text-white hover:bg-destructive/90 rounded-[3px] font-bold"
                                                        >
                                                            {isDeleting ? <FrogLoader size={16} className=" mr-2" /> : null}
                                                            {t("settings.finalDestruction")}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </section>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <p className="text-center text-xs text-muted-foreground pt-4 pb-2">
                                Katchapp — Make friends with interesting people.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SettingsPage;