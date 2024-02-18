const express = require("express");
const app = express();
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

app.set("view engine", "ejs");
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});
const { ExpressPeerServer } = require("peer");
const opinions = {
  debug: true,
};

app.use("/peerjs", ExpressPeerServer(server, opinions));
app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: (req, res, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage: storage,
}).single("video");

app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error(err);
      res.status(400).send("An error occurred during upload.");
    } else {
      if (req.file == undefined) {
        res.status(400).send("Error: No file selected.");
      } else {
        res.status(200).send("File uploaded and converted successfully!");
      }
    }
  });
});

app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "video/webm");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    res.status(404).send("File not found");
  }
});

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

const connections = {};

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    if (!connections[roomId]) {
      connections[roomId] = [{ userId, isAdmin: true }];
    } else {
      connections[roomId].push({ userId, isAdmin: false });
    }

    io.to(roomId).emit("user-connected", userId, connections[roomId]);
    socket.on("send-message", (message) => {
      io.to(roomId).emit("create-message", message, userId);
    });

    socket.on("disconnect", () => {
      io.to(roomId).emit("user-disconnected", userId, connections[roomId]);
      if (connections[roomId]) {
        const index = connections[roomId].find(
          (user) => user.userId === userId
        );
        if (index !== -1) {
          connections[roomId].splice(index, 1);
        }
      }
      for (const [roomId, connectedUsers] of Object.entries(connections)) {
        if (!connectedUsers.length) {
          delete connections[roomId];
        }
      }
    });
  });
});

const PORT = 8909;
server.listen(PORT, () => console.log("Sever is running PORT " + PORT));
