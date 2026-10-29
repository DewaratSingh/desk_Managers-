# DeskManager Desktop App Installer

This folder packages the lightweight **DeskManager** standalone desktop application into a standard Windows installer (`.exe`) using **Inno Setup**.

---

## 📁 Folder Structure

```
deskmanager_installer/
├── file/
│   ├── deskmanager.ico              # Application & setup icon
│   └── desktop/
│       └── DeskManagerFinder.exe    # Compiled standalone desktop executable
├── output/
│   └── DeskManager_Setup.exe        # Generated Windows installer (.exe)
├── installer.iss                    # Inno Setup script configuration
├── build_installer.bat              # One-click Windows build script
└── README.md                        # This documentation
```

---

## 🚀 How to Build the Installer

### Option 1: One-Click Batch Script (Recommended)
Double-click `build_installer.bat` or run:
```cmd
build_installer.bat
```

### Option 2: Inno Setup GUI Compiler
1. Open Inno Setup Compiler.
2. Open `installer.iss`.
3. Click **Build > Compile** (or press `Ctrl + F9`).

### Option 3: Command Line
```cmd
iscc installer.iss
```

The compiled installer will be saved to:
```
deskmanager_installer\output\DeskManager_Setup.exe
```

---

## 🛠️ Installer Features
- **Clean Installation:** Installs `DeskManagerFinder.exe` into `{autopf}\DeskManager` (`C:\Program Files\DeskManager`).
- **Shortcuts:** Automatically creates Start Menu and optional Desktop shortcuts with the custom icon.
- **Launch on Finish:** Offers a checkbox to launch DeskManager immediately after setup completes.
- **Uninstaller Support:** Full Windows Add/Remove Programs integration with clean uninstallation.
- **Lightweight (~12 MB):** Standalone desktop application without any bundled database or background services.
