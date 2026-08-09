import { Home, Search, User, LogOut, Settings, Palette, X, MessageCircle, UsersRound, LogIn, Bell, Shield, LayoutGrid, Inbox, Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/ModeToggle";
import { useState, useRef, useEffect } from "react";
import Sidebar from "./Sidebar";
import NotificationPanel from "./NotificationPanel";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnreadWhispers } from "@/hooks/useUnreadWhispers";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const notifRef = useRef<HTMLDivElement>(null);
  const { hasUnread: hasUnreadWhispers } = useUnreadWhispers();

  // Close notification panel on outside click
  useEffect(() => {
    if (!isNotifOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isNotifOpen]);

  // Prevent body scrolling when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isDrawerOpen]);

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-black/[0.06] shadow-xs"
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4">
          
          {/* Brand Logo */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 shrink-0 group md:justify-self-start focus:outline-none"
          >
            <div className="h-9 w-9 rounded-xl bg-black/5 flex items-center justify-center text-black font-bold text-lg transition-transform group-hover:scale-105">
              K
            </div>
            <span className="font-sans font-bold text-xl tracking-tight text-black">
              KatchApp
            </span>
          </motion.button>

          {/* Floating Glass Central Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-black/[0.03] p-1.5 rounded-full shadow-inner md:justify-self-center backdrop-blur-sm">
            {[
              { icon: Home, label: "Feed", path: "/" },
              { icon: Compass, label: "Explore", path: "/search" },
              { icon: MessageCircle, label: "Chats", path: "/whispers" },
              { icon: UsersRound, label: "Connect", path: "/stranger" },
            ].map(({ icon: Icon, label, path }) => {
              const active = location.pathname === path;
              return (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  key={path}
                  onClick={() => navigate(path)}
                  className={`relative h-9 flex items-center gap-2 px-4 rounded-full text-sm font-medium transition-all ${
                    active
                      ? "bg-white/80 dark:bg-white/10 text-black dark:text-white shadow-sm backdrop-blur-md font-semibold"
                      : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/[0.02]"
                  }`}
                >
                  <Icon size={16} className={active ? "text-black dark:text-white" : "text-black/60 dark:text-white/60"} />
                  <span>{label}</span>
                  {path === "/whispers" && hasUnreadWhispers && (
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse" />
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 md:justify-self-end">
            {!user && (
              <div className="hidden md:block">
                <ModeToggle />
              </div>
            )}

            {/* Mobile: Search button */}
            <button
              onClick={() => navigate("/search")}
              className="md:hidden p-2 rounded-full hover:bg-black/5 text-black transition-colors"
              title="Explore"
            >
              <Search size={18} />
            </button>

            {/* Mobile: Whispers button */}
            <button
              onClick={() => navigate("/whispers")}
              className="md:hidden relative p-2 rounded-full hover:bg-black/5 text-black transition-colors"
              title="Chats"
            >
              <MessageCircle size={18} />
              {hasUnreadWhispers && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-black animate-pulse" />
              )}
            </button>

            {/* Notification Bell */}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className={`relative p-2 rounded-full transition-all hover:bg-black/5 text-black ${
                    isNotifOpen ? "bg-black/5 text-black" : ""
                  }`}
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-xs">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-[360px] top-[60px] sm:top-full sm:mt-2 z-[80] bg-white dark:bg-zinc-900 shadow-2xl rounded-2xl overflow-hidden border border-black/5"
                    >
                      <NotificationPanel
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkAsRead={markAsRead}
                        onMarkAllAsRead={markAllAsRead}
                        onClose={() => setIsNotifOpen(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* User Profile Dropdown or Sign In */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 group rounded-full p-1 hover:bg-black/5 transition-all focus:outline-none">
                    <div className="hidden md:flex flex-col items-end pr-1">
                      <span className="text-sm font-semibold text-black group-hover:text-black leading-tight">{profile?.display_name || "Creator"}</span>
                      <span className="text-[11px] text-black/60 leading-tight">@{profile?.username || "user"}</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center font-bold text-xs text-black overflow-hidden transition-transform group-hover:scale-105">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
                      ) : initials}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl p-1 shadow-xl border border-black/5 bg-white dark:bg-zinc-900">
                  <div className="px-3 py-2 md:hidden border-b border-black/5 mb-1">
                    <p className="text-sm font-bold text-black dark:text-white truncate">{profile?.display_name}</p>
                    <p className="text-xs text-black/60 dark:text-white/60 truncate">@{profile?.username}</p>
                  </div>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer rounded-lg py-2 text-black dark:text-white">
                      <Shield className="mr-2 h-4 w-4 text-black/60 dark:text-white/60" />
                      <span>{t("nav.admin")}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      if (profile?.username) {
                        navigate(`/u/${profile.username}`);
                      }
                    }}
                    className={`cursor-pointer rounded-lg py-2 text-black dark:text-white ${!profile?.username ? 'opacity-50' : ''}`}
                    disabled={!profile?.username}
                  >
                    <User className="mr-2 h-4 w-4 text-black/60 dark:text-white/60" />
                    <span>{profile?.username ? t("nav.profile") : 'Loading...'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/qna-inbox")} className="cursor-pointer rounded-lg py-2 text-black dark:text-white">
                    <Inbox className="mr-2 h-4 w-4 text-black/60 dark:text-white/60" />
                    <span>Inbox</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer rounded-lg py-2 text-black dark:text-white">
                    <Settings className="mr-2 h-4 w-4 text-black/60 dark:text-white/60" />
                    <span>{t("nav.settings")}</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="my-1 bg-black/5" />
                  
                  <DropdownMenuItem onClick={(e) => e.preventDefault()} className="flex items-center justify-between py-2 rounded-lg focus:bg-transparent text-black dark:text-white">
                    <div className="flex items-center text-black/60 dark:text-white/60">
                      <Palette className="mr-2 h-4 w-4" />
                      <span>{t("nav.theme")}</span>
                    </div>
                    <ModeToggle />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="px-4 py-2 rounded-full bg-black text-white hover:bg-black/85 transition-colors text-sm font-medium flex items-center justify-center gap-2 shadow-xs whitespace-nowrap"
              >
                <LogIn size={16} />
                <span className="font-semibold">Sign In</span>
              </button>
            )}

            {/* Mobile: Menu button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="md:hidden p-2 rounded-full hover:bg-black/5 text-black transition-colors"
              title="Menu"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-[300px] bg-white dark:bg-zinc-900 z-[70] md:hidden overflow-y-auto shadow-2xl flex flex-col justify-between"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-5 border-b border-black/5 bg-black/[0.02]">
                  <span className="font-bold text-lg tracking-tight text-black dark:text-white">Menu</span>
                  <button 
                    onClick={() => setIsDrawerOpen(false)} 
                    className="p-2 hover:bg-black/5 rounded-full transition-colors text-black dark:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 space-y-6">
                  {/* User Profile Snippet */}
                  {user && profile && (
                    <button
                      onClick={() => { if (profile?.username) { navigate(`/u/${profile.username}`); setIsDrawerOpen(false); } }}
                      className="flex items-center gap-3 w-full hover:bg-black/5 rounded-xl p-2.5 -mx-2.5 transition-colors text-left"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/5 flex items-center justify-center font-bold text-sm text-black dark:text-white overflow-hidden shrink-0">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
                        ) : initials}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold truncate leading-tight text-black dark:text-white">{profile?.display_name}</p>
                        <p className="text-xs text-black/60 dark:text-white/60 truncate mt-0.5">@{profile?.username}</p>
                      </div>
                    </button>
                  )}

                  {/* NAVIGATE LINKS */}
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-black/40 dark:text-white/40 uppercase mb-2 px-1">Navigation</p>
                    <div className="space-y-1">
                      {[
                        { icon: Home, label: "Feed", path: "/" },
                        { icon: Compass, label: "Explore & Search", path: "/search" },
                        { icon: MessageCircle, label: "Chats", path: "/whispers" },
                        { icon: UsersRound, label: "Connect", path: "/stranger" },
                      ].map(({ icon: Icon, label, path }) => (
                        <button
                          key={path}
                          onClick={() => { navigate(path); setIsDrawerOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            location.pathname === path
                              ? "bg-black/5 dark:bg-white/10 text-black dark:text-white font-semibold"
                              : "hover:bg-black/5 text-black/80 dark:text-white/80"
                          }`}
                        >
                          <Icon size={18} className={location.pathname === path ? "text-black dark:text-white" : "text-black/60 dark:text-white/60"} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ACCOUNT LINKS */}
                  {user && (
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-black/40 dark:text-white/40 uppercase mb-2 px-1">Account</p>
                      <div className="space-y-1">
                        {isAdmin && (
                          <button
                            onClick={() => { navigate("/admin"); setIsDrawerOpen(false); }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors text-black dark:text-white"
                          >
                            <Shield size={18} className="text-black/60 dark:text-white/60" />
                            <span>{t("nav.admin")}</span>
                          </button>
                        )}
                        <button
                          onClick={() => { if (profile?.username) { navigate(`/u/${profile.username}`); setIsDrawerOpen(false); } }}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors text-black dark:text-white"
                        >
                          <User size={18} className="text-black/60 dark:text-white/60" />
                          <span>{t("nav.profile")}</span>
                        </button>
                        <button
                          onClick={() => { navigate("/settings"); setIsDrawerOpen(false); }}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors text-black dark:text-white"
                        >
                          <Settings size={18} className="text-black/60 dark:text-white/60" />
                          <span>{t("nav.settings")}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DISCOVERY SIDEBAR COMPONENT */}
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-black/40 dark:text-white/40 uppercase mb-2 px-1">Discover</p>
                    <Sidebar onAction={() => setIsDrawerOpen(false)} />
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-5 border-t border-black/5 flex items-center justify-between bg-black/[0.02]">
                <ModeToggle />
                {user && (
                  <button
                    onClick={() => { signOut(); setIsDrawerOpen(false); }}
                    className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"
                  >
                    <LogOut size={16} />
                    <span>{t("nav.signOut")}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;