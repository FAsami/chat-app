// Establishing a connection to the server using socket.io
const socket = io("/");

// Getting references to various elements in the HTML document
const videoContainerEl = document.getElementById("video-container");
const streamRecordContainer = document.getElementById(
  "stream-record-container"
);
const localVideoEl = document.getElementById("local-video");
const remoteVideoEl = document.getElementById("remote-video");
const actionButtonsEl = document.getElementById("action-buttons");
const shareScreenEl = document.getElementById("share-screen");
const stopScreenEl = document.getElementById("stop-share");
const startRecordingEl = document.getElementById("start-recording");
const stopRecordingEl = document.getElementById("stop-recording");
const messageFormEl = document.getElementById("message-form");
const inputEl = document.getElementById("input-form");
const recordingState = document.getElementById("recording-state");
const adminStateEl = document.getElementById("admin-state");
const uploadStatus = document.getElementById("uploading-status");

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
let canvasElement = document.createElement("canvas");
let canvasCtx = canvasElement.getContext("2d");
let recordedChunks = [];
let audioTracks = [];
let mediaRecorder;

const streams = {
  cameraSteam: null,
  screenStream: null,
  composedStream: null,
};
const DOMElements = {
  screen: null,
  camera: null,
};

// Function to request animation frame
const requestFrame = (callback) => {
  return window.setTimeout(() => {
    callback(Date.now());
  }, 1000 / 60);
};

// Function to cancel animation frame
const cancelFrame = (id) => {
  clearTimeout(id);
};

// Function to compose video on canvas
const composeVideoCanvas = async () => {
  const isSharing = document.getElementById("screen-stream");

  if (isSharing) {
    canvasCtx.save();
    canvasElement.setAttribute("width", `${DOMElements.screen.videoWidth}px`);
    canvasElement.setAttribute("height", `${DOMElements.screen.videoHeight}px`);
    canvasCtx.clearRect(
      0,
      0,
      DOMElements.screen.videoWidth,
      DOMElements.screen.videoHeight
    );
    canvasCtx.drawImage(
      DOMElements.screen,
      0,
      0,
      DOMElements.screen.videoWidth,
      DOMElements.screen.videoHeight
    );

    let imageData = canvasCtx.getImageData(
      0,
      0,
      DOMElements.screen.videoWidth,
      DOMElements.screen.videoHeight
    );
    canvasCtx.putImageData(imageData, 0, 0);
    canvasCtx.restore();
  } else if (DOMElements.camera) {
    canvasCtx.save();
    canvasElement.setAttribute("width", `${DOMElements.camera.videoWidth}px`);
    canvasElement.setAttribute("height", `${DOMElements.camera.videoHeight}px`);
    canvasCtx.clearRect(
      0,
      0,
      DOMElements.camera.videoWidth,
      DOMElements.camera.videoHeight
    );
    canvasCtx.drawImage(
      DOMElements.camera,
      0,
      0,
      DOMElements.camera.videoWidth,
      DOMElements.camera.videoHeight
    );

    let imageData = canvasCtx.getImageData(
      0,
      0,
      DOMElements.camera.videoWidth,
      DOMElements.camera.videoHeight
    );
    canvasCtx.putImageData(imageData, 0, 0);
    canvasCtx.restore();
  }
  rafId = requestFrame(composeVideoCanvas);
};

// Function to compose streams
const composeStreams = async () => {
  await composeVideoCanvas();
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  const fullVideoStream = canvasElement.captureStream();

  const existingAudioStreams = [
    ...(streams.cameraSteam ? streams.cameraSteam.getAudioTracks() : []),
    ...(streams.screenStream ? streams.screenStream.getAudioTracks() : []),
  ];
  audioTracks.push(
    audioContext.createMediaStreamSource(
      new MediaStream([existingAudioStreams[0]])
    )
  );
  if (existingAudioStreams.length > 1) {
    audioTracks.push(
      audioContext.createMediaStreamSource(
        new MediaStream([existingAudioStreams[1]])
      )
    );
  }
  audioTracks.map((track) => track.connect(destination));

  const fullOverlayStream = new MediaStream([
    ...fullVideoStream.getVideoTracks(),
    ...destination.stream.getTracks(),
  ]);

  streams.composedStream = new MediaStream([
    ...fullVideoStream.getVideoTracks(),
  ]);

  if (streams.composedStream) {
    mediaRecorder = new MediaRecorder(fullOverlayStream, {
      mimeType: "video/webm; codecs=vp9",
    });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    const video = renderVideo("composed-video", streams.composedStream, false);
    video.volume = 0;

    if (DOMElements.screen) {
      DOMElements.screen.volume = 0;
      DOMElements.screen.style.display = "none";
    }
    if (DOMElements.camera) {
      DOMElements.camera.volume = 0;
      DOMElements.camera.style.display = "none";
    }
  }
};

// Function to render video element
const renderVideo = (id, stream, hide = true) => {
  const video = document.createElement("video");
  video.id = id;
  video.width = 640;
  video.height = 480;
  video.autoplay = true;
  video.setAttribute("playsinline", true);
  video.srcObject = new MediaStream(stream.getTracks());
  if (hide) {
    video.style.display = "none";
  }
  streamRecordContainer.appendChild(video);
  return video;
};

// Event listener for when a user connects
socket.on("user-connected", async (userId, users) => {
  // Checking if the user is an admin
  const isAdmin = users.find((user) => user.userId === userId).isAdmin;

  // If user is an admin, initialize video streaming and recording
  if (isAdmin) {
    const stream = await getStream();
    currentStream = stream;

    if (videoContainerEl) {
      videoContainerEl.remove();
    }

    actionButtonsEl.style.display = "block";

    streams.cameraSteam = stream;
    if (streams.cameraSteam) {
      DOMElements.camera = renderVideo("camera-stream", streams.cameraSteam);
    }
    stopScreenEl.disabled = true;

    setTimeout(async () => {
      await composeStreams();
    }, 1000);
    setTimeout(async () => {
      startRecording();
    }, 1000);
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
    adminStateEl.style.display = "block";
  }
});

// Getting the room ID from the URL
const roomId = window.location.pathname.replace("/", "");

// Event listener for when the peer connection is established
peer.on("open", (id) => {
  const userId = id;
  // Sending a join-room event to the server
  socket.emit("join-room", roomId, userId);
});

// Event listener for incoming calls
peer.on("call", (call) => {
  // Answering the call and displaying the remote video stream
  call.answer();
  videoContainerEl.setAttribute("data-remote", "true");
  const video = remoteVideoEl;
  video.style.display = "block";
  if (localVideoEl) {
    localVideoEl.remove();
  }
  if (streamRecordContainer) {
    streamRecordContainer.remove();
  }
  if (actionButtonsEl) {
    actionButtonsEl.remove();
  }

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

  streams.screenStream = stream;
  if (streams.screenStream) {
    DOMElements.screen = renderVideo("screen-stream", streams.screenStream);
  }
  shareScreenEl.disabled = true;
  stopScreenEl.disabled = false;
  setTimeout(async () => {
    await composeStreams();
  }, 1000);
});

// Event listener for stopping screen sharing
stopScreenEl.addEventListener("click", async () => {
  const video = document.getElementById("remote-video");
  shareScreenEl.disabled = false;
  stopScreenEl.disabled = true;

  if (video) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
  }

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

  streams.cameraSteam = stream;

  if (streams.screenStream) {
    streams.screenStream.getTracks().forEach((track) => track.stop());
    DOMElements.screen.remove();
    streams.screenStream = null;
    if (document.getElementById("screen-stream")) {
      document.getElementById("screen-stream").remove();
    }
  }
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
const startRecording = () => {
  // Start recording
  mediaRecorder.start();
  // Event listener for when recording stops

  if (mediaRecorder.state === "recording") {
    recordingState.style.display = "inline-block";
    startRecordingEl.disabled = true;
    stopRecordingEl.disabled = false;
  }
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    await uploadVideo(blob);
    recordedChunks.length = 0;
  };
};
startRecordingEl.addEventListener("click", () => {
  uploadStatus.innerHTML = "";
  stopRecordingEl.disabled = true;
  setTimeout(async () => {
    await composeStreams();
  }, 1000);
  setTimeout(async () => {
    startRecording();
  }, 1000);
});

stopRecordingEl.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (mediaRecorder.state !== "recording") {
    recordingState.style.display = "none";
    startRecordingEl.disabled = false;
    stopRecordingEl.disabled = true;
  }
});

// Function to upload recorded video
const uploadVideo = async (blob) => {
  uploadStatus.innerText = "uploading...";
  try {
    const formData = new FormData();
    formData.append("video", blob, `${roomId}.webm`);

    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (data.success) {
      uploadStatus.innerHTML = `Uploaded successfully <a href='${data.downloadUrl}'>Download</a>`;
    } else {
      uploadStatus.innerText = "Something went wrong while uploading recording";
    }
  } catch (error) {
    uploadStatus.innerText = "Something went wrong while uploading recording";
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

window.addEventListener("beforeunload", (event) => {
  event.preventDefault();
  event.returnValue = "Are you sure you want to leave?";
});
