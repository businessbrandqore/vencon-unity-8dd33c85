import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const MOOD_COLORS: Record<string, string> = {
  happy: "#22C55E",
  sad: "#3B82F6",
  excited: "#F59E0B",
  tired: "#8B5CF6",
  neutral: "#6B7280",
  angry: "#EF4444",
};

const MOOD_LABELS_BN: Record<string, string> = {
  happy: "😊 খুশি",
  sad: "😢 দুঃখী",
  excited: "🤩 উত্তেজিত",
  tired: "😴 ক্লান্ত",
  neutral: "😐 স্বাভাবিক",
  angry: "😠 রাগান্বিত",
};

const MOOD_LABELS_EN: Record<string, string> = {
  happy: "😊 Happy",
  sad: "😢 Sad",
  excited: "🤩 Excited",
  tired: "😴 Tired",
  neutral: "😐 Neutral",
  angry: "😠 Angry",
};

const HRMoodChart = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: rows } = await supabase
        .from("attendance")
        .select("mood_in")
        .eq("date", today)
        .not("mood_in", "is", null);

      if (!rows) return;

      const counts: Record<string, number> = {};
      rows.forEach((r) => {
        const mood = (r.mood_in || "neutral").toLowerCase();
        counts[mood] = (counts[mood] || 0) + 1;
      });

      const labels = isBn ? MOOD_LABELS_BN : MOOD_LABELS_EN;
      setData(
        Object.entries(counts).map(([mood, count]) => ({
          name: labels[mood] || mood,
          value: count,
          color: MOOD_COLORS[mood] || "#6B7280",
        }))
      );
    };
    fetch();
  }, [isBn]);

  return (
    <div className="bg-background border border-border p-4">
      <h3 className="font-heading text-sm font-bold text-foreground mb-3">
        {isBn ? "আজকের মুড সামারি" : "Today's Mood Summary"}
      </h3>
      {data.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground text-center py-8">
          {isBn ? "আজ কোনো মুড ডেটা নেই" : "No mood data today"}
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={30}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs font-body text-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HRMoodChart;
