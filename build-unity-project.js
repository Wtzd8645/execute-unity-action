import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';

function buildUnityProject() {
  try {
    const projectPath = process.env.project_path;
    console.log(`Unity project path used: ${projectPath}`);

    const unityVer = getUnityVersion(projectPath);
    console.log(`Unity version used: ${unityVer}`);

    const unityInstallDir = getUnityInstallDir(process.env.unity_install_dir);
    const unityExecutable = getUnityExecutable(unityInstallDir, unityVer);
    console.log(`Executable: ${unityExecutable}`);

    const logPath = join(process.env.log_dir, `${process.env.log_name}_${process.env.build_version}.log`);
    const args = getBuildArguments(projectPath, logPath);
    console.log("Arguments:", args.join(" "));
    executeUnityBuild(unityExecutable, args, projectPath);

    console.log("Unity Build Log:");
    const log = readFileSync(join(projectPath, logPath), 'utf-8');
    console.log(log);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

function getUnityVersion(unityProjectPath) {
  try {
    const versionFilePath = join(unityProjectPath, 'ProjectSettings', 'ProjectVersion.txt');
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
    return findUnityExecutable(unityDir, 'unity-editor/Unity');
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

function getBuildArguments(projectPath, logPath) {
  const args = [
    '-batchmode',
    '-quit',
    `-projectPath ${projectPath}`,
    `-executeMethod ${process.env.build_method}`,
    `-logFile ${logPath}`
  ];

  const customOptions = process.env.custom_options || "";
  const tokens = customOptions ? customOptions.split(" ") : [];;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("-")) {
      const value = tokens[i + 1] && !tokens[i + 1].startsWith("-") ? tokens[++i] : "";
      args.push(value ? `${token} ${value}` : token);
    }
  }
  return args;
}

function executeUnityBuild(executable, args, workingDir) {
  console.log('Start Unity build.');
  executable = `"${executable}"`;
  const result = spawnSync(executable, args, { cwd: workingDir, stdio: 'inherit', shell: true });
  if (result.error) {
    console.error(`Process failed. ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Process exited with code: ${result.status}`);
    process.exit(result.status);
  }
}

buildUnityProject();