import { hasSupabaseEnv, supabase } from "./supabase";

const tableNames = [
  "clinic_settings",
  "reviews",
  "patients",
  "campaigns",
  "enquiries",
  "appointments",
  "automation_tasks"
];

function sortDescending(items) {
  return [...items].sort((a, b) => Number(b.id) - Number(a.id));
}

function mapClinicFromRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    plan: row.plan,
    owner: row.owner,
    googleReviewLink: row.google_review_link ?? ""
  };
}

function mapReviewFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    source: row.source,
    text: row.text,
    draft: row.draft,
    status: row.status
  };
}

function mapPatientFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    visitDate: row.visit_date,
    reviewStatus: row.review_status,
    feedbackStatus: row.feedback_status,
    phone: row.phone ?? "",
    email: row.email ?? "",
    nextFollowUp: row.next_follow_up ?? ""
  };
}

function mapCampaignFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    sent: row.sent,
    delivered: row.delivered,
    clicked: row.clicked,
    status: row.status,
    audience: row.audience ?? "pending_reviews",
    channel: row.channel ?? "whatsapp",
    template: row.template ?? "review_request",
    scheduledFor: row.scheduled_for ?? ""
  };
}

function mapEnquiryFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    note: row.note,
    phone: row.phone ?? "",
    preferredChannel: row.preferred_channel ?? "whatsapp",
    nextFollowUp: row.next_follow_up ?? ""
  };
}

function mapAppointmentFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    city: row.city,
    doctor: row.doctor,
    appointmentDate: row.appointment_date,
    status: row.status
  };
}

function mapAutomationTaskFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    contactName: row.contact_name,
    channel: row.channel,
    dueAt: row.due_at,
    status: row.status,
    source: row.source,
    message: row.message
  };
}

function mapClinicToRow(clinic, userId) {
  return {
    user_id: userId,
    id: clinic.id,
    name: clinic.name,
    city: clinic.city,
    plan: clinic.plan,
    owner: clinic.owner,
    google_review_link: clinic.googleReviewLink ?? "",
    updated_at: new Date().toISOString()
  };
}

function mapReviewToRow(review, userId) {
  return {
    user_id: userId,
    id: review.id,
    name: review.name,
    rating: review.rating,
    source: review.source,
    text: review.text,
    draft: review.draft,
    status: review.status,
    updated_at: new Date().toISOString()
  };
}

function mapPatientToRow(patient, userId) {
  return {
    user_id: userId,
    id: patient.id,
    name: patient.name,
    visit_date: patient.visitDate,
    review_status: patient.reviewStatus,
    feedback_status: patient.feedbackStatus,
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    next_follow_up: patient.nextFollowUp || null,
    updated_at: new Date().toISOString()
  };
}

function mapCampaignToRow(campaign, userId) {
  return {
    user_id: userId,
    id: campaign.id,
    name: campaign.name,
    sent: campaign.sent,
    delivered: campaign.delivered,
    clicked: campaign.clicked,
    status: campaign.status,
    audience: campaign.audience ?? "pending_reviews",
    channel: campaign.channel ?? "whatsapp",
    template: campaign.template ?? "review_request",
    scheduled_for: campaign.scheduledFor || null,
    updated_at: new Date().toISOString()
  };
}

function mapEnquiryToRow(enquiry, userId) {
  return {
    user_id: userId,
    id: enquiry.id,
    name: enquiry.name,
    status: enquiry.status,
    note: enquiry.note,
    phone: enquiry.phone ?? "",
    preferred_channel: enquiry.preferredChannel ?? "whatsapp",
    next_follow_up: enquiry.nextFollowUp || null,
    updated_at: new Date().toISOString()
  };
}

function mapAppointmentToRow(appointment, userId) {
  return {
    user_id: userId,
    id: appointment.id,
    name: appointment.name,
    mobile: appointment.mobile ?? "",
    city: appointment.city ?? "",
    doctor: appointment.doctor ?? "",
    appointment_date: appointment.appointmentDate,
    status: appointment.status,
    updated_at: new Date().toISOString()
  };
}

function mapAutomationTaskToRow(task, userId) {
  return {
    user_id: userId,
    id: task.id,
    title: task.title,
    contact_name: task.contactName,
    channel: task.channel,
    due_at: task.dueAt,
    status: task.status,
    source: task.source,
    message: task.message,
    updated_at: new Date().toISOString()
  };
}

export async function loadRemoteState(userId) {
  if (!hasSupabaseEnv || !supabase) {
    return {
      available: false,
      reason: "Supabase environment variables are missing."
    };
  }

  if (!userId) {
    return {
      available: false,
      reason: "No signed-in clinic user was found."
    };
  }

  try {
    const [clinicResult, reviewsResult, patientsResult, campaignsResult, enquiriesResult, appointmentsResult, automationTasksResult] =
      await Promise.all([
        supabase
          .from("clinic_settings")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase.from("reviews").select("*").eq("user_id", userId).order("id", { ascending: false }),
        supabase.from("patients").select("*").eq("user_id", userId).order("id", { ascending: false }),
        supabase.from("campaigns").select("*").eq("user_id", userId).order("id", { ascending: false }),
        supabase.from("enquiries").select("*").eq("user_id", userId).order("id", { ascending: false }),
        supabase.from("appointments").select("*").eq("user_id", userId).order("id", { ascending: false }),
        supabase.from("automation_tasks").select("*").eq("user_id", userId).order("id", { ascending: false })
      ]);

    const firstError = [
      clinicResult.error,
      reviewsResult.error,
      patientsResult.error,
      campaignsResult.error,
      enquiriesResult.error,
      appointmentsResult.error,
      automationTasksResult.error
    ].find(Boolean);

    if (firstError) {
      throw firstError;
    }

    return {
      available: true,
      state: {
        clinic: mapClinicFromRow(clinicResult.data?.[0] ?? null),
        reviews: (reviewsResult.data ?? []).map(mapReviewFromRow),
        patients: (patientsResult.data ?? []).map(mapPatientFromRow),
        campaigns: (campaignsResult.data ?? []).map(mapCampaignFromRow),
        enquiries: (enquiriesResult.data ?? []).map(mapEnquiryFromRow),
        appointments: (appointmentsResult.data ?? []).map(mapAppointmentFromRow),
        automationTasks: (automationTasksResult.data ?? []).map(mapAutomationTaskFromRow)
      }
    };
  } catch (error) {
    return {
      available: false,
      reason: error.message
    };
  }
}

export async function pushRemoteState({
  clinic,
  reviews,
  patients,
  campaigns,
  enquiries,
  appointments,
  automationTasks,
  userId
}) {
  if (!hasSupabaseEnv || !supabase) {
    return { ok: false, reason: "Supabase environment variables are missing." };
  }

  if (!userId) {
    return { ok: false, reason: "No signed-in clinic user was found." };
  }

  try {
    const operations = [
      supabase.from("clinic_settings").upsert(mapClinicToRow(clinic, userId), { onConflict: "user_id,id" }),
      supabase
        .from("reviews")
        .upsert(sortDescending(reviews).map((review) => mapReviewToRow(review, userId)), {
          onConflict: "user_id,id"
        }),
      supabase
        .from("patients")
        .upsert(sortDescending(patients).map((patient) => mapPatientToRow(patient, userId)), {
          onConflict: "user_id,id"
        }),
      supabase
        .from("campaigns")
        .upsert(sortDescending(campaigns).map((campaign) => mapCampaignToRow(campaign, userId)), {
          onConflict: "user_id,id"
        }),
      supabase
        .from("enquiries")
        .upsert(sortDescending(enquiries).map((enquiry) => mapEnquiryToRow(enquiry, userId)), {
          onConflict: "user_id,id"
        }),
      supabase
        .from("appointments")
        .upsert(sortDescending(appointments).map((appointment) => mapAppointmentToRow(appointment, userId)), {
          onConflict: "user_id,id"
        }),
      supabase
        .from("automation_tasks")
        .upsert(sortDescending(automationTasks).map((task) => mapAutomationTaskToRow(task, userId)), {
          onConflict: "user_id,id"
        })
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
  return `Run the latest Supabase migration for these tables: ${tableNames.join(", ")}.`;
}
