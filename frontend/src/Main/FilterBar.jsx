import { useState, useRef, useEffect } from "react";
import styles from "./FilterBar.module.css";

const COUNTRIES = ["Tümü", "DE", "ES"];
const SITES = ["Tümü", "ticketmaster"];
const STATUSES = [
  { label: "Tümü", value: "ALL" },
  { label: "Bulundu", value: "FOUND" },
  { label: "Fiyat Aşıldı", value: "PRICE_EXCEEDED" },
  { label: "Aranıyor", value: "FINDING" },
  { label: "Hata", value: "ERROR" },
  { label: "Alındı", value: "PURCHASED" },
];

export default function FilterBar({ filterState, onFilterChange }) {
  const {
    searchQuery,
    selectedCountry,
    selectedSite,
    sortDateAsc,
    selectedStatus,
  } = filterState;

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState(null);
  const countryRef = useRef(null);
  const siteRef = useRef(null);
  const statusRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      const allRefs = [countryRef, siteRef, statusRef];
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

  const handleClearFilters = () => {
    onFilterChange({
      searchQuery: "",
      selectedCountry: "Tümü",
      selectedSite: "Tümü",
      sortDateAsc: false,
      selectedStatus: "ALL",
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
      </div>
    </div>
  );
}
