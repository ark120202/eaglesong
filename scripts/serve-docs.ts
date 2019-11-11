import http from 'http';
import path from 'path';
import fs from 'fs';

function sendFile(response: http.ServerResponse, filePath: string, contentType: string) {
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(response);

  fileStream.on('error', () => {
    response.writeHead(404);
    response.end();
  });

  fileStream.on('close', () => {
    response.writeHead(200, { 'Content-Type': contentType });
    response.end();
  });
}

const server = http.createServer(({ url }, response) => {
  if (url && path.extname(url)) {
    sendFile(response, path.join(__dirname, '../docs', url), 'text/plain');
  } else {
    sendFile(response, path.join(__dirname, '../docs/index.html'), 'text/html');
  }
});

server.listen(8080, () => console.log('Listening on http://localhost:8080/'));
