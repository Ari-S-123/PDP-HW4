import { Message } from "../types/Message";
import { ReadReceiptDisplay } from "./ReadReceiptDisplay"; // Import the new component

/**
 * Props for the MessageBubble component.
 */
type MessageBubbleProps = {
  /** The message object to display. */
  message: Message;
  /** Flag indicating if the message was sent by the current user. */
  isOwnMessage: boolean;
  /** Function to format the message timestamp. */
  formatTime: (date: Date) => string;
};

/**
 * Renders a single message bubble in the chat.
 * Handles styling for own messages, system messages, and displays sender, time, content, and read receipts.
 */
export const MessageBubble = ({ message, isOwnMessage, formatTime }: MessageBubbleProps) => {
  const bubbleClass = `message-bubble ${isOwnMessage ? "own-message" : ""} ${
    message.sender === "System" ? "system-message" : ""
  }`;

  return (
    <div
      key={message.id} // Unique key for React rendering
      className={bubbleClass}
      data-message-id={message.id} // Store message ID for IntersectionObserver
    >
      {/* Message Header (Sender & Time) */}
      <div className="message-header">
        <span className="message-sender">{message.sender}</span>
        <span className="message-time">{formatTime(message.timestamp)}</span>
      </div>
      {/* Message Content */}
      <div className="message-content">{message.text}</div>
      {/* Render Read Receipts using the new component */}
      <ReadReceiptDisplay message={message} />
    </div>
  );
};
