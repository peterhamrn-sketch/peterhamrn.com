# The Little Mini Resurrection Manual

*A Practical Guide to Giving an Old Mac a Second Life*

## Chapter 3 — Creating a Bootable macOS Installer

### 3.1 Why We Needed a USB Installer

Our 2012 Mac mini had been sitting unused for years. Rather than trying to restore its old software environment, we decided to start with a clean installation of macOS Catalina.

Catalina is the newest major macOS release officially supported by the Late 2012 Mac mini.

A bootable USB installer allows macOS to be installed without relying on a functioning operating system already present on the computer.

It also provides access to recovery utilities, including Disk Utility.

In our case, creating the installer was only the beginning. Getting the Mini to actually boot from it would become a separate adventure.

### 3.2 What You'll Need

- A working Mac to prepare the installer.
- A USB flash drive with at least 16 GB of storage.
- An internet connection to download Catalina.
- An administrator account on the working Mac.
- A compatible Mac mini or other supported Mac.

**Warning:** Preparing the USB installer will erase its existing contents.

### 3.3 Download macOS Catalina

Apple provides instructions and download links for older versions of macOS.

**Official Apple reference:** [How to download and install macOS](https://support.apple.com/en-us/102662)

1. On the working Mac, open Apple's macOS download page.
2. Find **macOS Catalina 10.15**.
3. Follow Apple's download instructions for that version.
4. When the download finishes, locate **Install macOS Catalina.app** in the Applications folder.
5. If the installer opens automatically, quit it without beginning installation on the working Mac.

The installer should be located at:

`/Applications/Install macOS Catalina.app`

**Compatibility note:** Depending on the working Mac and its operating system, Apple may prevent downloading an installer for an incompatible model. If this happens, use a compatible Mac and Apple's official instructions rather than downloading an installer from an unverified website.

### 3.4 Prepare the USB Drive

1. Insert the USB flash drive into the working Mac.
2. Open **Disk Utility**.
3. Choose **View → Show All Devices**.
4. Select the USB drive's physical device, not merely an existing volume beneath it.
5. Click **Erase**.
6. Enter the name `MyVolume`.
7. Select **Mac OS Extended (Journaled)** as the format.
8. Select **GUID Partition Map** as the scheme.
9. Click **Erase** and wait for completion.

Double-check that you selected the USB drive. Erasing the wrong disk can permanently destroy important data.

The name `MyVolume` is used in the installation command below. If you choose another name, the command must be adjusted accordingly.

### 3.5 Create the Bootable Installer

Open **Terminal** on the working Mac.

Copy and paste this command:

```bash
sudo /Applications/Install\ macOS\ Catalina.app/Contents/Resources/createinstallmedia --volume /Volumes/MyVolume
```

Press **Return**.

Terminal will request the administrator password for the working Mac.

The password will not appear as you type it. This is normal.

Press **Return** after entering the password.

When prompted to erase the USB volume, confirm by typing `Y` and pressing **Return**.

The installer creation process may take several minutes.

Do not disconnect the USB drive while it is running.

When the process finishes successfully, Terminal should report that the installation media is available.

### 3.6 Confirm the Installer Was Created

Open Finder and examine the USB drive.

Its name should now resemble **Install macOS Catalina**.

The installer should contain the files needed to start a compatible Mac.

At this point, the USB preparation process is complete.

However, **having a bootable installer does not guarantee that the target Mac will successfully boot from it**.

We learned that distinction firsthand.

### 3.7 Troubleshooting Installer Creation

| Problem | Possible cause | What to do |
|---|---|---|
| Command not found | Installer missing or incorrectly named | Verify the installer exists in Applications |
| Volume not found | USB drive has a different name | Check the volume name in Finder or Disk Utility |
| Permission denied | Command not run with appropriate privileges | Use the complete `sudo` command |
| USB drive not visible | Connection, adapter, or drive problem | Try another port or inspect Disk Utility |
| Installer download unavailable | Working Mac is incompatible or download method changed | Follow Apple's current download instructions on a compatible Mac |
| Creation stops unexpectedly | USB media or connection problem | Retry with another suitable USB drive |

### 3.8 What Happened in Our Project

We created the Catalina installation USB.

Then we attempted to start the Mac mini from it.

It didn't work.

The original wireless keyboard was not cooperating with startup selection, preventing us from choosing the USB installer.

A brand-new keyboard ultimately allowed us to select the installer and proceed.

The USB installer wasn't necessarily the problem. The input device was preventing us from using it.

This is why a wired or otherwise startup-compatible keyboard is worth having available when reviving an older Mac.

The replacement keyboard later became intermittently unresponsive during normal operation, but it had already performed its most important task: getting Catalina installed.

We'll cover that process in the next chapter.

---