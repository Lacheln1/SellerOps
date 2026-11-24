import { createServer } from 'node:http';
import type { HealthStatus } from '@sellerops/shared';

const port = Number(process.env.MOCK_MALL_PORT ?? 3002);

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const body: HealthStatus = { service: 'mock-mall', status: 'ok' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }
  res.writeHead(404).end();
});

server.listen(port, () => {
  console.log(`mock-mall listening on :${port}`);
});
