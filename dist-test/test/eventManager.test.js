"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
function createHarness() {
    const warningCalls = [];
    let clipboardText = "";
    let warningChoice;
    const vscodeStub = {
        env: {
            clipboard: {
                readText: async () => clipboardText,
                writeText: async (text) => {
                    clipboardText = text;
                },
            },
        },
        window: {
            activeTextEditor: undefined,
            showWarningMessage: async (message) => {
                warningCalls.push(message);
                return warningChoice;
            },
            showInformationMessage: async (_message) => undefined,
        },
        workspace: {
            getConfiguration: (_section) => ({
                get: (_key) => undefined,
            }),
            workspaceFolders: undefined,
            onDidChangeConfiguration: (_handler) => ({ dispose: () => { } }),
        },
    };
    const moduleWithInternals = Module;
    const originalLoad = moduleWithInternals._load;
    const intervalCallbacks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const globalWithTimers = global;
    globalWithTimers.setInterval = ((callback) => {
        intervalCallbacks.push(callback);
        return intervalCallbacks.length;
    });
    globalWithTimers.clearInterval = ((_id) => { });
    moduleWithInternals._load = (request, parent, isMain) => {
        if (request === "vscode") {
            return vscodeStub;
        }
        return originalLoad(request, parent, isMain);
    };
    const modulePath = require.resolve("../src/eventManager");
    delete require.cache[modulePath];
    const eventManager = require("../src/eventManager");
    moduleWithInternals._load = originalLoad;
    const context = { subscriptions: [] };
    eventManager.registerEventManager(context);
    return {
        eventManager,
        warningCalls,
        setClipboardText: (text) => {
            clipboardText = text;
        },
        setWarningChoice: (choice) => {
            warningChoice = choice;
        },
        setActiveFile: (path) => {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
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
    }
    finally {
        harness.cleanup();
    }
});
test("empty clipboard does not trigger warning", async () => {
    const harness = createHarness();
    try {
        harness.setClipboardText("");
        await harness.tick();
        assert.equal(harness.warningCalls.length, 0);
    }
    finally {
        harness.cleanup();
    }
});
test("LOW risk result does not trigger warning", async () => {
    const harness = createHarness();
    try {
        harness.setClipboardText("dev@example.com");
        await harness.tick();
        assert.equal(harness.warningCalls.length, 0);
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=eventManager.test.js.map