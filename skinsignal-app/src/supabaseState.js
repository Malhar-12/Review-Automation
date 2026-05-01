import { hasSupabaseEnv, supabase } from "./supabase";

const tableNames = [
  "clinic_settings",
  "reviews",
  "patients",
  "campaigns",
  "enquiries"
];

function sortDescending(items) {
  return [...items].sort((a, b) => Number(b.id) - Number(a.id));
}

export async function loadRemoteState() {
  if (!hasSupabaseEnv || !supabase) {
    return {
      available: false,
      reason: "Supabase environment variables are missing."
    };
  }

  try {
    const [clinicResult, reviewsResult, patientsResult, campaignsResult, enquiriesResult] =
      await Promise.all([
        supabase.from("clinic_settings").select("*").order("updated_at", { ascending: false }).limit(1),
        supabase.from("reviews").select("*").order("id", { ascending: false }),
        supabase.from("patients").select("*").order("id", { ascending: false }),
        supabase.from("campaigns").select("*").order("id", { ascending: false }),
        supabase.from("enquiries").select("*").order("id", { ascending: false })
      ]);

    const firstError = [
      clinicResult.error,
      reviewsResult.error,
      patientsResult.error,
      campaignsResult.error,
      enquiriesResult.error
    ].find(Boolean);

    if (firstError) {
      throw firstError;
    }

    return {
      available: true,
      state: {
        clinic: clinicResult.data?.[0] ?? null,
        reviews: reviewsResult.data ?? [],
        patients: patientsResult.data ?? [],
        campaigns: campaignsResult.data ?? [],
        enquiries: enquiriesResult.data ?? []
      }
    };
  } catch (error) {
    return {
      available: false,
      reason: error.message
    };
  }
}

export async function pushRemoteState({ clinic, reviews, patients, campaigns, enquiries }) {
  if (!hasSupabaseEnv || !supabase) {
    return { ok: false, reason: "Supabase environment variables are missing." };
  }

  try {
    const operations = [
      supabase.from("clinic_settings").upsert(clinic, { onConflict: "id" }),
      supabase.from("reviews").upsert(sortDescending(reviews), { onConflict: "id" }),
      supabase.from("patients").upsert(sortDescending(patients), { onConflict: "id" }),
      supabase.from("campaigns").upsert(sortDescending(campaigns), { onConflict: "id" }),
      supabase.from("enquiries").upsert(sortDescending(enquiries), { onConflict: "id" })
    ];

    const results = await Promise.all(operations);
    const firstError = results.map((result) => result.error).find(Boolean);

    if (firstError) {
      throw firstError;
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

export function getSchemaHelp() {
  return `Create these tables in Supabase before syncing: ${tableNames.join(", ")}.`;
}
