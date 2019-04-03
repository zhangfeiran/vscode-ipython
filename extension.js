let vscode = require('vscode');

const pythonTerminalName = 'IPython';
let pythonTerminal = null;
let textQueue = [];
let waitsQueue = [];
let currentFilename = null;

function createPythonTerminal() {
    textQueue = [];
    waitsQueue = [];
    pythonTerminal = vscode.window.createTerminal(pythonTerminalName);
    sendQueuedText('ipython', 2000, false);
}

function removePythonTerminal() {
    pythonTerminal = null;
    currentFilename = null;
    textQueue = [];
    waitsQueue = [];
}

function sendQueuedText(text, waitTime = 50, deleteToLineStart = false) {
    if (deleteToLineStart) {
        textQueue.push('%deleteToLineStart');
        waitsQueue.push(10);
    }

    textQueue.push(text);
    waitsQueue.push(10);

    textQueue.push('\n');
    waitsQueue.push(waitTime);
}

function queueLoop() {
    if (textQueue.length > 0 && pythonTerminal !== null && pythonTerminal._queuedRequests.length === 0) {
        const text = textQueue.shift();
        const waitTime = waitsQueue.shift();
        if (text == '%deleteToLineStart') {
            vscode.commands.executeCommand('workbench.action.terminal.deleteToLineStart')
        } else {
            pythonTerminal.sendText(text, false);
        }
        setTimeout(queueLoop, waitTime);
    } else {
        setTimeout(queueLoop, 50);
    }
}

function updateFilename(filename) {
    currentFilename = filename
    sendQueuedText(`import os; os.chdir(os.path.dirname(r'${filename}'))`, 200, true)
}

/* TODO:

auto adjust waiting time
    work with ipython kernels for the extension to work properly like the jupyter notebooks where it could wait for it to initialise properly, queue up commands while waiting for the previous command to complete etc.
support multiple selection
auto insert new line at the bottom

settings:
    ipython path and params
    run -i
    auto expand when multiple lines selected
    move cursor to terminal
    add to menu
*/

function activate(context) {
    vscode.window.onDidCloseTerminal(function (event) {
        if (event._name === pythonTerminalName) {
            removePythonTerminal();
        }
    });

    queueLoop();

    function sendText(advance = false) {
        if (pythonTerminal === null) {
            createPythonTerminal();
        }
        const editor = vscode.window.activeTextEditor;
        const filename = editor.document.fileName;
        if (filename !== currentFilename) {
            updateFilename(filename);
        }

        if (editor.selection.isEmpty) {
            var text = editor.document.lineAt(editor.selection.active.line).text;
        } else {
            var text = editor.document.getText(editor.selection);
        }

        sendQueuedText(text, 10, true);

        pythonTerminal.show(true);

        if (advance) {
            line = editor.selection.active.line
            lineAt = (line == (editor.document.lineCount - 1) ? line : (line + 1))
            let range = editor.document.lineAt(lineAt).range;
            editor.selection = new vscode.Selection(range.start, range.start);
            editor.revealRange(range);
        }
    }

    let sendSelectedToIPython = vscode.commands.registerCommand('ipython.sendSelectedToIPython', function () {
        sendText(false)
    });

    let sendSelectedToIPythonAndAdvance = vscode.commands.registerCommand('ipython.sendSelectedToIPythonAndAdvance', function () {
        sendText(true)
    });



    let sendFileContentsToIPython = vscode.commands.registerCommand('ipython.sendFileContentsToIPython', function () {
        if (pythonTerminal === null) {
            createPythonTerminal();
        }

        const editor = vscode.window.activeTextEditor;
        const filename = editor.document.fileName;
        if (filename !== currentFilename) {
            updateFilename(filename);
        }

        sendQueuedText(`%run ${filename}`, 10, true);
        pythonTerminal.show(true);
    });

    let sendWhosToIPython = vscode.commands.registerCommand('ipython.sendWhosToIPython', function () {
        if (pythonTerminal === null) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        const filename = editor.document.fileName;
        if (filename !== currentFilename) {
            updateFilename(filename);
        }

        sendQueuedText(`%whos`, 10, true);
        pythonTerminal.show(true);
    });

    context.subscriptions.push(sendSelectedToIPython);
    context.subscriptions.push(sendSelectedToIPythonAndAdvance);
    context.subscriptions.push(sendFileContentsToIPython);
    context.subscriptions.push(sendWhosToIPython);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;