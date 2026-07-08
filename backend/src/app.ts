import express, { type Express, type Request, type Response } from "express";
import { envConfig, envValidationError } from "./config/env";
import { logger } from "./utils/logger";
import { applyMiddleware } from "./middleware";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import indexRouter from "./routes/index.route";
const app: Express = express();

// Trust the configured number of reverse proxies so req.ip is the real client
// IP (correct rate limiting) rather than the proxy's. A finite hop count avoids
// the IP-spoofing risk of `trust proxy = true`.
app.set("trust proxy", envConfig.TRUST_PROXY_HOPS);

applyMiddleware(app);

// If the environment is misconfigured, refuse every request with a clear,
// readable error instead of serving with placeholder secrets.
if (envValidationError) {
  app.use((_req: Request, res: Response) => {
    res.status(500).json({
      success: false,
      message: "Server misconfigured: invalid or missing environment variables.",
      error: envValidationError,
    });
  });
}

app.use("/api/v1",indexRouter)



app.get("/health",async (_req, res) =>{

  res.status(200).json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
});


app.get("/", (req, res) => {
  res.send("home");
});



export const startServer = async () => {

  try {
    const PORT = envConfig.PORT || 5000;
    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Server started");
    })
  } catch (error) {
    logger.fatal({ err: error }, "Error initializing app");
    process.exit(1);
  }
};
app.use(notFound);
app.use(errorHandler);



export default app;



