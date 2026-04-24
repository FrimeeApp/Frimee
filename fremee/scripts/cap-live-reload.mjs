import { networkInterfaces } from "node:os";
import { execSync } from "node:child_process";

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

const platform = process.argv[2] ?? "ios";
const port = process.env.PORT ?? "3000";
const ip = process.env.CAP_LOCAL_IP ?? getLocalIp();

if (!ip) {
  console.error("No local IPv4 address found. Set CAP_LOCAL_IP manually and retry.");
  process.exit(1);
}

const serverUrl = `http://${ip}:${port}`;

console.log(`→ Configuring Capacitor live reload for ${platform}`);
console.log(`→ Server URL: ${serverUrl}`);

execSync(`npx cap sync ${platform}`, {
  stdio: "inherit",
  env: {
    ...process.env,
    CAP_SERVER_URL: serverUrl,
    CAP_CLEAR_TEXT: "true",
  },
});

console.log("");
console.log(`Live reload ready for ${platform}.`);
console.log("Next step:");
console.log(`  npx cap open ${platform}`);
