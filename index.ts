import { runApp, cleanup } from "./src/shell/app";

const renderer = await runApp();
process.on("SIGINT", () => cleanup(renderer));
