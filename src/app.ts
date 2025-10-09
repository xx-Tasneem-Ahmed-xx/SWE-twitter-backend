import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./swagger.json";
import userRouter from "./api/routes/user.routes";

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.use("/api/users", userRouter);
app.get("/", (req, res) => res.json({ message: "HELLO TEAM" }));
export default app;
