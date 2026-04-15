import { Form, useActionData, useNavigation } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import Input from "./Input";
import Button from "./Button";
import SectionPicker from "./SectionPicker";
import { apiFetch } from "../api";

const INPUTS = [
  {
    type: "text",
    name: "orderNo",
    placeholder: "Order No.",
  },
  {
    type: "url",
    name: "url",
    placeholder: "Event URL",
  },
  {
    type: "text",
    name: "section",
    placeholder: "Section No.",
    required: false,
  },
  {
    type: "number",
    name: "minSeats",
    placeholder: "Min. Koltuk",
    required: false,
  },
  {
    type: "number",
    name: "maxPrice",
    placeholder: "Max. Fiyat",
    required: false,
  },
  {
    type: "number",
    name: "salePrice",
    placeholder: "Satış Fiyatı",
    required: false,
  },
];

export default function HeaderSection() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formRef = useRef(null);
  const urlInputRef = useRef(null);
  const sectionInputRef = useRef(null);
  const helperBtnRef = useRef(null);

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSections, setPickerSections] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    if (navigation.state === "idle" && actionData && !actionData.error) {
      formRef.current?.reset();
      setUrlValue("");
    }
  }, [navigation.state, actionData]);

  const handleHelperClick = useCallback(async () => {
    const currentUrl = urlInputRef.current?.value?.trim();
    if (!currentUrl) return;

    setPickerOpen(true);
    setPickerLoading(true);
    setPickerError(null);
    setPickerSections([]);

    try {
      const res = await apiFetch(
        `/queries/manifest-sections?url=${encodeURIComponent(currentUrl)}`
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

  const handleSectionSelect = useCallback((code) => {
    if (sectionInputRef.current) {
      // Set the native input value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      nativeInputValueSetter.call(sectionInputRef.current, code);

      // Dispatch input event so React picks up the change
      sectionInputRef.current.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
    setPickerOpen(false);
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
        {INPUTS.filter((i) => i.name === "orderNo").map((input) => (
          <div key={input.name} className="col-span-1">
            <Input
              type={input.type}
              name={input.name}
              placeholder={input.placeholder}
              required={input.required !== false}
            />
          </div>
        ))}

        {INPUTS.filter((i) => i.name === "url").map((input) => (
          <div key={input.name} className="col-span-3">
            <Input
              ref={urlInputRef}
              type={input.type}
              name={input.name}
              placeholder={input.placeholder}
              required={input.required !== false}
              onChange={(e) => setUrlValue(e.target.value)}
            />
          </div>
        ))}

        {/* Bölümler helper button — row 1, rightmost */}
        <div className="col-span-1" style={{ position: "relative" }} ref={helperBtnRef}>
          <button
            type="button"
            disabled={!hasUrl || pickerLoading}
            onClick={handleHelperClick}
            style={{
              width: "100%",
              height: "52px",
              borderRadius: "10px",
              border: "2px solid rgb(200, 200, 200)",
              background: hasUrl ? "#305bce" : "transparent",
              color: hasUrl ? "#fff" : "rgb(150, 150, 150)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: hasUrl ? "pointer" : "not-allowed",
              opacity: hasUrl ? 1 : 0.5,
              transition: "all 0.2s ease",
              letterSpacing: "0.3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "0 12px",
              boxShadow: hasUrl
                ? "0 2px 4px rgba(48, 91, 206, 0.15)"
                : "none",
            }}
          >
            {pickerLoading ? (
              "Yükleniyor..."
            ) : (
              <>
                <span style={{ fontSize: "16px" }}>☰</span>
                <span>Bölümler</span>
              </>
            )}
          </button>

          {/* Picker dropdown anchored to this button — opens to the right */}
          {pickerOpen && (
            <SectionPicker
              sections={pickerSections}
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
          <p style={{
            fontSize: "10px",
            color: "#999",
            marginTop: "4px",
            textAlign: "center",
            letterSpacing: "0.2px",
          }}>
            Boş: Tüm bölümler
          </p>
        </div>

        {INPUTS.filter((i) => ["minSeats", "maxPrice", "salePrice"].includes(i.name)).map(
          (input) => (
            <div key={input.name} className="col-span-1">
              <Input
                type={input.type}
                name={input.name}
                placeholder={input.placeholder}
                required={input.required !== false}
              />
              {input.name === "minSeats" && (
                <p style={{
                  fontSize: "10px",
                  color: "#999",
                  marginTop: "4px",
                  textAlign: "center",
                  letterSpacing: "0.2px",
                }}>
                  Tüm ve Floor arama için: 1
                </p>
              )}
              {input.name === "maxPrice" && (
                <p style={{
                  fontSize: "10px",
                  color: "#999",
                  marginTop: "4px",
                  textAlign: "center",
                  letterSpacing: "0.2px",
                }}>
                  Boş: Herhangi fiyat
                </p>
              )}
            </div>
          )
        )}

        <div className="col-span-1 flex">
          <Button disabled={isSubmitting} className="w-full h-[52px]">
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
