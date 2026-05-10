import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  automationTasks as initialAutomationTasks,
  campaigns as initialCampaigns,
  clinic as initialClinic,
  enquiries as initialEnquiries,
  feedbackItems,
  patients as initialPatients,
  reviews as initialReviews
} from "./data";
import { hasSupabaseEnv, supabase } from "./supabase";
import { getSchemaHelp, loadRemoteState, pushRemoteState } from "./supabaseState";

const navItems = ["Dashboard", "Reviews", "Patients", "Campaigns", "Enquiries", "Automations", "Settings"];
const storageKey = "skinsignal-console-state";
const clinicSeed = { id: "default-clinic", ...initialClinic };

function createBlankClinic(owner = "Clinic team") {
  return {
    id: "default-clinic",
    name: "",
    city: "",
    plan: "Launch Plan",
    owner
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
  return Boolean(clinic?.name?.trim() && clinic?.city?.trim() && clinic?.owner?.trim());
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

function normalizeRemoteState(remoteState, session) {
  const blankClinic = createBlankClinic(getOwnerFromSession(session));

  return {
    clinic: ensureClinicId(remoteState.clinic ?? blankClinic),
    reviews: remoteState.reviews ?? [],
    patients: remoteState.patients ?? [],
    campaigns: remoteState.campaigns ?? [],
    enquiries: remoteState.enquiries ?? [],
    automationTasks: remoteState.automationTasks ?? []
  };
}

function App() {
  const storedState = loadStoredState();
  const [authReady, setAuthReady] = useState(!hasSupabaseEnv);
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState("");
  const [activeView, setActiveView] = useState("Dashboard");
  const [notice, setNotice] = useState("Your workspace now saves changes in this browser and can sync with Supabase.");
  const [syncStatus, setSyncStatus] = useState("local");
  const [clinic, setClinic] = useState(ensureClinicId(storedState?.clinic ?? clinicSeed));
  const [reviews, setReviews] = useState(storedState?.reviews ?? initialReviews);
  const [patients, setPatients] = useState(storedState?.patients ?? initialPatients);
  const [campaigns, setCampaigns] = useState(storedState?.campaigns ?? initialCampaigns);
  const [enquiries, setEnquiries] = useState(storedState?.enquiries ?? initialEnquiries);
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
        automationTasks
      })
    );
  }, [automationTasks, campaigns, clinic, enquiries, patients, reviews]);

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
  }, [automationTasks, campaigns, clinic, clinicIsComplete, enquiries, patients, reviews, session]);

  const stats = useMemo(() => {
    const ratingTotal = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length ? (ratingTotal / reviews.length).toFixed(1) : "0.0";
    const pendingReplies = reviews.filter((review) => review.status !== "approved").length;
    const sentRequests = patients.filter((patient) => patient.reviewStatus !== "pending").length;
    const bookedLeads = enquiries.filter((entry) => entry.status === "booked").length;

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
        label: "Booked Enquiries",
        value: String(bookedLeads),
        detail: `${enquiries.length} total leads in the tracker`,
        accent: true
      }
    ];
  }, [enquiries, patients, reviews]);

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
              message: "Send a reminder if the patient has not opened the review link."
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
    link.download = "skinsignal-report.json";
    link.click();
    window.URL.revokeObjectURL(url);
    setNotice("Exported a fresh JSON snapshot of the clinic workspace.");
  }

  function addPatient(patient) {
    setPatients((currentPatients) => [{ id: Date.now(), ...patient }, ...currentPatients]);
    setAutomationTasks((currentTasks) => [
      buildAutomationTask({
        title: "First review request",
        contactName: patient.name,
        channel: patient.phone ? "whatsapp" : patient.email ? "email" : "manual",
        dueAt: `${patient.nextFollowUp || patient.visitDate} 11:00`,
        source: "patient",
        message: "Send the first review request after the visit."
      }),
      ...currentTasks
    ]);
    setNotice(`Added ${patient.name} to the review request list.`);
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

  function saveClinic(updates) {
    setClinic((currentClinic) => ({ ...currentClinic, ...updates }));
    setNotice(
      isClinicProfileComplete(updates)
        ? "Clinic settings saved."
        : "Clinic profile saved locally. Add the remaining details to unlock cloud sync."
    );
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
          <p className="eyebrow">SkinSignal</p>
          <h1>Checking your workspace</h1>
          <p className="muted">Loading your secure clinic console.</p>
        </div>
      </div>
    );
  }

  if (hasSupabaseEnv && !session) {
    return <AuthScreen authError={authError} setAuthError={setAuthError} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div>
            <p className="brand-title">SkinSignal</p>
            <p className="brand-subtitle">Clinic Console</p>
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
          <p className="sidebar-label">Clinic</p>
          <h3>{clinic.name || "Set up your clinic"}</h3>
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
            <h1>Good afternoon, {clinic.owner || "Clinic team"}</h1>
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
            addPatient={addPatient}
            patients={patients}
            schedulePatientFollowUp={schedulePatientFollowUp}
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

function AuthScreen({ authError, setAuthError }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      <div className="auth-card">
        <div>
          <p className="eyebrow">SkinSignal Secure Access</p>
          <h1>{mode === "signin" ? "Clinic login" : "Create clinic access"}</h1>
          <p className="muted">
            {mode === "signin"
              ? "Sign in to open the live review automation dashboard."
              : "Create an account to protect this live dashboard before sharing it."}
          </p>
        </div>

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

        {authError ? <div className="auth-error">{authError}</div> : null}
        {statusMessage ? <div className="notice-banner auth-status">{statusMessage}</div> : null}

        <button
          className="link-button auth-switch"
          onClick={() => {
            setMode((currentMode) => (currentMode === "signin" ? "signup" : "signin"));
            setAuthError("");
            setStatusMessage("");
          }}
          type="button"
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function DashboardView({
  automationStats,
  automationTasks,
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
          <h2>Finish your clinic profile</h2>
          <p className="muted">
            Add your clinic name, city, and owner in Settings to activate private Supabase sync for this account.
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

function PatientsView({ addPatient, patients, schedulePatientFollowUp, setPatients }) {
  const [form, setForm] = useState({
    name: "",
    visitDate: new Date().toISOString().slice(0, 10),
    reviewStatus: "pending",
    feedbackStatus: "unknown",
    phone: "",
    email: "",
    nextFollowUp: new Date().toISOString().slice(0, 10)
  });

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    addPatient({
      ...form,
      name: form.name.trim()
    });

    setForm((currentForm) => ({
      ...currentForm,
      name: "",
      phone: "",
      email: ""
    }));
  }

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

      <form className="inline-form patients-form" onSubmit={handleSubmit}>
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
          placeholder="Patient name"
          value={form.name}
        />
        <input
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, visitDate: event.target.value }))
          }
          type="date"
          value={form.visitDate}
        />
        <select
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, reviewStatus: event.target.value }))
          }
          value={form.reviewStatus}
        >
          <option value="pending">pending</option>
          <option value="sent">sent</option>
          <option value="clicked">clicked</option>
          <option value="private_feedback">private_feedback</option>
        </select>
        <select
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, feedbackStatus: event.target.value }))
          }
          value={form.feedbackStatus}
        >
          <option value="unknown">unknown</option>
          <option value="happy">happy</option>
          <option value="needs_followup">needs_followup</option>
        </select>
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, phone: event.target.value }))}
          placeholder="Phone"
          value={form.phone}
        />
        <input
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
          placeholder="Email"
          value={form.email}
        />
        <input
          onChange={(event) =>
            setForm((currentForm) => ({ ...currentForm, nextFollowUp: event.target.value }))
          }
          type="date"
          value={form.nextFollowUp}
        />
        <button className="primary-button small" type="submit">
          Add patient
        </button>
      </form>

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
          <h2>Clinic profile</h2>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span className="settings-label">Clinic Name</span>
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
            <option value="Launch Plan">Launch Plan</option>
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
