import { useState } from "react";
import styles from "./Card.module.css";
import "/node_modules/flag-icons/css/flag-icons.min.css";

const DOMAIN_CURRENCY = { DE: "EUR", UK: "GBP", ES: "EUR" };

function formatPrice(cents, currencyCode) {
  if (cents == null) return "–";
  return `${(cents / 100).toFixed(2)} ${currencyCode}`;
}

function getDisplayStatus(query) {
  if (query.status === "PURCHASED") return "purchased";
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
  purchased: "ALINDI",
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
    salePrice,
    salePriceCurrency,
    salePriceInEUR,
    foundPriceInEUR,
  } = query;
  const site = "TicketMaster";
  const imgUrl = new URL(`../assets/${site}.png`, import.meta.url).href;
  const displayStatus = getDisplayStatus(query);
  const statusLabel = STATUS_LABELS[displayStatus] || status;
  // flag-icons uses ISO 3166-1 alpha-2: UK → gb
  const FLAG_CODE_MAP = { uk: "gb" };
  const rawCode = domain?.toLowerCase() || "de";
  const countryCode = FLAG_CODE_MAP[rawCode] || rawCode;

  // Currency resolution
  const foundCurrency = DOMAIN_CURRENCY[domain] || "EUR";
  const saleCurrency = salePriceCurrency || "EUR";

  // Event yer ve tarih formatlama
  let formattedDate = eventDate;
  if (eventDate) {
    let dateStr =
      eventDate instanceof Date ? eventDate.toISOString() : eventDate;
    if (typeof dateStr === "string" && dateStr.includes("-")) {
      const datePart = dateStr.split("T")[0];
      const [year, month, day] = datePart.split("-");
      if (year && month && day) {
        formattedDate = `${day}.${month}.${year}`;
      }
    }
  }
  const metaParts = [eventLocation, formattedDate].filter(Boolean);
  const metaLine = metaParts.length > 0 ? metaParts.join(" • ") : null;

  let profitLossLine = null;
  const profitLoss = query.profitLoss;
  const profitLossCurrency = query.profitLossCurrency;
  if (
    (displayStatus === "found" ||
      displayStatus === "price_exceeded" ||
      displayStatus === "purchased") &&
    foundPrice != null &&
    salePrice != null
  ) {
    if (profitLoss != null && profitLossCurrency) {
      if (profitLoss > 0) {
        profitLossLine = (
          <span className="text-green-600 font-bold">
            , {formatPrice(profitLoss, profitLossCurrency)} kâr
          </span>
        );
      } else if (profitLoss < 0) {
        profitLossLine = (
          <span className="text-red-500 font-bold">
            , {formatPrice(Math.abs(profitLoss), profitLossCurrency)} zarar
          </span>
        );
      } else {
        profitLossLine = (
          <span className="text-gray-500 font-bold">, 0 kâr</span>
        );
      }
    } else {
      profitLossLine = <span className="text-gray-400 font-bold">, –</span>;
    }
  }

  const handleLinkClick = (e) => {
    // URL'ye tıklarken modalın açılmasını engeller
    e.stopPropagation();
  };

  const [copied, setCopied] = useState(false);

  const handleOrderNoClick = (e) => {
    e.stopPropagation();
    if (orderNo) {
      navigator.clipboard.writeText(orderNo).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
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
            <p
              className={styles.orderNo}
              onClick={handleOrderNoClick}
              title="Kopyalamak için tıkla"
              style={{ cursor: "copy", position: "relative" }}
            >
              Order Number: {orderNo}
              {copied && (
                <span className={styles.copiedToast}>Kopyalandı!</span>
              )}
            </p>
          )}
          <span className={`fi fi-${countryCode} ${styles.flag}`}></span>
          <p className="font-bold">{domain || "DE"}</p>
        </div>

        <div className="flex flex-col items-center">
          {metaLine && <p className={styles.eventMeta}>{metaLine}</p>}
          <p className="text-2xl font-bold text-center">{eventName || "Unknown Event"}</p>
          <p className="text-lg text-gray-500 font-bold">
            Section: {section || "Tümü"}
            {minSeats && minSeats > 1 ? ` x ${minSeats}` : ""}
          </p>
          {query.foundSection && (displayStatus === "found" || displayStatus === "purchased" || displayStatus === "price_exceeded") && (
            <p className={`text-md font-bold ${displayStatus === "price_exceeded" ? "text-orange-500" : "text-green-600"}`}>
              Bulunan: {query.foundSection}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-col items-center">
            <p className="text-sm font-bold text-gray-700">
              {salePrice != null ? (
                <>
                  {`${formatPrice(salePrice, saleCurrency)} satış fiyatı`}
                  {salePriceInEUR != null && salePriceCurrency !== "EUR" && (
                    <span className="text-xs text-gray-500">
                      {" "}
                      ({formatPrice(salePriceInEUR, "EUR")})
                    </span>
                  )}
                </>
              ) : (
                "\u00A0"
              )}
              {foundPriceInEUR != null && foundCurrency !== "EUR" && (
                <> ({formatPrice(foundPriceInEUR, "EUR")})</>
              )}
            </p>
          </div>
          <p className={`font-bold text-2xl ${styles.statusText}`}>
            {statusLabel}
          </p>
          <p className={styles.priceInfo}>
            {(displayStatus === "found" ||
              displayStatus === "price_exceeded" ||
              displayStatus === "purchased") &&
            foundPrice != null ? (
              <>
                <span>{formatPrice(foundPrice, foundCurrency)} bulundu</span>
                {profitLossLine}
              </>
            ) : (
              "\u00A0"
            )}
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
