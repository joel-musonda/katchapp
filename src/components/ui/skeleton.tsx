import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[3px] bg-secondary/80", className)}
      {...props}
    />
  );
}

const PostSkeleton = () => {
  return (
    <div className="gum-card p-5 mb-4 space-y-4">
      <div className="flex gap-3">
        <Skeleton className="w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="pt-4 border-t border-secondary flex gap-6">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-8" />
      </div>
    </div>
  );
};

export { Skeleton, PostSkeleton };
