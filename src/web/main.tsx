import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-sans/latin-800.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  ExternalLink,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Overview, Slot } from "../shared/types.js";
import "./styles.css";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed.");
  return body;
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
const tomorrow = () =>
  new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function App() {
  const [data, setData] = useState<Overview>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [view, setView] = useState("Overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState(false),
    [bookingService, setBookingService] = useState("consultation"),
    [busy, setBusy] = useState("");
  async function refresh() {
    try {
      setData(await api<Overview>("/api/overview"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function cancel(id: string) {
    setBusy(id);
    try {
      await api(`/api/bookings/${id}/cancel`, { method: "POST", body: "{}" });
      setNotice("Reservation cancelled. Those seats are available again.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function changeFault(kind: string) {
    try {
      await api("/api/demo/fault", {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const bookings = (data?.bookings || []).filter(
    (b) =>
      (filter === "all" || b.status === filter) &&
      `${b.name} ${b.email} ${b.serviceName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const upcoming = (data?.bookings || [])
    .filter(
      (b) =>
        b.status === "confirmed" &&
        new Date(`${b.date}T${b.time}:00Z`).getTime() > Date.now(),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const openBooking = (id = "consultation") => {
    setBookingService(id);
    setModal(true);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <Layers3 size={22} />
          </span>
          <span>
            company a<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Company A</strong>
            <small>Booking workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "Reservations", icon: CalendarDays },
            { name: "Services", icon: Layers3 },
            { name: "Activity", icon: Zap },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "nav-item active" : "nav-item"}
              onClick={() => setView(name)}
            >
              <Icon size={18} />
              {name}
              {name === "Reservations" && (
                <span className="nav-count">
                  {data?.metrics.confirmed || 0}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-note">
            <ShieldCheck size={20} />
            <strong>A little room to experiment.</strong>
            <p>
              Standalone demo company.
              <br />
              Scoped demo connector available.
            </p>
            <span className="mini-tag">LOCAL DEVELOPMENT</span>
          </div>
          <div className="profile">
            <span className="profile-avatar">JA</span>
            <div>
              <strong>Workspace operator</strong>
              <small>Local demo · no sign-in</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <span
              className={`status-pill ${data?.health === "degraded" ? "degraded" : ""}`}
            >
              <i />
              {data
                ? data.health === "healthy"
                  ? "Systems operational"
                  : "System degraded"
                : "Connecting"}
            </span>
            <span className="topbar-avatar">A</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR BUSINESS, IN FOCUS</div>
              <h1>
                {view === "Overview"
                  ? "Good things are on the calendar."
                  : view === "Reservations"
                    ? "Every reservation, in one place."
                    : view === "Services"
                      ? "Make time for what you do best."
                      : "A clear record of what happened."}
              </h1>
              <p>
                {view === "Overview"
                  ? "A little less admin. A little more time for your customers."
                  : view === "Reservations"
                    ? "Manage bookings, find a customer, or free up a seat."
                    : view === "Services"
                      ? "Three simple ways for customers to spend time with you."
                      : "Real events from this company. No pre-filled activity."}
              </p>
            </div>
            <button className="button primary" onClick={() => openBooking()}>
              <Plus size={17} />
              New reservation
            </button>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}
          {!data ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Opening your workspace…
            </div>
          ) : (
            <>
              {view === "Overview" && (
                <>
                  <div className="metrics-grid">
                    {[
                      {
                        label: "Confirmed reservations",
                        value: data.metrics.confirmed,
                        icon: CalendarDays,
                        note: "Across all dates",
                        color: "violet",
                      },
                      {
                        label: "Reserved value",
                        value: money(data.metrics.revenue),
                        icon: CreditCard,
                        note: "Confirmed bookings · not collected payments",
                        color: "teal",
                      },
                      {
                        label: "Seats reserved",
                        value: data.metrics.occupiedSeats,
                        icon: Users,
                        note: "Capacity is checked at booking",
                        color: "amber",
                      },
                      {
                        label: "Next appointment",
                        value: upcoming[0]
                          ? shortDate(upcoming[0].date)
                          : "A fresh start",
                        icon: Clock3,
                        note: upcoming[0]
                          ? `${upcoming[0].time} UTC · ${upcoming[0].serviceName}`
                          : "Your calendar is ready",
                        color: "blue",
                      },
                    ].map(({ label, value, icon: Icon, note, color }) => (
                      <section className="metric-card" key={label}>
                        <div className="metric-top">
                          <span>{label}</span>
                          <span className={`icon-box ${color}`}>
                            <Icon size={17} />
                          </span>
                        </div>
                        <strong className="metric-value">{value}</strong>
                        <small>{note}</small>
                      </section>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="card calendar-card">
                      <div className="section-heading">
                        <div>
                          <h2>The week ahead</h2>
                          <p>Confirmed seats · next seven days · UTC</p>
                        </div>
                        <CalendarDays size={18} />
                      </div>
                      <div className="week-chart">
                        {Array.from({ length: 7 }, (_, i) => {
                          const date = new Date(Date.now() + i * 86400000)
                            .toISOString()
                            .slice(0, 10);
                          const seats = data.bookings
                            .filter(
                              (b) =>
                                b.date === date && b.status === "confirmed",
                            )
                            .reduce((n, b) => n + b.seats, 0);
                          const max = Math.max(
                            4,
                            ...Array.from({ length: 7 }, (_, j) =>
                              data.bookings
                                .filter(
                                  (b) =>
                                    b.date ===
                                      new Date(Date.now() + j * 86400000)
                                        .toISOString()
                                        .slice(0, 10) &&
                                    b.status === "confirmed",
                                )
                                .reduce((n, b) => n + b.seats, 0),
                            ),
                          );
                          return (
                            <div
                              className={`chart-column ${i === 0 ? "today" : ""}`}
                              key={date}
                            >
                              <span className="chart-value">{seats}</span>
                              <div className="bar-track">
                                <div
                                  className="bar"
                                  style={{
                                    height: `${Math.max(3, (seats / max) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span>
                                {new Date(`${date}T12:00Z`).toLocaleDateString(
                                  "en-US",
                                  { weekday: "short", timeZone: "UTC" },
                                )}
                              </span>
                              <small>{shortDate(date)}</small>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="welcome-card">
                      <div className="welcome-decoration">
                        <Sparkles size={32} />
                        <span className="orbit one" />
                        <span className="orbit two" />
                      </div>
                      <span className="mini-tag">BUILT FOR YOUR DAY</span>
                      <h2>
                        Less back-and-forth.
                        <br />
                        More booked-in.
                      </h2>
                      <p>
                        Pick a service, choose a time, and we’ll keep the seats
                        in check.
                      </p>
                      <button
                        className="button dark"
                        onClick={() => openBooking()}
                      >
                        Book something good <ArrowUpRight size={17} />
                      </button>
                    </section>
                  </div>
                </>
              )}
              {(view === "Overview" || view === "Reservations") && (
                <section className="card reservations">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {view === "Overview"
                          ? "Recent reservations"
                          : "All reservations"}{" "}
                        <span className="count">{data.bookings.length}</span>
                      </h2>
                      <p>A real-time view of your customer calendar.</p>
                    </div>
                    {view === "Overview" && (
                      <button
                        className="text-button"
                        onClick={() => setView("Reservations")}
                      >
                        View all <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                  <div className="table-toolbar">
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search reservations"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, email or service…"
                      />
                    </label>
                    <select
                      aria-label="Filter reservation status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Service</th>
                          <th>Date & time</th>
                          <th>Seats</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings
                          .slice(0, view === "Overview" ? 5 : 1000)
                          .map((b) => (
                            <tr key={b.id}>
                              <td>
                                <div className="customer">
                                  <span className="customer-avatar">
                                    {b.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join("")
                                      .toUpperCase()}
                                  </span>
                                  <div>
                                    <strong>{b.name}</strong>
                                    <small>{b.email}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{b.serviceName}</td>
                              <td>
                                <strong>{shortDate(b.date)}</strong>
                                <small>{b.time} UTC</small>
                              </td>
                              <td>{b.seats}</td>
                              <td>
                                <span className={`booking-status ${b.status}`}>
                                  <i />
                                  {b.status}
                                </span>
                              </td>
                              <td>
                                {b.status === "confirmed" && (
                                  <button
                                    className="text-button subtle"
                                    disabled={busy === b.id}
                                    onClick={() => void cancel(b.id)}
                                  >
                                    {busy === b.id ? "Cancelling…" : "Cancel"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {bookings.length === 0 && (
                      <div className="empty-state">
                        <span className="empty-icon">
                          <CalendarDays size={26} />
                        </span>
                        <h3>
                          {query || filter !== "all"
                            ? "No matching reservations"
                            : "Your calendar has room for something good."}
                        </h3>
                        <p>
                          {query || filter !== "all"
                            ? "Try another search or status."
                            : "Create your first reservation. We’ll handle the capacity checks."}
                        </p>
                        {!query && filter === "all" && (
                          <button
                            className="text-button"
                            onClick={() => openBooking()}
                          >
                            Make the first booking <ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}
              {(view === "Overview" || view === "Services") && (
                <section className="services-section">
                  <div className="section-heading">
                    <div>
                      <h2>Your services</h2>
                      <p>Ready to book. Thoughtfully simple.</p>
                    </div>
                    <span className="small-muted">3 active services</span>
                  </div>
                  <div className="service-grid">
                    {data.services.map((s, i) => (
                      <article key={s.id} className={`service-card ${s.color}`}>
                        <div className="service-card-top">
                          <span className={`icon-box ${s.color}`}>
                            {i === 0 ? (
                              <Sparkles size={20} />
                            ) : i === 1 ? (
                              <Users size={20} />
                            ) : (
                              <ArrowDownLeft size={20} />
                            )}
                          </span>
                          <span className="service-duration">
                            <Clock3 size={13} />
                            {s.duration} min
                          </span>
                        </div>
                        <h3>{s.name}</h3>
                        <p>{s.description}</p>
                        <div className="service-bottom">
                          <div>
                            <strong>{money(s.price)}</strong>
                            <small>/ person · up to {s.capacity} seats</small>
                          </div>
                          <button
                            aria-label={`Book ${s.name}`}
                            onClick={() => openBooking(s.id)}
                          >
                            <ArrowUpRight size={20} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {view === "Activity" && (
                <section className="card activity-card">
                  <h2>Workspace activity</h2>
                  {data.events.length === 0 ? (
                    <div className="empty-state">
                      <Zap size={28} />
                      <h3>Quiet is a good place to start.</h3>
                      <p>Your first booking will appear here.</p>
                    </div>
                  ) : (
                    data.events.map((e) => (
                      <div className="activity-row" key={e.id}>
                        <span className="icon-box teal">
                          <Check size={16} />
                        </span>
                        <div>
                          <strong>{e.message}</strong>
                          <small>{e.type}</small>
                        </div>
                        <time>{new Date(e.createdAt).toLocaleString()}</time>
                      </div>
                    ))
                  )}
                </section>
              )}
              {data.demoFaultsEnabled && (
                <section className="demo-controls">
                  <div>
                    <Zap size={17} />
                    <strong>Local incident controls</strong>
                    <span>Isolated to this app. Not connected to MAYA.</span>
                  </div>
                  <select
                    aria-label="Demo fault"
                    value={data.fault}
                    onChange={(e) => void changeFault(e.target.value)}
                  >
                    <option value="none">Healthy baseline</option>
                    <option value="capacity-regression">
                      Capacity regression
                    </option>
                    <option value="dependency-unavailable">
                      Dependency unavailable
                    </option>
                  </select>
                </section>
              )}
              <footer>
                <span>
                  <ShieldCheck size={13} />
                  Standalone V1 · persistent SQLite storage
                </span>
                <a href="/api/health" target="_blank" rel="noreferrer">
                  Health endpoint <ExternalLink size={12} />
                </a>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && data && (
        <BookingDialog
          data={data}
          initialService={bookingService}
          close={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            setNotice("Reservation confirmed. You’re on the calendar.");
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function BookingDialog({
  data,
  initialService,
  close,
  onSaved,
}: {
  data: Overview;
  initialService: string;
  close: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef({ payload: "", key: "" });
  const [serviceId, setService] = useState(initialService),
    [date, setDate] = useState(tomorrow()),
    [slots, setSlots] = useState<Slot[]>([]),
    [time, setTime] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [seats, setSeats] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const service = data.services.find((s) => s.id === serviceId)!;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTime("");
    setSlots([]);
    void api<Slot[]>(
      `/api/slots?serviceId=${encodeURIComponent(serviceId)}&date=${date}`,
    )
      .then((s) => {
        if (!cancelled) {
          setSlots(s);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, date]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = JSON.stringify({
      serviceId,
      name,
      email,
      date,
      time,
      seats,
    });
    if (request.current.payload !== payload)
      request.current = { payload, key: crypto.randomUUID() };
    try {
      await api("/api/bookings", {
        method: "POST",
        body: payload,
        headers: { "Idempotency-Key": request.current.key },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="booking-dialog"
      onCancel={close}
      aria-labelledby="booking-title"
    >
      <form onSubmit={(e) => void submit(e)}>
        <div className="dialog-heading">
          <span className="icon-box violet">
            <CalendarDays size={22} />
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Close booking"
          >
            <X size={20} />
          </button>
        </div>
        <div className="eyebrow">LET’S GET YOU BOOKED</div>
        <h2 id="booking-title">Make a little time.</h2>
        <p>All times are in UTC. Reservations are saved locally.</p>
        <label>
          Service
          <select
            value={serviceId}
            onChange={(e) => {
              setService(e.target.value);
              setSeats(1);
            }}
          >
            {data.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration} min
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Date
            <input
              required
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              max={new Date(Date.now() + 30 * 86400000)
                .toISOString()
                .slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Seats
            <input
              required
              type="number"
              min="1"
              max={service.capacity}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </label>
        </div>
        <fieldset>
          <legend>
            Choose a time <span>UTC</span>
          </legend>
          {loading ? (
            <div className="slot-loading">Finding available times…</div>
          ) : (
            <div className="slots">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s.time}
                  disabled={!s.available || s.remaining < seats}
                  className={time === s.time ? "selected" : ""}
                  onClick={() => setTime(s.time)}
                >
                  {s.time}
                  <small>{s.remaining} left</small>
                </button>
              ))}
            </div>
          )}
        </fieldset>
        <label>
          Your name
          <input
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
          />
        </label>
        <label>
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
          />
        </label>
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <div className="booking-total">
          <span>Total reserved value</span>
          <strong>{money(service.price * seats)}</strong>
        </div>
        <button
          className="button primary full"
          disabled={busy || !time || loading}
          type="submit"
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <CheckCircle2 size={17} />
          )}{" "}
          {busy ? "Confirming…" : "Confirm reservation"}
        </button>
        <small className="form-footnote">
          Demo only. No payment is collected.
        </small>
      </form>
    </dialog>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
