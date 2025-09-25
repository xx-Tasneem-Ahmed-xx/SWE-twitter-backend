import dotenv from "dotenv";
import app from "./app";
dotenv.config();

const PORT = process.env.PORT;

async function start() {
  try {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error(error);
  }
}

start();
