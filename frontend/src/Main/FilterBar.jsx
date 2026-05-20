import { useState, useRef, useEffect } from "react";
import styles from "./FilterBar.module.css";

const STATUS_COUNTER_CONFIG = [
  { key: "FOUND", label: "Bulundu", color: "#16a34a" },
  { key: "PRICE_EXCEEDED", label: "Fiyat Aşıldı", color: "#ea580c" },
  { key: "PURCHASED", label: "Alındı", color: "#2563eb" },
  { key: "ERROR", label: "Hata", color: "#dc2626" },
  { key: "FINDING", label: "Aranıyor", color: "#6b7280" },
  { key: "STOPPED", label: "Durdu", color: "#94a3b8" },
];

const COUNTRY_LABELS = {
  BE: "🇧🇪 BE",
  CH: "🇨🇭 CH",
  DE: "🇩🇪 DE",
  ES: "🇪🇸 ES",
  MX: "🇲🇽 MX",
  NL: "🇳🇱 NL",
  PL: "🇵🇱 PL",
  SE: "🇸🇪 SE",
  UK: "🇬🇧 UK",
};

const PLATFORM_LABELS = {
  ticketmaster: "Ticketmaster",
  fifa: "FIFA",
};

const PROFIT_SORTS = [
  { label: "↓ En Yüksek", value: "HIGH" },
  { label: "↑ En Düşük", value: "LOW" },
];

// Helper to toggle a value in a Set (immutable)
function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export default function FilterBar({
  filterState,
  onFilterChange,
  statusCounts = {},
  countryCounts = {},
  platformCounts = {},
  saleSiteCounts = {},
}) {
  const {
    searchQuery,
    selectedCountries,
    selectedSites,
    selectedSaleSites,
    sortDateAsc,
    selectedStatuses,
    sortByProfit,
    primarySort,
  } = filterState;

  const handleChange = (changes) => {
    onFilterChange((prev) => ({ ...prev, ...changes }));
  };

  const handleClearFilters = () => {
    onFilterChange({
      searchQuery: "",
      selectedCountries: new Set(),
      selectedSites: new Set(),
      selectedSaleSites: new Set(),
      selectedStatuses: new Set(),
      sortDateAsc: false,
      sortByProfit: "HIGH",
      primarySort: "profit",
    });
  };

  // All possible keys for each filter (used to show 0-count disabled badges)
  const ALL_COUNTRIES = ["BE", "CH", "DE", "ES", "MX", "NL", "PL", "SE", "UK"];
  const ALL_PLATFORMS = ["ticketmaster", "fifa"];
  const ALL_SALE_SITES = ["ViaGogo", "TixStock", "Vivid", "Gigsberg", "StubHub", "Ticombo", "Belirtilmemiş"];

  // Merge known keys with any extra from data, then sort (exclude FIFA from countries)
  const sortedCountryKeys = [...new Set([...ALL_COUNTRIES, ...Object.keys(countryCounts)])]
    .filter((k) => k !== "FIFA")
    .sort((a, b) => {
      const iA = ALL_COUNTRIES.indexOf(a);
      const iB = ALL_COUNTRIES.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });

  const sortedPlatformKeys = [...new Set([...ALL_PLATFORMS, ...Object.keys(platformCounts)])]
    .sort((a, b) => {
      const iA = ALL_PLATFORMS.indexOf(a);
      const iB = ALL_PLATFORMS.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });

  const sortedSaleSiteKeys = [...new Set([...ALL_SALE_SITES, ...Object.keys(saleSiteCounts)])]
    .sort((a, b) => {
      const iA = ALL_SALE_SITES.indexOf(a);
      const iB = ALL_SALE_SITES.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });

  return (
    <div className={styles.filterContainer}>
      {/* Row 1: Search + Sort Toggles + Clear */}
      <div className={styles.topRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Order No. veya Etkinlik Adı ile ara..."
          value={searchQuery}
          onChange={(e) => handleChange({ searchQuery: e.target.value })}
        />
        <button
          type="button"
          className={`${styles.sortToggle} ${primarySort === "date" ? styles.sortToggleActive : ""}`}
          onClick={() => {
            if (primarySort === "date") {
              handleChange({ sortDateAsc: !sortDateAsc });
            } else {
              handleChange({ primarySort: "date" });
            }
          }}
          title="Tarihe göre sırala"
        >
          <span className={styles.sortToggleIcon}>{sortDateAsc ? "↑" : "↓"}</span>
          <span className={styles.sortToggleLabel}>
            {sortDateAsc ? "Eski" : "Yeni"}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.sortToggle} ${primarySort === "profit" ? styles.sortTogglePrimary : ""}`}
          onClick={() => {
            if (primarySort === "profit") {
              handleChange({ sortByProfit: sortByProfit === "HIGH" ? "LOW" : "HIGH" });
            } else {
              handleChange({ primarySort: "profit" });
            }
          }}
          title="Kâra göre sırala"
        >
          <span className={styles.sortToggleIcon}>
            {sortByProfit === "HIGH" ? "↓" : "↑"}
          </span>
          <span className={styles.sortToggleLabel}>
            {sortByProfit === "HIGH" ? "En Yüksek" : "En Düşük"}
          </span>
        </button>
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClearFilters}
          title="Filtreleri Temizle"
        >
          Temizle
        </button>
      </div>

      {/* Row 2: Badge Filter Groups */}
      <div className={styles.badgeSection}>
        {/* Platform Badges */}
        <div className={styles.badgeRow}>
          {sortedPlatformKeys.map((key) => {
            const count = platformCounts[key] || 0;
            const isActive = selectedSites.has(key);
            const isDisabled = count === 0;
            return (
              <button
                key={key}
                className={`${styles.filterBadge} ${isActive ? styles.filterBadgeActive : ""} ${isDisabled ? styles.filterBadgeDisabled : ""}`}
                style={{ "--badge-color": "#0891b2" }}
                onClick={() => {
                  if (isDisabled) return;
                  handleChange({ selectedSites: toggleInSet(selectedSites, key) });
                }}
              >
                <span className={styles.filterBadgeDot} style={{ background: "#0891b2" }} />
                <span className={styles.filterBadgeCount}>{count}</span>
                <span className={styles.filterBadgeLabel}>
                  {PLATFORM_LABELS[key] || key}
                </span>
              </button>
            );
          })}
        </div>

        {/* Country Badges */}
        <div className={styles.badgeRow}>
          {sortedCountryKeys.map((key) => {
            const count = countryCounts[key] || 0;
            const isActive = selectedCountries.has(key);
            const isDisabled = count === 0;
            return (
              <button
                key={key}
                className={`${styles.filterBadge} ${isActive ? styles.filterBadgeActive : ""} ${isDisabled ? styles.filterBadgeDisabled : ""}`}
                style={{ "--badge-color": "#d97706" }}
                onClick={() => {
                  if (isDisabled) return;
                  handleChange({ selectedCountries: toggleInSet(selectedCountries, key) });
                }}
              >
                <span className={styles.filterBadgeDot} style={{ background: "#d97706" }} />
                <span className={styles.filterBadgeCount}>{count}</span>
                <span className={styles.filterBadgeLabel}>
                  {COUNTRY_LABELS[key] || key}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sale Site Badges */}
        <div className={styles.badgeRow}>
          {sortedSaleSiteKeys.map((key) => {
            const count = saleSiteCounts[key] || 0;
            const isActive = selectedSaleSites.has(key);
            const isDisabled = count === 0;
            return (
              <button
                key={key}
                className={`${styles.filterBadge} ${isActive ? styles.filterBadgeActive : ""} ${isDisabled ? styles.filterBadgeDisabled : ""}`}
                style={{ "--badge-color": "#8b5cf6" }}
                onClick={() => {
                  if (isDisabled) return;
                  handleChange({ selectedSaleSites: toggleInSet(selectedSaleSites, key) });
                }}
              >
                <span className={styles.filterBadgeDot} style={{ background: "#8b5cf6" }} />
                <span className={styles.filterBadgeCount}>{count}</span>
                <span className={styles.filterBadgeLabel}>{key}</span>
              </button>
            );
          })}
        </div>

        {/* Status Badges */}
        <div className={styles.badgeRow}>
          {STATUS_COUNTER_CONFIG.map(({ key, label, color }) => {
            const count = statusCounts[key] || 0;
            const isActive = selectedStatuses.has(key);
            const isDisabled = count === 0;
            return (
              <button
                key={key}
                className={`${styles.filterBadge} ${isActive ? styles.filterBadgeActive : ""} ${isDisabled ? styles.filterBadgeDisabled : ""}`}
                style={{ "--badge-color": color }}
                onClick={() => {
                  if (isDisabled) return;
                  handleChange({ selectedStatuses: toggleInSet(selectedStatuses, key) });
                }}
              >
                <span className={styles.filterBadgeDot} style={{ background: color }} />
                <span className={styles.filterBadgeCount}>{count}</span>
                <span className={styles.filterBadgeLabel}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
