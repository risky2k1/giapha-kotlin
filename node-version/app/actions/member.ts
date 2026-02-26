"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function deleteMemberProfile(memberId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Verify Authentication & Authorization
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Vui lòng đăng nhập.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Từ chối truy cập. Chỉ admin mới có quyền xoá hồ sơ.");
  }

  // 2. Check for existing relationships
  const { data: relationships, error: relationshipError } = await supabase
    .from("relationships")
    .select("id")
    .or(`person_a.eq.${memberId},person_b.eq.${memberId}`)
    .limit(1);

  if (relationshipError) {
    console.error("Error checking relationships:", relationshipError);
    throw new Error("Lỗi kiểm tra mối quan hệ gia đình.");
  }

  if (relationships && relationships.length > 0) {
    throw new Error(
      "Không thể xoá. Vui lòng xoá hết các mối quan hệ gia đình của người này trước.",
    );
  }

  // 3. Delete the member
  const { error: deleteError } = await supabase
    .from("persons")
    .delete()
    .eq("id", memberId);

  if (deleteError) {
    console.error("Error deleting person:", deleteError);
    throw new Error("Đã xảy ra lỗi khi xoá hồ sơ.");
  }

  // 4. Revalidate and redirect
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/members");
  redirect("/dashboard");
}
