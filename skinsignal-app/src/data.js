export const clinic = {
  name: "Northstar Specialty Clinic",
  city: "Mumbai",
  plan: "Growth Plan",
  owner: "Dr. Kapoor"
};

export const stats = [
  { label: "Average Rating", value: "4.8", detail: "up 0.3 in the last 30 days" },
  { label: "New Reviews", value: "18", detail: "12 from WhatsApp requests" },
  { label: "Pending Replies", value: "6", detail: "AI drafts are ready" },
  { label: "Patient Enquiries", value: "23", detail: "8 converted to appointments", accent: true }
];

export const reviews = [
  {
    id: 1,
    name: "Ananya S.",
    rating: 5,
    source: "Google Review",
    text: "Doctor was patient and explained the treatment plan clearly. Staff was very supportive.",
    draft:
      "Thank you for your kind words, Ananya. We are glad you felt well-supported by the doctor and team. We appreciate your trust in our clinic.",
    status: "ready"
  },
  {
    id: 2,
    name: "Rakesh P.",
    rating: 4,
    source: "Google Review",
    text: "Treatment was good but I had to wait longer than expected.",
    draft:
      "Thank you for the feedback, Rakesh. We are happy the treatment experience was positive, and we appreciate your note about wait time. We are working on making visits smoother.",
    status: "ready"
  },
  {
    id: 3,
    name: "Mona K.",
    rating: 3,
    source: "Google Review",
    text: "The consultation was useful, but I wanted more clarity on follow-up care.",
    draft:
      "Thank you for sharing this, Mona. We are glad the consultation helped, and we appreciate the note about follow-up clarity. Our team will use this to improve how we guide patients after their visit.",
    status: "needs_edit"
  }
];

export const patients = [
  {
    id: 1,
    name: "Priya N.",
    visitDate: "2026-04-19",
    reviewStatus: "sent",
    feedbackStatus: "happy",
    phone: "+91 98765 11001",
    email: "priya@example.com",
    nextFollowUp: "2026-05-11"
  },
  {
    id: 2,
    name: "Karan D.",
    visitDate: "2026-04-20",
    reviewStatus: "clicked",
    feedbackStatus: "happy",
    phone: "+91 98765 11002",
    email: "karan@example.com",
    nextFollowUp: "2026-05-12"
  },
  {
    id: 3,
    name: "Ishita R.",
    visitDate: "2026-04-20",
    reviewStatus: "pending",
    feedbackStatus: "unknown",
    phone: "+91 98765 11003",
    email: "ishita@example.com",
    nextFollowUp: "2026-05-10"
  },
  {
    id: 4,
    name: "Neha G.",
    visitDate: "2026-04-21",
    reviewStatus: "private_feedback",
    feedbackStatus: "needs_followup",
    phone: "+91 98765 11004",
    email: "neha@example.com",
    nextFollowUp: "2026-05-09"
  }
];

export const campaigns = [
  { id: 1, name: "Post-visit review request", sent: 142, delivered: 91, clicked: 24, status: "active" },
  { id: 2, name: "Acne program follow-up", sent: 58, delivered: 45, clicked: 10, status: "draft" }
];

export const enquiries = [
  {
    id: 1,
    name: "Laser consultation",
    status: "follow_up_sent",
    note: "Follow-up sent 10 min ago",
    phone: "+91 99880 44001",
    preferredChannel: "whatsapp",
    nextFollowUp: "2026-05-10"
  },
  {
    id: 2,
    name: "Acne treatment pricing",
    status: "awaiting_reply",
    note: "Awaiting patient reply",
    phone: "+91 99880 44002",
    preferredChannel: "sms",
    nextFollowUp: "2026-05-11"
  },
  {
    id: 3,
    name: "Skin allergy consultation",
    status: "booked",
    note: "Booked for Friday",
    phone: "+91 99880 44003",
    preferredChannel: "email",
    nextFollowUp: "2026-05-13"
  }
];

export const appointments = [
  {
    id: 1,
    name: "Aarav P.",
    mobile: "+91 98990 22001",
    city: "Mumbai",
    doctor: "Dr. Kapoor",
    appointmentDate: "2026-05-14",
    status: "booked"
  },
  {
    id: 2,
    name: "Riya S.",
    mobile: "+91 98990 22002",
    city: "Pune",
    doctor: "Dr. Nair",
    appointmentDate: "2026-05-13",
    status: "completed"
  },
  {
    id: 3,
    name: "Kabir M.",
    mobile: "+91 98990 22003",
    city: "Delhi",
    doctor: "Dr. Rao",
    appointmentDate: "2026-05-15",
    status: "new"
  }
];

export const automationTasks = [
  {
    id: 1,
    title: "Review reminder",
    contactName: "Ishita R.",
    channel: "whatsapp",
    dueAt: "2026-05-10 10:30",
    status: "scheduled",
    source: "patient",
    message: "Send a second reminder if no review is posted today."
  },
  {
    id: 2,
    title: "Lead follow-up",
    contactName: "Acne treatment pricing",
    channel: "sms",
    dueAt: "2026-05-11 14:00",
    status: "scheduled",
    source: "enquiry",
    message: "Share pricing deck and ask for preferred consultation slot."
  },
  {
    id: 3,
    title: "Private feedback callback",
    contactName: "Neha G.",
    channel: "phone",
    dueAt: "2026-05-09 17:30",
    status: "done",
    source: "patient",
    message: "Call patient and close the loop on follow-up support."
  }
];

export const feedbackItems = [
  { id: 1, title: "Long waiting time complaint", submittedAt: "2 hours ago" },
  { id: 2, title: "Billing confusion after consultation", submittedAt: "yesterday" }
];
