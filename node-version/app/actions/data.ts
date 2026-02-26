"use server";

import { Relationship } from "@/types";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload shape cho file backup JSON.
 * Các field DB-managed (created_at, updated_at) được giữ để tham khảo
 * nhưng sẽ bị loại bỏ khi import lại.
 */
interface PersonExport {
  id: string;
  full_name: string;
  gender: "male" | "female" | "other";
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  is_deceased: boolean;
  is_in_law: boolean;
  birth_order: number | null;
  generation: number | null;
  avatar_url: string | null;
  note: string | null;
  // DB-managed fields (kept in export for traceability, stripped on import)
  created_at?: string;
  updated_at?: string;
}

interface RelationshipExport {
  id?: string;
  type: string;
  person_a: string;
  person_b: string;
  created_at?: string;
  updated_at?: string;
}

interface BackupPayload {
  version: number;
  timestamp: string;
  persons: PersonExport[];
  relationships: RelationshipExport[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Vui lòng đăng nhập.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin")
    throw new Error("Từ chối truy cập. Chỉ admin mới có quyền này.");

  return supabase;
}

// Các field được phép insert vào bảng persons (loại bỏ created_at/updated_at)
function sanitizePerson(
  p: PersonExport,
): Omit<PersonExport, "created_at" | "updated_at"> {
  return {
    id: p.id,
    full_name: p.full_name,
    gender: p.gender,
    birth_year: p.birth_year ?? null,
    birth_month: p.birth_month ?? null,
    birth_day: p.birth_day ?? null,
    death_year: p.death_year ?? null,
    death_month: p.death_month ?? null,
    death_day: p.death_day ?? null,
    is_deceased: p.is_deceased ?? false,
    is_in_law: p.is_in_law ?? false,
    birth_order: p.birth_order ?? null,
    generation: p.generation ?? null,
    avatar_url: p.avatar_url ?? null,
    note: p.note ?? null,
  };
}

function sanitizeRelationship(
  r: RelationshipExport,
): Omit<RelationshipExport, "id" | "created_at" | "updated_at"> {
  return {
    type: r.type,
    person_a: r.person_a,
    person_b: r.person_b,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportData(): Promise<BackupPayload> {
  const supabase = await verifyAdmin();

  const { data: persons, error: personsError } = await supabase
    .from("persons")
    .select(
      "id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day, is_deceased, is_in_law, birth_order, generation, avatar_url, note, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  if (personsError)
    throw new Error("Lỗi tải dữ liệu persons: " + personsError.message);

  const { data: relationships, error: relationshipsError } = await supabase
    .from("relationships")
    .select("id, type, person_a, person_b, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (relationshipsError)
    throw new Error(
      "Lỗi tải dữ liệu relationships: " + relationshipsError.message,
    );

  return {
    version: 2, // bumped for schema with birth_order + generation
    timestamp: new Date().toISOString(),
    persons: (persons ?? []) as PersonExport[],
    relationships: (relationships ?? []) as RelationshipExport[],
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importData(
  importPayload:
    | BackupPayload
    | {
        persons: PersonExport[];
        relationships: Relationship[];
      },
) {
  const supabase = await verifyAdmin();

  if (!importPayload?.persons || !importPayload?.relationships) {
    throw new Error("Dữ liệu không hợp lệ. Vui lòng kiểm tra lại file JSON.");
  }

  if (importPayload.persons.length === 0) {
    throw new Error("File backup trống — không có thành viên nào để phục hồi.");
  }

  // 1. Xoá relationships trước (FK constraint)
  const { error: delRelError } = await supabase
    .from("relationships")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (delRelError)
    throw new Error("Lỗi khi xoá relationships cũ: " + delRelError.message);

  // 2. Xoá persons
  const { error: delPersonsError } = await supabase
    .from("persons")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (delPersonsError)
    throw new Error("Lỗi khi xoá persons cũ: " + delPersonsError.message);

  // 3. Insert persons (sanitized — chỉ giữ các field schema hiện tại)
  const CHUNK = 200;
  const persons = importPayload.persons.map(sanitizePerson);

  for (let i = 0; i < persons.length; i += CHUNK) {
    const chunk = persons.slice(i, i + CHUNK);
    const { error } = await supabase.from("persons").insert(chunk);
    if (error)
      throw new Error(
        `Lỗi khi import persons (chunk ${i / CHUNK + 1}): ${error.message}`,
      );
  }

  // 4. Insert relationships (stripped of id/created_at to avoid conflicts)
  const relationships = importPayload.relationships.map(sanitizeRelationship);

  for (let i = 0; i < relationships.length; i += CHUNK) {
    const chunk = relationships.slice(i, i + CHUNK);
    const { error } = await supabase.from("relationships").insert(chunk);
    if (error)
      throw new Error(
        `Lỗi khi import relationships (chunk ${i / CHUNK + 1}): ${error.message}`,
      );
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/data");

  return {
    success: true,
    imported: {
      persons: persons.length,
      relationships: relationships.length,
    },
  };
}
