"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function Pagination({
    totalItems,
    pageSize,
    currentPage,
}: {
    totalItems: number;
    pageSize: number;
    currentPage: number;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [inputPage, setInputPage] = useState(currentPage.toString());

    useEffect(() => {
        setInputPage(currentPage.toString());
    }, [currentPage]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    function createPageURL(pageNumber: number | string) {
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("page", pageNumber.toString());
        return `${pathname}?${params.toString()}`;
    }

    const handlePageSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let page = parseInt(inputPage, 10);
        if (isNaN(page)) {
            setInputPage(currentPage.toString());
            return;
        }
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        router.push(createPageURL(page) as any);
    };

    // Logic to show limited page numbers (e.g., 1, 2, ..., 10)
    const generatePageNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        if (currentPage <= 3) {
            return [1, 2, 3, "...", totalPages];
        }

        if (currentPage >= totalPages - 2) {
            return [1, "...", totalPages - 2, totalPages - 1, totalPages];
        }

        return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
    };

    const pageNumbers = generatePageNumbers();
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 bg-white px-6 py-4 gap-4">
            <p className="text-sm text-slate-500 text-center sm:text-left">
                แสดง {totalItems === 0 ? 0 : startIndex} ถึง {endIndex} จากทั้งหมด {totalItems} รายการ
            </p>

            <div className="flex flex-wrap items-center justify-center gap-1">
                <Link
                    href={(currentPage > 1 ? createPageURL(currentPage - 1) : "#") as any}
                    aria-disabled={currentPage <= 1}
                    tabIndex={currentPage <= 1 ? -1 : undefined}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${currentPage <= 1
                        ? "text-slate-300 pointer-events-none cursor-not-allowed opacity-50 border border-slate-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                        }`}
                >
                    <Icon icon="majesticons:chevron-left" className="h-5 w-5" />
                </Link>

                {pageNumbers.map((page, index) => {
                    if (page === "...") {
                        return (
                            <span key={index} className="flex h-8 w-8 items-center justify-center text-sm font-medium text-slate-400 border border-transparent">
                                ...
                            </span>
                        );
                    }

                    const isCurrent = page === currentPage;

                    return (
                        <Link
                            key={index}
                            href={(isCurrent ? "#" : createPageURL(page)) as any}
                            aria-disabled={isCurrent || totalItems === 0}
                            tabIndex={isCurrent || totalItems === 0 ? -1 : undefined}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${isCurrent
                                ? "bg-slate-900 text-white pointer-events-none"
                                : totalItems === 0
                                    ? "text-slate-300 pointer-events-none opacity-50 border border-slate-100"
                                    : "text-slate-600 hover:bg-slate-100 border border-transparent"
                                }`}
                        >
                            {page}
                        </Link>
                    );
                })}

                <Link
                    href={(currentPage < totalPages ? createPageURL(currentPage + 1) : "#") as any}
                    aria-disabled={currentPage >= totalPages}
                    tabIndex={currentPage >= totalPages ? -1 : undefined}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${currentPage >= totalPages
                        ? "text-slate-300 pointer-events-none cursor-not-allowed opacity-50 border border-slate-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                        }`}
                >
                    <Icon icon="majesticons:chevron-right" className="h-5 w-5" />
                </Link>

                <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-sm text-slate-500">ไปที่หน้า</span>
                    <form onSubmit={handlePageSubmit} className="flex items-center">
                        <input
                            type="number"
                            min={1}
                            max={totalPages || 1}
                            value={inputPage}
                            onChange={(e) => setInputPage(e.target.value)}
                            onBlur={handlePageSubmit}
                            className="h-8 w-16 rounded-md border border-slate-200 px-2 py-1 text-sm text-center transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            disabled={totalItems === 0}
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}
