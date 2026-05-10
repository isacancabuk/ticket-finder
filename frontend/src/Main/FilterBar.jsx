import { useState, useRef, useEffect } from "react";
import styles from "./FilterBar.module.css";

const COUNTRIES = ["Tümü", "BE", "CH", "DE", "ES", "NL", "PL", "SE", "UK"];
const SITES = ["Tümü", "ticketmaster"];
const STATUSES = [
  { label: "Tümü", value: "ALL" },
  { label: "Bulundu", value: "FOUND" },
  { label: "Fiyat Aşıldı", value: "PRICE_EXCEEDED" },
  { label: "Aranıyor", value: "FINDING" },
  { label: "Hata", value: "ERROR" },
  { label: "Alındı", value: "PURCHASED" },
];

const STATUS_COUNTER_CONFIG = [
  { key: "FOUND", label: "Bulundu", color: "#16a34a" },
  { key: "PRICE_EXCEEDED", label: "Fiyat Aşıldı", color: "#ea580c" },
  { key: "PURCHASED", label: "Alındı", color: "#2563eb" },
  { key: "ERROR", label: "Hata", color: "#dc2626" },
  { key: "FINDING", label: "Aranıyor", color: "#6b7280" },
  { key: "STOPPED", label: "Durdu", color: "#94a3b8" },
];

const PROFIT_SORTS = [
  { label: "↓ En Yüksek", value: "HIGH" },
  { label: "↑ En Düşük", value: "LOW" },
];

export default function FilterBar({ filterState, onFilterChange, statusCounts = {} }) {
  const {
    searchQuery,
    selectedCountry,
    selectedSite,
    sortDateAsc,
    selectedStatus,
    sortByProfit,
  } = filterState;

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState(null);
  const countryRef = useRef(null);
  const siteRef = useRef(null);
  const statusRef = useRef(null);
  const profitRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      const allRefs = [countryRef, siteRef, statusRef, profitRef];
      const clickedOutside = allRefs.every(
        (ref) => ref.current && !ref.current.contains(e.target),
      );

      if (clickedOutside) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCountryToggle = () => {
    setOpenDropdown(openDropdown === "country" ? null : "country");
  };

  const handleSiteToggle = () => {
    setOpenDropdown(openDropdown === "site" ? null : "site");
  };

  const handleStatusToggle = () => {
    setOpenDropdown(openDropdown === "status" ? null : "status");
  };

  const handleChange = (changes) => {
    onFilterChange((prev) => ({ ...prev, ...changes }));
  };

  const handleProfitToggle = () => {
    setOpenDropdown(openDropdown === "profit" ? null : "profit");
  };

  const handleClearFilters = () => {
    onFilterChange({
      searchQuery: "",
      selectedCountry: "Tümü",
      selectedSite: "Tümü",
      sortDateAsc: false,
      selectedStatus: "ALL",
      sortByProfit: "HIGH",
    });
  };

  return (
    <div className={styles.filterContainer}>
      {/* Top Row: Search */}
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
          className={styles.clearButton}
          onClick={handleClearFilters}
          title="Filtreleri Temizle"
        >
          Temizle
        </button>
      </div>

      {/* Bottom Row: Filters and Sort */}
      <div className={styles.bottomRow}>
        {/* Country Filter */}
        <div ref={countryRef} className={styles.filterGroup}>
          <div className={styles.filterLabel}>Ülke</div>
          <button className={styles.filterButton} onClick={handleCountryToggle}>
            {selectedCountry}
            <span className={styles.dropdownIcon}>▼</span>
          </button>
          {openDropdown === "country" && (
            <div className={styles.dropdown}>
              {COUNTRIES.map((country) => (
                <button
                  key={country}
                  className={`${styles.dropdownItem} ${
                    selectedCountry === country ? styles.active : ""
                  }`}
                  onClick={() => {
                    handleChange({ selectedCountry: country });
                    setOpenDropdown(null);
                  }}
                >
                  {country}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Site Filter */}
        <div ref={siteRef} className={styles.filterGroup}>
          <div className={styles.filterLabel}>Platform</div>
          <button className={styles.filterButton} onClick={handleSiteToggle}>
            {selectedSite}
            <span className={styles.dropdownIcon}>▼</span>
          </button>
          {openDropdown === "site" && (
            <div className={styles.dropdown}>
              {SITES.map((site) => (
                <button
                  key={site}
                  className={`${styles.dropdownItem} ${
                    selectedSite === site ? styles.active : ""
                  }`}
                  onClick={() => {
                    handleChange({ selectedSite: site });
                    setOpenDropdown(null);
                  }}
                >
                  {site === "Tümü" ? "Tümü" : "ticketmaster"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Date Sort */}
        <div className={styles.filterGroup}>
          <div className={styles.filterLabel}>Tarih</div>
          <button
            className={styles.filterButton}
            onClick={() => handleChange({ sortDateAsc: !sortDateAsc })}
            title="Sıralama yönünü değiştirmek için tıklayın"
          >
            {sortDateAsc ? "↑" : "↓"}
            <span className={styles.sortLabel}>
              {sortDateAsc ? "Eski" : "Yeni"}
            </span>
          </button>
        </div>

        {/* Ticket Status Filter */}
        <div ref={statusRef} className={styles.filterGroup}>
          <div className={styles.filterLabel}>Durum</div>
          <button className={styles.filterButton} onClick={handleStatusToggle}>
            {STATUSES.find((s) => s.value === selectedStatus)?.label || "Tümü"}
            <span className={styles.dropdownIcon}>▼</span>
          </button>
          {openDropdown === "status" && (
            <div className={styles.dropdown}>
              {STATUSES.map((status) => (
                <button
                  key={status.value}
                  className={`${styles.dropdownItem} ${
                    selectedStatus === status.value ? styles.active : ""
                  }`}
                  onClick={() => {
                    handleChange({ selectedStatus: status.value });
                    setOpenDropdown(null);
                  }}
                >
                  {status.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profit Sort */}
        <div ref={profitRef} className={styles.filterGroup}>
          <div className={styles.filterLabel}>Kâr</div>
          <button className={styles.filterButton} onClick={handleProfitToggle}>
            {PROFIT_SORTS.find((s) => s.value === sortByProfit)?.label || "Yok"}
            <span className={styles.dropdownIcon}>▼</span>
          </button>
          {openDropdown === "profit" && (
            <div className={styles.dropdown}>
              {PROFIT_SORTS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.dropdownItem} ${
                    sortByProfit === opt.value ? styles.active : ""
                  }`}
                  onClick={() => {
                    handleChange({ sortByProfit: opt.value });
                    setOpenDropdown(null);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Counter Bar */}
      <div className={styles.statusBar}>
        {STATUS_COUNTER_CONFIG.map(({ key, label, color }) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              className={`${styles.statusBadge} ${selectedStatus === key ? styles.statusBadgeActive : ""}`}
              style={{ "--badge-color": color }}
              onClick={() => {
                if (selectedStatus === key) {
                  handleChange({ selectedStatus: "ALL" });
                } else {
                  handleChange({ selectedStatus: key });
                }
              }}
            >
              <span className={styles.statusDot} style={{ background: color }} />
              <span className={styles.statusCount}>{count}</span>
              <span className={styles.statusLabel}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
