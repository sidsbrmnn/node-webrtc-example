import http, { Server as HTTPServer } from "http";
import express, { Application } from "express";
import path from "path";
import socketIO, { Server as SocketIOServer } from "socket.io";

export class Server {
  private httpServer: HTTPServer;
  private app: Application;
  private io: SocketIOServer;

  private activeSockets: string[] = [];

  private readonly DEFAULT_PORT = 3000;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.io = socketIO(this.httpServer);

    this.configureApp();
    this.handleRoutes();
    this.handleSocketConnection();
  }

  private configureApp(): void {
    this.app.use(express.static(path.join(__dirname, "..", "public")));
  }

  private handleRoutes(): void {
    this.app.get("/", (req, res) => {
      res.sendFile("index.html");
    });
  }

  private handleSocketConnection(): void {
    this.io.on("connection", (socket) => {
      const existingSocket = this.activeSockets.find(
        (existingSocket) => existingSocket === socket.id
      );

      if (!existingSocket) {
        this.activeSockets.push(socket.id);

        socket.emit("update-user-list", {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket !== socket.id
          ),
        });

        socket.broadcast.emit("update-user-list", { users: [socket.id] });
      }

      socket.on("call-user", (data: any) => {
        socket
          .to(data.to)
          .emit("call-made", { offer: data.offer, socket: socket.id });
      });

      socket.on("make-answer", (data) => {
        socket
          .to(data.to)
          .emit("answer-made", { socket: socket.id, answer: data.answer });
      });

      socket.on("reject-call", (data) => {
        socket.to(data.from).emit("call-rejected", { socket: socket.id });
      });

      socket.on("disconnect", () => {
        this.activeSockets = this.activeSockets.filter(
          (existingSocket) => existingSocket !== socket.id
        );
        socket.broadcast.emit("remove-user", { socketId: socket.id });
      });
    });
  }

  public listen(callback: (port: number) => void): void {
    const port = parseInt(process.env.PORT || "", 10) || this.DEFAULT_PORT;
    this.httpServer.listen(port, () => callback(port));
  }
}
