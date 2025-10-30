// ===== server.js =====
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);

  let contentType = "text/html";
  switch (ext) {
    case ".js": contentType = "text/javascript"; break;
    case ".css": contentType = "text/css"; break;
    case ".json": contentType = "application/json"; break;
    case ".png": contentType = "image/png"; break;
    case ".jpg": contentType = "image/jpg"; break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("404 Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

const PORT = 9000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:9000`));
