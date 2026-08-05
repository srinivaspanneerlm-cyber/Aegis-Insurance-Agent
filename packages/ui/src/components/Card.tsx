import { forwardRef, type HTMLAttributes } from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@aegis/utils";
import { cardVariants } from "../variants";

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, padding, interactive, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, interactive }), className)}
      {...props}
    />
  );
});

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-h4 text-content font-bold", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-body-sm text-content-muted", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex items-center gap-3", className)} {...props} />
);
