const HTTPS_PORT = 8081;
const HTTP2_PORT = 8082;

// http/1.1 server
const https = require("https");
const fs    = require("fs");
const mime  = require("mime");

const serverOptions = {
  key:  fs.readFileSync('./cert/localhost-privkey.pem'),
  cert: fs.readFileSync('./cert/localhost-cert.pem')
};

const httpsHandler = (req, res) => {
  console.log(req.url);
  if (req.url === "/favicon.ico") {
    res.writeHead(200);
    res.end();
    return;
  }

  const fileName = req.url === "/" ? "index.html" : __dirname + req.url;
  fs.readFile(fileName, (err, data) => {
    if (err) {
      res.writeHead(503);
      res.end("Error occurred while reading file", fileName);
      return;
    }
    res.writeHead(200, { "Content-Type": mime.getType(fileName) });
    res.end(data);
  });
};

https
  .createServer(serverOptions, httpsHandler)
  .listen(HTTPS_PORT, () =>
    console.log("HTTP/1.1 server started on port", HTTPS_PORT)
  );


// http/2 server
const http2 = require("http2");

const sendFile = (stream, fileName) => {
  const fd = fs.openSync(fileName, "r");
  const stat = fs.fstatSync(fd);
  const headers = {
    "content-length": stat.size,
    "last-modified": stat.mtime.toUTCString(),
    "content-type": mime.getType(fileName)
  };
  stream.respondWithFD(fd, headers);
  stream.on("close", () => {
    console.log("closing file", fileName);
    fs.closeSync(fd);
  });
  stream.end();
};

const pushFile = (stream, path, fileName) => {
  stream.pushStream({ ":path": path }, (err, pushStream) => {
    if (err) {
      throw err;
    }
    sendFile(pushStream, fileName);
  });
};

const http2Handlers = (req, res) => {
  console.log(req.url);
  if (req.url === "/") {
    // push style.css
    pushFile(res.stream, "/style.css", "style.css");

    sendFile(res.stream, "index.html");
  } else {
    if (req.url === "/favicon.ico") {
      res.stream.respond({ ":status": 200 });
      res.stream.end();
      return;
    }
    const fileName = __dirname + req.url;
    sendFile(res.stream, fileName);
  }
};

http2
  .createSecureServer(serverOptions, http2Handlers)
  .listen(HTTP2_PORT, () => {
    console.log("HTTP/2 server started on port", HTTP2_PORT);
  });
