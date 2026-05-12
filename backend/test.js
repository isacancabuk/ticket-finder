import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

async function testMX() {
  const url =
    "https://www.ticketmaster.com.mx/api/quickpicks/3D00648EE4AD7327/list?sort=price&offset=0&qty=1&primary=true&resale=true";
  const cookie = process.env.TM_MX_COOKIE || "";

  console.log(`Starting GET request to: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        Cookie: cookie,
      },
    });

    console.log("\n--- SUCCESS ---");
    console.log(`Status Code: ${response.status}`);
    console.log("Response Data:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log("\n--- ERROR ---");
    if (error.response) {
      console.log(`Status Code: ${error.response.status}`);
      console.log("Error Data:");
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

testMX();
