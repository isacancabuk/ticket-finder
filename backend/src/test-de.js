import { fetchDE } from "../fetch-de.js";

async function test() {
  const eventId = "2049708374";
  const section = "104";

  const result = await fetchDE({ eventId, section });

  console.log("RESULT:");
  console.dir(result, { depth: null });
}

test();
