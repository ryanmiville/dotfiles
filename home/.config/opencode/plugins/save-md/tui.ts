import { Plugin } from "@opencode/plugin/tui";

import { saveLatestAssistantMarkdown } from "./save.js";

export default Plugin.define({
  id: "save-md.cli",
  setup(context) {
    return context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "save-md.save",
              title: "Save latest response as Markdown",
              description: "Usage: /save-md name",
              palette: true,
              slash: { name: "save-md", arguments: true },
              enabled: () => context.ui.router.current().type === "session",
              suggested: true,
              run: async (input = "") => {
                const route = context.ui.router.current();
                if (route.type !== "session") return;

                await context.client.session.wait({ sessionID: route.sessionID });
                await Promise.all([
                  context.data.session.sync(route.sessionID),
                  context.data.session.message.sync(route.sessionID),
                ]);

                const session = context.data.session.get(route.sessionID);
                const result = await saveLatestAssistantMarkdown({
                  messages: context.data.session.message.list(route.sessionID),
                  name: input,
                  directory:
                    session?.location.directory ??
                    context.location?.directory ??
                    context.data.location.default().directory,
                });

                if (result.status === "no-assistant") {
                  context.ui.toast.show({
                    message: "No assistant response to save",
                    variant: "warning",
                  });
                  return;
                }
                if (result.status === "missing-name") {
                  context.ui.toast.show({ message: "Usage: /save-md name", variant: "warning" });
                  return;
                }
                if (result.status === "no-text") {
                  context.ui.toast.show({
                    message: "The latest assistant response has no Markdown text",
                    variant: "warning",
                  });
                  return;
                }
                if (result.status === "exists") {
                  context.ui.toast.show({
                    message: `File already exists: ${result.path}`,
                    variant: "error",
                  });
                  return;
                }

                context.ui.toast.show({
                  message: `Saved Markdown to ${result.path}`,
                  variant: "info",
                });
              },
            },
          ],
        }));
        return null;
      },
    });
  },
});
