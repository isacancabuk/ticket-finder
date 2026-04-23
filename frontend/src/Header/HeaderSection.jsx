import { useEffect, useRef, useState, useCallback } from "react";
import { Form, useActionData, useNavigation } from "react-router-dom";
import Input from "./Input";
import Button from "./Button";
import SectionPicker from "./SectionPicker";
import { apiFetch } from "../api";
import styles from "./HeaderSection.module.css";

const CURRENCY_OPTIONS = ["EUR", "GBP", "USD"];

export default function HeaderSection() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formRef = useRef(null);
  const urlInputRef = useRef(null);
  const sectionInputRef = useRef(null);

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSections, setPickerSections] = useState([]);
  const [pickerSelectedCodes, setPickerSelectedCodes] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  const [urlValue, setUrlValue] = useState("");

  // Reset form after successful submission
  useEffect(() => {
    if (navigation.state === "idle" && actionData && !actionData.error) {
      formRef.current?.reset();
      setUrlValue("");
    }
  }, [navigation.state, actionData]);

  // Fetch sections from manifest API
  const handleHelperClick = useCallback(async () => {
    const currentUrl = urlInputRef.current?.value?.trim();
    if (!currentUrl) return;

    const currentSectionVal = sectionInputRef.current?.value || "";
    const currentCodes = currentSectionVal
      .split(/[\s,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    setPickerSelectedCodes(currentCodes);

    setPickerOpen(true);
    setPickerLoading(true);
    setPickerError(null);
    setPickerSections([]);

    try {
      const res = await apiFetch(
        `/queries/manifest-sections?url=${encodeURIComponent(currentUrl)}`,
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPickerError(data.error || `Hata: ${res.status}`);
        return;
      }

      const data = await res.json();
      setPickerSections(data.sections || []);
    } catch (err) {
      setPickerError("Bağlantı hatası");
    } finally {
      setPickerLoading(false);
    }
  }, []);

  // Add section code to input
  const handleSectionSelect = useCallback((code) => {
    if (sectionInputRef.current) {
      // Get current value
      const currentValue = sectionInputRef.current.value;
      const currentCodes = currentValue
        .split(/[\s,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      // If already selected, do nothing
      if (currentCodes.includes(code.toUpperCase())) {
        return;
      }

      // Add new section (space-separated)
      const newValue = currentValue.trim() ? `${currentValue.trim()} ${code}` : code;

      // Set the native input value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      nativeInputValueSetter.call(sectionInputRef.current, newValue);

      // Dispatch input event so React picks up the change
      sectionInputRef.current.dispatchEvent(
        new Event("input", { bubbles: true }),
      );

      // Update picker selected state
      setPickerSelectedCodes((prev) => [...prev, code.toUpperCase()]);
    }
  }, []);

  const handlePickerClose = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const hasUrl = urlValue.trim().length > 0;

  return (
    <div className="h-[220px] w-full flex flex-col items-center justify-center">
      <Form
        ref={formRef}
        method="POST"
        className="w-[1000px] grid grid-cols-5 gap-5"
      >
        <input type="hidden" name="_action" value="create" />

        {/* Row 1: Order No. | Event URL (3 cols) | Bölümler helper */}
        <div className="col-span-1">
          <Input
            type="text"
            name="orderNo"
            placeholder="Order No."
            required={true}
          />
        </div>

        <div className="col-span-3">
          <Input
            ref={urlInputRef}
            type="url"
            name="url"
            placeholder="Event URL"
            required={true}
            onChange={(e) => setUrlValue(e.target.value)}
          />
        </div>

        {/* Bölümler helper button — row 1, rightmost */}
        <div className="col-span-1" style={{ position: "relative" }}>
          <button
            type="button"
            disabled={!hasUrl || pickerLoading}
            onClick={handleHelperClick}
            className={`${styles.helperButton} ${hasUrl ? styles.hasUrl : ""}`}
          >
            {pickerLoading ? (
              "Yükleniyor..."
            ) : (
              <>
                <span className={styles.helperIcon}>☰</span>
                <span>Bölümler</span>
              </>
            )}
          </button>

          {/* Picker dropdown anchored to this button — opens to the right */}
          {pickerOpen && (
            <SectionPicker
              sections={pickerSections}
              selectedCodes={pickerSelectedCodes}
              loading={pickerLoading}
              error={pickerError}
              onSelect={handleSectionSelect}
              onClose={handlePickerClose}
            />
          )}
        </div>

        {/* Row 2: Section No. (with helper text) | Min. Koltuk | Max. Fiyat | Satış Fiyatı | İstek Başlat */}
        <div className="col-span-1">
          <Input
            ref={sectionInputRef}
            type="text"
            name="section"
            placeholder="Section No."
            required={false}
          />
          <p className={styles.helperText}>
            Boş: Tüm bölümler
          </p>
        </div>

        <div className="col-span-1">
          <Input
            type="number"
            name="minSeats"
            placeholder="Min. Koltuk"
            required={false}
          />
          <p className={styles.helperText}>
            Tüm ve Floor arama için: 1
          </p>
        </div>

        <div className="col-span-1">
          <Input
            type="number"
            name="maxPrice"
            placeholder="Max. Fiyat"
            required={false}
          />
          <p className={styles.helperText}>
            Boş: Herhangi fiyat
          </p>
        </div>

        {/* Sale Price + Currency Picker */}
        <div className="col-span-1">
          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
            <div style={{ flex: 1 }}>
              <Input
                type="number"
                name="salePrice"
                placeholder="Satış Fiyatı"
                required={false}
              />
            </div>
            <select
              name="salePriceCurrency"
              defaultValue="EUR"
              className={styles.currencySelect}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="col-span-1 flex">
          <Button disabled={isSubmitting}>
            {isSubmitting ? "İşleniyor..." : "İstek Başlat"}
          </Button>
        </div>
      </Form>
      {actionData?.error && (
        <p className="text-red-500 text-sm mt-1">{actionData.error}</p>
      )}
    </div>
  );
}
