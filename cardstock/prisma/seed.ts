import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const kmart = await prisma.retailer.upsert({
    where: { name: "Kmart" },
    update: {},
    create: { name: "Kmart", baseUrl: "https://www.kmart.com.au", platform: "kmart" }
  });
  const bigw = await prisma.retailer.upsert({
    where: { name: "BIG W" },
    update: {},
    create: { name: "BIG W", baseUrl: "https://www.bigw.com.au", platform: "bigw" }
  });
  const eb = await prisma.retailer.upsert({
    where: { name: "EB Games" },
    update: {},
    create: { name: "EB Games", baseUrl: "https://www.ebgames.com.au", platform: "ebgames" }
  });

  const products = [
    { retailerId: kmart.id, title: "Pokemon TCG Scarlet & Violet 151 Elite Trainer Box", url: "https://www.kmart.com.au/product/pokemon-tcg-scarlet-violet-151-elite-trainer-box/43407936", sku: null },
    { retailerId: bigw.id, title: "Pokemon Trading Card Game Paradox Rift Booster Bundle", url: "https://www.bigw.com.au/product/pokemon-trading-card-game-paradox-rift-booster-bundle/p/202866", sku: null },
    { retailerId: eb.id, title: "Pokemon Trading Card Game: Scarlet & Violet Paldea Evolved Booster Box", url: "https://www.ebgames.com.au/product/toys-and-collectibles/294637-pokemon-trading-card-game-scarlet-and-violet-paldea-evolved-booster-box", sku: null }
  ];

  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { url: p.url },
      update: {},
      create: p
    });
    await prisma.productVariant.upsert({
      where: { id: prod.id + "_var" },
      update: {},
      create: { id: prod.id + "_var", productId: prod.id }
    });
  }

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });