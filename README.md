# execute-unity-action
Used for executing an Unity project using a specific installed version. Supports cross-platform.  

### Requirements
- **Unity Editor**: The specific Unity version required by your project is installed on the runner. The Unity license must be set to at least **Personal** or higher (Note: The **Unity Personal Version** license is not allowed).

### Inputs
- **unity_install_dir (Optional)**:  Root directory where Unity is installed. The action will search within this directory for the Unity version that matches the project’s requirements. Defaults to the OS-specific Unity installation path.
- **project_path (Required)**: Absolute path to the Unity project directory that you want to operate on. The path should include 'ProjectSettings' folder. Defaults to ```<github.workspace>```.
- **log_path (Optional)**: The relative path to ```project_path``` for the execution log file. Defaults to ```unity_output.log```.
- **custom_args (Optional)**: Additional command line arguments passed to Unity. Each parameter should start with a dash. If an argument requires a value, place the value directly after the argument, separated by a space.

### Usage
```yaml
- name: Execute Unity
  uses: Wtzd8645/execute-unity-action@v3
  with:
    project_path: ${{ github.workspace }}
    log_path: Builds/output.log
    custom_args: >
      -quit
      -batchmode
      -executeMethod MyGame.Editor.PerformBuild
      -targetPlatform ${{ env.target_platform }}
```