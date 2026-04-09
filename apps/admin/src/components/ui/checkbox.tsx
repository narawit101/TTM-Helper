import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className = "", label, id, ...props }, ref) => {
        const checkboxId = id || (label ? `checkbox-${label}` : undefined);
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <div className="relative flex items-center justify-center">
                    <input
                        type="checkbox"
                        id={checkboxId}
                        ref={ref}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-200 bg-white checked:border-slate-900 checked:bg-slate-900 focus:outline-none transition-all hover:border-slate-300 checked:hover:bg-slate-900 checked:hover:border-slate-900"
                        {...props}
                    />
                    <svg
                        className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                {label && (
                    <label htmlFor={checkboxId} className="text-sm font-semibold text-slate-700 cursor-pointer select-none hover:text-slate-900 transition-colors">
                        {label}
                    </label>
                )}
            </div>
        );
    }
);

Checkbox.displayName = "Checkbox";
