# Host Buildinio on a Synology or QNAP NAS

Synology and QNAP run their own systems, where the [hosting script](hosting.md) can't run directly. You can still use one, though: the NAS runs a small Linux computer of its own, a **virtual machine**, and Buildinio goes inside it. This page shows how to make one. When it's done, you follow the [hosting guide](hosting.md) inside it, like on any other computer.

(Your NAS runs a Debian-based Linux, like OpenMediaVault? Then you don't need any of this: follow the [hosting guide](hosting.md) on it directly.)

**Contents:** [What you need](#what-you-need) · [1. Download Ubuntu](#1-download-ubuntu) · [2a. Make the virtual machine on Synology](#2a-make-the-virtual-machine-on-synology) · [2b. Make the virtual machine on QNAP](#2b-make-the-virtual-machine-on-qnap) · [3. Install Ubuntu](#3-install-ubuntu) · [4. Connect from your computer](#4-connect-from-your-computer) · [5. Install Buildinio](#5-install-buildinio) · [Troubleshooting](#troubleshooting)

## What you need

- **A NAS that can run virtual machines.** That's most Synology "+" models (like the DS224+ or DS923+) and most QNAP models with an Intel or AMD processor. To check: open **Package Center** (Synology) or **App Center** (QNAP) and search for **Virtual Machine Manager** (Synology) or **Virtualization Station** (QNAP). If it isn't there, your model can't run one, and you'll need [another computer](hosting.md#what-you-need).
- **At least 8 GB of memory in the NAS.** The virtual machine takes 4 GB, and the NAS needs the rest for itself. Many models come with less but take more: check your NAS's memory under **Control Panel** → **Info Center** (Synology) or **Control Panel** → **System Status** (QNAP).
- **40 GB of free space** on one of its volumes.
- A computer on the same network, to set it up from.

Menus can have slightly different names on older versions of DSM and QTS; look for the closest match.

## 1. Download Ubuntu

On your computer, download **Ubuntu Server 24.04 LTS** from [ubuntu.com/download/server](https://ubuntu.com/download/server). It's one file of about 3 GB, ending in `.iso`.

## 2a. Make the virtual machine on Synology

Using QNAP? Skip to [2b](#2b-make-the-virtual-machine-on-qnap).

1. **Install Virtual Machine Manager.** Open **Package Center**, search for **Virtual Machine Manager**, and click **Install**. Then open it.
2. **The first time**, it walks you through setting itself up: click **Next** through it, and pick the volume with the most free space as the storage.
3. **Add the Ubuntu file.** On the left, click **Image**, then the **ISO File** tab, then **Add**. Pick **From computer**, choose the `.iso` file you downloaded, and click **Next**, then **Done**. Wait until the upload finishes.
4. **Create the machine.** On the left, click **Virtual Machine**, then **Create**:
   1. Operating system: **Linux**. Click **Next**.
   2. Storage: the volume you picked before. **Next**.
   3. General: name it `buildinio`, with **2** CPU cores (4 if you have them to spare) and **4 GB** of memory. **Next**.
   4. Storage: a virtual disk of **40 GB**. **Next**.
   5. Network: leave **Default VM Network**. **Next**.
   6. Other settings: for **ISO file for bootup**, pick the Ubuntu file. Set **Autostart** to **Yes**, so the machine starts by itself whenever the NAS does. **Next**.
   7. Permissions: tick your own account. **Next**.
   8. Tick **Power on the virtual machine after creation**, and click **Done**.
5. **Open its screen.** Click the `buildinio` machine, then **Connect**. A new browser tab opens with its screen. Go on to [3. Install Ubuntu](#3-install-ubuntu).

## 2b. Make the virtual machine on QNAP

1. **Install Virtualization Station.** Open **App Center**, search for **Virtualization Station**, and click **Install**. Then open it, and accept its first-time questions.
2. **Put the Ubuntu file on the NAS.** Open **File Station** and upload the `.iso` file you downloaded to any shared folder, like `Public`. Wait until the upload finishes.
3. **Create the machine.** In Virtualization Station, click **Create** (or **Create VM**):
   1. Name: `buildinio`. Operating system: **Linux**, version **Ubuntu**.
   2. CPU: **2** cores (4 if you have them to spare). Memory: **4 GB**.
   3. CD image: click **Browse** and pick the Ubuntu file in the shared folder.
   4. Hard disk: **40 GB**, on the volume with the most free space.
   5. Network: leave the default virtual switch.
   6. Click **Create**.
4. **Make it start with the NAS.** Open the machine's **Settings**, find **Auto start** (under **General**), and set it to **Always on**. Save.
5. **Start it and open its screen.** Click the machine's start (▶) button, then click its little screen picture. A new browser tab opens with its screen. Go on to [3. Install Ubuntu](#3-install-ubuntu).

## 3. Install Ubuntu

The machine's screen shows Ubuntu's installer. It's all keyboard: the **arrow keys** and **Tab** move, **Space** ticks a box, and **Enter** picks. For most screens the right answer is to press Enter on **Done**.

1. **Language:** English, Enter.
2. **Installer update available:** **Continue without updating**.
3. **Keyboard:** your layout, then **Done**.
4. **Type of installation:** leave **Ubuntu Server**, then **Done**.
5. **Network:** it shows an address, like `192.168.1.50`. **Write it down**: it's how you'll reach the machine. Then **Done**.
6. **Proxy** and **Ubuntu archive mirror:** **Done** on both.
7. **Storage:** leave **Use an entire disk**, then **Done**, **Done** again, and **Continue** to confirm. (This only erases the machine's empty 40 GB disk, not your NAS.)
8. **Profile:** type your name, a server name (`buildinio`), a username and a password. Remember the username and password. **Done**.
9. **Ubuntu Pro:** leave **Skip for now**, then **Continue**.
10. **SSH:** press **Space** to tick **Install OpenSSH server**, then **Done**. This lets you connect from your computer in the next step.
11. **Featured server snaps:** tick nothing, **Done**.
12. It installs (a few minutes). When **Reboot Now** shows, pick it. If it then says to remove the installation medium, press Enter.

When it has restarted, the screen asks for a login: Ubuntu is ready. You can close the tab.

## 4. Connect from your computer

You'll type the rest from your own computer, not the machine's screen: copying and pasting doesn't work well in the browser tab.

1. Open a terminal on your computer: on **Windows**, the **Terminal** app (or PowerShell); on a **Mac**, the **Terminal** app.
2. Connect, with your username and the address you wrote down:

   ```bash
   ssh your-username@192.168.1.50
   ```

3. The first time, it asks whether to trust the machine: type `yes` and press Enter. Then type your password (it shows nothing as you type; that's normal) and press Enter.

You're now typing on the machine. To leave, type `exit`.

**Lost the address?** Open the machine's screen again (step 5 of 2a or 2b), log in, and type `hostname -I`: the first number is it. While you're at it, it's worth giving the machine a fixed address in your router's settings (often called "DHCP reservation"), so it doesn't change.

## 5. Install Buildinio

You're in: follow the [hosting guide](hosting.md#install) from **2. Download Buildinio**, typing the commands in this terminal.

Two notes for a virtual machine:

- When the installer asks whether to stop the computer from sleeping, either answer is fine: the machine doesn't sleep.
- If you pick "your domain, through your router", forward the ports to **the machine's** address (the one you wrote down), not the NAS's.

## Troubleshooting

- **Package Center or App Center doesn't have Virtual Machine Manager or Virtualization Station:** your model can't run virtual machines. Use [another computer](hosting.md#what-you-need), like an old laptop or a mini PC.
- **The machine won't start, or says there isn't enough memory:** the NAS needs more free memory. Stop other apps and virtual machines, or add memory to the NAS.
- **`ssh` says "Connection refused" or "timed out":** check the address (see "Lost the address?" above). If SSH wasn't ticked during the install, log in on the machine's screen and type `sudo apt install -y openssh-server`.
- **Buildinio is gone after the NAS restarted:** turn on the machine's autostart (2a, step 4.6, or 2b, step 4). Buildinio itself starts with the machine.
- **Everything else:** see the [hosting guide's troubleshooting](hosting.md#troubleshooting).
