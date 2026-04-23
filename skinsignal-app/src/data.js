export const clinic = {
  name: "Radiant Derma Clinic",
  city: "Bangalore",
  plan: "Growth Plan",
  owner: "Dr. Mehta"
};

export const stats = [
  { label: "Average Rating", value: "4.8", detail: "up 0.3 in the last 30 days" },
  { label: "New Reviews", value: "18", detail: "12 from WhatsApp requests" },
  { label: "Pending Replies", value: "6", detail: "AI drafts are ready" },
  { label: "WhatsApp Enquiries", value: "23", detail: "8 converted to consultations", accent: true }
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
  { id: 1, name: "Priya N.", visitDate: "2026-04-19", reviewStatus: "sent", feedbackStatus: "happy" },
  { id: 2, name: "Karan D.", visitDate: "2026-04-20", reviewStatus: "clicked", feedbackStatus: "happy" },
  { id: 3, name: "Ishita R.", visitDate: "2026-04-20", reviewStatus: "pending", feedbackStatus: "unknown" },
  { id: 4, name: "Neha G.", visitDate: "2026-04-21", reviewStatus: "private_feedback", feedbackStatus: "needs_followup" }
];

export const campaigns = [
  { id: 1, name: "Post-visit review request", sent: 142, delivered: 91, clicked: 24, status: "active" },
  { id: 2, name: "Acne program follow-up", sent: 58, delivered: 45, clicked: 10, status: "draft" }
];

export const enquiries = [
  { id: 1, name: "Laser consultation", status: "follow_up_sent", note: "Follow-up sent 10 min ago" },
  { id: 2, name: "Acne treatment pricing", status: "awaiting_reply", note: "Awaiting patient reply" },
  { id: 3, name: "Skin allergy consultation", status: "booked", note: "Booked for Friday" }
];

export const feedbackItems = [
  { id: 1, title: "Long waiting time complaint", submittedAt: "2 hours ago" },
  { id: 2, title: "Billing confusion after consultation", submittedAt: "yesterday" }
];
