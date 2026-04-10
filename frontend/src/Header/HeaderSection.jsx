import { Form, useActionData, useNavigation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Input from "./Input";
import Button from "./Button";

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
  },
];

export default function HeaderSection() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formRef = useRef(null);

  useEffect(() => {
    if (navigation.state === "idle" && actionData && !actionData.error) {
      formRef.current?.reset();
    }
  }, [navigation.state, actionData]);

  return (
    <div className="h-[220px] w-full flex flex-col items-center justify-center">
      <Form
        ref={formRef}
        method="POST"
        className="w-[1000px] grid grid-cols-4 gap-5"
      >
        <input type="hidden" name="_action" value="create" />
        {INPUTS.map((input) => {
          const colClass = input.name === "url" ? "col-span-3" : "col-span-1";
          return (
            <div key={input.name} className={colClass}>
              <Input
                type={input.type}
                name={input.name}
                placeholder={input.placeholder}
                required={input.required !== false}
              />
            </div>
          );
        })}
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
