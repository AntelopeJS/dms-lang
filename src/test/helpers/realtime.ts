import {
  type RealtimeMessage,
  SubscribeMessage,
} from "@antelopejs/interface-dms/realtime";

const HEARING_TIMEOUT_MS = 5000;

/** The messages published on a topic since a test started listening. */
export interface Listener {
  /** The first message heard, or already heard, that `matches`; rejects when none arrives in time. */
  hear(
    matches: (message: RealtimeMessage) => boolean,
  ): Promise<RealtimeMessage>;
  stop(): void;
}

/** Listens to a topic the way another module does: by its name, through the realtime interface. */
export function listenTo(topic: string): Listener {
  const heard: RealtimeMessage[] = [];
  const waiting: (() => void)[] = [];
  const stop = SubscribeMessage(topic, (message) => {
    heard.push(message);
    for (const wake of waiting.splice(0)) wake();
  });
  return {
    stop,
    async hear(matches) {
      const deadline = Date.now() + HEARING_TIMEOUT_MS;
      for (;;) {
        const found = heard.find(matches);
        if (found) return found;
        const remaining = deadline - Date.now();
        if (remaining <= 0)
          throw new Error(
            `nothing matching was heard on ${topic}: ${JSON.stringify(heard)}`,
          );
        await new Promise<void>((resolve) => {
          waiting.push(resolve);
          setTimeout(resolve, remaining);
        });
      }
    },
  };
}
