/**
 * Represents a single chat message within the application.
 * Includes message content, sender information, timestamp, and read status.
 */
export type Message = {
  /**
   * A unique identifier for the message, typically a UUID.
   * Used for tracking and updating message status (e.g., read receipts).
   */
  id: string;
  /**
   * The textual content of the message.
   */
  text: string;
  /**
   * The username of the user who sent the message.
   * Can also be "System" for automated messages (e.g., join/leave notifications).
   */
  sender: string;
  /**
   * The date and time when the message was sent.
   * Represented as a JavaScript Date object.
   */
  timestamp: Date;
  /**
   * An array of usernames indicating who has read this message.
   * This array is updated as users view the message.
   */
  readBy: string[];
};
