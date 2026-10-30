# Try Buildinio on your computer

A few minutes to set up, on Windows, Mac or Linux. Buildinio runs while the terminal window is open. To keep it running all the time and open it from anywhere, [host it at home](hosting.md) instead.

You'll need an OpenAI [API key](https://platform.openai.com/api-keys) with some credit on it: the AI that builds the apps runs on it.

## 1. Install what it needs

- **Node.js 22 or newer**: from [nodejs.org](https://nodejs.org), the button that says LTS.
- **Docker Desktop**, recommended: from [docker.com](https://docs.docker.com/get-docker/), and keep it running. The AI builds each app inside it, sealed off from the rest of your computer. You can skip it: then the AI's commands run straight on your computer (you'll pick this in step 4).

## 2. Download Buildinio

On [Buildinio's GitHub page](https://github.com/lortkipa/buildinio), click the green **Code** button, then **Download ZIP**, and unzip it. (Or, with Git: `git clone https://github.com/lortkipa/buildinio.git`.)

## 3. Open a terminal in the folder

- **Windows:** open the `buildinio` folder, right-click an empty spot and pick **Open in Terminal**.
- **Mac:** open the **Terminal** app, type `cd ` (with a space), drag the `buildinio` folder into the window and press Enter.
- **Linux:** right-click in the folder and pick **Open in Terminal**.

## 4. Set it up

```bash
npm run setup
```

It asks for your OpenAI key, the model and where the AI's commands run, then installs the rest (a minute or two). Press Enter to keep what's in [brackets].

What you type is saved in the `.env.local` file in the folder, and nowhere else. Rather fill that file in yourself? Copy `.env.example` to `.env.local`, add your key, and run `npm install` instead. Running `npm run setup` later keeps what's already there when you press Enter.

## 5. Start it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up. Until email is set up, the sign-up code is printed in the terminal instead of emailed.

To stop it, press **Ctrl+C** in the terminal. To start it again later, open a terminal in the folder and run `npm run dev`.

**On your phone:** connect it to the same Wi-Fi and open `http://<your computer's IP>:3000`, like `http://192.168.1.20:3000`.

To change a setting or turn on sign-in with Google, GitHub or email, see [Settings](settings.md).

## Troubleshooting

- **`npm` isn't recognized / command not found:** install Node.js (step 1), then open a new terminal.
- **The AI says it isn't set up:** add your OpenAI key and model with `npm run setup`, then start Buildinio again.
- **The AI says Docker isn't installed or running:** start Docker Desktop, or run `npm run setup` and pick "straight on this computer".
- **Where's my sign-up code?** In the terminal where Buildinio runs, unless email is set up.
- **The AI's "Looked at your app" step shows an X:** the terminal says why.
- **Hosting at home?** See [its troubleshooting](hosting.md#troubleshooting).
