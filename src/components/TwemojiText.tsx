import { useEffect, useRef, type ReactNode } from "react";
import twemoji from "@twemoji/api";
import { useTheme, type EmojiPack } from "@/components/theme-provider";

type TwemojiTextProps = {
    children: ReactNode;
    className?: string;
    packOverride?: EmojiPack;
};

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/";
const GOOGLE_NOTO_BASE = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.034/svg/";
const OPENMOJI_BASE = "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@16.0.0/color/svg/";

const resolveEmojiAssetUrl = (icon: string, emojiPack: Exclude<EmojiPack, "native">) => {
    if (emojiPack === "twemoji") {
        return `${TWEMOJI_BASE}svg/${icon}.svg`;
    }

    if (emojiPack === "google") {
        const notoCode = icon.toLowerCase().replace(/-/g, "_");
        return `${GOOGLE_NOTO_BASE}emoji_u${notoCode}.svg`;
    }
    return `${OPENMOJI_BASE}${icon.toUpperCase()}.svg`;
};

const TwemojiText = ({ children, className, packOverride }: TwemojiTextProps) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const { emojiPack } = useTheme();
    const activePack = packOverride ?? emojiPack;

    useEffect(() => {
        if (!containerRef.current) return;
        if (activePack === "native") return;

        twemoji.parse(containerRef.current, {
            callback: (icon) => resolveEmojiAssetUrl(icon, activePack),
            className: "twemoji",
        });

        // Fallback gracefully to the original Unicode glyph if any remote asset fails.
        const emojiImages = containerRef.current.querySelectorAll<HTMLImageElement>("img.twemoji");
        emojiImages.forEach((img) => {
            img.addEventListener(
                "error",
                () => {
                    const fallbackText = img.getAttribute("alt") || "";
                    img.replaceWith(document.createTextNode(fallbackText));
                },
                { once: true }
            );
        });
    }, [children, activePack]);

    return (
        <span key={activePack} ref={containerRef} className={className}>
            {children}
        </span>
    );
};

export default TwemojiText;
