import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4000;

createApp().then((app) => {
  app.listen(port, () => {
    console.log(`stackplain API on :${port}`);
  });
});
