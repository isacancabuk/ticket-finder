import { useState } from "react";
import styles from "./Card.module.css";
import "/node_modules/flag-icons/css/flag-icons.min.css";

import ViagogoLogo from "../assets/ViaGogo.png";
import TixStockLogo from "../assets/TixStock.png";
import VividLogo from "../assets/Vivid.png";
import GigsbergLogo from "../assets/Gigsberg.jpg";
import StubHubLogo from "../assets/StubHub.png";
import TicomboLogo from "../assets/Ticombo.png";

const SALE_SITE_LOGOS = {
  ViaGogo: ViagogoLogo,
  TixStock: TixStockLogo,
  Vivid: VividLogo,
  Gigsberg: GigsbergLogo,
  StubHub: StubHubLogo,
  Ticombo: TicomboLogo,
};

const DOMAIN_CURRENCY = {
  DE: "EUR",
  UK: "GBP",
  ES: "EUR",
  NL: "EUR",
  PL: "PLN",
  BE: "EUR",
  SE: "SEK",
  CH: "CHF",
  MX: "MXN",
  FIFA: "USD",
};

function formatPrice(cents, currencyCode) {
  if (cents == null) return "–";
  return `${(cents / 100).toFixed(2)}\u00A0${currencyCode}`;
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
    saleSite,
    description,
    eventLocation,
    eventDate,
    foundPrice,
    salePrice,
    salePriceCurrency,
    salePriceInEUR,
    foundPriceInEUR,
    maxPrice,
    gogoPrice,
    tixPrice,
  } = query;
  const isFifa = domain === "FIFA";
  const site = isFifa ? "FifaLogo.svg" : "TicketMaster";
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
  let isProfit = null;
  if (
    (displayStatus === "found" ||
      displayStatus === "price_exceeded" ||
      displayStatus === "purchased") &&
    foundPrice != null &&
    salePrice != null
  ) {
    if (profitLoss != null && profitLossCurrency) {
      if (profitLoss > 0) {
        isProfit = true;
        profitLossLine = formatPrice(profitLoss, profitLossCurrency);
      } else if (profitLoss < 0) {
        isProfit = false;
        profitLossLine = formatPrice(Math.abs(profitLoss), profitLossCurrency);
      } else {
        isProfit = true;
        profitLossLine = `0\u00A0${profitLossCurrency}`;
      }
    } else {
      profitLossLine = "–";
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
        <div className="flex items-center gap-3">
          <img
            src={imgUrl}
            alt={site}
            style={isFifa ? { maxWidth: "80px", height: "auto" } : undefined}
          />
          {!isFifa && (
            <div className="flex flex-row items-center justify-center gap-1 px-2 py-1">
              <span
                className={`fi fi-${countryCode}`}
                style={{ fontSize: "1.2rem", borderRadius: "2px" }}
              ></span>
              <span className={`font-bold text-xs ${styles.textSecondary}`}>
                {domain || "DE"}
              </span>
            </div>
          )}
        </div>
        {description && (
          <p className={styles.description} title={description}>
            <span className={`${styles.textSecondary} font-extrabold`}>NOT:</span>{" "}
            {description}
          </p>
        )}
        <p 
          className={`font-bold text-2xl ${styles.statusText} ${styles.textSecondary}`} 
          style={{ position: "absolute", left: "687px", top: "18px" }}
        >
          {statusLabel}
        </p>
      </div>

      <div className={styles.infoDiv}>
        <div className="flex flex-col items-center justify-center">
          {saleSite && (
            <div className={`${styles.saleSite} flex flex-col items-center justify-center gap-0.5`}>
              <span className={`${styles.textSecondary} font-extrabold`}>
                Satış Sitesi:
              </span>
              <div className="flex items-center gap-1.5">
                {SALE_SITE_LOGOS[saleSite] && (
                  <img src={SALE_SITE_LOGOS[saleSite]} alt={saleSite} style={{ height: "1.1em", width: "auto", borderRadius: "2px" }} />
                )}
                <span style={{ fontWeight: 800 }}>{saleSite}</span>
              </div>
            </div>
          )}
          {orderNo && (
            <p
              className={styles.orderNo}
              onClick={handleOrderNoClick}
              title="Kopyalamak için tıkla"
              style={{ cursor: "copy", position: "relative" }}
            >
              <span style={{ fontWeight: 800 }}>Order Number:</span>{" "}
              <span style={{ fontWeight: 500 }}>{orderNo}</span>
              {copied && (
                <span className={styles.copiedToast}>Kopyalandı!</span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center px-6 w-full">
          {metaLine && <p className={`${styles.eventMeta} font-bold`}>{metaLine}</p>}
          <p className={`text-2xl font-bold text-center ${styles.eventTitle}`}>
            {eventName || "Unknown Event"}
          </p>
          <p className={`text-lg font-bold ${styles.textMuted}`}>
            ARANAN: {section || "Tümü"}
            {minSeats && minSeats > 1 ? ` x ${minSeats}` : ""}
          </p>
          {query.foundSection &&
            (displayStatus === "found" ||
              displayStatus === "purchased" ||
              displayStatus === "price_exceeded") && (
              <p
                className="text-md font-bold"
                style={{ color: displayStatus === "price_exceeded" ? "var(--text-warning)" : "var(--text-success)" }}
              >
                BULUNAN: {query.foundSection}
              </p>
            )}
        </div>

        <div className="flex flex-col items-start justify-center w-full pl-6">
          <div className={`text-xs font-bold flex flex-col gap-0.5 items-start ${styles.textSecondary}`}>
             {salePrice != null && (
                 <p>
                    <span style={{ color: "var(--text-info)" }}>SATIŞ:</span> {formatPrice(salePrice, saleCurrency)}
                    {salePriceInEUR != null && salePriceCurrency !== "EUR" && ` (${formatPrice(salePriceInEUR, "EUR")})`}
                 </p>
             )}
             {maxPrice != null && (
                 <p>
                    <span style={{ color: "var(--text-warning)" }}>MAX:</span> {formatPrice(maxPrice, foundCurrency)}
                 </p>
             )}
             {(displayStatus === "found" || displayStatus === "price_exceeded" || displayStatus === "purchased") && foundPrice != null && (
                 <p>
                    <span style={{ color: "var(--text-success)" }}>BULUNAN:</span> {foundPrice === -1 ? "Fiyat bilgisi yok" : `${formatPrice(foundPrice, foundCurrency)}${foundPriceInEUR != null && foundCurrency !== "EUR" ? ` (${formatPrice(foundPriceInEUR, "EUR")})` : ""}`}
                 </p>
             )}
             {profitLossLine && (
                 <p>
                    <span className={styles.textMuted}>{isProfit === false ? "ZARAR:" : "KAR:"}</span> <span style={{ color: isProfit === false ? "var(--text-danger)" : "var(--text-success)" }}>{profitLossLine}</span>
                 </p>
             )}

             {(gogoPrice != null || tixPrice != null) && (
                 <>
                     <br />
                     <div className="flex flex-col gap-0.5">
                         {gogoPrice != null && (
                             <p className="flex items-center gap-1.5" style={{ color: "var(--text-purple)" }}>
                                 <img src={SALE_SITE_LOGOS["ViaGogo"]} alt="GOGO" style={{ height: "1.1em", width: "auto", borderRadius: "2px" }} />
                                 <span><span className={styles.textMuted}>GOGO:</span> {formatPrice(gogoPrice, "EUR")}</span>
                             </p>
                         )}
                         {tixPrice != null && (
                             <p className="flex items-center gap-1.5" style={{ color: "var(--text-purple)" }}>
                                 <img src={SALE_SITE_LOGOS["TixStock"]} alt="Tix" style={{ height: "1.1em", width: "auto", borderRadius: "2px" }} />
                                 <span><span className={styles.textMuted}>Tix:</span> {formatPrice(tixPrice, "EUR")}</span>
                             </p>
                         )}
                     </div>
                 </>
             )}
          </div>
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
