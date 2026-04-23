import { useEffect } from "react";
import styles from "./SectionPicker.module.css";

export default function SectionPicker({ sections, selectedCodes = [], loading, error, onSelect, onClose }) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Invisible overlay to catch clicks outside */}
      <div className={styles.pickerOverlay} onClick={onClose} />

      <div className={styles.pickerDropdown}>
        {/* Header */}
        <div className={styles.pickerHeader}>
          <span className={styles.pickerTitle}>Bölüm Seç</span>
          <button
            type="button"
            className={styles.pickerCloseBtn}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.pickerLoading}>Yükleniyor...</div>
        ) : error ? (
          <div className={styles.pickerError}>{error}</div>
        ) : sections.length === 0 ? (
          <div className={styles.pickerEmpty}>Bölüm bulunamadı</div>
        ) : (
          <div className={styles.pickerList}>
            {sections.map((s) => {
              const isSelected = selectedCodes.includes(s.code.toUpperCase());
              return (
                <button
                  key={s.code}
                  type="button"
                  className={`${styles.pickerItem} ${isSelected ? styles.selectedItem : ""}`}
                  onClick={() => onSelect(s.code)}
                >
                  <span className={styles.pickerName}>{s.name}</span>
                  {isSelected && <span className={styles.checkIcon}>✓</span>}
                  <span className={styles.pickerArrow}>→</span>
                  <span className={`${styles.pickerCode} ${isSelected ? styles.selectedCode : ""}`}>
                    {s.code}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
