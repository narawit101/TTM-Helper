import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg" | "xl";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ring-1 ring-transparent",
    secondary: "bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-red-600 text-white shadow-sm ring-1 ring-transparent hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600",
};

const sizes: Record<ButtonSize, string> = {
    md: "px-4 py-2.5 text-sm font-medium rounded-xl",
    lg: "px-5 py-3 text-base font-semibold rounded-xl",
    xl: "px-6 py-4 text-lg font-bold rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "primary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
        const baseStyles = "relative inline-flex items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-70 disabled:cursor-not-allowed";

        // Simple class merge
        const classNames = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`.trim();

        return (
            <button
                ref={ref}
                disabled={isLoading || disabled}
                className={classNames}
                {...props}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center gap-1">
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
                <span className={`flex items-center justify-center gap-2 w-full ${isLoading ? "opacity-0 invisible" : ""}`}>{children}</span>
            </button>
        );
    }
);
Button.displayName = "Button";
