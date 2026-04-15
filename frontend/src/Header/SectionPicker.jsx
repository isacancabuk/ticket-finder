import { useEffect, useRef } from "react";
import styles from "./SectionPicker.module.css";

/**
 * SectionPicker — compact dropdown showing section code + name pairs.
 *
 * @param {Array<{code: string, name: string}>} sections - Sorted sections list
 * @param {boolean} loading - Whether the manifest fetch is in progress
 * @param {string|null} error - Error message from fetch, if any
 * @param {function} onSelect - Called with the selected section code
 * @param {function} onClose - Called when the picker should close
 */
export default function SectionPicker({ sections, loading, error, onSelect, onClose }) {
  const dropdownRef = useRef(null);

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

      <div className={styles.pickerDropdown} ref={dropdownRef}>
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
            {sections.map((s) => (
              <button
                key={s.code}
                type="button"
                className={styles.pickerItem}
                onClick={() => onSelect(s.code)}
              >
                <span className={styles.pickerName}>{s.name}</span>
                <span className={styles.pickerArrow}>→</span>
                <span className={styles.pickerCode}>{s.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
