import { spawn } from 'child_process';
import { createWriteStream, Dirent, existsSync, mkdirSync, readdirSync, readFileSync, WriteStream } from 'fs';
import { platform } from 'os';
import { dirname, join } from 'path';

async function main() {
  try {
    const unityInstallDir: string = getUnityInstallDir(process.env.unity_install_dir);
    const projectPath: string = process.env.project_path ?? process.cwd();
    const logPath: string = process.env.log_path ?? 'Build/Releases/build_output.log';
    const buildMethod: string = process.env.build_method ?? '';
    const customOptions = process.env.custom_options ?? '';

    console.log(`Unity project path used: ${projectPath}`);
    process.chdir(projectPath);

    const unityVer: string = getUnityVersion(projectPath);
    console.log(`Unity version used: ${unityVer}`);

    const unityExecutable: string = getUnityExecutable(unityInstallDir, unityVer) ?? '';
    console.log(`Unity Executable: ${unityExecutable}`);

    const args: readonly string[] = getBuildArguments(projectPath, buildMethod, customOptions);
    console.log("Arguments:", args.join(" "));

    const result: number = await executeUnityBuild(unityExecutable, args, projectPath, logPath);
    process.exit(result);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Unknown Error: ${JSON.stringify(error)}`);
    }
    process.exit(1);
  }
}

function getUnityVersion(projectPath: string) {
  try {
    const versionFilePath = join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    const versionFileContent = readFileSync(versionFilePath, 'utf-8');
    const versionLine = versionFileContent.split('\n').find(line => line.includes('m_EditorVersion:')) ?? '';
    return versionLine.split(' ')[1].trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse project version. Error: ${error.message}`);
    } else {
      throw new Error(`Failed to parse project version. Error: ${JSON.stringify(error)}`);
    }
  }
}

function getUnityInstallDir(installDir: string | undefined) {
  if (installDir) {
    return installDir;
  }

  switch (platform()) {
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

function getUnityExecutable(installDir: string, version: string) {
  const unityDir = findUnityDirectory(installDir, version);
  if (!unityDir) {
    console.error("Unable to find the corresponding Unity version installation folder.")
    return undefined;
  }

  const currPlatform = platform();
  if (currPlatform === 'win32') {
    return findUnityExecutable(unityDir, 'Unity.exe');
  } else if (currPlatform === 'darwin') {
    return findUnityExecutable(unityDir, 'Unity.app/Contents/MacOS/Unity');
  } else if (currPlatform === 'linux') {
    return findUnityExecutable(unityDir, 'Unity');
  }
  return undefined;
}

function findUnityDirectory(dir: string, unityVer: string) {
  let queue: string[] = [dir];
  while (queue.length > 0) {
    const currDir: string = queue.shift() ?? "";

    let entries;
    try {
      entries = readdirSync(currDir, { withFileTypes: true });
    } catch (error) {
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
        return join(currDir, entry.name);
      }

      queue.push(join(currDir, entry.name));
    }
  }
  return undefined;
}

function findUnityExecutable(unityDir: string, executableName: string): string | undefined {
  const filePath: string = join(unityDir, executableName);
  if (existsSync(filePath)) {
    return filePath;
  }

  const entries: Dirent[] = readdirSync(unityDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const subDir: string = join(unityDir, entry.name);
    const result: string | undefined = findUnityExecutable(subDir, executableName);
    if (result) {
      return result;
    }
  }
  return undefined;
}

function getBuildArguments(projectPath: string, executeMethod: string, customOptions: string) {
  const args: string[] = [
    "-quit",
    "-batchmode",
    "-logFile -",
    `-projectPath ${projectPath}`,
    `-executeMethod ${executeMethod}`
  ];

  const tokens: string[] = customOptions ? customOptions.split(" ") : [];
  for (let i = 0; i < tokens.length; i++) {
    const token: string = tokens[i];
    if (token.startsWith("-")) {
      const value = tokens[i + 1] && !tokens[i + 1].startsWith("-") ? tokens[++i] : "";
      args.push(value ? `${token} ${value}` : token);
    }
  }
  return args;
}

function executeUnityBuild(executable: string, args: readonly string[] | undefined, projectPath: string, logPath: string): Promise<number> {
  logPath = join(projectPath, logPath);

  console.log(`Creating log file. Path: ${logPath}`);
  const dirPath: string = dirname(logPath);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  const logFileStream: WriteStream = createWriteStream(logPath, { flags: 'a' });

  console.log("Executing Unity build.");
  return new Promise((resolve, reject) => {
    const process = spawn(`"${executable}"`, args, { cwd: projectPath, shell: true });

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
      } else {
        console.log('Unity build completed successfully.');
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