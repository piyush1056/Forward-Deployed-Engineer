import "dotenv/config"; 
import { createApp } from "./app.js";
import { createSummarizeService } from "./summarizeService.js";

// Wire dependencies: create the OpenAI service and inject it into Express app
const summarizeService = createSummarizeService();
const app = createApp(summarizeService);

const port = Number(process.env.PORT || 8080);


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
