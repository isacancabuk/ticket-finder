import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFetcher } from "react-router-dom";
import { apiFetch } from "../api";
import styles from "./QueryModal.module.css";

const STATUS_LABELS = {
  FINDING: "Searching",
  FOUND: "Found",
  STOPPED: "Stopped",
  ERROR: "Error",
};

export default function QueryModal({ query, onClose }) {
  const fetcher = useFetcher();
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Fetch logs lazily when modal opens
  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLogsLoading(true);
      try {
        const res = await apiFetch(`/queries/${query.id}/logs`);
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
  }, [query.id]);

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
            <span className={styles.infoLabel}>Status</span>
            <span
              className={styles.infoValue}
              data-status={query.status?.toLowerCase()}
            >
              {STATUS_LABELS[query.status] || query.status}
            </span>
          </div>
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
          <h3 className={styles.logsTitle}>Check Logs</h3>
          {logsLoading ? (
            <p className={styles.logsLoading}>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className={styles.logsEmpty}>Waiting for first scheduler run...</p>
          ) : (
            <div className={styles.logsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Available</th>
                    <th>Latency</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.checkedAt).toLocaleString()}</td>
                      <td>{log.status}</td>
                      <td>{log.isAvailable ? "Yes" : "No"}</td>
                      <td>{log.latencyMs != null ? `${log.latencyMs}ms` : "–"}</td>
                      <td className={styles.logError}>
                        {log.errorMessage || "–"}
                      </td>
                    </tr>
                  ))}
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
