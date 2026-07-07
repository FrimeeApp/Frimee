import { execSync } from "node:child_process";
import { networkInterfaces } from "node:os";

function getLocalIp() {
  const nets = networkInterfaces();
  for (const net of Object.values(nets)) {
    if (!net) continue;
    for (const address of net) {
      const familyV4Value = typeof address.family === "string" ? "IPv4" : 4;
      if (address.family === familyV4Value && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

const port = process.env.PORT ?? "3000";
const ip = process.env.CAP_LOCAL_IP ?? getLocalIp();

if (!ip) {
  console.error("No local IPv4 address found. Set CAP_LOCAL_IP manually and retry.");
  process.exit(1);
}

console.log(`→ Starting Next dev for mobile on http://${ip}:${port}`);
console.log("→ iOS Simulator can also use http://localhost:3000");

execSync("next dev --hostname 0.0.0.0", {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=4096",
    CAP_ALLOWED_DEV_ORIGIN: ip,
  },
});
