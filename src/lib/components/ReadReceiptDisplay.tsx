import { Message } from "../types/Message";

/**
 * Props for the ReadReceiptDisplay component.
 */
type ReadReceiptDisplayProps = {
  /** The message object for which to display read receipts. */
  message: Message;
};

/**
 * Renders the read receipt status for a given message.
 * Shows "Not read yet" or "Read by X people" with a tooltip listing readers.
 * Does not render anything for system messages.
 */
export const ReadReceiptDisplay = ({ message }: ReadReceiptDisplayProps) => {
  // Don't show read receipts for system messages
  if (message.sender === "System") return null;

  // Filter out the sender themselves from the readBy list for the display
  const otherReaders = message.readBy.filter((reader) => reader !== message.sender);

  // If no one else has read it yet
  if (otherReaders.length === 0) {
    return <div className="read-receipt">Not read yet</div>;
  }

  // Display count and list readers in a tooltip
  return (
    <div className="read-receipt">
      Read by {otherReaders.length} {otherReaders.length === 1 ? "person" : "people"}
      {/* Tooltip shown on hover */}
      <div className="read-tooltip">
        {otherReaders.map((reader) => (
          <div key={reader} className="reader">
            {reader}
          </div>
        ))}
      </div>
    </div>
  );
};
