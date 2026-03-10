import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({ message, onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
      <p className="font-body text-sm text-muted-foreground max-w-xs mb-4">
        {message || "Something went wrong. Please try again."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
