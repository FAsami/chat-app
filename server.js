// Importing necessary modules and setting up the server
const express = require("express"); // Importing Express framework for creating server
const app = express(); // Creating an instance of Express
const server = require("http").Server(app); // Creating an HTTP server using Express app
const { v4: uuidv4 } = require("uuid"); // Importing UUID for generating unique identifiers
const multer = require("multer"); // Importing multer for handling file uploads
const path = require("path"); // Importing path module for file path operations
const fs = require("fs"); // Importing fs module for file system operations

// Configuring Express app
app.set("view engine", "ejs"); // Setting the view engine to EJS for rendering HTML templates

// Configuring Socket.IO for real-time communication
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

// Configuring PeerJS server for peer-to-peer communication
const { ExpressPeerServer } = require("peer");
const opinions = {
  debug: true,
};

// Serving static files from the 'public' directory
app.use("/peerjs", ExpressPeerServer(server, opinions)); // Configuring PeerJS server
app.use(express.static("public")); // Serving static files from the 'public' directory

// Configuring multer for handling file uploads
const storage = multer.diskStorage({
  destination: (req, res, cb) => cb(null, "uploads/"), // Setting upload destination directory
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }, // Generating unique filename for uploaded file
});

const upload = multer({
  storage: storage,
}).single("video"); // Configuring multer to accept a single file with the field name 'video'

// Handling file upload endpoint
app.post("/upload", (req, res) => {
  // Handling file upload using multer middleware
  upload(req, res, (err) => {
    if (err) {
      console.error(err);
      res.status(400).send("An error occurred during upload.");
    } else {
      // If upload is successful
      console.log("file", req.url);
      if (req.file == undefined) {
        res.status(400).send("Error: No file selected.");
      } else {
        // Sending success response with download URL for the uploaded file
        const baseUrl = req.protocol + "://" + req.get("host");
        res.status(200).send({
          success: true,
          downloadUrl: `${baseUrl}/download/${req.file.filename}`,
        });
      }
    }
  });
});

// Handling file download endpoint
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);

  // Checking if the file exists
  if (fs.existsSync(filePath)) {
    // If file exists, sending the file for download
    res.setHeader("Content-Type", "video/webm");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    // If file doesn't exist, sending 404 error
    res.status(404).send("File not found");
  }
});

// Handling root endpoint
app.get("/", (req, res) => {
  // Redirecting to a randomly generated room
  res.redirect(`/${uuidv4()}`);
});

// Handling room endpoint
app.get("/:room", (req, res) => {
  // Rendering the 'room' template with the room ID
  res.render("room", { roomId: req.params.room });
});

// Storing connections for each room
const connections = {};

// Handling Socket.IO connection events
io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    // Joining the room
    socket.join(roomId);

    // Storing connection information
    if (!connections[roomId]) {
      connections[roomId] = [{ userId, isAdmin: true }];
    } else {
      connections[roomId].push({ userId, isAdmin: false });
    }

    // Emitting 'user-connected' event to notify other users in the room
    io.to(roomId).emit("user-connected", userId, connections[roomId]);

    // Handling message sending
    socket.on("send-message", (message) => {
      io.to(roomId).emit("create-message", message, userId);
    });

    // Handling disconnection
    socket.on("disconnect", () => {
      io.to(roomId).emit("user-disconnected", userId, connections[roomId]);

      // Removing user from connections
      if (connections[roomId]) {
        const index = connections[roomId].findIndex(
          (user) => user.userId === userId
        );
        if (index !== -1) {
          connections[roomId].splice(index, 1);
        }
      }

      // Cleaning up empty room connections
      for (const [roomId, connectedUsers] of Object.entries(connections)) {
        if (!connectedUsers.length) {
          delete connections[roomId];
        }
      }
    });
  });
});

// Starting the server on port 8909
const PORT = 8900;
server.listen(PORT, () => console.log("Server is running on PORT " + PORT));
