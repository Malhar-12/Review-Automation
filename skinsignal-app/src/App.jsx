import { useState } from "react";
import {
  campaigns,
  clinic,
  enquiries,
  feedbackItems,
  patients,
  reviews,
  stats
} from "./data";

const navItems = ["Dashboard", "Reviews", "Patients", "Campaigns", "Enquiries", "Settings"];

function App() {
  const [activeView, setActiveView] = useState("Dashboard");

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
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeView}</p>
            <h1>Good afternoon, {clinic.owner}</h1>
            <p className="muted">Here’s what needs your attention today.</p>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" type="button">Export Report</button>
            <button className="primary-button" type="button">Send Review Requests</button>
          </div>
        </header>

        {activeView === "Dashboard" && <DashboardView />}
        {activeView === "Reviews" && <ReviewsView />}
        {activeView === "Patients" && <PatientsView />}
        {activeView === "Campaigns" && <CampaignsView />}
        {activeView === "Enquiries" && <EnquiriesView />}
        {activeView === "Settings" && <SettingsView />}
      </main>
    </div>
  );
}

function DashboardView() {
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
            <button className="link-button" type="button">View all</button>
          </div>

          {reviews.slice(0, 2).map((review) => (
            <ReviewRow key={review.id} review={review} />
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
                <strong>142</strong>
                <span>sent</span>
              </div>
              <div>
                <strong>91</strong>
                <span>delivered</span>
              </div>
              <div>
                <strong>24</strong>
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
              <span className="status-pill warm">2 open</span>
            </div>
            <SimpleList items={feedbackItems} titleKey="title" detailKey="submittedAt" />
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Enquiries</p>
                <h2>Lead tracker</h2>
              </div>
              <span className="status-pill cool">8 booked</span>
            </div>
            <SimpleList items={enquiries} titleKey="name" detailKey="note" />
          </section>
        </div>
      </section>
    </>
  );
}

function ReviewsView() {
  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Reviews</p>
          <h2>All incoming reviews</h2>
        </div>
        <div className="toolbar">
          <button className="ghost-button small" type="button">Import reviews</button>
          <button className="primary-button small" type="button">Generate drafts</button>
        </div>
      </div>
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </section>
  );
}

function PatientsView() {
  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Patients</p>
          <h2>Review request list</h2>
        </div>
        <div className="toolbar">
          <button className="ghost-button small" type="button">Download CSV template</button>
          <button className="primary-button small" type="button">Upload patient list</button>
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Visit Date</th>
              <th>Review Status</th>
              <th>Feedback Status</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.name}</td>
                <td>{patient.visitDate}</td>
                <td><span className="chip">{patient.reviewStatus}</span></td>
                <td><span className="chip chip-soft">{patient.feedbackStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CampaignsView() {
  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Campaigns</p>
          <h2>WhatsApp request flows</h2>
        </div>
        <button className="primary-button small" type="button">Create campaign</button>
      </div>
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

function EnquiriesView() {
  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Enquiries</p>
          <h2>Incoming lead tracker</h2>
        </div>
        <button className="ghost-button small" type="button">Filter by status</button>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Status</th>
              <th>Latest Note</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.name}</td>
                <td><span className="chip">{entry.status}</span></td>
                <td>{entry.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsView() {
  return (
    <section className="panel full-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Clinic profile</h2>
        </div>
      </div>
      <div className="settings-grid">
        <article className="settings-card">
          <span className="settings-label">Clinic Name</span>
          <strong>{clinic.name}</strong>
        </article>
        <article className="settings-card">
          <span className="settings-label">City</span>
          <strong>{clinic.city}</strong>
        </article>
        <article className="settings-card">
          <span className="settings-label">Plan</span>
          <strong>{clinic.plan}</strong>
        </article>
        <article className="settings-card">
          <span className="settings-label">Google Review Link</span>
          <strong>Connected manually in MVP</strong>
        </article>
      </div>
    </section>
  );
}

function ReviewRow({ review }) {
  return (
    <div className="review-row">
      <div className="review-meta">
        <div className="avatar">{review.name[0]}</div>
        <div>
          <strong>{review.name}</strong>
          <p>{review.source} • {review.rating} stars</p>
        </div>
      </div>
      <div className="review-body">
        <p>{review.text}</p>
        <div className="draft-box">
          <span>AI draft reply</span>
          <p>{review.draft}</p>
        </div>
      </div>
      <div className="review-actions">
        <button className="ghost-button small" type="button">Edit</button>
        <button className="primary-button small" type="button">
          {review.status === "needs_edit" ? "Revise" : "Approve"}
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
