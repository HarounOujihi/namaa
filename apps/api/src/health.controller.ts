import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('meta')
@Controller()
export class MetaController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  landing(): string {
    return LANDING_HTML;
  }

  @Get('health')
  @ApiTags('health')
  check(): { status: string } {
    return { status: 'ok' };
  }
}

const LANDING_HTML = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rihlati API</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif;
    background: #fdf6ec; color: #3d2817;
  }
  .card {
    background: #fff; border: 2px solid #ecdcc8; border-radius: 20px;
    padding: 40px 44px; max-width: 420px; width: calc(100% - 32px);
    text-align: center; box-shadow: 0 12px 32px rgba(93,64,55,.08);
  }
  .owl { font-size: 44px; }
  h1 { font-size: 1.3rem; margin: 10px 0 4px; }
  p.sub { margin: 0 0 22px; color: #8a6f5c; font-size: .95rem; }
  a.link {
    display: flex; align-items: center; justify-content: space-between;
    text-decoration: none; color: #3d2817; background: #faf1e4;
    border: 1.5px solid #ecdcc8; border-radius: 12px;
    padding: 12px 16px; margin: 8px 0; font-weight: 600; font-size: .95rem;
  }
  a.link:hover { border-color: #d9b98f; background: #f5e8d3; }
  a.link span { color: #b08c5f; font-weight: 400; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
  .grid a.link { margin: 0; justify-content: center; }
  footer { margin-top: 18px; font-size: .8rem; color: #b08c5f; }
</style>
</head>
<body>
  <main class="card">
    <div class="owl">&#129417;</div>
    <h1>Rihlati &mdash; Dyslexia Therapy API</h1>
    <p class="sub">Backend service is running</p>
    <a class="link" href="/docs">Swagger documentation <span>/docs</span></a>
    <a class="link" href="/health">Health check <span>/health</span></a>
    <div class="grid">
      <a class="link" href="http://localhost:5173">Child app</a>
      <a class="link" href="http://localhost:5174">Admin CMS</a>
      <a class="link" href="http://localhost:3001">Care portal</a>
      <a class="link" href="http://localhost:9006">MinIO console</a>
    </div>
    <footer>JSON API &mdash; see /docs for every endpoint</footer>
  </main>
</body>
</html>`;