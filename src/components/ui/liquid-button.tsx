import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const liquidButtonVariants = cva(
  "inline-flex items-center justify-center cursor-pointer gap-2 whitespace-nowrap rounded-2xl text-lg font-semibold transition-[color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/35",
  {
    variants: {
      variant: {
        default:
          "hover:scale-[1.02] active:scale-[0.98] duration-200",
        glass:
          "bg-transparent hover:bg-white/5 text-white border border-white/10 backdrop-blur-md",
        success:
          "hover:scale-[1.02] active:scale-[0.98] duration-200",
      },
      size: {
        default: "h-14 px-6 py-3",
        sm: "h-12 text-base px-5 py-2",
        lg: "h-16 text-xl px-8 py-4",
        icon: "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function LiquidButton({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof liquidButtonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const variantStyle: React.CSSProperties | undefined =
    variant === "default"
      ? {
          background: "var(--theme-accent)",
          color: "var(--theme-on-accent, #FFFFFF)",
          boxShadow:
            "0 0 6px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.16), inset 3px 3px 0.5px -3px rgba(0,0,0,0.9), inset -3px -3px 0.5px -3px rgba(0,0,0,0.85), inset 1px 1px 1px -0.5px rgba(0,0,0,0.6), inset -1px -1px 1px -0.5px rgba(0,0,0,0.6), inset 0 0 6px 6px rgba(0,0,0,0.12), inset 0 0 2px 2px rgba(0,0,0,0.06), 0 0 10px var(--theme-accent-soft)",
        }
      : variant === "success"
        ? {
            background: "var(--theme-success)",
            color: "var(--theme-on-accent, #FFFFFF)",
            boxShadow:
              "0 0 6px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.16), inset 3px 3px 0.5px -3px rgba(0,0,0,0.9), inset -3px -3px 0.5px -3px rgba(0,0,0,0.85), inset 1px 1px 1px -0.5px rgba(0,0,0,0.6), inset -1px -1px 1px -0.5px rgba(0,0,0,0.6), inset 0 0 6px 6px rgba(0,0,0,0.12), inset 0 0 2px 2px rgba(0,0,0,0.06), 0 0 10px var(--theme-success-soft)",
          }
        : undefined;

  return (
    <Comp
      data-slot="button"
      className={cn("relative", liquidButtonVariants({ variant, size, className }))}
      style={variantStyle}
      {...props}
    >
      <div className="pointer-events-none z-10">{children}</div>
    </Comp>
  );
}

export { LiquidButton, liquidButtonVariants };
