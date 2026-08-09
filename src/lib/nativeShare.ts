export interface NativeSharePayload {
  title?: string;
  text?: string;
  url: string;
}

export type NativeShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareWithFallback(payload: NativeSharePayload): Promise<NativeShareResult> {
  if (typeof navigator === "undefined") return "failed";

  const canUseNativeShare =
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare({ url: payload.url }));

  if (canUseNativeShare) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    } catch (error: any) {
      // User dismissed native share sheet.
      if (error?.name === "AbortError") return "cancelled";
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(payload.url);
      return "copied";
    } catch {
      // Continue to failed result below.
    }
  }

  return "failed";
}
