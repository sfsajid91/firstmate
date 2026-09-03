// Verified against Pi 0.81.1 and 0.82.0, which add the ordinary-user spacer and row
// together via InteractiveMode.addMessageToChat. This adapter probes that exact method
// and throws if it is missing; fm-calm.ts catches that and skips only this adapter with a
// diagnostic instead of blocking Calm or Pi. It changes only that presentation and never
// message delivery.
import type { UserMessageComponent as PiUserMessageComponent } from "@earendil-works/pi-coding-agent";
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import { calmPresentationHides } from "./fm-calm-visibility.ts";
import { classifyFirstmateCurrentOperationalText } from "./fm-operational-input.ts";

type UserMessageConstructorArgs = ConstructorParameters<typeof PiUserMessageComponent>;
type UserMessageLike = {
  role: string;
  content: unknown;
};
type AddMessageOptions = {
  populateHistory?: boolean;
};
type InteractiveModePresentation = {
  chatContainer?: {
    children?: unknown[];
    addChild(component: PiUserMessageComponent): void;
  };
  editor?: {
    addToHistory?(text: string): void;
  };
  getMarkdownThemeWithSettings?(): UserMessageConstructorArgs[1];
  getUserMessageText?(message: UserMessageLike): string;
  outputPad?: number;
};
type InteractiveModePrototype = {
  addMessageToChat(
    this: InteractiveModePresentation,
    message: UserMessageLike,
    options?: AddMessageOptions,
  ): unknown;
};
type CalmOperationalUserLayoutPatch = {
  hidesOperationalInput: () => boolean;
  isOperationalInput: (text: string) => boolean;
};

// Keep the introduction-version symbol stable so a compatible upgrade cannot
// double-patch a live process.
const CALM_OPERATIONAL_USER_LAYOUT_PATCH = Symbol.for(
  "firstmate:calm-operational-user-layout:pi-0.81.1",
);
const LEGACY_CALM_OPERATIONAL_PREFIX = "\u2063Supervisor escalate (";

function contentIsTextOnly(content: unknown): boolean {
  if (typeof content === "string") return true;
  if (!Array.isArray(content) || content.length === 0) return false;
  return content.every(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string",
  );
}

export function installCalmOperationalUserLayout(): void {
  const registry = globalThis as typeof globalThis & {
    [key: symbol]: CalmOperationalUserLayoutPatch | undefined;
  };
  const hidesOperationalInput = (): boolean => calmPresentationHides("synthetic-user");
  const isOperationalInput = (text: string): boolean => {
    if (!text.includes("\u2063")) return false;
    return (
      classifyFirstmateCurrentOperationalText(text) !== undefined ||
      text.startsWith(LEGACY_CALM_OPERATIONAL_PREFIX)
    );
  };
  const installed = registry[CALM_OPERATIONAL_USER_LAYOUT_PATCH];
  if (installed) {
    installed.hidesOperationalInput = hidesOperationalInput;
    installed.isOperationalInput = isOperationalInput;
    return;
  }

  const patch: CalmOperationalUserLayoutPatch = {
    hidesOperationalInput,
    isOperationalInput,
  };
  const InteractiveMode = PiCodingAgent.InteractiveMode;
  if (typeof InteractiveMode !== "function") {
    throw new Error("Firstmate Calm requires Pi InteractiveMode");
  }
  const prototype = InteractiveMode.prototype as unknown as InteractiveModePrototype;
  const originalAddMessageToChat = prototype.addMessageToChat;
  if (typeof originalAddMessageToChat !== "function") {
    throw new Error("Firstmate Calm requires Pi InteractiveMode.addMessageToChat");
  }

  const UserMessageComponent = PiCodingAgent.UserMessageComponent;
  if (typeof UserMessageComponent !== "function") {
    throw new Error("Firstmate Calm requires Pi UserMessageComponent");
  }
  class CalmOperationalUserMessageComponent extends UserMessageComponent {
    private readonly hasLeadingSpacer: boolean;

    constructor(
      text: UserMessageConstructorArgs[0],
      markdownTheme: UserMessageConstructorArgs[1],
      outputPad: number,
      hasLeadingSpacer: boolean,
    ) {
      super(text, markdownTheme, outputPad);
      this.hasLeadingSpacer = hasLeadingSpacer;
    }

    override render(width: number): string[] {
      if (patch.hidesOperationalInput()) return [];
      const lines = super.render(width);
      return this.hasLeadingSpacer ? ["", ...lines] : lines;
    }
  }

  prototype.addMessageToChat = function (
    this: InteractiveModePresentation,
    message: UserMessageLike,
    options?: AddMessageOptions,
  ): unknown {
    if (message.role !== "user" || !contentIsTextOnly(message.content)) {
      return originalAddMessageToChat.call(this, message, options);
    }

    const text =
      typeof this.getUserMessageText === "function"
        ? this.getUserMessageText(message)
        : typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .filter(
                  (b) =>
                    b &&
                    typeof b === "object" &&
                    (b as { type?: unknown }).type === "text" &&
                    typeof (b as { text?: unknown }).text === "string",
                )
                .map((b) => (b as { text: string }).text)
                .join("")
            : undefined;
    if (!text || !patch.isOperationalInput(text)) {
      return originalAddMessageToChat.call(this, message, options);
    }

    const markdownTheme =
      typeof this.getMarkdownThemeWithSettings === "function"
        ? this.getMarkdownThemeWithSettings()
        : undefined;
    const outputPad = typeof this.outputPad === "number" ? this.outputPad : 0;
    const hasLeadingSpacer = Boolean(
      this.chatContainer?.children && this.chatContainer.children.length > 0,
    );

    const component = new CalmOperationalUserMessageComponent(
      text,
      markdownTheme,
      outputPad,
      hasLeadingSpacer,
    );
    this.chatContainer?.addChild(component);
    if (options?.populateHistory) this.editor?.addToHistory?.(text);
    return [component];
  };

  registry[CALM_OPERATIONAL_USER_LAYOUT_PATCH] = patch;
}
