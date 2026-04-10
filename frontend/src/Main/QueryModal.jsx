import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFetcher } from "react-router-dom";
import { apiFetch } from "../api";
import styles from "./QueryModal.module.css";

const CURRENCY_MAP = {
  DE: { symbol: "€", code: "EUR" },
  UK: { symbol: "£", code: "GBP" },
};

function formatPrice(cents, domain) {
  if (cents == null) return "–";
  const { symbol } = CURRENCY_MAP[domain] || { symbol: "€" };
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

// Derive display status from backend fields
function getDisplayStatus(query) {
  if (query.status === "FOUND") return "found";
  if (query.status === "STOPPED") return "stopped";
  if (query.status === "ERROR") return "error";
  if (query.priceExceeded && query.foundPrice != null) return "price_exceeded";
  return "finding";
}

const STATUS_LABELS = {
  finding: "Searching",
  found: "Found",
  stopped: "Stopped",
  error: "Error",
  price_exceeded: "Price Exceeded",
};

export default function QueryModal({ query, onClose }) {
  const fetcher = useFetcher();
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Fetch logs lazily when modal opens or showAllLogs changes
  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLogsLoading(true);
      try {
        const logUrl = showAllLogs
          ? `/queries/${query.id}/logs`
          : `/queries/${query.id}/logs?filter=significant`;
        const res = await apiFetch(logUrl);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setLogs(data);
        }
      } catch {
        // Silently fail — logs are non-critical
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }

    fetchLogs();
    return () => { cancelled = true; };
  }, [query.id, showAllLogs]);

  // Close modal after delete completes
  useEffect(() => {
    if (fetcher.data?.deleted) {
      onClose();
    }
  }, [fetcher.data, onClose]);

  const isBusy = fetcher.state !== "idle";
  const canStop = query.status === "FINDING" || query.status === "FOUND";
  const canResume = query.status === "STOPPED" || query.status === "ERROR";

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const displayStatus = getDisplayStatus(query);

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {query.eventName || "Unknown Event"}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Query Info */}
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Order No</span>
            <span className={styles.infoValue}>{query.orderNo || "–"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Domain</span>
            <span className={styles.infoValue}>{query.domain}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Section</span>
            <span className={styles.infoValue}>{query.section}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Min Seats</span>
            <span className={styles.infoValue}>{query.minSeats}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Max Price</span>
            <span className={styles.infoValue}>{formatPrice(query.maxPrice, query.domain)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <span
              className={styles.infoValue}
              data-status={displayStatus}
            >
              {STATUS_LABELS[displayStatus] || displayStatus}
              {displayStatus === "price_exceeded" && ` (${formatPrice(query.foundPrice, query.domain)})`}
            </span>
          </div>
          {query.eventLocation && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Location</span>
              <span className={styles.infoValue}>{query.eventLocation}</span>
            </div>
          )}
          {query.eventDate && (
             <div className={styles.infoItem}>
               <span className={styles.infoLabel}>Date</span>
               <span className={styles.infoValue}>{query.eventDate}</span>
             </div>
          )}
          {query.lastCheckedAt && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Last Checked</span>
              <span className={styles.infoValue}>
                {new Date(query.lastCheckedAt).toLocaleString()}
              </span>
            </div>
          )}
          {query.eventUrl && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Event URL</span>
              <a
                href={query.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                Open event page ↗
              </a>
            </div>
          )}
        </div>

        {/* Error message */}
        {query.status === "ERROR" && query.lastErrorMessage && (
          <div className={styles.errorBox}>
            <p className={styles.errorLabel}>Error</p>
            <p className={styles.errorText}>{query.lastErrorMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {canStop && (
            <fetcher.Form method="POST">
              <input type="hidden" name="_action" value="stop" />
              <input type="hidden" name="queryId" value={query.id} />
              <button
                type="submit"
                className={styles.btnStop}
                disabled={isBusy}
              >
                Stop
              </button>
            </fetcher.Form>
          )}
          {canResume && (
            <fetcher.Form method="POST">
              <input type="hidden" name="_action" value="resume" />
              <input type="hidden" name="queryId" value={query.id} />
              <button
                type="submit"
                className={styles.btnResume}
                disabled={isBusy}
              >
                Resume
              </button>
            </fetcher.Form>
          )}
          <fetcher.Form method="POST">
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="queryId" value={query.id} />
            <button
              type="submit"
              className={styles.btnDelete}
              disabled={isBusy}
            >
              Delete
            </button>
          </fetcher.Form>
        </div>

        {/* Logs */}
        <div className={styles.logsSection}>
          <div className={styles.logsHeaderContainer}>
            <h3 className={styles.logsTitle}>Check Logs</h3>
            <button
               className={styles.btnToggleLogs}
               onClick={() => setShowAllLogs(!showAllLogs)}
            >
              {showAllLogs ? "Show Important Only" : "Show All"}
            </button>
          </div>
          {logsLoading ? (
            <p className={styles.logsLoading}>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className={styles.logsEmpty}>Waiting for first scheduler run or no logs matched parameter...</p>
          ) : (
            <div className={styles.logsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th>Latency</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                     let rowStatus = log.status;
                     let rowClass = "";
                     if (log.priceExceeded) {
                       rowStatus = "Price Exceeded";
                       rowClass = styles.logRowPriceExceeded;
                     }

                     return (
                      <tr key={log.id} className={rowClass}>
                        <td>{new Date(log.checkedAt).toLocaleString()}</td>
                        <td>{rowStatus}</td>
                        <td>{formatPrice(log.foundPrice, query.domain)}</td>
                        <td>{log.isAvailable ? "Yes" : "No"}</td>
                        <td>{log.latencyMs != null ? `${log.latencyMs}ms` : "–"}</td>
                        <td className={styles.logError}>
                          {log.errorMessage || "–"}
                        </td>
                      </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
