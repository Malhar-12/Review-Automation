import { useEffect, useMemo, useRef, useState } from "react";
import {
  campaigns as initialCampaigns,
  clinic as initialClinic,
  enquiries as initialEnquiries,
  feedbackItems,
  patients as initialPatients,
  reviews as initialReviews
} from "./data";
import { getSchemaHelp, loadRemoteState, pushRemoteState } from "./supabaseState";

const navItems = ["Dashboard", "Reviews", "Patients", "Campaigns", "Enquiries", "Settings"];
const storageKey = "skinsignal-console-state";
const clinicSeed = { id: "default-clinic", ...initialClinic };

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

function normalizeRemoteState(remoteState) {
  return {
    clinic: ensureClinicId(remoteState.clinic ?? clinicSeed),
    reviews: remoteState.reviews?.length ? remoteState.reviews : initialReviews,
    patients: remoteState.patients?.length ? remoteState.patients : initialPatients,
    campaigns: remoteState.campaigns?.length ? remoteState.campaigns : initialCampaigns,
    enquiries: remoteState.enquiries?.length ? remoteState.enquiries : initialEnquiries
  };
}

function App() {
  const storedState = loadStoredState();
  const [activeView, setActiveView] = useState("Dashboard");
  const [notice, setNotice] = useState("Your workspace now saves changes in this browser and can sync with Supabase.");
  const [syncStatus, setSyncStatus] = useState("local");
  const [clinic, setClinic] = useState(ensureClinicId(storedState?.clinic ?? clinicSeed));
  const [reviews, setReviews] = useState(storedState?.reviews ?? initialReviews);
  const [patients, setPatients] = useState(storedState?.patients ?? initialPatients);
  const [campaigns, setCampaigns] = useState(storedState?.campaigns ?? initialCampaigns);
  const [enquiries, setEnquiries] = useState(storedState?.enquiries ?? initialEnquiries);
  const remoteReadyRef = useRef(false);
  const hasLoadedRemoteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapRemoteState() {
      const result = await loadRemoteState();

      if (cancelled) {
        return;
      }

      hasLoadedRemoteRef.current = true;

      if (result.available && result.state) {
        const nextState = normalizeRemoteState(result.state);
        setClinic(nextState.clinic);
        setReviews(nextState.reviews);
        setPatients(nextState.patients);
        setCampaigns(nextState.campaigns);
        setEnquiries(nextState.enquiries);
        setSyncStatus("supabase");
        remoteReadyRef.current = true;
        setNotice("Connected to Supabase. Changes now sync to your project tables.");
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
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        clinic,
        reviews,
        patients,
        campaigns,
        enquiries
      })
    );
  }, [campaigns, clinic, enquiries, patients, reviews]);

  useEffect(() => {
    if (!hasLoadedRemoteRef.current || !remoteReadyRef.current) {
      return undefined;
    }

    let cancelled = false;

    async function syncState() {
      const result = await pushRemoteState({ clinic, reviews, patients, campaigns, enquiries });

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
  }, [campaigns, clinic, enquiries, patients, reviews]);

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

    setPatients((currentPatients) =>
      currentPatients.map((patient) => {
        if (patient.reviewStatus === "pending") {
          sentCount += 1;
          return { ...patient, reviewStatus: "sent" };
        }

        return patient;
      })
    );

    setNotice(
      sentCount
        ? `Queued review requests for ${sentCount} patient${sentCount > 1 ? "s" : ""}.`
        : "All tracked patients already have a review action."
    );
    setActiveView("Patients");
  }

  function exportReport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      syncStatus,
      clinic,
      reviews,
      patients,
      campaigns,
      enquiries
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
    setNotice(`Added ${patient.name} to the review request list.`);
  }

  function addCampaign(campaign) {
    setCampaigns((currentCampaigns) => [{ id: Date.now(), ...campaign }, ...currentCampaigns]);
    setNotice(`Created the "${campaign.name}" campaign.`);
  }

  function addEnquiry(enquiry) {
    setEnquiries((currentEnquiries) => [{ id: Date.now(), ...enquiry }, ...currentEnquiries]);
    setNotice(`Added ${enquiry.name} to the lead tracker.`);
  }

  function saveClinic(updates) {
    setClinic((currentClinic) => ({ ...currentClinic, ...updates }));
    setNotice("Clinic settings saved.");
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
          <h3>{clinic.name}</h3>
          <p>{clinic.city}</p>
          <span className="status-pill">{clinic.plan}</span>
          <p className="sidebar-sync">Sync: {syncStatus === "supabase" ? "Supabase live" : "Local only"}</p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeView}</p>
            <h1>Good afternoon, {clinic.owner}</h1>
            <p className="muted">Here&apos;s what needs your attention today.</p>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" onClick={exportReport} type="button">
              Export Report
            </button>
            <button className="primary-button" onClick={queueReviewRequests} type="button">
              Send Review Requests
            </button>
          </div>
        </header>

        {notice ? <div className="notice-banner">{notice}</div> : null}

        {activeView === "Dashboard" && (
          <DashboardView
            campaigns={campaigns}
            enquiries={enquiries}
            feedbackItems={feedbackItems}
            reviews={reviews}
            setActiveView={setActiveView}
            stats={stats}
            updateReview={updateReview}
          />
        )}
        {activeView === "Reviews" && <ReviewsView reviews={reviews} updateReview={updateReview} />}
        {activeView === "Patients" && (
          <PatientsView addPatient={addPatient} patients={patients} setPatients={setPatients} />
        )}
        {activeView === "Campaigns" && (
          <CampaignsView addCampaign={addCampaign} campaigns={campaigns} />
        )}
        {activeView === "Enquiries" && (
          <EnquiriesView addEnquiry={addEnquiry} enquiries={enquiries} setEnquiries={setEnquiries} />
        )}
        {activeView === "Settings" && <SettingsView clinic={clinic} saveClinic={saveClinic} />}
      </main>
    </div>
  );
}

function DashboardView({
  campaigns,
  enquiries,
  feedbackItems,
  reviews,
  setActiveView,
  stats,
  updateReview
}) {
  return (
    <>
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

function ReviewsView({ reviews, updateReview }) {
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
        <ReviewRow key={review.id} review={review} updateReview={updateReview} />
      ))}
    </section>
  );
}

function PatientsView({ addPatient, patients, setPatients }) {
  const [form, setForm] = useState({
    name: "",
    visitDate: new Date().toISOString().slice(0, 10),
    reviewStatus: "pending",
    feedbackStatus: "unknown"
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
      name: ""
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
                <td>
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

function EnquiriesView({ addEnquiry, enquiries, setEnquiries }) {
  const [form, setForm] = useState({
    name: "",
    status: "awaiting_reply",
    note: ""
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
      note: ""
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
              <th>Latest Note</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.name}</td>
                <td><span className="chip">{entry.status}</span></td>
                <td>{entry.note}</td>
                <td>
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

function ReviewRow({ review, updateReview }) {
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
