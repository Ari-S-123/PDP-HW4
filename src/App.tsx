import { useState, FormEvent, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";
import { Message } from "./lib/types/Message";
import { UsernameForm } from "./lib/components/UsernameForm";
import { ChatHeader } from "./lib/components/ChatHeader";
import { OnlineUsers } from "./lib/components/OnlineUsers";
import { MessageList } from "./lib/components/MessageList";
import { MessageInput } from "./lib/components/MessageInput";

/**
 * The main application component for the chat client.
 * Handles user authentication, message display, sending messages,
 * displaying online users, managing socket connections, and read receipts.
 */
const App = () => {
  /** State for storing the list of messages displayed in the chat. */
  const [messages, setMessages] = useState<Message[]>([]);
  /** State for the current value of the message input field. */
  const [input, setInput] = useState("");
  /** State for the current user's username. */
  const [username, setUsername] = useState("");
  /** State flag indicating if the user has successfully entered a username and joined the chat. */
  const [hasUsername, setHasUsername] = useState(false);
  /** State for storing the list of currently online users. */
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  /** State for storing any connection error message from Socket.IO. Null if connected. */
  const [connectionError, setConnectionError] = useState<string | null>(null);
  /** Ref to the Socket.IO client instance. */
  const socketRef = useRef<Socket | null>(null);
  /** Ref to an empty div at the end of the messages list, used for auto-scrolling. */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Ref to the container div holding the message bubbles. Used for IntersectionObserver. */
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  /** State flag indicating if the user is currently in the process of changing their username. */
  const [changingUsername, setChangingUsername] = useState(false);
  /** State to temporarily store the old username when initiating a username change. */
  const [oldUsername, setOldUsername] = useState("");

  // Refs to hold the latest state values for use in effect callbacks without adding to dependency array
  const usernameRef = useRef(username);
  const hasUsernameRef = useRef(hasUsername);

  // Keep refs updated with the latest state
  useEffect(() => {
    usernameRef.current = username;
    hasUsernameRef.current = hasUsername;
  }, [username, hasUsername]);

  /**
   * Effect hook to establish and manage the Socket.IO connection.
   * Sets up listeners for incoming messages, user list updates, and connection events.
   * Cleans up the connection on component unmount.
   */
  useEffect(() => {
    // Connect to the Socket.IO server
    // Ensure only one connection is made
    if (!socketRef.current) {
      console.log("Establishing socket connection...");
      socketRef.current = io("http://localhost:3000");

      /** Handler for incoming 'chat message' events. */
      const handleChatMessage = (msg: Message) => {
        setMessages((prevMessages) => {
          // Prevent duplicates if the same message ID is received again
          const messageExists = prevMessages.some((m) => m.id === msg.id);
          if (messageExists) {
            console.warn(`Duplicate message received, ignoring: ${msg.id}`);
            return prevMessages;
          }
          return [...prevMessages, msg];
        });

        // Automatically send a read receipt if the message is not from the current user and socket exists
        // Use refs here to avoid adding state to dependency array
        if (usernameRef.current && msg.sender !== usernameRef.current && socketRef.current) {
          console.log(`Auto-sending read receipt for message ${msg.id} from ${usernameRef.current}`);
          socketRef.current.emit("read receipt", {
            messageId: msg.id,
            reader: usernameRef.current
          });
        }
      };

      /** Handler for 'message updated' events (typically for read receipts). */
      const handleMessageUpdated = (updatedMsg: Message) => {
        console.log(`Updating message ${updatedMsg.id} based on 'message updated' event.`);
        setMessages((prevMessages) => prevMessages.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg)));
      };

      /** Handler for 'online users' events. */
      const handleOnlineUsers = (users: string[]) => {
        setOnlineUsers(users);
      };

      /** Handler for successful connection events. */
      const handleConnect = () => {
        console.log("Connected to server with socket ID:", socketRef.current?.id);
        setConnectionError(null); // Clear any previous error
        // If user was already "logged in" (e.g., reconnect after brief disconnect), rejoin
        // Use refs here to avoid adding state to dependency array
        if (hasUsernameRef.current && usernameRef.current) {
          console.log(`Re-emitting 'user joined' for ${usernameRef.current} after reconnect.`);
          socketRef.current?.emit("user joined", usernameRef.current);
        }
      };

      /** Handler for connection error events. */
      const handleConnectError = (error: Error) => {
        console.error("Connection error:", error);
        setConnectionError(
          `Failed to connect to the chat server. Please check your connection or try again later. Error: ${error.message}`
        );
        // Optionally attempt to disconnect to prevent repeated errors if in a bad state
        socketRef.current?.disconnect();
        socketRef.current = null; // Allow reconnection attempt on next render cycle if needed
      };

      /** Handler for disconnect events */
      const handleDisconnect = (reason: Socket.DisconnectReason) => {
        console.log("Disconnected from server. Reason:", reason);
        if (reason === "io server disconnect") {
          // Server initiated disconnect, maybe handle differently?
          setConnectionError("Disconnected by the server.");
        } else if (reason === "io client disconnect") {
          // Client initiated disconnect (e.g., logout), usually okay.
        } else {
          // Other reasons (transport error, ping timeout) might warrant an error message
          setConnectionError("Lost connection to the server. Attempting to reconnect...");
          // Socket.IO will attempt to reconnect automatically unless `autoConnect` is false
        }
        // Clear online users on disconnect as the list might be stale upon reconnect
        setOnlineUsers([]);
      };

      // Register event listeners
      socketRef.current.on("chat message", handleChatMessage);
      socketRef.current.on("message updated", handleMessageUpdated);
      socketRef.current.on("online users", handleOnlineUsers);
      socketRef.current.on("connect", handleConnect);
      socketRef.current.on("connect_error", handleConnectError);
      socketRef.current.on("disconnect", handleDisconnect);
    }

    // Cleanup function: remove listeners and disconnect socket
    return () => {
      if (socketRef.current) {
        console.log("Cleaning up socket listeners and disconnecting...");
        socketRef.current.off("chat message");
        socketRef.current.off("message updated");
        socketRef.current.off("online users");
        socketRef.current.off("connect");
        socketRef.current.off("connect_error");
        socketRef.current.off("disconnect");
        // Only disconnect if the component is truly unmounting,
        // not just on username change if we want connection persistence.
        // However, the current logout logic handles explicit disconnect.
        // Let's keep the disconnect here for robustness on unmount.
        socketRef.current.disconnect();
        socketRef.current = null;
        console.log("Socket disconnected and instance nulled on cleanup.");
      }
    };
    // Only run on mount and unmount (empty dependency array)
    // Username changes are handled by other effects.
  }, []);

  /**
   * Effect hook to emit "user joined" or "change username" events when the username state changes
   * after the user has initially joined (hasUsername is true), or when hasUsername becomes true.
   * Dependencies: `username`, `hasUsername`, `changingUsername`, `oldUsername`
   */
  useEffect(() => {
    // Only proceed if we have a valid socket connection, a username, and the user has passed the initial join screen
    if (username && hasUsername && socketRef.current?.connected) {
      const trimmedUsername = username.trim();

      // If currently in the username change flow AND the name is different from the old one
      if (changingUsername && trimmedUsername !== oldUsername) {
        console.log(`Emitting 'change username' from ${oldUsername} to ${trimmedUsername}`);
        // Emit the specific event for username change
        socketRef.current.emit("change username", {
          oldUsername,
          newUsername: trimmedUsername
        });
        // Reset the changing username flag after emitting
        setChangingUsername(false);
        setOldUsername(""); // Clear old username after successful change emission
      } else if (!changingUsername) {
        // If not changing username, emit the standard "user joined" event
        // This handles the initial join after setting the username.
        console.log(`Emitting 'user joined' for ${trimmedUsername}`);
        socketRef.current.emit("user joined", trimmedUsername);
      }
    }
  }, [username, hasUsername, changingUsername, oldUsername]);

  /**
   * Effect hook to handle marking messages as read when the browser tab becomes visible.
   * Adds and removes a visibilitychange event listener.
   * Dependencies: `username`
   */
  useEffect(() => {
    /**
     * Event handler for the 'visibilitychange' event.
     * Sends read receipts for unread messages when the tab becomes visible.
     */
    const handleVisibilityChange = () => {
      // Check if the tab is now visible and the user is logged in and socket is connected
      if (document.visibilityState === "visible" && username && socketRef.current?.connected) {
        console.log("Tab became visible, checking for unread messages.");
        // Access the latest messages state directly inside the handler
        setMessages((currentMessages) => {
          currentMessages.forEach((msg) => {
            // Send read receipt for messages not sent by the current user and not already marked as read by them
            if (msg.sender !== username && !msg.readBy.includes(username)) {
              console.log(`Sending read receipt for message ${msg.id} on visibility change.`);
              socketRef.current?.emit("read receipt", {
                messageId: msg.id,
                reader: username
              });
            }
          });
          return currentMessages; // No state change needed here, just iterating
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Cleanup: remove the event listener
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [username]);

  /**
   * Effect hook to set up an IntersectionObserver for marking messages as read when they scroll into view.
   * Observes message bubbles within the messages container.
   * Dependencies: `messages.length`, `username`, `messages` (array reference itself)
   */
  useEffect(() => {
    // Ensure the container ref is set, user is logged in, socket connected, and there are messages
    if (!messagesContainerRef.current || !username || messages.length === 0 || !socketRef.current?.connected) {
      return;
    }

    // Capture the current ref value for stable use in callbacks and cleanup
    const container = messagesContainerRef.current;

    /**
     * Callback function for the IntersectionObserver.
     * Sends a read receipt when a message bubble enters the viewport.
     * @param {IntersectionObserverEntry[]} entries - Array of observer entries.
     */
    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Use setMessages to ensure we're checking against the *latest* state
      setMessages((currentMessages) => {
        // let stateChanged = false; // Flag to see if we need to return a new array (for optimistic updates)
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetElement = entry.target as HTMLElement;
            const messageId = targetElement.getAttribute("data-message-id");
            if (!messageId) return;

            const message = currentMessages.find((m) => m.id === messageId);

            if (message && message.sender !== username && !message.readBy.includes(username)) {
              console.log(`IntersectionObserver: Marking message ${messageId} as read by ${username}`);
              socketRef.current?.emit("read receipt", {
                messageId,
                reader: username
              });
              // It's better to wait for the 'message updated' event to update state,
              // rather than optimistically updating here, to avoid potential inconsistencies.
            }
          }
        });
        // If doing optimistic updates, return the modified array or original if no changes
        return currentMessages; // For non-optimistic, just return the current state
      });
    };

    // Create the observer instance
    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1, // Trigger when 10% of the element is visible
      root: container // Observe intersections within the messages container
    });

    // Find all message bubble elements with the data attribute and observe them
    const messageElements = container.querySelectorAll(".message-bubble[data-message-id]");
    messageElements.forEach((el) => observer.observe(el));
    console.log(`IntersectionObserver observing ${messageElements.length} messages.`);

    // Cleanup function: unobserve all elements and disconnect the observer
    return () => {
      console.log("IntersectionObserver cleanup: Disconnecting observer.");
      // Use the captured container variable safely
      const currentElements = container?.querySelectorAll(".message-bubble[data-message-id]");
      if (currentElements) {
        currentElements.forEach((el) => observer.unobserve(el));
      }
      observer.disconnect();
    };
    // Re-run observer setup if username changes or messages array/length changes
  }, [messages.length, username, messages]);

  /**
   * Effect hook to automatically scroll to the bottom of the messages container
   * whenever the `messages` array changes.
   * Dependency: `messages`
   */
  useEffect(() => {
    // Use optional chaining in case the ref is not yet attached
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Handles the submission of the message input form.
   * Prevents default form submission, trims the input, and emits a "chat message" event if valid.
   * Clears the input field after sending.
   * @param {FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleMessageSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent page reload
    const trimmedInput = input.trim();
    // Check if input is not empty, user is logged in, and socket is connected
    if (trimmedInput && hasUsername && socketRef.current?.connected) {
      console.log(`Sending message: "${trimmedInput}" from ${username}`);
      // Emit the message content and sender username
      socketRef.current.emit("chat message", {
        text: trimmedInput,
        sender: username
      });
      // Clear the input field
      setInput("");
    } else if (!socketRef.current?.connected) {
      console.warn("Cannot send message: Socket not connected.");
      setConnectionError("Not connected. Cannot send message."); // Provide feedback
    }
  };

  /**
   * Handles the submission of the username form (initial join or update).
   * Prevents default form submission.
   * If joining for the first time, sets `hasUsername` to true (triggering the join effect).
   * If changing username, calls `handleUsernameUpdate`.
   * @param {FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleUsernameSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent page reload
    const trimmedUsername = username.trim();

    // Proceed only if a non-empty username is entered
    if (trimmedUsername) {
      if (!socketRef.current) {
        console.error("Socket not initialized. Attempting to initialize...");
        // Attempt to initialize here, though ideally it should be ready from the initial useEffect
        socketRef.current = io("http://localhost:3000");
        // Add essential listeners again or rely on the main useEffect cleanup/re-run?
        // For simplicity, let's show an error and ask to retry/reload
        setConnectionError("Connection not ready. Please try again or reload.");
        return;
      }

      if (changingUsername) {
        // If we are in the 'change username' flow, call the specific update handler
        console.log(`Username form submitted in 'change' mode for: ${trimmedUsername}`);
        handleUsernameUpdate(trimmedUsername);
      } else {
        // If it's the initial join, set the flag
        console.log(`Username form submitted in 'join' mode for: ${trimmedUsername}`);
        setHasUsername(true);
        // Ensure connection if not already established (e.g., if user was fast)
        if (!socketRef.current.connected) {
          console.log("Connecting socket on initial join submit...");
          socketRef.current.connect();
        }
      }
    } else if (!trimmedUsername) {
      // Handle empty username input if needed (e.g., show validation message)
      console.log("Username cannot be empty.");
    }
  };

  /**
   * Handles the logic for updating the username after the user confirms the change.
   * Called by `handleUsernameSubmit` when `changingUsername` is true.
   * If the name is unchanged, returns to chat view.
   * If the name is changed, updates the `username` state (triggering the change effect).
   * @param {string} newUsername - The new username entered by the user.
   */
  const handleUsernameUpdate = (newUsername: string) => {
    if (newUsername === oldUsername) {
      // If the user entered the same name, no need to emit events
      console.log("Username unchanged, returning to chat view.");
      setChangingUsername(false); // Exit the changing username mode
      setHasUsername(true); // Show the chat interface again
      setOldUsername(""); // Clear old username
    } else if (socketRef.current?.connected) {
      // If the username is different and socket connected, proceed with the update
      console.log(`Attempting to update username state from ${oldUsername} to ${newUsername}`);
      // Update the username state. This will trigger the useEffect hook
      // which handles emitting the "change username" event because changingUsername is true.
      setUsername(newUsername);
      // Set hasUsername back to true to show the chat view after the state update triggers the effect.
      setHasUsername(true);
      // Note: setChangingUsername(false) and setOldUsername("") are handled within the useEffect hook after the event is emitted.
    } else {
      console.warn("Cannot change username: Socket not connected.");
      setConnectionError("Not connected. Cannot change username."); // Provide feedback
      // Optionally revert UI state
      setChangingUsername(false);
      setHasUsername(true); // Go back to chat view with old username
    }
  };

  /**
   * Initiates the username change process.
   * Stores the current username, sets the `changingUsername` flag,
   * hides the chat view, and potentially clears messages (optional).
   */
  const handleChangeUsername = () => {
    if (socketRef.current?.connected) {
      console.log(`Initiating username change for ${username}`);
      // Store the current username to compare against the new one later
      setOldUsername(username);
      // Set the flag to indicate we are in the change flow
      setChangingUsername(true);
      // Hide the main chat interface and show the username input form
      setHasUsername(false);
      // Optionally clear messages, or keep them for context upon return?
      // setMessages([]); // Uncomment to clear messages during name change
    } else {
      console.warn("Cannot initiate username change: Socket not connected.");
      setConnectionError("Not connected. Cannot change username.");
    }
  };

  /**
   * Handles a complete logout.
   * Disconnects the socket, resets all relevant state variables.
   */
  const handleTrueLogout = () => {
    if (socketRef.current) {
      console.log(`Logging out user ${username}`);
      // Disconnect the current socket connection
      socketRef.current.disconnect();
      socketRef.current = null; // Nullify the ref

      // Reset all application state to initial values
      setHasUsername(false);
      setMessages([]);
      setUsername(""); // Clear username field for next login
      setOnlineUsers([]);
      setChangingUsername(false);
      setOldUsername("");
      setConnectionError(null); // Also clear connection errors on logout

      console.log("State reset and socket instance nulled after logout.");
      // The main useEffect will handle creating a new socket instance if the component remains mounted
      // or on next mount.
    }
  };

  /**
   * Formats a Date object into a locale-specific time string (HH:MM AM/PM).
   * @param {Date} date - The Date object to format.
   * @returns {string} The formatted time string.
   */
  const formatTime = (date: Date): string => {
    // Ensure input is a valid Date object before formatting
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      console.warn("Invalid date provided to formatTime:", date);
      return "Invalid Time";
    }
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Conditional Rendering Logic:

  // 1. Render connection error view if connection failed AND user is not logged in/changing name
  if (connectionError && !hasUsername && !changingUsername) {
    return (
      <div className="error-container">
        <h1>Connection Error</h1>
        <p>{connectionError}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
        {/* You could add a button to manually trigger socketRef.current?.connect() */}
      </div>
    );
  }

  // 2. Render username input view if user hasn't joined yet or is changing username
  if (!hasUsername) {
    return (
      <UsernameForm
        username={username}
        setUsername={setUsername}
        onSubmit={handleUsernameSubmit}
        isChanging={changingUsername}
      />
    );
  }

  // 3. Render the main chat view if connected and username is set
  return (
    <div className="chat-container">
      <ChatHeader username={username} onChangeUsername={handleChangeUsername} onLogout={handleTrueLogout} />

      <OnlineUsers users={onlineUsers} />

      {/* Display connection error inline if occurs while logged in */}
      {connectionError && (
        <div
          className="inline-error"
          style={{ padding: "0.5rem 2rem", backgroundColor: "#5e3a3a", color: "white", textAlign: "center" }}
        >
          Warning: {connectionError}
        </div>
      )}

      <MessageList
        messages={messages}
        currentUser={username}
        containerRef={messagesContainerRef}
        endRef={messagesEndRef}
        formatTime={formatTime}
      />

      <MessageInput
        input={input}
        setInput={setInput}
        onSubmit={handleMessageSubmit}
        disabled={!socketRef.current?.connected} // Disable input if not connected
      />
    </div>
  );
};

export default App;
