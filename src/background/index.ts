// src/background/index.ts
import "./workers/Email";
import "./workers/hashtags";
import "./workers/trends";
import "./workers/notifications";

console.log("🚀 Background workers started and listening for jobs...");
