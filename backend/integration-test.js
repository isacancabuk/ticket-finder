import "dotenv/config";
import prisma from "./src/prisma.js";
import { getNextQueryToRun } from "./src/services/getNextQueryToRun.js";
import { runQuery } from "./src/services/runQuery.js";

async function run() {
  console.log("[test] 🧹 Cleaning up Database...");
  await prisma.checkResult.deleteMany({});
  await prisma.query.deleteMany({});

  console.log("[test] 📝 Creating Queries...");
  const eventUrl = "https://www.ticketmaster.de/event/2049708374";
  
  // Real section with seats (Will be used to test minSeats changing)
  let queryA = await prisma.query.create({
    data: { domain: "DE", site: "TICKETMASTER", eventId: "2049708374", eventUrl, section: "104", minSeats: 1 }
  });
  
  // Fake section without seats (To test scheduler round-robin)
  let queryB = await prisma.query.create({
    data: { domain: "DE", site: "TICKETMASTER", eventId: "2049708374", eventUrl, section: "FAKE_104", minSeats: 1 }
  });

  console.log(`[test] Queries Created:
  A: ${queryA.id} (section: 104, minSeats: 1)
  B: ${queryB.id} (section: FAKE_104, minSeats: 1)
  `);

  console.log("[test] 🚀 Simulating Scheduler Ticks (Fast Forward)...");
  
  const simTick = async (tickNum) => {
    console.log(`\n--- Tick ${tickNum} ---`);
    const nextQ = await getNextQueryToRun();
    if (!nextQ) {
      console.log("[test] No query picked (Scheduler rests).");
      return;
    }
    const label = nextQ.id === queryA.id ? "A" : "B";
    console.log(`[test] Picked Query ${label} (section: ${nextQ.section}, minSeats: ${nextQ.minSeats})`);
    
    console.log(`[test] Running query...`);
    await runQuery(nextQ.id);
    
    const qs = await prisma.query.findMany({ orderBy: { createdAt: "asc" }});
    console.log(`  State after run:`);
    for (const q of qs) {
      const ql = q.id === queryA.id ? "A" : "B";
      console.log(`    Query ${ql} (minSeats=${q.minSeats}): status=${q.status}, isAvailable=${q.isAvailable}`);
    }
  };

  // Tick 1 (Picks A or B)
  await simTick(1);
  // Tick 2 (Picks the other one)
  await simTick(2);

  console.log("\n[test] ⚙️ Modifying Query A minSeats to 3...");
  await prisma.query.update({ where: { id: queryA.id }, data: { minSeats: 3, lastCheckedAt: new Date(0) }}); // force A to run next

  // Tick 3 (Picks A, tests minSeats 3)
  await simTick(3);

  console.log("\n[test] ⚙️ Modifying Query A minSeats to 7...");
  await prisma.query.update({ where: { id: queryA.id }, data: { minSeats: 7, lastCheckedAt: new Date(0) }}); // force A to run next

  // Tick 4 (Picks A, tests minSeats 7)
  await simTick(4);

  console.log("\n[test] 🛑 Stopping Query B...");
  await prisma.query.update({ where: { id: queryB.id }, data: { status: "STOPPED", lastCheckedAt: new Date(0) } }); // make B oldest, but stopped!

  // Tick 5 (Picks A because B is stopped)
  await simTick(5);

  console.log("\n[test] ✅ Test Complete. Final Results:");
  const results = await prisma.checkResult.findMany({ orderBy: { checkedAt: "asc" } });
  results.forEach(r => {
    const qid = r.queryId === queryA.id ? "A" : "B";
    console.log(`  Result log -> query: ${qid}, status=${r.status}, isAvailable=${r.isAvailable}, latency=${r.latencyMs}ms`);
  });
  
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
