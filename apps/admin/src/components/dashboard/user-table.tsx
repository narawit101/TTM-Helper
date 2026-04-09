"use client";

import { useState } from "react";
import { User } from "@/types/user";
import { formatDateThai } from "@/utils/formatDate";
import { getStatus } from "@/utils/getStatus";
import { UpdateUserForm } from "@/components/dashboard/update-user-form";
import { DeleteUserForm } from "@/components/dashboard/delete-user-form";
import { Icon } from "@iconify/react";

interface UserTableProps {
  users: User[];
}

export function UserTable({ users }: UserTableProps) {
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const sortedUsers = [...users].sort((a, b) => {
    const dateA = new Date(a.expiresAt || 0).getTime();
    const dateB = new Date(b.expiresAt || 0).getTime();
    return sortDir === "asc" ? dateA - dateB : dateB - dateA;
  });

  const toggleSort = () => {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-white">
          <tr>
            <th className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100">อีเมล</th>
            <th className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100">สร้างเมื่อ</th>
            <th
              className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              onClick={toggleSort}
            >
              <div className="flex items-center justify-between ">
                วันหมดอายุ
                {sortDir === "asc" ? (
                  <Icon icon="bxs:up-arrow" className="h-3 w-3 mt-1 text-slate-600" />
                ) : (
                  <Icon icon="bxs:down-arrow" className="h-3 w-3 mt-1 text-slate-600" />
                )}
              </div>
            </th>
            <th className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100 text-center">จำกัดอุปกรณ์</th>
            <th className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100 text-center" >สถานะ</th>
            <th className="px-6 py-4 font-semibold text-slate-900 border-b border-slate-100 text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sortedUsers.map((user) => {
            const status = getStatus(user.expiresAt);
            return (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-700">{user.email}</td>
                <td className="px-6 py-4 text-slate-600">{formatDateThai(user.createdAt)}</td>
                <td className="px-6 py-4 text-slate-600">{formatDateThai(user.expiresAt)}</td>
                <td className="px-6 py-4 text-center">
                  {user.deviceLimit === 0 ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                      แบนห้ามใช้งาน
                    </span>
                  ) : (
                    <span className="text-slate-600">{user.deviceLimit} อุปกรณ์</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {user.deviceLimit === 0 ? (
                    <span>
                      -
                    </span>
                  ) : (
                    <>
                      <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </>
                  )}

                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <UpdateUserForm user={user} />
                    <DeleteUserForm user={user} />
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 ? (
            <tr>
              <td className="px-6 py-12 text-center text-slate-500" colSpan={6}>
                <div className="flex flex-col items-center gap-2">
                  <Icon icon="icon-park-solid:data" width="28" height="28" />
                  <p>ไม่มีข้อมูลผู้ใช้งาน</p>
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
