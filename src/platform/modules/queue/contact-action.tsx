import type { ContactSlot } from "@/platform/kernel/types";
import { addToQueueAction } from "./actions";

export const GiveTokenButton: ContactSlot = ({ contact }) => (
  <form action={addToQueueAction}>
    <input type="hidden" name="contactId" value={contact.id} />
    <button className="btn-primary">🎫 Give token</button>
  </form>
);
