import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-muted-foreground mb-3">
        {icon || <Inbox className="h-10 w-10" />}
      </div>
      <p className="font-body text-sm text-muted-foreground max-w-xs">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
