import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
}

export default function LoadingSpinner({
  text,
  className,
  size = "md",
  fullPage = false,
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        <div className={cn(
          "rounded-full border-2 border-muted-foreground/20",
          size === "sm" ? "h-8 w-8" : size === "md" ? "h-12 w-12" : "h-16 w-16"
        )} />
        <Loader2
          className={cn(
            "animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            sizeMap[size]
          )}
        />
      </div>
      {text && (
        <p className="font-body text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {content}
      </div>
    );
  }

  return <div className="py-12 flex items-center justify-center">{content}</div>;
}