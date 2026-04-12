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
  const [logFilter, setLogFilter] = useState("significant"); // "significant", "all", "found"

  // Fetch logs lazily when modal opens or showAllLogs changes
  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLogsLoading(true);
      try {
        let logUrl = `/queries/${query.id}/logs`;
        if (logFilter === "significant") {
          logUrl += "?filter=significant";
        } else if (logFilter === "found") {
          logUrl += "?filter=found";
        }
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
  }, [query.id, logFilter]);

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
            <span className={styles.infoLabel}>Order Number</span>
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
            <span className={styles.infoLabel}>Min. Koltuk</span>
            <span className={styles.infoValue}>{query.minSeats}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Max. Fiyat</span>
            <span className={styles.infoValue}>{formatPrice(query.maxPrice, query.domain)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Durum</span>
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
              <span className={styles.infoLabel}>Konum</span>
              <span className={styles.infoValue}>{query.eventLocation}</span>
            </div>
          )}
          {query.eventDate && (
             <div className={styles.infoItem}>
               <span className={styles.infoLabel}>Tarih</span>
               <span className={styles.infoValue}>{query.eventDate}</span>
             </div>
          )}
          {query.lastCheckedAt && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Son Kontrol</span>
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
                Etkinlik Sayfası ↗
              </a>
            </div>
          )}
        </div>

        {/* Error message */}
        {query.status === "ERROR" && query.lastErrorMessage && (
          <div className={styles.errorBox}>
            <p className={styles.errorLabel}>Hata</p>
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
                Durdur
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
                Devam Et
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
              Sil
            </button>
          </fetcher.Form>
        </div>

        {/* Logs */}
        <div className={styles.logsSection}>
          <div className={styles.logsHeaderContainer}>
            <h3 className={styles.logsTitle}>Loglar</h3>
            <div className={styles.filterTabs}>
              <button 
                className={`${styles.filterTab} ${logFilter === 'significant' ? styles.activeTab : ''}`}
                onClick={() => setLogFilter('significant')}
              >
                Önemli
              </button>
              <button 
                className={`${styles.filterTab} ${logFilter === 'found' ? styles.activeTab : ''}`}
                onClick={() => setLogFilter('found')}
              >
                Bulunanlar
              </button>
              <button 
                className={`${styles.filterTab} ${logFilter === 'all' ? styles.activeTab : ''}`}
                onClick={() => setLogFilter('all')}
              >
                Tümü
              </button>
            </div>
          </div>
          <div className={styles.logsContent}>
            {logsLoading ? (
              <div className={styles.logsPlaceholder}><p>Yükleniyor...</p></div>
            ) : logs.length === 0 ? (
              <div className={styles.logsPlaceholder}><p>İlk kontrol bekleniyor veya parametre eşleşen log bulunamadı...</p></div>
            ) : (
              <div className={styles.logsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Zaman</th>
                    <th>Durum</th>
                    <th>Fiyat</th>
                    <th>Mevcut</th>
                    <th>Gecikme</th>
                    <th>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                     let rowStatus = log.status;
                     let rowClass = "";
                     if (log.priceExceeded) {
                       rowStatus = "Fiyat Aşıldı";
                       rowClass = styles.logRowPriceExceeded;
                     }

                     return (
                      <tr key={log.id} className={rowClass}>
                        <td>{new Date(log.checkedAt).toLocaleString()}</td>
                        <td>{rowStatus}</td>
                        <td>{formatPrice(log.foundPrice, query.domain)}</td>
                        <td>{log.isAvailable ? "Evet" : "Hayır"}</td>
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
      </div>
    </div>,
    document.body
  );
}
