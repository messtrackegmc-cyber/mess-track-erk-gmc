import { cn } from "../../lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/10 bg-gray-200", className)}
      {...props}
    />
  )
}

export { Skeleton }
