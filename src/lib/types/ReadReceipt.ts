/**
 * Represents a notification indicating that a specific user has read a specific message.
 * This is typically emitted by a client and broadcast by the server to update message statuses.
 */
export type ReadReceipt = {
  /**
   * The unique identifier of the message that has been read.
   * Corresponds to the `id` property of a `Message` object.
   */
  messageId: string;
  /**
   * The username of the user who has read the message.
   */
  reader: string;
};
