let vscode = require('vscode');

const pythonTerminalName = 'IPython';
let pythonTerminal = null;
let textQueue = [];
let waitsQueue = [];
let currentFilename = null;
let commandType = 0; //0: run line; 1: run line and advance; 2: run file; 3: run %whos
let baseWaitTime = 25; //according to the performance of your machine

function createPythonTerminal() {
    textQueue = [];
    waitsQueue = [];
    pythonTerminal = vscode.window.createTerminal(pythonTerminalName, 'D:\\python\\scripts\\ipython.exe');
}

function removePythonTerminal() {
    pythonTerminal = null;
    currentFilename = null;
    textQueue = [];
    waitsQueue = [];
}

function sendQueuedText(text, waitTime, deleteToLineStart = false) {
    if (deleteToLineStart) {
        textQueue.push('%deleteToLineStart');
        waitsQueue.push(baseWaitTime);
    }

    textQueue.push(text);
    waitsQueue.push(waitTime);

    textQueue.push('\n');
    waitsQueue.push(baseWaitTime);
}

function queueLoop() {
    if (textQueue.length > 0 && pythonTerminal !== null && pythonTerminal._queuedRequests.length == 0) {
        const text = textQueue.shift();
        const waitTime = waitsQueue.shift();
        if (text == '%deleteToLineStart') {
            vscode.commands.executeCommand('workbench.action.terminal.scrollToBottom')
            vscode.commands.executeCommand('workbench.action.terminal.deleteToLineStart')
        } else {
            pythonTerminal.sendText(text, false);
        }
        setTimeout(queueLoop, waitTime);
    } else {
        setTimeout(queueLoop, baseWaitTime);
    }
}

function updateFilename(filename, waitTime) {
    currentFilename = filename
    sendQueuedText(`import os; os.chdir(os.path.dirname(r'${filename}'))`, waitTime, false)
}

/* TODO:

auto adjust waiting time
    work with ipython kernels for the extension to work properly like the jupyter notebooks where it could wait for it to initialise properly, queue up commands while waiting for the previous command to complete etc.
    workaround: add to settings?
support multiple selection
auto insert new line at the bottom
auto find ipython path

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

    vscode.window.onDidOpenTerminal(function (event) {
        if (event._name === pythonTerminalName) {
            sendText(baseWaitTime*100, baseWaitTime*10)
        }
    });

    queueLoop();

    function sendCommand() {
        if (pythonTerminal === null) {
            createPythonTerminal();
        } else {
            sendText(baseWaitTime*10, baseWaitTime)
        }
    }

    function moveCursorDown() {
        const editor = vscode.window.activeTextEditor;
        line = editor.selection.active.line + 1
        if (line == editor.document.lineCount) {
            editor.edit(builder => builder.insert(editor.document.lineAt(line - 1).range.end, '\n'))
        }
        editor.selection = new vscode.Selection(line, 0, line, 0);
    }


    function sendText(updateWaitTime, textWaitTime) {
        const editor = vscode.window.activeTextEditor;
        const filename = editor.document.fileName;
        if (filename !== currentFilename) {
            updateFilename(filename, updateWaitTime);
        }

        if (commandType == 2) {
            var text = `%run ${filename}`
        } else if (commandType == 3) {
            var text = '%whos'
        } else if (editor.selection.isEmpty) {
            var text = editor.document.lineAt(editor.selection.active.line).text;
        } else {
            var text = editor.document.getText(editor.selection);
        }

        sendQueuedText(text, textWaitTime, text.startsWith(' ') || text.startsWith('\t'));
        pythonTerminal.show(true);
        if (commandType == 1) {
            moveCursorDown()
        }
    }

    let sendSelectedToIPython = vscode.commands.registerCommand('ipython.sendSelectedToIPython', function () {
        commandType = 0
        sendCommand()
    });


    let sendSelectedToIPythonAndAdvance = vscode.commands.registerCommand('ipython.sendSelectedToIPythonAndAdvance', function () {
        commandType = 1
        sendCommand()
    });


    let sendFileContentsToIPython = vscode.commands.registerCommand('ipython.sendFileContentsToIPython', function () {
        commandType = 2
        sendCommand()
    });


    let sendWhosToIPython = vscode.commands.registerCommand('ipython.sendWhosToIPython', function () {
        commandType = 3
        sendCommand()
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