import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
prisma.weeklyPlan.deleteMany({ where: { demands: { none: {} } } }).then(console.log).catch(console.error);
