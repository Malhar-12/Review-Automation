import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  automationTasks as initialAutomationTasks,
  appointments as initialAppointments,
  campaigns as initialCampaigns,
  clinic as initialClinic,
  enquiries as initialEnquiries,
  feedbackItems,
  patients as initialPatients,
  reviews as initialReviews
} from "./data";
import { hasSupabaseEnv, supabase } from "./supabase";
import { getSchemaHelp, loadRemoteState, pushRemoteState } from "./supabaseState";

const navItems = ["Dashboard", "Appointments", "Patients", "Reviews", "Campaigns", "Automations", "Enquiries", "Settings"];
const storageKey = "reviewpulse-console-state";
const clinicSeed = { id: "default-clinic", ...initialClinic };

function getCurrentRoute() {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname === "/app" ? "/app" : "/";
}

function createBlankClinic(owner = "Clinic team") {
  return {
    id: "default-clinic",
    name: "",
    city: "",
    plan: "Free Plan",
    owner,
    googleReviewLink: ""
  };
}

function getOwnerFromSession(session) {
  const email = session?.user?.email;

  if (!email) {
    return "Clinic team";
  }

  const [name] = email.split("@");
  return name || "Clinic team";
}

function loadStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function ensureClinicId(clinic) {
  return clinic?.id ? clinic : { ...clinic, id: "default-clinic" };
}

function isClinicProfileComplete(clinic) {
  return Boolean(
    clinic?.name?.trim() &&
      clinic?.city?.trim() &&
      clinic?.owner?.trim() &&
      clinic?.googleReviewLink?.trim()
  );
}

function buildReplyDraft(review, clinic) {
  const reviewText = review.text.toLowerCase();
  const ownerName = clinic?.owner?.trim() || "our clinic team";
  const clinicName = clinic?.name?.trim() || "our clinic";
  const mentionsWait = reviewText.includes("wait");
  const mentionsStaff = reviewText.includes("staff") || reviewText.includes("team");
  const mentionsClarity =
    reviewText.includes("clarity") || reviewText.includes("explain") || reviewText.includes("follow-up");

  if (review.rating >= 5) {
    return `Thank you for the wonderful review, ${review.name}. ${clinicName} is grateful for your trust, and ${ownerName} is glad the visit felt supportive. We look forward to seeing you again.`;
  }

  if (review.rating === 4) {
    return `Thank you for the thoughtful feedback, ${review.name}. ${ownerName} appreciates your kind words about the experience.${mentionsWait ? " We are also reviewing wait times so visits feel smoother." : ""} ${mentionsStaff ? "I will pass your note along to the team." : ""}`.trim();
  }

  return `Thank you for sharing this with us, ${review.name}. ${ownerName} appreciates the honest feedback and wants to make things right.${mentionsClarity ? " We will improve how we explain next steps and follow-up care." : ""}${mentionsWait ? " We are also reviewing scheduling and waiting time closely." : ""} Please feel free to contact ${clinicName} directly so we can help further.`;
}

function buildAutomationTask({ title, contactName, channel, dueAt, source, message }) {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title,
    contactName,
    channel,
    dueAt,
    status: "scheduled",
    source,
    message
  };
}

function buildReviewRequestMessage(clinic, patientName) {
  const practiceName = clinic?.name?.trim() || "our clinic";
  const reviewLink = clinic?.googleReviewLink?.trim();

  if (reviewLink) {
    return `Hi ${patientName}, thank you for visiting ${practiceName}. Please share your feedback here: ${reviewLink}`;
  }

  return `Hi ${patientName}, thank you for visiting ${practiceName}. Add your Google review link in Settings before sending this request.`;
}

function getPatientReviewStatusFromAppointment(status) {
  if (status === "completed") {
    return "pending";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  if (status === "no_show") {
    return "no_show";
  }

  return "awaiting_visit";
}

function upsertPatientFromAppointment(currentPatients, appointment) {
  const matchingPatient = currentPatients.find(
    (patient) => patient.name === appointment.name && patient.phone === appointment.mobile
  );

  const nextPatient = {
    id: matchingPatient?.id ?? Date.now() + 1,
    name: appointment.name,
    visitDate: appointment.appointmentDate,
    reviewStatus: getPatientReviewStatusFromAppointment(appointment.status),
    feedbackStatus: matchingPatient?.feedbackStatus ?? "unknown",
    phone: appointment.mobile,
    email: matchingPatient?.email ?? "",
    nextFollowUp: matchingPatient?.nextFollowUp ?? appointment.appointmentDate
  };

  if (!matchingPatient) {
    return [nextPatient, ...currentPatients];
  }

  return currentPatients.map((patient) => (patient.id === matchingPatient.id ? nextPatient : patient));
}

function hasReviewRequestTask(currentTasks, appointment) {
  return currentTasks.some(
    (task) =>
      task.source === "appointment" &&
      task.title === "Post-visit review request" &&
      task.contactName === appointment.name &&
      task.dueAt === `${appointment.appointmentDate} 19:00`
  );
}

function normalizeRemoteState(remoteState, session) {
  const blankClinic = createBlankClinic(getOwnerFromSession(session));

  return {
    clinic: ensureClinicId(remoteState.clinic ?? blankClinic),
    reviews: remoteState.reviews ?? [],
    patients: remoteState.patients ?? [],
    campaigns: remoteState.campaigns ?? [],
    enquiries: remoteState.enquiries ?? [],
    appointments: remoteState.appointments ?? [],
    automationTasks: remoteState.automationTasks ?? []
  };
}

function App() {
  const storedState = loadStoredState();
  const [authReady, setAuthReady] = useState(!hasSupabaseEnv);
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState("");
  const [route, setRoute] = useState(getCurrentRoute());
  const [activeView, setActiveView] = useState("Dashboard");
  const [notice, setNotice] = useState("Your workspace now saves changes in this browser and can sync with Supabase.");
  const [syncStatus, setSyncStatus] = useState("local");
  const [clinic, setClinic] = useState(ensureClinicId(storedState?.clinic ?? clinicSeed));
  const [reviews, setReviews] = useState(storedState?.reviews ?? initialReviews);
  const [patients, setPatients] = useState(storedState?.patients ?? initialPatients);
  const [campaigns, setCampaigns] = useState(storedState?.campaigns ?? initialCampaigns);
  const [enquiries, setEnquiries] = useState(storedState?.enquiries ?? initialEnquiries);
  const [appointments, setAppointments] = useState(storedState?.appointments ?? initialAppointments);
  const [automationTasks, setAutomationTasks] = useState(
    storedState?.automationTasks ?? initialAutomationTasks
  );
  const remoteReadyRef = useRef(false);
  const hasLoadedRemoteRef = useRef(false);
  const clinicIsComplete = isClinicProfileComplete(clinic);
  const automationStats = useMemo(
    () => [
      {
        label: "Reply drafts ready",
        value: reviews.filter((review) => review.status === "ready").length,
        detail: `${reviews.filter((review) => review.status === "needs_edit").length} still need edits`
      },
      {
        label: "Requests waiting",
        value: patients.filter((patient) => patient.reviewStatus === "pending").length,
        detail: `${patients.filter((patient) => patient.reviewStatus === "sent").length} already queued`
      },
      {
        label: "Active campaigns",
        value: campaigns.filter((campaign) => campaign.status === "active").length,
        detail: `${campaigns.length} total campaign flows`
      },
      {
        label: "Follow-ups due",
        value: automationTasks.filter((task) => task.status === "scheduled").length,
        detail: `${enquiries.filter((entry) => entry.status === "booked").length} already booked`
      }
    ],
    [automationTasks, campaigns, enquiries, patients, reviews]
  );

  useEffect(() => {
    function handlePopState() {
      setRoute(getCurrentRoute());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!session || route === "/app") {
      return;
    }

    window.history.replaceState({}, "", "/app");
    setRoute("/app");
  }, [route, session]);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setAuthReady(true);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (hasSupabaseEnv && !session) {
      hasLoadedRemoteRef.current = false;
      remoteReadyRef.current = false;
      setSyncStatus("local");
      return undefined;
    }

    let cancelled = false;

    async function bootstrapRemoteState() {
      const result = await loadRemoteState(session?.user?.id);

      if (cancelled) {
        return;
      }

      hasLoadedRemoteRef.current = true;

      if (result.available && result.state) {
        const nextState = normalizeRemoteState(result.state, session);
        setClinic(nextState.clinic);
        setReviews(nextState.reviews);
        setPatients(nextState.patients);
        setCampaigns(nextState.campaigns);
        setEnquiries(nextState.enquiries);
        setAppointments(nextState.appointments);
        setAutomationTasks(nextState.automationTasks);
        setSyncStatus(isClinicProfileComplete(nextState.clinic) ? "supabase" : "setup");
        remoteReadyRef.current = true;
        setNotice(
          isClinicProfileComplete(nextState.clinic)
            ? "Connected to Supabase. Changes now sync to your project tables."
            : "Connected to Supabase. Finish clinic setup to start your private cloud workspace."
        );
        return;
      }

      setSyncStatus("local");
      remoteReadyRef.current = false;
      setNotice(`Using local demo mode. ${result.reason ?? getSchemaHelp()}`);
    }

    bootstrapRemoteState();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        clinic,
        reviews,
        patients,
        campaigns,
        enquiries,
        appointments,
        automationTasks
      })
    );
  }, [appointments, automationTasks, campaigns, clinic, enquiries, patients, reviews]);

  useEffect(() => {
    if (!hasLoadedRemoteRef.current || !remoteReadyRef.current) {
      return undefined;
    }

    if (hasSupabaseEnv && session && !clinicIsComplete) {
      setSyncStatus("setup");
      return undefined;
    }

    let cancelled = false;

    async function syncState() {
      const result = await pushRemoteState({
        clinic,
        reviews,
        patients,
        campaigns,
        enquiries,
        appointments,
        automationTasks,
        userId: session?.user?.id
      });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        remoteReadyRef.current = false;
        setSyncStatus("local");
        setNotice(`Supabase sync paused. ${result.reason ?? getSchemaHelp()}`);
      } else {
        setSyncStatus("supabase");
      }
    }

    syncState();

    return () => {
      cancelled = true;
    };
  }, [appointments, automationTasks, campaigns, clinic, clinicIsComplete, enquiries, patients, reviews, session]);

  const stats = useMemo(() => {
    const ratingTotal = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length ? (ratingTotal / reviews.length).toFixed(1) : "0.0";
    const pendingReplies = reviews.filter((review) => review.status !== "approved").length;
    const sentRequests = patients.filter((patient) => patient.reviewStatus !== "pending").length;
    const completedAppointments = appointments.filter((appointment) => appointment.status === "completed").length;

    return [
      {
        label: "Average Rating",
        value: averageRating,
        detail: `${reviews.length} reviews currently tracked`
      },
      {
        label: "Review Requests Sent",
        value: String(sentRequests),
        detail: `${patients.length - sentRequests} patients still pending outreach`
      },
      {
        label: "Pending Replies",
        value: String(pendingReplies),
        detail: `${reviews.filter((review) => review.status === "needs_edit").length} need edits`
      },
      {
        label: "Completed Visits",
        value: String(completedAppointments),
        detail: `${appointments.filter((appointment) => appointment.status === "booked").length} appointments currently booked`,
        accent: true
      }
    ];
  }, [appointments, patients, reviews]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function updateReview(reviewId, updates) {
    setReviews((currentReviews) =>
      currentReviews.map((review) =>
        review.id === reviewId ? { ...review, ...updates } : review
      )
    );
  }

  function queueReviewRequests() {
    let sentCount = 0;
    const createdTasks = [];

    setPatients((currentPatients) =>
      currentPatients.map((patient) => {
        if (patient.reviewStatus === "pending") {
          sentCount += 1;
          createdTasks.push(
            buildAutomationTask({
              title: "Review reminder",
              contactName: patient.name,
              channel: patient.phone ? "whatsapp" : patient.email ? "email" : "manual",
              dueAt: `${patient.nextFollowUp || patient.visitDate} 18:00`,
              source: "patient",
              message: buildReviewRequestMessage(clinic, patient.name)
            })
          );
          return { ...patient, reviewStatus: "sent" };
        }

        return patient;
      })
    );

    if (sentCount) {
      const campaignDate = new Date().toISOString().slice(0, 10);

      setCampaigns((currentCampaigns) => [
        {
          id: Date.now(),
          name: `Automated review batch ${campaignDate}`,
          sent: sentCount,
          delivered: 0,
          clicked: 0,
          status: "active"
        },
        ...currentCampaigns
      ]);

      setAutomationTasks((currentTasks) => [...createdTasks, ...currentTasks]);
    }

    setNotice(
      sentCount
        ? `Queued review requests for ${sentCount} patient${sentCount > 1 ? "s" : ""} and created a tracking campaign.`
        : "All tracked patients already have a review action."
    );
    setActiveView("Patients");
  }

  function regenerateDraft(reviewId) {
    setReviews((currentReviews) =>
      currentReviews.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              draft: buildReplyDraft(review, clinic),
              status: review.status === "approved" ? "approved" : "ready"
            }
          : review
      )
    );
    setNotice("Generated a fresh reply draft from the review context.");
  }

  function exportReport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      syncStatus,
      clinic,
      reviews,
      patients,
      campaigns,
      enquiries,
      automationTasks
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reviewpulse-report.json";
    link.click();
    window.URL.revokeObjectURL(url);
    setNotice("Exported a fresh JSON snapshot of the clinic workspace.");
  }

  function addCampaign(campaign) {
    setCampaigns((currentCampaigns) => [{ id: Date.now(), ...campaign }, ...currentCampaigns]);
    setNotice(`Created the "${campaign.name}" campaign.`);
  }

  function addEnquiry(enquiry) {
    setEnquiries((currentEnquiries) => [{ id: Date.now(), ...enquiry }, ...currentEnquiries]);
    setAutomationTasks((currentTasks) => [
      buildAutomationTask({
        title: "Lead follow-up",
        contactName: enquiry.name,
        channel: enquiry.preferredChannel || "whatsapp",
        dueAt: `${enquiry.nextFollowUp || new Date().toISOString().slice(0, 10)} 15:00`,
        source: "enquiry",
        message: enquiry.note || "Send the next follow-up to this lead."
      }),
      ...currentTasks
    ]);
    setNotice(`Added ${enquiry.name} to the lead tracker.`);
  }

  function addAppointment(appointment) {
    setAppointments((currentAppointments) => [{ id: Date.now(), ...appointment }, ...currentAppointments]);
    setPatients((currentPatients) => upsertPatientFromAppointment(currentPatients, appointment));

    if (appointment.status === "completed") {
      setAutomationTasks((currentTasks) => {
        if (hasReviewRequestTask(currentTasks, appointment)) {
          return currentTasks;
        }

        return [
          buildAutomationTask({
            title: "Post-visit review request",
            contactName: appointment.name,
            channel: appointment.mobile ? "whatsapp" : "manual",
            dueAt: `${appointment.appointmentDate} 19:00`,
            source: "appointment",
            message: buildReviewRequestMessage(clinic, appointment.name)
          }),
          ...currentTasks
        ];
      });
    }

    setNotice(`Added appointment for ${appointment.name}.`);
  }

  function schedulePatientFollowUp(patientId) {
    const patient = patients.find((entry) => entry.id === patientId);

    if (!patient) {
      return;
    }

    setAutomationTasks((currentTasks) => [
      buildAutomationTask({
        title: "Manual patient follow-up",
        contactName: patient.name,
        channel: patient.phone ? "whatsapp" : patient.email ? "email" : "manual",
        dueAt: `${patient.nextFollowUp || patient.visitDate} 16:00`,
        source: "patient",
        message: "Check whether this patient needs another reminder."
      }),
      ...currentTasks
    ]);
    setNotice(`Scheduled a follow-up for ${patient.name}.`);
  }

  function scheduleEnquiryFollowUp(enquiryId) {
    const enquiry = enquiries.find((entry) => entry.id === enquiryId);

    if (!enquiry) {
      return;
    }

    setAutomationTasks((currentTasks) => [
      buildAutomationTask({
        title: "Lead reminder",
        contactName: enquiry.name,
        channel: enquiry.preferredChannel || "whatsapp",
        dueAt: `${enquiry.nextFollowUp || new Date().toISOString().slice(0, 10)} 13:00`,
        source: "enquiry",
        message: enquiry.note || "Send a follow-up message to this enquiry."
      }),
      ...currentTasks
    ]);
    setNotice(`Scheduled a follow-up for ${enquiry.name}.`);
  }

  function completeAutomationTask(taskId) {
    setAutomationTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, status: "done" } : task))
    );
    setNotice("Automation task marked complete.");
  }

  function advanceAppointmentStatus(appointmentId) {
    const statusOrder = ["new", "booked", "completed", "cancelled", "no_show"];
    let updatedAppointment = null;

    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) => {
        if (appointment.id !== appointmentId) {
          return appointment;
        }

        const currentIndex = statusOrder.indexOf(appointment.status);
        const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
        updatedAppointment = { ...appointment, status: nextStatus };
        return updatedAppointment;
      })
    );

    if (!updatedAppointment) {
      return;
    }

    if (updatedAppointment.status === "completed") {
      setPatients((currentPatients) => upsertPatientFromAppointment(currentPatients, updatedAppointment));

      setAutomationTasks((currentTasks) => {
        if (hasReviewRequestTask(currentTasks, updatedAppointment)) {
          return currentTasks;
        }

        return [
          buildAutomationTask({
            title: "Post-visit review request",
            contactName: updatedAppointment.name,
            channel: updatedAppointment.mobile ? "whatsapp" : "manual",
            dueAt: `${updatedAppointment.appointmentDate} 19:00`,
            source: "appointment",
            message: buildReviewRequestMessage(clinic, updatedAppointment.name)
          }),
          ...currentTasks
        ];
      });
    }

    if (updatedAppointment.status !== "completed") {
      setPatients((currentPatients) => upsertPatientFromAppointment(currentPatients, updatedAppointment));
    }

    setNotice(`Appointment status moved to ${updatedAppointment.status}.`);
  }

  function saveClinic(updates) {
    setClinic((currentClinic) => ({ ...currentClinic, ...updates }));
    setNotice(
      isClinicProfileComplete(updates)
        ? "Clinic settings saved."
        : "Practice profile saved locally. Add the remaining details to unlock cloud sync."
    );
  }

  function navigateTo(nextRoute) {
    if (typeof window === "undefined") {
      return;
    }

    window.history.pushState({}, "", nextRoute);
    setRoute(getCurrentRoute());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setNotice("Signed out successfully.");
  }

  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="eyebrow">ReviewPulse</p>
          <h1>Checking your workspace</h1>
          <p className="muted">Loading your secure practice workspace.</p>
        </div>
      </div>
    );
  }

  if (route !== "/app") {
    return (
        <AuthScreen
          authError={authError}
          clinicIsComplete={clinicIsComplete}
          openDashboard={() => navigateTo("/app")}
          session={session}
          setAuthError={setAuthError}
        />
    );
  }

  if (hasSupabaseEnv && !session) {
    return (
      <AuthScreen
        authError={authError}
        clinicIsComplete={clinicIsComplete}
        openDashboard={() => navigateTo("/app")}
        session={session}
        setAuthError={setAuthError}
      />
    );
  }

  if (session && !clinicIsComplete) {
    return (
      <ClinicSetupScreen clinic={clinic} handleLogout={handleLogout} saveClinic={saveClinic} />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">R</div>
          <div>
            <p className="brand-title">ReviewPulse</p>
            <p className="brand-subtitle">Practice Growth Console</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${activeView === item ? "active" : ""}`}
              onClick={() => setActiveView(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-label">Workspace</p>
          <h3>{clinic.name || "Set up your practice"}</h3>
          <p>{clinic.city || "Complete onboarding in Settings"}</p>
          <span className="status-pill">{clinic.plan}</span>
          <p className="sidebar-sync">
            Sync:{" "}
            {syncStatus === "supabase"
              ? "Supabase live"
              : syncStatus === "setup"
                ? "Setup required"
                : "Local only"}
          </p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeView}</p>
            <h1>Good afternoon, {clinic.owner || "Practice team"}</h1>
            <p className="muted">Here&apos;s what needs your attention today.</p>
          </div>
          <div className="topbar-actions">
            {session?.user?.email ? (
              <span className="user-chip">{session.user.email}</span>
            ) : null}
            <button className="ghost-button" onClick={exportReport} type="button">
              Export Report
            </button>
            <button className="primary-button" onClick={queueReviewRequests} type="button">
              Send Review Requests
            </button>
            {hasSupabaseEnv ? (
              <button className="ghost-button" onClick={handleLogout} type="button">
                Logout
              </button>
            ) : null}
          </div>
        </header>

        {notice ? <div className="notice-banner">{notice}</div> : null}

        {activeView === "Dashboard" && (
          <DashboardView
            appointments={appointments}
            automationStats={automationStats}
            automationTasks={automationTasks}
            campaigns={campaigns}
            clinicIsComplete={clinicIsComplete}
            enquiries={enquiries}
            feedbackItems={feedbackItems}
            reviews={reviews}
            regenerateDraft={regenerateDraft}
            setActiveView={setActiveView}
            stats={stats}
            updateReview={updateReview}
          />
        )}
        {activeView === "Reviews" && (
          <ReviewsView regenerateDraft={regenerateDraft} reviews={reviews} updateReview={updateReview} />
        )}
        {activeView === "Patients" && (
          <PatientsView
            patients={patients}
            schedulePatientFollowUp={schedulePatientFollowUp}
            setActiveView={setActiveView}
            setPatients={setPatients}
          />
        )}
        {activeView === "Campaigns" && (
          <CampaignsView addCampaign={addCampaign} campaigns={campaigns} />
        )}
        {activeView === "Enquiries" && (
          <EnquiriesView
            addEnquiry={addEnquiry}
            enquiries={enquiries}
            scheduleEnquiryFollowUp={scheduleEnquiryFollowUp}
            setEnquiries={setEnquiries}
          />
        )}
        {activeView === "Appointments" && (
          <AppointmentsView
            addAppointment={addAppointment}
            appointments={appointments}
            advanceAppointmentStatus={advanceAppointmentStatus}
            clinic={clinic}
          />
        )}
        {activeView === "Automations" && (
          <AutomationsView
            automationTasks={automationTasks}
            completeAutomationTask={completeAutomationTask}
          />
        )}
        {activeView === "Settings" && <SettingsView clinic={clinic} saveClinic={saveClinic} />}
      </main>
    </div>
  );
}

function AuthScreen({ authError, clinicIsComplete, openDashboard, session, setAuthError }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const plans = [
    {
      name: "Free",
      price: "INR 0",
      detail: "For clinics getting started with appointments and review automation",
      features: ["1 practice workspace", "Appointment + patient tracking", "Basic reports"]
    },
    {
      name: "Growth",
      price: "INR 4,999",
      detail: "For growing teams that need follow-up workflows",
      features: ["Everything in Starter", "Automations tab", "Review workflow + exports"],
      featured: true
    },
    {
      name: "Pro",
      price: "INR 9,999",
      detail: "For high-volume clinics and specialty groups",
      features: ["Everything in Growth", "Priority support", "Future multi-user controls"]
    }
  ];

  async function handleSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      setAuthError("Supabase is not configured for authentication.");
      return;
    }

    setSubmitting(true);
    setAuthError("");
    setStatusMessage("");

    const action =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await action;

    setSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (mode === "signup") {
      setStatusMessage("Account created. Check your inbox if email confirmation is enabled.");
    } else {
      setStatusMessage("Signed in successfully.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="public-shell">
        <header className="public-header">
          <div className="sidebar-brand public-brand">
            <div className="brand-mark">R</div>
            <div>
              <p className="brand-title">ReviewPulse</p>
              <p className="brand-subtitle">Reviews + Follow-Up Automation for Clinics</p>
            </div>
          </div>
          <nav className="public-nav">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#access">Access</a>
            {session ? (
              <button className="link-button public-nav-button" onClick={openDashboard} type="button">
                Dashboard
              </button>
            ) : null}
          </nav>
        </header>

        <section className="public-hero">
          <div className="public-copy">
            <p className="eyebrow">Built for clinics and specialty practices</p>
            <h1>Turn patient visits into reviews, replies, and repeatable follow-ups.</h1>
            <p className="muted public-lead">
              ReviewPulse helps dental, eye, ortho, skin, and specialty clinics collect more Google reviews,
              track appointments, follow up with patients, and send review requests after completed visits.
            </p>
            <div className="public-actions">
              {session ? null : (
                <>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setMode("signup");
                      setAuthError("");
                      setStatusMessage("");
                      window.location.hash = "#access";
                    }}
                    type="button"
                  >
                    Start free
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setMode("signin");
                      setAuthError("");
                      setStatusMessage("");
                      window.location.hash = "#access";
                    }}
                    type="button"
                  >
                    Login
                  </button>
                </>
              )}
            </div>
            <div className="public-stat-row">
              <div>
                <strong>1 dashboard</strong>
                <span>appointments, patients, reviews, automations</span>
              </div>
              <div>
                <strong>Multi-specialty</strong>
                <span>dental, eye, ortho, neuro, aesthetics, hospitals</span>
              </div>
              <div>
                <strong>Cloud ready</strong>
                <span>secure practice login with private workspace sync</span>
              </div>
            </div>
          </div>

          <div className="auth-card" id="access">
            <div>
              <p className="eyebrow">ReviewPulse Secure Access</p>
              <h2>
                {session && !showSwitchAccount
                  ? clinicIsComplete
                    ? "Welcome back"
                    : "Finish clinic setup"
                  : mode === "signin"
                    ? "Practice login"
                    : "Create practice access"}
              </h2>
              <p className="muted">
                {session && !showSwitchAccount
                  ? clinicIsComplete
                    ? "Open your dashboard directly, or switch to another clinic account only if needed."
                    : "Your account is ready. Complete clinic details first, then start using the dashboard."
                  : mode === "signin"
                    ? "Sign in to open your live review automation workspace."
                    : "Create your account and start onboarding your practice."}
              </p>
            </div>

            {session && !showSwitchAccount ? (
              <div className="signed-in-panel">
                <div className="signed-in-badge">{session.user?.email}</div>
                <button className="primary-button" onClick={openDashboard} type="button">
                  {clinicIsComplete ? "Open dashboard" : "Continue setup"}
                </button>
                <button
                  className="ghost-button auth-submit"
                  onClick={() => {
                    setShowSwitchAccount(true);
                    setMode("signin");
                    setAuthError("");
                    setStatusMessage("");
                  }}
                  type="button"
                >
                  Use another clinic account
                </button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                <label>
                  <span className="settings-label">Email</span>
                  <input
                    autoComplete="email"
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    value={email}
                  />
                </label>
                <label>
                  <span className="settings-label">Password</span>
                  <input
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />
                </label>
                <button className="primary-button auth-submit" disabled={submitting} type="submit">
                  {submitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            )}

            {authError ? <div className="auth-error">{authError}</div> : null}
            {statusMessage ? <div className="notice-banner auth-status">{statusMessage}</div> : null}

            <button
              className="link-button auth-switch"
              onClick={() => {
                setMode((currentMode) => (currentMode === "signin" ? "signup" : "signin"));
                setShowSwitchAccount(true);
                setAuthError("");
                setStatusMessage("");
              }}
              type="button"
            >
              {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>
        </section>

        <section className="public-section" id="features">
          <div className="public-section-head">
            <p className="eyebrow">What you get</p>
            <h2>One workspace for review growth and patient follow-up.</h2>
          </div>
          <div className="public-feature-grid">
            <article className="public-feature-card">
              <h3>Review requests</h3>
              <p>Track patients after visits and queue review reminders at the right time.</p>
            </article>
            <article className="public-feature-card">
              <h3>Reply workflow</h3>
              <p>Review incoming feedback, regenerate drafts, and approve responses faster.</p>
            </article>
            <article className="public-feature-card">
              <h3>Enquiry follow-up</h3>
              <p>Capture new leads, choose channels, and schedule the next action from one dashboard.</p>
            </article>
          </div>
        </section>

        <section className="public-section" id="pricing">
          <div className="public-section-head">
            <p className="eyebrow">Pricing</p>
            <h2>Simple plans for clinics starting with automation.</h2>
          </div>
          <div className="public-pricing-grid">
            {plans.map((plan) => (
              <article key={plan.name} className={`public-price-card ${plan.featured ? "featured" : ""}`}>
                <p className="price-plan">{plan.name}</p>
                <strong className="public-price-value">{plan.price}<span>/month</span></strong>
                <p className="muted">{plan.detail}</p>
                <ul className="public-price-list">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ClinicSetupScreen({ clinic, handleLogout, saveClinic }) {
  const [form, setForm] = useState(clinic);

  useEffect(() => {
    setForm(clinic);
  }, [clinic]);

  function handleSubmit(event) {
    event.preventDefault();
    saveClinic({
      ...form,
      name: form.name.trim(),
      city: form.city.trim(),
      owner: form.owner.trim(),
      googleReviewLink: form.googleReviewLink?.trim() || "",
      plan: form.plan || "Free Plan"
    });
  }

  const canActivateAutomation = Boolean(
    form.name?.trim() && form.city?.trim() && form.owner?.trim() && form.googleReviewLink?.trim()
  );

  return (
    <div className="auth-shell">
      <div className="setup-shell">
        <section className="setup-card">
          <p className="eyebrow">Welcome to ReviewPulse</p>
          <h1>Set up your clinic first</h1>
          <p className="muted">
            Add your clinic details and Google review link once. Then your team can start using appointments, patients, and review automation.
          </p>

          <form className="settings-form setup-form" onSubmit={handleSubmit}>
            <label>
              <span className="settings-label">Clinic Name</span>
              <input
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                placeholder="Vivek Derma Clinic"
                value={form.name}
              />
            </label>
            <label>
              <span className="settings-label">City</span>
              <input
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, city: event.target.value }))}
                placeholder="Bangalore"
                value={form.city}
              />
            </label>
            <label>
              <span className="settings-label">Owner / Admin</span>
              <input
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, owner: event.target.value }))}
                placeholder="Dr. Vivek"
                value={form.owner}
              />
            </label>
            <label>
              <span className="settings-label">Plan</span>
              <input disabled value={form.plan || "Free Plan"} />
            </label>
            <label className="settings-wide">
              <span className="settings-label">Google Review Link</span>
              <input
                required
                onChange={(event) =>
                  setForm((currentForm) => ({ ...currentForm, googleReviewLink: event.target.value }))
                }
                placeholder="Paste your Google review link here"
                value={form.googleReviewLink || ""}
              />
            </label>
            <div className="setup-actions">
              <button className="primary-button" disabled={!canActivateAutomation} type="submit">
                Start dashboard
              </button>
              <button className="ghost-button" onClick={handleLogout} type="button">
                Logout
              </button>
            </div>
          </form>
          {!canActivateAutomation ? (
            <p className="muted">
              Add clinic name, city, owner, and your Google review link to activate the dashboard.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function DashboardView({
  automationStats,
  automationTasks,
  appointments,
  campaigns,
  clinicIsComplete,
  enquiries,
  feedbackItems,
  regenerateDraft,
  reviews,
  setActiveView,
  stats,
  updateReview
}) {
  return (
    <>
      {!clinicIsComplete ? (
        <section className="panel onboarding-panel">
          <p className="eyebrow">Get Started</p>
          <h2>Finish your practice profile</h2>
          <p className="muted">
            Add your practice name, city, owner, and Google review link in Settings to activate private Supabase sync for this account.
          </p>
          <button className="primary-button small" onClick={() => setActiveView("Settings")} type="button">
            Complete setup
          </button>
        </section>
      ) : null}

      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className={`stat-card ${stat.accent ? "accent" : ""}`}>
            <p className="label">{stat.label}</p>
            <p className="value">{stat.value}</p>
            <p className="detail">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel panel-large">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Reviews</p>
              <h2>Reply queue</h2>
            </div>
            <button className="link-button" onClick={() => setActiveView("Reviews")} type="button">
              View all
            </button>
          </div>

          {reviews.slice(0, 2).map((review) => (
            <ReviewRow key={review.id} review={review} updateReview={updateReview} />
          ))}
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Automation</p>
                <h2>Automation center</h2>
              </div>
            </div>
            <div className="automation-grid">
              {automationStats.map((item) => (
                <article key={item.label} className="automation-tile">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </article>
              ))}
            </div>
            <SimpleList
              items={automationTasks.slice(0, 2)}
              titleKey="title"
              detailKey="dueAt"
            />
            <button className="link-button" onClick={() => setActiveView("Automations")} type="button">
              View tasks
            </button>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Campaigns</p>
                <h2>Review requests</h2>
              </div>
            </div>
            <div className="mini-metrics">
              <div>
                <strong>{campaigns.reduce((sum, campaign) => sum + campaign.sent, 0)}</strong>
                <span>sent</span>
              </div>
              <div>
                <strong>{campaigns.reduce((sum, campaign) => sum + campaign.delivered, 0)}</strong>
                <span>delivered</span>
              </div>
              <div>
                <strong>{campaigns.reduce((sum, campaign) => sum + campaign.clicked, 0)}</strong>
                <span>clicked</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Private Feedback</p>
                <h2>Needs attention</h2>
              </div>
              <span className="status-pill warm">{feedbackItems.length} open</span>
            </div>
            <SimpleList items={feedbackItems} titleKey="title" detailKey="submittedAt" />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Appointments</p>
                <h2>Visit pipeline</h2>
              </div>
              <span className="status-pill cool">
                {appointments.filter((appointment) => appointment.status === "completed").length} completed
              </span>
            </div>
            <SimpleList items={appointments.slice(0, 3)} titleKey="name" detailKey="doctor" />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Enquiries</p>
                <h2>Lead tracker</h2>
              </div>
              <span className="status-pill cool">
                {enquiries.filter((entry) => entry.status === "booked").length} booked
              </span>
            </div>
            <SimpleList items={enquiries} titleKey="name" detailKey="note" />
          </section>
        </div>
      </section>
    </>
  );
}

function ReviewsView({ regenerateDraft, reviews, updateReview }) {
  const [filter, setFilter] = useState("all");

  const filteredReviews = reviews.filter((review) => {
    if (filter === "all") {
      return true;
    }

    return review.status === filter;
  });

  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Reviews</p>
          <h2>All incoming reviews</h2>
        </div>
        <div className="toolbar">
          {["all", "ready", "needs_edit", "approved"].map((option) => (
            <button
              key={option}
              className={`ghost-button small ${filter === option ? "is-selected" : ""}`}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>
      {filteredReviews.map((review) => (
        <ReviewRow
          key={review.id}
          regenerateDraft={regenerateDraft}
          review={review}
          updateReview={updateReview}
        />
      ))}
    </section>
  );
}

function PatientsView({ patients, schedulePatientFollowUp, setActiveView, setPatients }) {
  function queueSingleRequest(patientId) {
    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.id === patientId ? { ...patient, reviewStatus: "sent" } : patient
      )
    );
  }

  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Patients</p>
          <h2>Review request list</h2>
        </div>
      </div>

      <div className="flow-hint">
        <div>
          <strong>Easy flow:</strong> add the person once in <span>Appointments</span>. ReviewPulse will
          auto-create the patient follow-up row here.
        </div>
        <button className="ghost-button small" onClick={() => setActiveView("Appointments")} type="button">
          Open appointments
        </button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Visit Date</th>
              <th>Review Status</th>
              <th>Feedback Status</th>
              <th>Contact</th>
              <th>Next Follow-up</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.name}</td>
                <td>{patient.visitDate}</td>
                <td><span className="chip">{patient.reviewStatus}</span></td>
                <td><span className="chip chip-soft">{patient.feedbackStatus}</span></td>
                <td>{patient.phone || patient.email || "Missing"}</td>
                <td>{patient.nextFollowUp || "-"}</td>
                <td>
                  <button
                    className="ghost-button small"
                    onClick={() => schedulePatientFollowUp(patient.id)}
                    type="button"
                  >
                    Follow-up
                  </button>
                  <button
                    className="ghost-button small"
                    disabled={patient.reviewStatus === "sent"}
                    onClick={() => queueSingleRequest(patient.id)}
                    type="button"
                  >
                    {patient.reviewStatus === "sent" ? "Queued" : "Queue request"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CampaignsView({ addCampaign, campaigns }) {
  const [form, setForm] = useState({
    name: "",
    sent: 0,
    delivered: 0,
    clicked: 0,
    status: "draft"
  });

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    addCampaign({
      ...form,
      name: form.name.trim(),
      sent: Number(form.sent),
      delivered: Number(form.delivered),
      clicked: Number(form.clicked)
    });

    setForm({
      name: "",
      sent: 0,
      delivered: 0,
      clicked: 0,
      status: "draft"
    });
  }

  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Campaigns</p>
          <h2>WhatsApp request flows</h2>
        </div>
      </div>

      <form className="inline-form campaign-form" onSubmit={handleSubmit}>
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
          placeholder="Campaign name"
          value={form.name}
        />
        <input
          min="0"
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, sent: event.target.value }))}
          placeholder="Sent"
          type="number"
          value={form.sent}
        />
        <input
          min="0"
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, delivered: event.target.value }))
          }
          placeholder="Delivered"
          type="number"
          value={form.delivered}
        />
        <input
          min="0"
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, clicked: event.target.value }))}
          placeholder="Clicked"
          type="number"
          value={form.clicked}
        />
        <select
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value }))}
          value={form.status}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
        </select>
        <button className="primary-button small" type="submit">
          Create campaign
        </button>
      </form>

      <div className="campaign-grid">
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="campaign-card">
            <div className="campaign-head">
              <h3>{campaign.name}</h3>
              <span className={`status-pill ${campaign.status === "draft" ? "cool" : ""}`}>
                {campaign.status}
              </span>
            </div>
            <div className="campaign-metrics">
              <div>
                <strong>{campaign.sent}</strong>
                <span>sent</span>
              </div>
              <div>
                <strong>{campaign.delivered}</strong>
                <span>delivered</span>
              </div>
              <div>
                <strong>{campaign.clicked}</strong>
                <span>clicked</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnquiriesView({ addEnquiry, enquiries, scheduleEnquiryFollowUp, setEnquiries }) {
  const [form, setForm] = useState({
    name: "",
    status: "awaiting_reply",
    note: "",
    phone: "",
    preferredChannel: "whatsapp",
    nextFollowUp: new Date().toISOString().slice(0, 10)
  });

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    addEnquiry({
      ...form,
      name: form.name.trim(),
      note: form.note.trim() || "Fresh enquiry captured"
    });

    setForm({
      name: "",
      status: "awaiting_reply",
      note: "",
      phone: "",
      preferredChannel: "whatsapp",
      nextFollowUp: new Date().toISOString().slice(0, 10)
    });
  }

  function cycleStatus(entryId) {
    const statuses = ["awaiting_reply", "follow_up_sent", "booked"];

    setEnquiries((currentEnquiries) =>
      currentEnquiries.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        const currentIndex = statuses.indexOf(entry.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        return { ...entry, status: nextStatus };
      })
    );
  }

  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Enquiries</p>
          <h2>Incoming lead tracker</h2>
        </div>
      </div>

      <div className="flow-hint">
        <div>
          <strong>Use this for people who asked but have not booked yet.</strong> Once they confirm,
          move them into <span>Appointments</span>.
        </div>
      </div>

      <form className="inline-form enquiry-form" onSubmit={handleSubmit}>
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
          placeholder="Lead name"
          value={form.name}
        />
        <select
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value }))}
          value={form.status}
        >
          <option value="awaiting_reply">awaiting_reply</option>
          <option value="follow_up_sent">follow_up_sent</option>
          <option value="booked">booked</option>
        </select>
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, note: event.target.value }))}
          placeholder="Latest note"
          value={form.note}
        />
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, phone: event.target.value }))}
          placeholder="Phone"
          value={form.phone}
        />
        <select
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, preferredChannel: event.target.value }))
          }
          value={form.preferredChannel}
        >
          <option value="whatsapp">whatsapp</option>
          <option value="sms">sms</option>
          <option value="email">email</option>
          <option value="phone">phone</option>
        </select>
        <input
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, nextFollowUp: event.target.value }))
          }
          type="date"
          value={form.nextFollowUp}
        />
        <button className="primary-button small" type="submit">
          Add enquiry
        </button>
      </form>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Status</th>
              <th>Channel</th>
              <th>Next Follow-up</th>
              <th>Latest Note</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.name}</td>
                <td><span className="chip">{entry.status}</span></td>
                <td>{entry.preferredChannel || "whatsapp"}</td>
                <td>{entry.nextFollowUp || "-"}</td>
                <td>{entry.note}</td>
                <td>
                  <button
                    className="ghost-button small"
                    onClick={() => scheduleEnquiryFollowUp(entry.id)}
                    type="button"
                  >
                    Schedule
                  </button>
                  <button className="ghost-button small" onClick={() => cycleStatus(entry.id)} type="button">
                    Advance status
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AppointmentsView({ addAppointment, appointments, advanceAppointmentStatus, clinic }) {
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    city: clinic?.city || "",
    doctor: "",
    appointmentDate: new Date().toISOString().slice(0, 10),
    status: "booked"
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setForm((currentForm) => ({
      ...currentForm,
      city: currentForm.city || clinic?.city || ""
    }));
  }, [clinic?.city]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.mobile.trim()) {
      setFormError("Enter patient name and mobile number.");
      return;
    }

    setFormError("");

    addAppointment({
      ...form,
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      city: form.city.trim() || clinic?.city || "Not set",
      doctor: form.doctor.trim() || clinic?.owner || "General doctor"
    });

    setForm({
      name: "",
      mobile: "",
      city: clinic?.city || "",
      doctor: "",
      appointmentDate: new Date().toISOString().slice(0, 10),
      status: "booked"
    });
  }

  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Appointments</p>
          <h2>Booked visits</h2>
        </div>
      </div>

      <div className="flow-hint">
        <div>
          <strong>Main receptionist flow:</strong> add appointment here first. Patients and review follow-ups will be created automatically from this step.
        </div>
      </div>

      <form className="inline-form appointment-form" onSubmit={handleSubmit}>
        <input
          required
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
          placeholder="Patient name"
          value={form.name}
        />
        <input
          required
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, mobile: event.target.value }))}
          placeholder="Mobile number"
          value={form.mobile}
        />
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, city: event.target.value }))}
          placeholder="City"
          value={form.city}
        />
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, doctor: event.target.value }))}
          placeholder="Doctor (optional)"
          value={form.doctor}
        />
        <input
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, appointmentDate: event.target.value }))
          }
          type="date"
          value={form.appointmentDate}
        />
        <select
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value }))}
          value={form.status}
        >
          <option value="new">new</option>
          <option value="booked">booked</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
          <option value="no_show">no_show</option>
        </select>
        <button className="primary-button small" type="submit">
          Add appointment
        </button>
      </form>

      {formError ? <div className="auth-error inline-error">{formError}</div> : null}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>City</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td>{appointment.name}</td>
                <td>{appointment.mobile}</td>
                <td>{appointment.city}</td>
                <td>{appointment.doctor}</td>
                <td>{appointment.appointmentDate}</td>
                <td><span className="chip">{appointment.status}</span></td>
                <td>
                  <button
                    className="ghost-button small"
                    onClick={() => advanceAppointmentStatus(appointment.id)}
                    type="button"
                  >
                    Advance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AutomationsView({ automationTasks, completeAutomationTask }) {
  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Automations</p>
          <h2>Scheduled follow-ups</h2>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Contact</th>
              <th>Channel</th>
              <th>Due</th>
              <th>Status</th>
              <th>Message</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {automationTasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.contactName}</td>
                <td>{task.channel}</td>
                <td>{task.dueAt}</td>
                <td><span className="chip">{task.status}</span></td>
                <td>{task.message}</td>
                <td>
                  <button
                    className="ghost-button small"
                    disabled={task.status === "done"}
                    onClick={() => completeAutomationTask(task.id)}
                    type="button"
                  >
                    {task.status === "done" ? "Completed" : "Mark done"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsView({ clinic, saveClinic }) {
  const [form, setForm] = useState(clinic);

  useEffect(() => {
    setForm(clinic);
  }, [clinic]);

  function handleSubmit(event) {
    event.preventDefault();
    saveClinic(form);
  }

  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Practice profile</h2>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span className="settings-label">Practice Name</span>
          <input
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
            value={form.name}
          />
        </label>
        <label>
          <span className="settings-label">City</span>
          <input
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, city: event.target.value }))}
            value={form.city}
          />
        </label>
        <label>
          <span className="settings-label">Plan</span>
          <select
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, plan: event.target.value }))}
            value={form.plan}
          >
            <option value="Free Plan">Free Plan</option>
            <option value="Growth Plan">Growth Plan</option>
            <option value="Premium Plan">Premium Plan</option>
          </select>
        </label>
        <label>
          <span className="settings-label">Owner</span>
          <input
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, owner: event.target.value }))}
            value={form.owner}
          />
        </label>
        <label className="settings-wide">
          <span className="settings-label">Google Review Link</span>
          <input
            onChange={(event) =>
              setForm((currentForm) => ({ ...currentForm, googleReviewLink: event.target.value }))
            }
            placeholder="Paste your Google review link here"
            value={form.googleReviewLink || ""}
          />
        </label>
        <button className="primary-button settings-submit" type="submit">
          Save settings
        </button>
      </form>
    </section>
  );
}

function ReviewRow({ regenerateDraft, review, updateReview }) {
  return (
    <div className="review-row">
      <div className="review-meta">
        <div className="avatar">{review.name[0]}</div>
        <div>
          <strong>{review.name}</strong>
          <p>
            {review.source} • {review.rating} stars
          </p>
          <span className={`status-pill ${review.status === "needs_edit" ? "warm" : "cool"}`}>
            {review.status.replace("_", " ")}
          </span>
        </div>
      </div>
      <div className="review-body">
        <p>{review.text}</p>
        <div className="draft-box">
          <span>AI draft reply</span>
          <textarea
            className="draft-input"
            onChange={(event) => updateReview(review.id, { draft: event.target.value })}
            value={review.draft}
          />
        </div>
      </div>
      <div className="review-actions">
        <button
          className="ghost-button small"
          onClick={() => regenerateDraft(review.id)}
          type="button"
        >
          Regenerate draft
        </button>
        <button
          className="ghost-button small"
          onClick={() =>
            updateReview(review.id, {
              status: review.status === "needs_edit" ? "ready" : "needs_edit"
            })
          }
          type="button"
        >
          {review.status === "needs_edit" ? "Mark ready" : "Needs edit"}
        </button>
        <button
          className="primary-button small"
          onClick={() => updateReview(review.id, { status: "approved" })}
          type="button"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function SimpleList({ items, titleKey, detailKey }) {
  return (
    <ul className="simple-list">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item[titleKey]}</strong>
          <span>{item[detailKey]}</span>
        </li>
      ))}
    </ul>
  );
}

export default App;
