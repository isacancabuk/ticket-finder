import styles from "./Card.module.css";
import "/node_modules/flag-icons/css/flag-icons.min.css";

const CURRENCY_MAP = {
  DE: { symbol: "€", code: "EUR" },
  UK: { symbol: "£", code: "GBP" },
};

function formatPrice(cents, domain) {
  const { symbol } = CURRENCY_MAP[domain] || { symbol: "€" };
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function getDisplayStatus(query) {
  if (query.status === "FOUND") return "found";
  if (query.status === "STOPPED") return "stopped";
  if (query.status === "ERROR") return "error";
  if (query.priceExceeded && query.foundPrice != null) return "price_exceeded";
  return "finding";
}

// Frontend Status etiketleri
const STATUS_LABELS = {
  finding: "ARANIYOR",
  found: "BULUNDU",
  stopped: "DURDURULDU",
  error: "HATA",
  price_exceeded: "FİYAT AŞILDI",
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
    orderNo,
    eventLocation,
    eventDate,
    foundPrice,
  } = query;
  const site = "TicketMaster";
  const imgUrl = new URL(`../assets/${site}.png`, import.meta.url).href;
  const displayStatus = getDisplayStatus(query);
  const statusLabel = STATUS_LABELS[displayStatus] || status;
  const countryCode = domain?.toLowerCase() || "de";

  // Event yer ve tarih formatlama
  let formattedDate = eventDate;
  if (eventDate) {
    let dateStr = eventDate instanceof Date ? eventDate.toISOString() : eventDate;
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-');
      if (year && month && day) {
        formattedDate = `${day}.${month}.${year}`;
      }
    }
  }
  const metaParts = [eventLocation, formattedDate].filter(Boolean);
  const metaLine = metaParts.length > 0 ? metaParts.join(" • ") : null;

  const handleLinkClick = (e) => {
    // URL'ye tıklarken modalın açılmasını engeller
    e.stopPropagation();
  };

  return (
    <div
      className={styles.cardDiv}
      data-status={displayStatus}
      onClick={() => onClick(query)}
    >

      <div className={styles.imgDiv}>
        <img src={imgUrl} alt={site} />
      </div>

      <div className={styles.infoDiv}>

        <div className="flex flex-col items-center">
          {orderNo && (
            <p className={styles.orderNo}>Order Number: {orderNo}</p>
          )}
          <span
            className={`fi fi-${countryCode} ${styles.flag}`}
          ></span>
          <p className="font-bold">{countryCode.toUpperCase()}</p>
        </div>

        <div className="flex flex-col items-center">
          {metaLine && (
            <p className={styles.eventMeta}>{metaLine}</p>
          )}
          <p className="text-2xl font-bold">{eventName || "Unknown Event"}</p>
          <p className="text-lg text-gray-500 font-bold">
            Section: {section}{minSeats && minSeats > 1 ? ` x ${minSeats}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-col items-center">
            <p className="text-sm text-gray-500">{"\u00A0"}</p>
          </div>
          <p className={`font-bold text-2xl ${styles.statusText}`}>
            {statusLabel}
          </p>
          <p className={styles.priceInfo}>
            {displayStatus === "price_exceeded" && foundPrice != null
              ? `${formatPrice(foundPrice, domain)} bulundu`
              : "\u00A0"}
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
            title="Bilete git"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}
