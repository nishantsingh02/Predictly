import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const market = await prisma.market.create({
    data: {
      title: "Will BTC hit $100k in 2025?",
      description: "Predict whether Bitcoin will reach $100,000",
      resolutionDescription: "If BTC closes above $100k on any exchange",
      yesOrderbook: { orders: [] },
      noOrderbook: { orders: [] },
      totalQty: 0,
    },
  });
  console.log("Created market:", market.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
