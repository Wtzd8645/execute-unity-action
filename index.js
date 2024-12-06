import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { platform } from 'os';
import { dirname, join } from 'path';

async function main() {
  try {
    const unityInstallDir = getUnityInstallDir(process.env.unity_install_dir);
    const projectPath = process.env.project_path;
    const logPath = process.env.log_path;
    const buildMethod = process.env.build_method;
    const customOptions = process.env.custom_options || "";

    console.log(`Unity project path used: ${projectPath}`);
    process.chdir(projectPath);

    const unityVer = getUnityVersion(projectPath);
    console.log(`Unity version used: ${unityVer}`);

    const unityExecutable = getUnityExecutable(unityInstallDir, unityVer);
    console.log(`Unity Executable: ${unityExecutable}`);

    const args = getBuildArguments(projectPath, buildMethod, customOptions);
    console.log("Arguments:", args.join(" "));

    const result = await executeUnityBuild(unityExecutable, args, projectPath, logPath);
    process.exit(result);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

function getUnityVersion(projectPath) {
  try {
    const versionFilePath = join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    const versionFileContent = readFileSync(versionFilePath, 'utf-8');
    const versionLine = versionFileContent.split('\n').find(line => line.includes('m_EditorVersion:'));
    return versionLine.split(' ')[1].trim();
  } catch (error) {
    throw new Error(`Failed to parse project version.\n ${error.message}`);
  }
}

function getUnityInstallDir(installDir) {
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

function getUnityExecutable(installDir, version) {
  const unityDir = findUnityDirectory(installDir, version);
  if (!unityDir) {
    console.error("Unable to find the corresponding Unity version installation folder.")
    return null;
  }

  const currPlatform = platform();
  if (currPlatform === 'win32') {
    return findUnityExecutable(unityDir, 'Unity.exe');
  } else if (currPlatform === 'darwin') {
    return findUnityExecutable(unityDir, 'Unity.app/Contents/MacOS/Unity');
  } else if (currPlatform === 'linux') {
    return findUnityExecutable(unityDir, 'Unity');
  }
  return null;
}

function findUnityDirectory(dir, unityVer) {
  let queue = [dir];
  while (queue.length > 0) {
    const currDir = queue.shift();

    let entries;
    try {
      entries = readdirSync(currDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
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
  return null;
}

function findUnityExecutable(unityDir, executableName) {
  const filePath = join(unityDir, executableName);
  if (existsSync(filePath)) {
    return filePath;
  }

  const entries = readdirSync(unityDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const subDir = join(unityDir, entry.name);
    const result = findUnityExecutable(subDir, executableName);
    if (result) {
      return result;
    }
  }
  return null;
}

function getBuildArguments(projectPath, executeMethod, customOptions) {
  const args = [
    "-quit",
    "-batchmode",
    "-logFile -",
    `-projectPath ${projectPath}`,
    `-executeMethod ${executeMethod}`
  ];

  const tokens = customOptions ? customOptions.split(" ") : [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("-")) {
      const value = tokens[i + 1] && !tokens[i + 1].startsWith("-") ? tokens[++i] : "";
      args.push(value ? `${token} ${value}` : token);
    }
  }
  return args;
}

function executeUnityBuild(executable, args, projectPath, logPath) {
  logPath = join(projectPath, logPath);

  console.log(`Creating log file. Path: ${logPath}`);
  const dirPath = dirname(logPath);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  const logFileStream = createWriteStream(logPath, { flags: 'a' });

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
      resolve(code);
    });

    process.on('error', (error) => {
      console.error(`Process failed: ${error.message}`);
      logFileStream.end();
      reject(error);
    });
  });
}

main();