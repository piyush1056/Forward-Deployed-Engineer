import express from "express";
import releaseRoutes from "./routes/releaseRoutes.js";

const app = express();

app.use(express.json());

app.use("/api/releases", releaseRoutes);

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

export default app;