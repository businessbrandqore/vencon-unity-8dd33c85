import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BRANDING_CACHE_KEY = "vencon_ui_branding";
const FALLBACK_FAVICON = "/favicon.svg";

const setFaviconLink = (rel: string, href: string) => {
  let link = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }

  link.href = href;
};

const applyFavicon = (href: string) => {
  setFaviconLink("icon", href);
  setFaviconLink("shortcut icon", href);
  setFaviconLink("apple-touch-icon", href);
};

export const DynamicFavicon = () => {
  useEffect(() => {
    const cachedBranding = localStorage.getItem(BRANDING_CACHE_KEY);

    if (cachedBranding) {
      try {
        const parsed = JSON.parse(cachedBranding) as Record<string, string>;
        applyFavicon(parsed.favicon || parsed.company_logo || FALLBACK_FAVICON);
      } catch {
        applyFavicon(FALLBACK_FAVICON);
      }
    } else {
      applyFavicon(FALLBACK_FAVICON);
    }

    const loadFavicon = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "ui_config")
          .maybeSingle();

        const value = (data?.value as Record<string, string> | null) ?? null;
        if (!value) {
          applyFavicon(FALLBACK_FAVICON);
          return;
        }

        localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(value));
        applyFavicon(value.favicon || value.company_logo || FALLBACK_FAVICON);
      } catch {
        applyFavicon(FALLBACK_FAVICON);
      }
    };

    loadFavicon();
  }, []);

  return null;
};
