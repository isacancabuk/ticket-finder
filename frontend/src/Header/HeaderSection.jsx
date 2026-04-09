import { Form, useActionData, useNavigation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Input from "./Input";
import Button from "./Button";

const INPUTS = [
  {
    type: "url",
    name: "url",
    placeholder: "Event URL",
  },
  {
    type: "text",
    name: "section",
    placeholder: "Section",
  },
  {
    type: "number",
    name: "minSeats",
    placeholder: "Min Seats",
    required: false,
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
    <div className="w-full flex flex-col items-center">
      <Form
        ref={formRef}
        method="POST"
        className="w-[69%] h-50 flex justify-evenly items-center"
      >
        <input type="hidden" name="_action" value="create" />
        {INPUTS.map((input) => (
          <Input
            key={input.name}
            type={input.type}
            name={input.name}
            placeholder={input.placeholder}
            required={input.required !== false}
          />
        ))}
        <Button disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Start Query"}
        </Button>
      </Form>
      {actionData?.error && (
        <p className="text-red-500 text-sm mt-1">{actionData.error}</p>
      )}
    </div>
  );
}
