import { startServer } from "./app";
import bcrypt from "bcrypt";
import { connectToDatabase, prisma } from "./config/db";


(async () => {
  await connectToDatabase();

  // const passwordHash = await bcrypt.hash("admin123", 10);

 
  //  await prisma.admin.create({
  //   data: {
  //     email: "admin@adlersystem.com",
  //     passwordHash: passwordHash,
  //   }
  // });


  await startServer();
})();
