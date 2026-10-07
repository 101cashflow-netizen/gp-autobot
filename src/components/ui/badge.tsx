import { cn } from "@/lib/cn";
import type { PostStatus } from "@/lib/types";

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "bg-surface-2 text-muted-foreground",
  scheduled: "bg-warning/15 text-warning",
  posted: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  posted: "Publicado",
  failed: "Falhou",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({
  className,
  variant = "outline",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline" | "success" | "warning" | "destructive";
}) {
  const variantStyles = {
    default: "border-primary/20 bg-primary/10 text-primary",
    outline: "border-border bg-surface-2 text-muted-foreground",
    success: "border-emerald-500/20 bg-emerald-500/15 text-emerald-500",
    warning: "border-amber-500/20 bg-amber-500/15 text-amber-500",
    destructive: "border-destructive/20 bg-destructive/15 text-destructive",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant] ?? variantStyles.outline,
        className
      )}
      {...props}
    />
  );
}
