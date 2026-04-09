"use client";

import { Icon } from "@iconify/react";
import { useState, useEffect, useRef } from "react";

export interface Option {
    label: string;
    value: string;
}

interface CustomSelectProps {
    value: string;
    options: Option[];
    onChange: (val: string) => void;
    name?: string;
    icon?: string;
    placeholder?: string;
    className?: string;
}

export function CustomSelect({ value, options, onChange, name, icon, className = "" }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((o) => o.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={`relative min-w-[160px] w-full ${className}`} ref={containerRef}>
            {name && <input type="hidden" name={name} value={value} />}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border-0 py-2.5 ${icon ? "pl-10" : "pl-4"} pr-4 text-sm transition-all shadow-sm ring-1 ring-inset ${
                    isOpen
                        ? "bg-white ring-slate-900 text-slate-900"
                        : "bg-slate-50 ring-slate-200 text-slate-900 hover:bg-slate-100 hover:ring-slate-300"
                }`}
            >
                {icon && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Icon icon={icon} className="h-4 w-4 text-slate-500" />
                    </div>
                )}
                <span className="truncate mr-2">{selectedOption?.label || "เลือกตัวเลือก"}</span>
                <Icon icon="majesticons:chevron-down" className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-max rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg shadow-slate-200 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-left origin-top max-h-60 overflow-y-auto">
                    {options.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`cursor-pointer px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${option.value === value ? "bg-slate-50 font-bold text-slate-900" : "text-slate-600 font-medium"
                                }`}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
