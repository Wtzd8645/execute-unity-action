"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
async function main() {
    try {
        const unityInstallDir = getUnityInstallDir(process.env.unity_install_dir);
        const projectPath = process.env.project_path ?? process.cwd();
        const logPath = process.env.log_path ?? 'unity_output.log';
        const customArgs = process.env.custom_args ?? '';
        process.chdir(projectPath);
        console.log(`Unity project path used: ${projectPath}`);
        const unityVer = getUnityVersion(projectPath);
        console.log(`Unity version used: ${unityVer}`);
        const unityExecutable = getUnityExecutable(unityInstallDir, unityVer) ?? '';
        console.log(`Unity executable: ${unityExecutable}`);
        const cliArgs = getCommandLineArguments(projectPath, customArgs);
        console.log(`Command line arguments: ${cliArgs.join(" ")}`);
        const result = await executeUnity(unityExecutable, cliArgs, projectPath, logPath);
        process.exit(result);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        }
        else {
            console.error(`Unknown Error: ${JSON.stringify(error)}`);
        }
        process.exit(1);
    }
}
function getUnityVersion(projectPath) {
    try {
        const versionFilePath = (0, path_1.join)(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
        const versionFileContent = (0, fs_1.readFileSync)(versionFilePath, 'utf-8');
        const versionLine = versionFileContent.split('\n').find(line => line.includes('m_EditorVersion:')) ?? '';
        return versionLine.split(' ')[1].trim();
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to parse project version. Error: ${error.message}`);
        }
        else {
            throw new Error(`Failed to parse project version. Error: ${JSON.stringify(error)}`);
        }
    }
}
function getUnityInstallDir(installDir) {
    if (installDir) {
        return installDir;
    }
    switch ((0, os_1.platform)()) {
        case 'win32':
            return "C:\\Program Files\\";
        case 'darwin':
            return "/Applications/";
        case 'linux':
            return "/opt/";
        default:
            throw new Error('Unsupported platform.');
    }
}
function getUnityExecutable(installDir, version) {
    const unityDir = findUnityDirectory(installDir, version);
    if (!unityDir) {
        console.error("Unable to find the corresponding Unity version installation folder.");
        return undefined;
    }
    const currPlatform = (0, os_1.platform)();
    if (currPlatform === 'win32') {
        return findUnityExecutable(unityDir, 'Unity.exe');
    }
    else if (currPlatform === 'darwin') {
        return findUnityExecutable(unityDir, 'Unity.app/Contents/MacOS/Unity');
    }
    else if (currPlatform === 'linux') {
        return findUnityExecutable(unityDir, 'Unity');
    }
    return undefined;
}
function findUnityDirectory(dir, unityVer) {
    let queue = [dir];
    while (queue.length > 0) {
        const currDir = queue.shift() ?? "";
        let entries;
        try {
            entries = (0, fs_1.readdirSync)(currDir, { withFileTypes: true });
        }
        catch (error) {
            if ((error instanceof Error && 'code' in error) && (error.code === 'EPERM' || error.code === 'EACCES')) {
                continue;
            }
            throw error;
        }
        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            if (!entry.isDirectory()) {
                continue;
            }
            if (entry.name.includes(unityVer)) {
                return (0, path_1.join)(currDir, entry.name);
            }
            queue.push((0, path_1.join)(currDir, entry.name));
        }
    }
    return undefined;
}
function findUnityExecutable(unityDir, executableName) {
    const filePath = (0, path_1.join)(unityDir, executableName);
    if ((0, fs_1.existsSync)(filePath)) {
        return filePath;
    }
    const entries = (0, fs_1.readdirSync)(unityDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const subDir = (0, path_1.join)(unityDir, entry.name);
        const result = findUnityExecutable(subDir, executableName);
        if (result) {
            return result;
        }
    }
    return undefined;
}
function getCommandLineArguments(projectPath, customArgs) {
    const args = [
        "-logFile -",
        `-projectPath ${projectPath}`,
    ];
    const tokens = customArgs ? customArgs.split(" ") : [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.startsWith("-")) {
            const value = tokens[i + 1] && !tokens[i + 1].startsWith("-") ? tokens[++i] : "";
            args.push(value ? `${token} ${value}` : token);
        }
    }
    return args;
}
function executeUnity(executable, args, projectPath, logPath) {
    logPath = (0, path_1.join)(projectPath, logPath);
    console.log(`Creating log file. Path: ${logPath}`);
    const dirPath = (0, path_1.dirname)(logPath);
    if (!(0, fs_1.existsSync)(dirPath)) {
        (0, fs_1.mkdirSync)(dirPath, { recursive: true });
    }
    const logFileStream = (0, fs_1.createWriteStream)(logPath, { flags: 'a' });
    console.log("Executing Unity.");
    return new Promise((resolve, reject) => {
        const process = (0, child_process_1.spawn)(`"${executable}"`, args, { cwd: projectPath, shell: true });
        process.stdout.on('data', (data) => {
            const log = data.toString();
            console.log(log);
            logFileStream.write(log);
        });
        process.stderr.on('data', (data) => {
            const log = data.toString();
            console.error(log);
            logFileStream.write(log);
        });
        process.on('close', (code) => {
            if (code !== 0) {
                console.error(`Process exited with code: ${code}`);
            }
            else {
                console.log('Execute Unity successfully.');
            }
            logFileStream.end();
            resolve(code ?? 1);
        });
        process.on('error', (error) => {
            console.error(`Process failed: ${error.message}`);
            logFileStream.end();
            reject(error);
        });
    });
}
main();
