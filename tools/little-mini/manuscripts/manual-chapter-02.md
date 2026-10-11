# The Little Mini Resurrection Manual

*A Practical Guide to Giving an Old Mac a Second Life*

## Chapter 2 — Assessing and Preparing an Older Mac

### 2.1 Before You Throw That Old Mac Away

An aging Mac may no longer be suitable for everyday computing, but it can still be useful for a dedicated task.

Our 2012 Mac mini had spent years in a box on a garage shelf, occasionally facing the threat of a trip to the dump.

Rather than purchasing another computer, we decided to see whether the Mini could serve as a dedicated motorcycle video-download station.

The goal was not to make it perform like a modern Mac. It only needed to run reliably, connect to the camera, store recordings, and communicate with other devices.

### 2.2 Identify Your Mac

Before beginning, determine the exact model and year.

If the Mac starts normally:

1. Open the Apple menu.
2. Select **About This Mac**.
3. Record the model, processor, memory, and macOS version.
4. Check available storage using **About This Mac → Storage** or Disk Utility.

If the Mac does not start, look for its serial number or model identifier on the enclosure.

You can use Apple's support resources to identify the computer.

**Reference:** [Identify your Mac mini model](https://support.apple.com/en-us/102852)

Our project uses a **Mac mini (Late 2012)**.

### 2.3 Check the Hardware

Before installing an operating system, inspect the computer and its accessories.

| Component | What to check |
|---|---|
| Power | Computer powers on consistently |
| Display | HDMI or appropriate video adapter works |
| Keyboard | Recognized during startup, not just after login |
| Mouse | Can navigate setup screens |
| Internal drive | Detected by Disk Utility |
| USB ports | Can read the installation drive |
| Ethernet | Port and cable are functional |
| Wi-Fi | Can detect wireless networks |
| Cooling | Fan operates and vents are unobstructed |

A working wired keyboard and mouse are particularly useful when troubleshooting older Macs.

**Lesson from our project:** The original wireless keyboard would not select the USB installer during startup. A new keyboard worked for that step, allowing Catalina to be installed, although it later became intermittently unresponsive during ordinary use.

The fact that a keyboard works after macOS starts does not guarantee that it will work reliably in the startup environment.

### 2.4 Choose a Compatible macOS Version

The Late 2012 Mac mini officially supports macOS Catalina 10.15 as its newest major macOS release.

Catalina was selected because it is compatible with the computer and supports the basic networking, file-sharing, and software capabilities required for this project.

However, Catalina is an older, unsupported operating system. It no longer receives routine Apple security updates.

For that reason, this project treats the Mini as a dedicated appliance rather than a general-purpose personal computer.

Recommended precautions:

- Avoid routine browsing, email, and sensitive personal accounts.
- Keep unnecessary sharing and remote-access services disabled.
- Use a dedicated local account with a strong password.
- Avoid exposing the Mini directly to the public internet.
- Install only software needed for its assigned tasks.
- Keep backups of recordings and configuration files that matter.

**Important:** A different Mac model may require a different operating system. Check compatibility before creating installation media.

#### Security First: Give the Mini Its Own Identity

Do not use your everyday Mac login or Apple Account as the operating account for the garage Mini.

Create two separate local accounts:

**Maintenance Administrator**

A dedicated administrator account used only for installation, system configuration, and maintenance. It should have a unique, strong password and should not be connected to your personal iCloud account.

**Mini Operator — Standard User**

A standard macOS account used for routine video downloads and operation.

This account should have access only to the folders and applications required for the project.

It should not have access to personal documents, email, photographs, or other Macs' files.

A standard account is not a complete security sandbox, so appropriate file permissions and network restrictions remain important.

### 2.5 Prepare the Installation Equipment

For a clean Catalina installation, gather:

- A compatible Mac.
- A USB flash drive with sufficient capacity for the installer (16 GB or larger is a practical choice).
- Access to another functioning Mac for preparing the installer, if necessary.
- A keyboard and mouse that work during startup.
- A connected display.
- A reliable power connection.
- A backup of any existing files you wish to preserve.

**Warning:** Creating a bootable installer erases the USB drive. A clean macOS installation may also erase the Mac's internal drive.

Do not proceed until you have confirmed that important data has been backed up.

### 2.6 Plan the Network Connections

This project requires two separate network paths.

**Wi-Fi:** The Mac mini connects to the Vantrue F1's own broadcast Wi-Fi network.

**Ethernet:** The Mac mini connects to the home network through a Wi-Fi extender equipped with an Ethernet port.

The F1 does not join the home Wi-Fi network. The Mini serves as the computer that can communicate with both networks.

Before beginning, confirm that your home network equipment supports the intended Ethernet connection and that the Mini can physically reach the camera's Wi-Fi signal.

### 2.7 Plan Storage for Video Files

Video recordings can consume substantial disk space.

Before deciding how to store them, consider:

1. How many recordings you want to retain.
2. How frequently recordings will be downloaded.
3. Whether files will be copied to another Mac or external drive.
4. How older recordings will eventually be archived or deleted.

For our initial testing, recordings were stored in a folder named **Bike Videos**.

A more comprehensive storage and retention strategy remains part of the ongoing project.

### 2.8 Initial Readiness Checklist

Before moving to installation, confirm:

- [ ] Mac model and compatibility identified.
- [ ] Computer powers on and displays video.
- [ ] Keyboard and mouse work at startup.
- [ ] Internal storage is detected.
- [ ] Important existing data is backed up.
- [ ] Catalina installer media is available or can be created.
- [ ] Camera Wi-Fi can reach the Mini's intended location.
- [ ] Home network connection is available.
- [ ] Enough storage is available for initial video testing.
- [ ] A dedicated-account security plan is in place.

Once these items are addressed, proceed to **Chapter 3 — Creating a Bootable macOS Installer**.

---