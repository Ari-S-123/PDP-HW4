import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { Message } from "../lib/types/Message";
import { ReadReceipt } from "../lib/types/ReadReceipt";

/**
 * Express application instance.
 */
const app = express();

/**
 * HTTP server instance based on the Express app.
 * Required for Socket.IO integration.
 */
const server = createServer(app);

/**
 * Socket.IO server instance configured with CORS settings.
 * Allows connections from any origin for GET and POST methods.
 */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/**
 * Map to track connected users.
 * Key: Socket ID (string)
 * Value: Username (string)
 */
const users = new Map<string, string>();

/**
 * In-memory store for all chat messages.
 * New users receive a portion of this history upon joining.
 */
const messages: Message[] = [];

/**
 * Retrieves a list of currently online usernames.
 * @returns {string[]} An array of usernames currently connected to the server.
 */
const getOnlineUsers = (): string[] => {
  // Extract values (usernames) from the users Map and convert to an array
  return Array.from(users.values());
};

/**
 * Broadcasts the current list of online users to all connected clients.
 * Emits an "online users" event with the array of usernames.
 */
const broadcastOnlineUsers = () => {
  // Get the latest list of users
  const onlineUserList = getOnlineUsers();
  // Emit the list to all connected sockets
  io.emit("online users", onlineUserList);
};

// Set up event listeners for new socket connections
io.on("connection", (socket) => {
  console.log(`a user connected with socket ID: ${socket.id}`);

  /**
   * Handles the "user joined" event from a client.
   * Associates a username with the socket ID, sends message history,
   * broadcasts join/name change messages, and updates the online user list.
   * @param {string} username - The username provided by the joining client.
   */
  socket.on("user joined", (username: string) => {
    // Check if this socket was previously associated with a different username
    const previousUsername = users.get(socket.id);

    // Handle scenario where the user might be rejoining or changing name via initial join
    if (previousUsername) {
      // Only process and broadcast if the username has actually changed
      if (previousUsername !== username) {
        console.log(`${previousUsername} changed name to ${username} via user joined event`);

        // Create a system message announcing the name change
        const systemMessage: Message = {
          id: uuidv4(),
          text: `${previousUsername} changed their name to ${username}`,
          sender: "System",
          timestamp: new Date(),
          // Mark as read only by the user themselves initially
          readBy: [username]
        };

        // Add message to history and broadcast to all clients
        messages.push(systemMessage);
        io.emit("chat message", systemMessage);
      } else {
        // Username is the same as before, likely a rejoin or refresh
        console.log(`${username} re-joined with the same name. Socket ID: ${socket.id}`);
        // No system message needed, but history and user list update are still required.
      }
    } else {
      // This is a completely new user joining
      console.log(`${username} joined the chat. Socket ID: ${socket.id}`);

      // Create a system message announcing the new user
      const systemMessage: Message = {
        id: uuidv4(),
        text: `${username} joined the chat`,
        sender: "System",
        timestamp: new Date(),
        // Mark as read only by the joining user initially
        readBy: [username]
      };

      // Add message to history and broadcast to all clients
      messages.push(systemMessage);
      io.emit("chat message", systemMessage);
    }

    // Update or set the username associated with this socket ID in the map
    users.set(socket.id, username);
    console.log(`User map updated: ${username} -> ${socket.id}`);

    // Send recent message history to the newly connected/updated client
    const messageHistoryLimit = 50;
    // Sort messages chronologically before sending
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    // Get the latest messages up to the limit
    const recentMessages = sortedMessages.slice(-messageHistoryLimit);

    console.log(`Sending ${recentMessages.length} recent messages to ${username}`);
    recentMessages.forEach((msg) => {
      // Emit each historical message directly to the connecting socket
      socket.emit("chat message", msg);
    });

    // Broadcast the updated list of online users to everyone
    broadcastOnlineUsers();
  });

  /**
   * Handles the "change username" event specifically for explicit name changes.
   * Updates the user map, broadcasts a system message, and updates the online list.
   * @param {{oldUsername: string, newUsername: string}} data - Object containing old and new usernames.
   */
  socket.on("change username", (data: { oldUsername: string; newUsername: string }) => {
    const { oldUsername, newUsername } = data;

    // Basic validation: ensure names are different and the new name is not just whitespace
    if (oldUsername !== newUsername && newUsername.trim() !== "") {
      console.log(`${oldUsername} requested change to ${newUsername}. Socket ID: ${socket.id}`);

      // Create and broadcast a system message about the name change
      const systemMessage: Message = {
        id: uuidv4(),
        text: `${oldUsername} changed their name to ${newUsername}`,
        sender: "System",
        timestamp: new Date(),
        // Mark as read only by the user initiating the change
        readBy: [newUsername]
      };
      messages.push(systemMessage);
      io.emit("chat message", systemMessage);

      // Update the username associated with this socket ID
      users.set(socket.id, newUsername);
      console.log(`User map updated after name change: ${newUsername} -> ${socket.id}`);

      // Broadcast the updated list of online users
      broadcastOnlineUsers();
    } else {
      console.log(
        `Username change request ignored for ${oldUsername} -> ${newUsername} (no change or empty). Socket ID: ${socket.id}`
      );
    }
  });

  /**
   * Handles incoming "chat message" events from clients.
   * Creates a full Message object, stores it, and broadcasts it to all clients.
   * @param {{ text: string; sender: string }} msg - The basic message object sent by the client.
   */
  socket.on("chat message", (msg: { text: string; sender: string }) => {
    // Create the full message object with server-side details (ID, timestamp)
    const fullMessage: Message = {
      id: uuidv4(),
      text: msg.text,
      sender: msg.sender,
      timestamp: new Date(),
      // Mark the message as read by the sender immediately
      readBy: [msg.sender]
    };

    console.log(`Received message from ${msg.sender}: ${msg.text}`);

    // Store the message in the central message history
    messages.push(fullMessage);

    // Broadcast the full message object to all connected clients
    io.emit("chat message", fullMessage);
  });

  /**
   * Handles "read receipt" events from clients.
   * Updates the `readBy` array for the corresponding message and broadcasts the update.
   * @param {ReadReceipt} receipt - The read receipt object containing messageId and reader username.
   */
  socket.on("read receipt", (receipt: ReadReceipt) => {
    const { messageId, reader } = receipt;
    console.log(`Received read receipt for message ${messageId} from ${reader}`);

    // Find the index of the message in the stored messages array
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);

    // Proceed only if the message was found
    if (messageIndex !== -1) {
      const message = messages[messageIndex];

      // Add the reader to the readBy array if they aren't already included
      if (!message.readBy.includes(reader)) {
        message.readBy.push(reader);
        // Update the message in the array (optional for direct mutation, but good practice)
        messages[messageIndex] = message;
        console.log(`Message ${messageId} marked as read by ${reader}. New readBy: ${message.readBy.join(", ")}`);

        // Broadcast the *entire updated message object* to all clients
        // Clients can use the message ID to find and update their local state.
        io.emit("message updated", message);
      } else {
        console.log(`Reader ${reader} already present in readBy for message ${messageId}. Ignoring.`);
      }
    } else {
      console.warn(`Received read receipt for unknown message ID: ${messageId}`);
    }
  });

  /**
   * Handles the "disconnect" event for a socket.
   * Broadcasts a system message indicating the user left, removes the user from the tracked list,
   * and broadcasts the updated online user list.
   */
  socket.on("disconnect", () => {
    // Retrieve the username associated with the disconnecting socket *before* removing it
    const username = users.get(socket.id);

    // Only proceed if the socket was associated with a username
    if (username) {
      console.log(`${username} (Socket ID: ${socket.id}) disconnecting...`);

      // Create a system message announcing the departure
      const systemMessage: Message = {
        id: uuidv4(),
        text: `${username} left the chat`,
        sender: "System",
        timestamp: new Date(),
        readBy: [] // System messages about leaving are not typically "read"
      };

      // Add the leave message to history
      messages.push(systemMessage);
      // Broadcast the leave message to all remaining clients
      io.emit("chat message", systemMessage);

      // Remove the user from the tracking map *after* sending the message
      // This helps prevent race conditions where a quick rejoin might occur.
      const deleted = users.delete(socket.id);
      if (deleted) {
        console.log(`${username} removed from user map.`);
      } else {
        console.warn(
          `Attempted to delete user ${username} (Socket ID: ${socket.id}) but they were not found in the map.`
        );
      }

      // Broadcast the updated list of online users
      broadcastOnlineUsers();
    } else {
      // This branch handles cases where a socket disconnects before sending a username
      // (e.g., immediate disconnect after connection) or if somehow already removed.
      console.log(`User with socket ID ${socket.id} disconnected without a username or was already removed.`);
    }
  });
});

/**
 * Starts the HTTP server and listens for connections on port 3000.
 */
server.listen(3000, () => {
  console.log("Chat server running at http://localhost:3000");
});
