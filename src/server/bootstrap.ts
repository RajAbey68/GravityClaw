import http from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { getAppContainer } from "@/src/core/container";

const dev = process.env.NODE_ENV !== "production";

async function bootstrap() {
  const container = await getAppContainer();
  const app = next({ dev, hostname: "0.0.0.0", port: container.env.PORT });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => handle(req, res));

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/api/events/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const recent = container.eventBus.recent(40);
      recent.reverse().forEach((event) => ws.send(JSON.stringify(event)));

      const unsubscribe = container.eventBus.subscribe((event) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(event));
        }
      });

      ws.on("close", unsubscribe);
    });
  });

  server.listen(container.env.PORT, "0.0.0.0", () => {
    console.log(`Gravity Claw listening on http://localhost:${container.env.PORT}`);
  });

  if (container.env.TELEGRAM_BOT_TOKEN) {
    container.telegram.start();
  }
}

bootstrap().catch((error) => {
  console.error("Failed to start Gravity Claw", error);
  process.exit(1);
});
