# build-unity-project-action
Used for building an Unity project using a specific installed version. Supports cross-platform.  

### Requirements
- **Unity Editor**: The specific Unity version required by your project is installed on the runner. The Unity license must be set to at least **Personal** or higher (Note: The **Unity Personal Version** license is not allowed).

### Inputs
- **unity_install_dir (Optional)**:  Root directory where Unity is installed. The action will search within this directory for the Unity version that matches the project’s requirements. Defaults to the OS-specific Unity installation path.
- **project_path (Required)**: Absolute path to the Unity project directory that you want to build.
- **build_method (Required)**: The fully qualified name of the Unity build method to execute.
- **build_version (Optional)**: Version number for the build. This is used to label the generated logs.
- **output_dir (Optional)**: Relative path to the project_path where the build output will be stored. Default is "Build/Releases".
- **log_name (Optional)**: Base name for the build log file. Default is "build_log".
- **custom_options (Optional)**: Additional command line arguments passed to Unity. Each parameter should start with a dash. If an argument requires a value, place the value directly after the argument, separated by a space.

### Usage
```yaml
- name: Build Unity Project
  uses: Wtzd8645/build-unity-project-action@v1
  with:
    project_path: ${{ github.workspace }}
    build_method: MyGame.Editor.BuildScript.PerformBuild
    output_dir: Builds
    log_name: unity_build_log
    custom_options: -test -targetPlatform ${{ env.target_platform }}
```