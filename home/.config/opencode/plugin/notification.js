
export const NotificationPlugin = async ({ $, client }) => {

  // Check if a session is a main (non-subagent) session
  const isMainSession = async (sessionID) => {
    try {
      const result = await client.session.get({ path: { id: sessionID } });
      const session = result.data ?? result;
      return !session.parentID;
    } catch {
      // If we can't fetch the session, assume it's main to avoid missing notifications
      return true;
    }
  };

  return {
    event: async ({ event }) => {
      // Only notify for main session events, not background subagents
      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID;
        if (await isMainSession(sessionID)) {
          await $`osascript -e 'display notification "Ready for response" with title "OpenCode"'`;
        }
      }

      // Permission prompt created
      if (event.type === "permission.asked") {
        await $`osascript -e 'display notification "Needs permission" with title "OpenCode"'`;
      }
    },
  };
};
