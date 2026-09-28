# Waifu Errors
Your code has errors. She has opinions.
Waifu Errors is a VS Code extension that reacts to editor errors with random anime character images, playful scolding messages, and prerecorded voice clips in a sidebar. Audio plays from local MP3 files—no API keys or speech-service credits required.
## Features
- Random character images and scolding lines when editor error diagnostics change.
- 7 different Tsundere waifus with 7 different audios!
- Local MP3 playback with captions matched to each recording.
- Interrupts the current voice clip when a new scolding arrives.
- Displays the actual diagnostic message beneath the character's reaction.
- Works with errors reported by VS Code's installed language services.
- An Enable audio button appears when playback requires a click.

https://github.com/user-attachments/assets/865c528d-4258-44ec-931e-9c59fb987d90


## Requirements
- A VS Code version compatible with engines.vscode in package.json.
- Node.js and npm to build the extension from source.
- A language service that reports errors, such as Python with Pylance.
- The images and audio files referenced in src/extension.ts.
## Run locally
1. Download or clone this repository and open its folder in VS Code.
2. Install the project dependencies:
   npm install
3. Build the extension:
   npm run compile
4. Select Run Extension in the Run and Debug panel, then choose Run → Run Without Debugging (Ctrl+F5 on Windows).
5. In the Extension Development Host window, open a code file and the Waifu sidebar.
6. Introduce an error that your language service detects.
7. If prompted, click Enable audio inside the sidebar.
For a Python test, enter def foo( and wait for the diagnostic. To test again, replace it with pass, wait for the errors to clear, then reintroduce the error.
After changing extension source code, rebuild and restart the development session.
How it works
The extension listens for changes to VS Code diagnostics and filters for Error severity. When a file's error details change while the sidebar is visible, it selects an image and a prerecorded scolding, then sends them to the sidebar webview.
The webview updates the image and caption, stops any previous audio, and attempts to play the new clip. If autoplay is blocked, it offers an Enable audio button.
The recordings contain fixed phrases. The actual diagnostic is displayed as text; it is not synthesized into speech.
## Language support
The diagnostic listener is language-independent. It can react to Python, JavaScript, TypeScript, Java, C, C++, and other languages when an installed language service reports errors.
This extension does not provide its own compiler or language analyzer. Language activation is configured in package.json, and error detection depends on the relevant language service. Runtime exceptions printed only in the terminal do not trigger reactions.
Customize the character
Asset	Location	Configuration
Character images	media/	Edit the images array in src/extension.ts.
Voice clips	media/audio/	Edit each file entry in the scolds array.
Captions	src/extension.ts	Edit each text entry in the scolds array.


The current code references 1.png through 5.png and bob.png, plus 1.mp3 through 6.mp3. Supply those files or update the arrays to match your filenames.
Images are selected independently of audio. Each audio file is paired with its caption. To add another scolding, place an MP3 in media/audio/ and add an entry such as:
{
  file: '7.mp3',
  text: 'Another error? Take a breath and try again.'
}
Use images and recordings you have permission to redistribute, and include any required attribution.
# Current limitations
- The sidebar must be visible for reactions to trigger.
- Opening the sidebar does not automatically replay existing errors; a diagnostic change is needed.
- Audio may require a user click, particularly after the webview is recreated.
- Unchanged error signatures are suppressed, while edits that move errors can trigger another reaction.
- Rapid diagnostic updates can repeatedly interrupt clips.
- Only Error severity triggers reactions; warnings are ignored.
- Settings such as cooldowns and voice selection are not currently exposed in VS Code settings.
## Troubleshooting
No reaction: Keep the sidebar visible, confirm errors appear in the Problems panel, then clear and reintroduce an error.
No sound: Click Enable audio if shown. Check the MP3 filenames and the media/audio/ folder. Playback failures are displayed in the sidebar.
Missing image: Check that every filename in the images array exists in media/, including bob.png if listed.
Old behavior after editing: Run npm run compile and restart the Extension Development Host.
Debugger startup timeout: Run Without Debugging is the working development path used for this prototype. The separate F5 debugger startup issue remains unresolved.
Built with
TypeScript, the VS Code Extension API, HTML/CSS/JavaScript webviews, and esbuild.
