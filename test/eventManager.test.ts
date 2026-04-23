import assert = require("node:assert/strict");
import Module = require("node:module");
import test = require("node:test");

type WarningChoice = "Sanitize Clipboard" | "Allow Copy" | "Ignore for this file" | undefined;

type Harness = {
  eventManager: {
    suppressNextClipboardEvent: () => void;
    registerEventManager: (context: { subscriptions: Array<{ dispose: () => void }> }) => void;
  };
  warningCalls: string[];
  setClipboardText: (text: string) => void;
  setWarningChoice: (choice: WarningChoice) => void;
  setActiveFile: (path?: string) => void;
  tick: () => Promise<void>;
  cleanup: () => void;
};

function createHarness(): Harness {
  const warningCalls: string[] = [];
  let clipboardText = "";
  let warningChoice: WarningChoice;

  const vscodeStub = {
    env: {
      clipboard: {
        readText: async () => clipboardText,
        writeText: async (text: string) => {
          clipboardText = text;
        },
      },
    },
    window: {
      activeTextEditor: undefined as { document: { fileName: string } } | undefined,
      showWarningMessage: async (message: string) => {
        warningCalls.push(message);
        return warningChoice;
      },
      showInformationMessage: async (_message: string) => undefined,
    },
  };

  const moduleWithInternals = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleWithInternals._load;

  const intervalCallbacks: Array<() => void | Promise<void>> = [];
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;

  const globalWithTimers = global as typeof global & {
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
  };

  globalWithTimers.setInterval = ((callback: () => void | Promise<void>) => {
    intervalCallbacks.push(callback);
    return intervalCallbacks.length as unknown as NodeJS.Timeout;
  }) as typeof setInterval;
  globalWithTimers.clearInterval = ((_id: NodeJS.Timeout) => {}) as typeof clearInterval;

  moduleWithInternals._load = (request: string, parent: unknown, isMain: boolean) => {
    if (request === "vscode") {
      return vscodeStub;
    }
    return originalLoad(request, parent, isMain);
  };

   const modulePath = require.resolve("../src/eventManager");
  delete require.cache[modulePath];
   const eventManager = require("../src/eventManager") as Harness["eventManager"];
  moduleWithInternals._load = originalLoad;

  const context = { subscriptions: [] as Array<{ dispose: () => void }> };
  eventManager.registerEventManager(context);

  return {
    eventManager,
    warningCalls,
    setClipboardText: (text: string) => {
      clipboardText = text;
    },
    setWarningChoice: (choice: WarningChoice) => {
      warningChoice = choice;
    },
    setActiveFile: (path?: string) => {
      vscodeStub.window.activeTextEditor = path ? { document: { fileName: path } } : undefined;
    },
    tick: async () => {
      assert.equal(intervalCallbacks.length, 1);
      await intervalCallbacks[0]();
    },
    cleanup: () => {
      for (const disposable of context.subscriptions) {
        disposable.dispose();
      }
      delete require.cache[modulePath];
      globalWithTimers.setInterval = originalSetInterval;
      globalWithTimers.clearInterval = originalClearInterval;
      moduleWithInternals._load = originalLoad;
    },
  };
}

test("suppressNextClipboardEvent suppresses one tick", async () => {
  const harness = createHarness();
  try {
    harness.eventManager.suppressNextClipboardEvent();
    harness.setClipboardText("sk-12345678901234567890");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 0);

    harness.setClipboardText("sk-ABCDEFGHIJKLMNOPQRSTUV");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("suppressNextClipboardEvent can be called multiple times", async () => {
  const harness = createHarness();
  try {
    harness.eventManager.suppressNextClipboardEvent();
    harness.eventManager.suppressNextClipboardEvent();

    harness.setClipboardText("sk-12345678901234567890");
    await harness.tick();
    harness.setClipboardText("sk-ABCDEFGHIJKLMNOPQRSTUV");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 0);

    harness.setClipboardText("sk-QRSTUVWXYZABCDEFGHIJKL");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("suppress counter decrements on polling tick", async () => {
  const harness = createHarness();
  try {
    harness.eventManager.suppressNextClipboardEvent();

    harness.setClipboardText("sk-12345678901234567890");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 0);

    harness.setClipboardText("AKIAABCDEFGHIJKLMNOP");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("ignoredFiles prevents re-warning for same file", async () => {
  const harness = createHarness();
  try {
    harness.setActiveFile("/workspace/src/file.ts");
    harness.setWarningChoice("Ignore for this file");
    harness.setClipboardText("sk-12345678901234567890");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);

    harness.setWarningChoice("Allow Copy");
    harness.setClipboardText("AKIAABCDEFGHIJKLMNOP");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("unchanged clipboard does not trigger warning repeatedly", async () => {
  const harness = createHarness();
  try {
    harness.setWarningChoice("Allow Copy");
    harness.setClipboardText("sk-12345678901234567890");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);

    await harness.tick();
    assert.equal(harness.warningCalls.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("empty clipboard does not trigger warning", async () => {
  const harness = createHarness();
  try {
    harness.setClipboardText("");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 0);
  } finally {
    harness.cleanup();
  }
});

test("LOW risk result does not trigger warning", async () => {
  const harness = createHarness();
  try {
    harness.setClipboardText("dev@example.com");
    await harness.tick();
    assert.equal(harness.warningCalls.length, 0);
  } finally {
    harness.cleanup();
  }
});
