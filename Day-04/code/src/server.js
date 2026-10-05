import "dotenv/config"; 
import { createApp } from "./app.js";
import { createChatService } from "./chatService.js";

const chatService = createChatService();
const app = createApp(chatService);

const port = Number(process.env.PORT || 8080);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
