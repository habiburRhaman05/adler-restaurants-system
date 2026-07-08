
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clean up existing data to avoid conflicts
await prisma.$transaction(async (tx) => {
  await tx.dayDemand.deleteMany({});
  await tx.demandWeek.deleteMany({});
  await tx.availabilityDay.deleteMany({});
  await tx.availabilityMonth.deleteMany({});
  // await tx.shiftAssignment.deleteMany({});
  await tx.shift.deleteMany({});

  await tx.userCategory.deleteMany({});

  // await tx.category.deleteMany({});

  await tx.user.deleteMany({});
});

  // 1. Create Categories
  console.log('Creating categories...');
  const categoryNames = ['Service', 'Kitchen', 'Bar', 'Management'];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.category.create({
        data: { name },
      })
    )
  );

  const serviceCategory = categories.find((c) => c.name === 'Service')!;
  const kitchenCategory = categories.find((c) => c.name === 'Kitchen')!;

  // 2. Create Users
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  
const usersData = [
  {
    firstName: "James",
    lastName: "Anderson",
    email: "james.anderson@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Emily",
    lastName: "Johnson",
    email: "emily.johnson@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "Michael",
    lastName: "Williams",
    email: "michael.williams@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Olivia",
    lastName: "Brown",
    email: "olivia.brown@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "William",
    lastName: "Jones",
    email: "william.jones@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Sophia",
    lastName: "Garcia",
    email: "sophia.garcia@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "Benjamin",
    lastName: "Miller",
    email: "benjamin.miller@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Ava",
    lastName: "Davis",
    email: "ava.davis@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "Lucas",
    lastName: "Rodriguez",
    email: "lucas.rodriguez@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Charlotte",
    lastName: "Martinez",
    email: "charlotte.martinez@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "Henry",
    lastName: "Wilson",
    email: "henry.wilson@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Amelia",
    lastName: "Moore",
    email: "amelia.moore@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "Daniel",
    lastName: "Taylor",
    email: "daniel.taylor@example.com",
    category: serviceCategory,
  },
  {
    firstName: "Harper",
    lastName: "Thomas",
    email: "harper.thomas@example.com",
    category: kitchenCategory,
  },
  {
    firstName: "Ethan",
    lastName: "White",
    email: "ethan.white@example.com",
    category: serviceCategory,
  },
];

  const users = await Promise.all(
    usersData.map((u) =>
      prisma.user.create({
        data: {
          firstName: u.firstName,
          lastName: u.lastName,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          categories: {
            create: [
              {
                category: { connect: { id: u.category.id } }
              }
            ]
          }
        },
      })
    )
  );

  // 3. Create Availability for current month
  console.log('Creating availability for this month...');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const daysInMonth = new Date(year, month, 0).getDate();

  for (const user of users) {
    const availabilityMonth = await prisma.availabilityMonth.create({
      data: {
        userId: user.id,
        year,
        month,
        status: 'SUBMITTED',
        cutoffAt: new Date(year, month - 1, 15),
        submittedAt: new Date(),
      },
    });

    const availabilityDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      
      // Give them some fake preferred times (e.g. 09:00 to 17:00)
      let preferredStartTime = new Date(date);
      preferredStartTime.setUTCHours(9, 0, 0, 0);
      
      let preferredEndTime = new Date(date);
      preferredEndTime.setUTCHours(17, 0, 0, 0);

      // Randomly make some days unavailable
      const isUnavailable = Math.random() > 0.8;
      
      availabilityDays.push({
        availabilityMonthId: availabilityMonth.id,
        date,
        status: isUnavailable ? 'UNAVAILABLE' : 'AVAILABLE',
        preferredStartTime: isUnavailable ? null : preferredStartTime,
        preferredEndTime: isUnavailable ? null : preferredEndTime,
      });
    }

    // @ts-ignore (enums are mapped based on Prisma client)
    await prisma.availabilityDay.createMany({
      data: availabilityDays as any,
    });
  }

  // 4. Create Demand for the current week
  console.log('Creating demand for this week...');
  // Find Monday of the current week
  const today = new Date();
  const currentDay = today.getUTCDay();
  // We need Sunday for DemandWeek as per schema: `always a Sunday`
  const diffToSunday = currentDay; 
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - diffToSunday);
  sunday.setUTCHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);

  const demandWeek = await prisma.demandWeek.create({
    data: {
      weekStartDate: sunday,
      weekEndDate: saturday,
      status: 'DRAFT',
    },
  });

  const dayDemands = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + i);

    dayDemands.push({
      demandWeekId: demandWeek.id,
      categoryId: serviceCategory.id,
      date,
      requiredCount: 2, // e.g. need 2 Service staff everyday
    });

    dayDemands.push({
      demandWeekId: demandWeek.id,
      categoryId: kitchenCategory.id,
      date,
      requiredCount: 2, // e.g. need 2 Kitchen staff everyday
    });
  }

  await prisma.dayDemand.createMany({
    data: dayDemands,
  });

  console.log('Seed completed successfully!');
}

// const main = async () => {
//   console.log('Starting seed...');

//   // Clean up existing data to avoid conflicts
//   await prisma.$transaction(async (tx) => {
//     await tx.dayDemand.deleteMany({});
//     await tx.demandWeek.deleteMany({});
//     await tx.availabilityDay.deleteMany({});
//     await tx.availabilityMonth.deleteMany({});

//     // Delete tables that reference Category
//     // await tx.shiftAssignment.deleteMany({});
//     await tx.shift.deleteMany({});

//     await tx.userCategory.deleteMany({});

//     // await tx.category.deleteMany({});
    
//     await tx.user.deleteMany({});
//   });}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
