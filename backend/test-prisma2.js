import prisma from "./src/prisma.js";
async function main() {
  try {
    const query = await prisma.query.update({
      where: { id: "1ca9d886-0494-4d48-b64e-da1609fada05" },
      data: { gogoPrice: 1000, tixPrice: null }
    });
    console.log("Success");
  } catch (err) {
    console.error("Error:", err.message);
  }
}
main();
