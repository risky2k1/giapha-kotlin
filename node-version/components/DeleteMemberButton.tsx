"use client";

import { deleteMemberProfile } from "@/app/actions/member";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState } from "react";

interface DeleteMemberButtonProps {
  memberId: string;
}

export default function DeleteMemberButton({
  memberId,
}: DeleteMemberButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xoá hồ sơ này không? Hành động này không thể hoàn tác.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteMemberProfile(memberId);
      // Note: the server action will redirect on success
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      console.error("Delete failed:", error);
      // @ts-expect-error - error is caught as unknown
      alert(error.message || "Đã xảy ra lỗi khi xoá hồ sơ.");
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isDeleting ? "Đang xoá..." : "Xoá hồ sơ"}
    </button>
  );
}
