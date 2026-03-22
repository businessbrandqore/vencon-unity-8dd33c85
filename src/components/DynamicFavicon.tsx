import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DynamicFavicon = () => {
  useEffect(() => {
    const loadFavicon = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "ui_config")
          .maybeSingle();

        if (data?.value) {
          const val = data.value as Record<string, string>;
          const faviconUrl = val.favicon || val.company_logo;
          if (faviconUrl) {
            const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
            if (link) {
              link.href = faviconUrl;
            } else {
              const newLink = document.createElement("link");
              newLink.rel = "icon";
              newLink.href = faviconUrl;
              document.head.appendChild(newLink);
            }
          }
        }
      } catch {}
    };
    loadFavicon();
  }, []);

  return null;
};
