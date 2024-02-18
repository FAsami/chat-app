# WebRTC Video Conferencing Application

This is a web-based video conferencing application that allows users to participate in video calls, share screens, record video, and exchange text messages in real-time. The application is built using WebRTC technology for peer-to-peer communication and Socket.IO for real-time messaging.

## Features

- **Real-Time Video Streaming**: Users can join video calls and stream their video to other participants in real-time.
- **Screen Sharing**: Users can share their screens with other participants during video calls.
- **Video Recording**: Users have the option to record their video during calls, and recorded videos can be uploaded to the server.
- **Text Messaging**: Users can exchange text messages in the chat window during video calls.

## Technologies Used

- **WebRTC**: WebRTC (Web Real-Time Communication) is a technology that enables real-time communication between web browsers.
- **Socket.IO**: Socket.IO is a JavaScript library for real-time web applications. It enables real-time, bidirectional communication between web clients and servers.
- **Express.js**: Express.js is a web application framework for Node.js. It is used for building the backend server and handling HTTP requests.
- **PeerJS**: PeerJS is a JavaScript library that simplifies WebRTC peer-to-peer data, video, and audio calls.

## Setup Instructions

1. Clone the repository to your local machine.
2. Install dependencies by running `yarn install`.
3. Start the server using `yarn start`.
4. Access the application in your web browser by navigating to `http://localhost:<PORT>`, where `<PORT>` is the port number specified in the server configuration.
5. Replace ice-servers with your own turn and stun servers you can create from here `https://dashboard.metered.ca/signup?tool=turnserver` or google or any other provider

## Usage

1. Navigate to the application URL in your web browser.
2. Enter a room ID to join or create a new room.
3. Grant necessary permissions for accessing your camera and microphone.
4. Once inside the room, you can start a video call, share your screen, record video, and exchange text messages with other participants.
