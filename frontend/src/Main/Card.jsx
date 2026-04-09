import styles from "./Card.module.css";
import "/node_modules/flag-icons/css/flag-icons.min.css";

// Map backend status to data-status attribute values
const STATUS_MAP = {
  FINDING: "finding",
  FOUND: "found",
  STOPPED: "stopped",
  ERROR: "error",
};

const STATUS_LABELS = {
  FINDING: "Searching",
  FOUND: "Found",
  STOPPED: "Stopped",
  ERROR: "Error",
};

export default function Card({ query, onClick }) {
  const {
    eventName,
    domain,
    section,
    minSeats,
    status,
    eventUrl,
    lastErrorMessage,
  } = query;

  const site = "TicketMaster";
  const imgUrl = new URL(`../assets/${site}.png`, import.meta.url).href;
  const dataStatus = STATUS_MAP[status] || "finding";
  const statusLabel = STATUS_LABELS[status] || status;
  const countryCode = domain?.toLowerCase() || "de";

  const handleLinkClick = (e) => {
    // Prevent modal from opening when clicking the event URL
    e.stopPropagation();
  };

  return (
    <div
      className={styles.cardDiv}
      data-status={dataStatus}
      onClick={() => onClick(query)}
    >
      <div className={styles.imgDiv}>
        <img src={imgUrl} alt={site} />
      </div>
      <div className={styles.infoDiv}>
        <div className="flex flex-col items-center">
          <span
            className={`fi fi-${countryCode} ${styles.flag}`}
          ></span>
          <p className="font-bold">{countryCode.toUpperCase()}</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-2xl font-bold">{eventName || "Unknown Event"}</p>
          <p className="text-sm text-gray-500">{section}</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-500">
            Min Seats: <span className="font-bold">{minSeats}</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className={`font-bold text-2xl ${styles.statusText}`}>
            {statusLabel}
          </p>
          {status === "ERROR" && lastErrorMessage && (
            <p className={styles.errorMessage}>{lastErrorMessage}</p>
          )}
        </div>
        {eventUrl && (
          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.eventLink}
            onClick={handleLinkClick}
            title="Open event page"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}
