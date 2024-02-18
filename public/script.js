// Establishing a connection to the server using socket.io
const socket = io("/");
// Getting references to various elements in the HTML document
const videoContainerEl = document.getElementById("video-container");
const actionButtonsEl = document.getElementById("action-buttons");
const shareScreenEl = document.getElementById("share-screen");
const stopScreenEl = document.getElementById("stop-share");
const startRecordingEl = document.getElementById("start-recording");
const stopRecordingEl = document.getElementById("stop-recording");
const messageFormEl = document.getElementById("message-form");
const inputEl = document.getElementById("input-form");

// Creating a new Peer object for WebRTC communication
const peer = new Peer(undefined, {
  config: {
    iceServers: [
      // Setting up ICE servers for peer-to-peer connectivity
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "0f956e42603ee768b783e0e2",
        credential: "c6rFQYnCpXqbdLK3",
      },
    ],
  },
});

// Variables to hold current stream and connected peers
let currentStream;
let connectedPeers = [];

// Event listener for when a user connects
socket.on("user-connected", async (userId, users) => {
  // Checking if the user is an admin
  const isAdmin = users.find((user) => user.userId === userId).isAdmin;

  // If user is an admin, initialize video streaming and recording
  if (isAdmin) {
    const stream = await getStream();
    currentStream = stream;
    startRecordingEl.addEventListener("click", () => startRecording(stream));
    const video = document.querySelector("video");
    video.srcObject = stream;
    video.muted = true;
    video.addEventListener("loadedmetadata", () => {
      video.play();
      videoContainerEl.append(video);
      actionButtonsEl.style.display = "block";
    });
  }

  // Initiating a call to the user if not an admin
  let call;
  if (!isAdmin) {
    call = peer.call(userId, currentStream);
  }
  // Adding connected peers to the list
  users.forEach(async () => {
    if (call) {
      connectedPeers.push(call.peerConnection);
    }
  });
});

// Event listener for when a user disconnects
socket.on("user-disconnected", (userId, users) => {
  // Check if the disconnected user is an admin
  const isAdmin = users.find((user) => user.userId === userId)?.isAdmin;
  if (isAdmin) {
    console.log("Admin disconnected!");
  }
});

// Event listener for when the peer connection is established
peer.on("open", (id) => {
  // Getting the room ID from the URL
  const roomId = window.location.pathname.replace("/", "");
  const userId = id;
  // Sending a join-room event to the server
  socket.emit("join-room", roomId, userId);
});

// Event listener for incoming calls
peer.on("call", (call) => {
  // Answering the call and displaying the remote video stream
  call.answer();
  videoContainerEl.setAttribute("data-remote", "true");
  const video = document.querySelector("video");
  call.on("stream", (stream) => {
    video.srcObject = stream;
    videoContainerEl.addEventListener("click", () => {
      video.play();
    });
    video.addEventListener("loadedmetadata", () => {
      videoContainerEl.append(video);
    });
  });
});

// Event listener for peer connection errors
peer.on("error", (error) => {
  console.error(error);
});

// Event listener for sharing screen
shareScreenEl.addEventListener("click", async () => {
  const stream = await getScreen();
  currentStream = stream;

  // Replace video tracks for connected peers with screen stream
  if (connectedPeers.length) {
    connectedPeers.forEach((connection) => {
      const [videoTrack] = stream.getVideoTracks();
      const sender = connection
        .getSenders()
        .find((s) => s.track.kind === videoTrack.kind);
      sender.replaceTrack(videoTrack);
    });
  }
  const video = document.querySelector("video");
  video.srcObject = stream;
  video.muted = true;
  video.addEventListener("loadedmetadata", () => {
    video.play();
    videoContainerEl.append(video);
  });
});

// Event listener for stopping screen sharing
stopScreenEl.addEventListener("click", async () => {
  const video = document.querySelector("video");
  const tracks = video.srcObject.getTracks();
  tracks.forEach((track) => track.stop());
  const stream = await getStream();

  // Replace video tracks for connected peers with original stream
  if (connectedPeers.length) {
    connectedPeers.forEach((connection) => {
      const [videoTrack] = stream.getVideoTracks();
      const sender = connection
        .getSenders()
        .find((s) => s.track.kind === videoTrack.kind);
      sender.replaceTrack(videoTrack);
    });
  }

  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
});

// Function to get user media stream
const getStream = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  return stream;
};

// Function to get screen sharing stream
const getScreen = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });
  return stream;
};

// Function to start recording the stream
const startRecording = (stream) => {
  const chunks = [];
  const mediaRecorder = new MediaRecorder(stream);
  // Event listener for when data is available
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  // Start recording
  mediaRecorder.start();
  // Event listener for when recording stops
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    await uploadVideo(blob);
    chunks.length = 0;
  };

  // Event listener for stopping recording
  stopRecordingEl.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  });
};

// Function to upload recorded video
const uploadVideo = async (blob) => {
  try {
    const formData = new FormData();
    formData.append("video", blob, "recording.webm");

    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      console.log("Video uploaded successfully.");
    } else {
      console.error("Failed to upload video.");
    }
  } catch (error) {
    console.error("Error uploading video:", error);
  }
};

// Event listener for sending messages
messageFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  if (inputEl.value) {
    socket.emit("send-message", inputEl.value);
    inputEl.value = "";
  }
});

// Function to generate random string for message IDs
const generateRandomString = (length) => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

// Function to generate HTML for displaying messages
const getMessageString = (id, message, sender) => {
  return `
    <div id=${id} class="message">
      <small class="sender">${sender}</small>
      <div class="content">${message}</div>
    </div>
  `;
};

const messageContainer = document.getElementById("messages");
// Event listener for receiving messages from server
socket.on("create-message", (message, userId) => {
  const id = generateRandomString(6);
  // Displaying the message in the message container
  messageContainer.innerHTML += getMessageString(
    id,
    message,
    userId.split("-")[0]
  );
  // Scrolling to the latest message
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
});
