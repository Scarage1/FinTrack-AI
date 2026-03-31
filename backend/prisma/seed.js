import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = "demo@expense.app";
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Demo User", passwordHash },
    create: { name: "Demo User", email, passwordHash }
  });

  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.expense.createMany({
    data: [
      {
        userId: user.id,
        amount: 280,
        category: "Food",
        description: "Swiggy lunch",
        paymentMethod: "UPI",
        timestamp: new Date(`${currentMonth}-03T12:10:00.000Z`)
      },
      {
        userId: user.id,
        amount: 420,
        category: "Travel",
        description: "Uber office commute",
        paymentMethod: "Card",
        timestamp: new Date(`${currentMonth}-06T09:00:00.000Z`)
      },
      {
        userId: user.id,
        amount: 1600,
        category: "Bills",
        description: "Electricity bill",
        paymentMethod: "NetBanking",
        timestamp: new Date(`${currentMonth}-08T05:30:00.000Z`)
      },
      {
        userId: user.id,
        amount: 699,
        category: "Shopping",
        description: "Amazon household items",
        paymentMethod: "Card",
        timestamp: new Date(`${currentMonth}-11T18:45:00.000Z`)
      }
    ]
  });

  await prisma.budget.createMany({
    data: [
      { userId: user.id, category: "Food", limit: 4000 },
      { userId: user.id, category: "Travel", limit: 3000 },
      { userId: user.id, category: "Bills", limit: 5000 }
    ]
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete. Demo user: demo@expense.app / password123");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
