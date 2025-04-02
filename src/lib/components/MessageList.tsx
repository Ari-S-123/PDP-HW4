import React from "react";
import { Message } from "../types/Message";
import { MessageBubble } from "./MessageBubble"; // Import the MessageBubble component

/**
 * Props for the MessageList component.
 */
type MessageListProps = {
  /** Array of message objects to display. */
  messages: Message[];
  /** The username of the current user (for styling own messages). */
  currentUser: string;
  /** Ref for the message container div (used for IntersectionObserver). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref for the element at the end of the list (used for auto-scrolling). */
  endRef: React.RefObject<HTMLDivElement | null>;
  /** Function to format the timestamp of each message. */
  formatTime: (date: Date) => string;
};

/**
 * Renders the scrollable list of message bubbles.
 * Sorts messages chronologically and passes necessary props to MessageBubble.
 */
export const MessageList = ({ messages, currentUser, containerRef, endRef, formatTime }: MessageListProps) => {
  // Sort messages chronologically before mapping
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="messages-container" ref={containerRef}>
      {sortedMessages.map((message) => (
        <MessageBubble
          key={message.id} // Pass key here for React list rendering
          message={message}
          isOwnMessage={message.sender === currentUser}
          formatTime={formatTime}
        />
      ))}
      {/* Empty div target for scrolling to bottom */}
      <div ref={endRef} />
    </div>
  );
};
