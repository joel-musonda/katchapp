import { StrangerChat } from "@/components/stranger/StrangerChat";
import { UsersRound, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ModeToggle";
import { Helmet } from "react-helmet-async";

const StrangerPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Stranger — katchapp</title>
        <meta name="description" content="Meet fellow developers securely and entirely anonymously via real-time WebSockets." />
      </Helmet>
      <div className="flex flex-col h-[100dvh] w-full animate-in fade-in zoom-in-95 duration-500 bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors">
        <div className="flex-1 w-full max-w-6xl mx-auto p-3 sm:p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4 px-1 relative shrink-0">
            <button 
              onClick={() => navigate(-1)}
              className="flex relative z-10 items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all shadow-sm w-fit"
              title="Go back"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <h1 className="flex-1 flex justify-center text-lg sm:text-xl font-bold tracking-tight items-center gap-2 whitespace-nowrap overflow-hidden text-zinc-900 dark:text-zinc-100">
              <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 text-sky-500 shadow-sm hidden sm:flex">
                <UsersRound size={18} />
              </div>
              <span className="truncate">Stranger</span>
            </h1>

            <div className="relative z-10">
              <ModeToggle />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <StrangerChat />
          </div>
        </div>
      </div>
    </>
  );
};

export default StrangerPage;