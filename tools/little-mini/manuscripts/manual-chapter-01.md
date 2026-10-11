# The Little Mini Resurrection Manual

*A Practical Guide to Giving an Old Mac a Second Life*

### Chapter 1 — Introduction and Project Overview

### 1.1 The Problem

The Vantrue F1 motorcycle camera records video to a microSD card and provides Wi-Fi connectivity through its companion smartphone app.

The app allows users to view and download recordings without physically removing the memory card.

However, the camera’s limited Wi-Fi range requires the phone to remain relatively close to the motorcycle. Downloading numerous recordings can be time-consuming, particularly when the motorcycle is parked in a hot garage.

On our 2016 Harley-Davidson Ultra Limited, accessing the memory card also requires removing the rider’s backrest and seat to reach the camera’s card compartment.

We wanted a better solution.

### 1.2 The Objective

Build a dedicated garage-based video retrieval station that:

1. Connects wirelessly to the Vantrue F1 camera.
2. Downloads recordings without removing the camera’s microSD card.
3. Stores the recordings on a local computer.
4. Makes recordings accessible from other Apple devices over the home network.
5. Allows remote operation without remaining in the garage.
6. Eventually automates downloads and sends a reminder to turn off the motorcycle.

The first five capabilities have been demonstrated in varying degrees. Full download automation and completion notifications remain planned enhancements.

### 1.3 The Hardware

| Component | Purpose |
|---|---|
| 2012 Mac mini | Dedicated garage computer |
| macOS Catalina | Operating system |
| Vantrue F1 | Motorcycle camera and Wi-Fi source |
| Wi-Fi extender with Ethernet port | Connection to home network |
| Ethernet cable | Connects Mini to extender |
| Garage television via HDMI | Local display |
| Keyboard and mouse | Setup and troubleshooting |
| MacBook Air | File access and administration |
| iPad / iPhone | Remote access and future notifications |

### 1.4 System Architecture

The Mac mini connects to two separate networks.

**Camera network:** The Mini’s built-in Wi-Fi connects to the Vantrue F1’s broadcast Wi-Fi network to access recordings.

**Home network:** The Mini’s Ethernet connection connects through a Wi-Fi extender to the home network, making the Mini accessible from other Apple devices.

The Vantrue F1 can broadcast its own Wi-Fi network, but it cannot join an existing Wi-Fi network. This distinction is central to the project. The camera acts as a wireless access point for the Mac mini; it does not connect to the home network as a client. Otherwise, much of this project would not have been necessary.

The resulting data path is:

**Vantrue F1 broadcast Wi-Fi → Mac mini → Ethernet / Home Network → MacBook Air, iPad, or iPhone**

This arrangement allows the Mac mini to communicate with the camera over the camera’s own Wi-Fi network while remaining accessible to other devices through the home network. It avoids requiring the Vantrue camera to connect directly to the home’s Wi-Fi network—a connection it cannot make.

### 1.5 What Works Today

The following capabilities have been demonstrated:

- macOS Catalina installed and running on the 2012 Mac mini.
- Connection to the Vantrue F1’s broadcast Wi-Fi network.
- Successful download of a camera recording.
- Playback of a downloaded recording in QuickTime.
- SMB file sharing accessible from the MacBook Air.
- Remote access through Jump Desktop.
- A local web interface generating five preview images from a video.
- Selection of a video section for later download.

The web interface is still under development and should not yet be treated as a finished automated video-management system.

### 1.6 Planned Enhancements

Future development includes more comprehensive download automation, duplicate-file handling, progress monitoring, and notifications to Apple devices when a session is complete.

One particularly important notification will remind the operator to turn off the motorcycle after downloading.

We also intend to investigate whether the Mini can send a command over Wi-Fi to pause recording on the F1. That capability has not yet been verified.

### 1.7 A Note for Windows Users

This manual documents the actual Mac-based implementation. It does not contain untested Windows instructions.

If you’re using a Windows computer, you can upload this manual to ChatGPT and ask it to adapt the procedure to your particular machine. Include the computer’s manufacturer, model, approximate age, and Windows version.

**A word of caution:** ChatGPT helped create the system described in this manual. It also helped create several of the problems we encountered along the way.

Proceed accordingly.

---