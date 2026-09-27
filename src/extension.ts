import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new WaifuViewProvider(context.extensionUri);

  // Track errors separately for each file.
  const previousErrors = new Map<string, string>();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WaifuViewProvider.viewType,
      provider
    ),

    vscode.languages.onDidChangeDiagnostics(event => {
      for (const uri of event.uris) {
        const errors = vscode.languages
          .getDiagnostics(uri)
          .filter(
            diagnostic =>
              diagnostic.severity === vscode.DiagnosticSeverity.Error
          );

        const fileKey = uri.toString();

        if (errors.length === 0) {
          previousErrors.delete(fileKey);
          continue;
        }

        // Include positions so identical messages at different locations
        // can still trigger a new scolding.
        const signature = JSON.stringify(
          errors.map(error => ({
            message: error.message,
            startLine: error.range.start.line,
            startCharacter: error.range.start.character,
            endLine: error.range.end.line,
            endCharacter: error.range.end.character
          }))
        );

        if (previousErrors.get(fileKey) === signature) {
          continue;
        }

        // Don't mark errors as handled while the sidebar is hidden.
        if (!provider.isVisible) {
          continue;
        }

        previousErrors.set(fileKey, signature);
        void provider.scold(errors[0].message);
      }
    })
  );
}

export class WaifuViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'waifuView';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public get isVisible(): boolean {
    return this._view?.visible ?? false;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">

        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${webview.cspSource}; media-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
        >

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <style>
          body {
            background: var(--vscode-sideBar-background);
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            text-align: center;
            padding: 15px;
          }

          #status-text {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
          }

          #waifu-img {
            display: none;
            max-width: 100%;
            max-height: 280px;
            border-radius: 10px;
            object-fit: contain;
            margin: 0 auto;
          }

          #scold-text {
            display: none;
            margin-top: 15px;
            font-size: 13px;
            line-height: 1.4;
            color: #f87171;
            padding: 0 10px;
            white-space: pre-wrap;
          }

          #enable-audio {
            display: none;
            margin: 10px auto;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }

          #enable-audio:hover {
            background: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>

      <body>
        <p id="status-text">Waiting for you to mess up...</p>

        <img id="waifu-img" alt="Character reaction">

        <p id="scold-text"></p>

        <audio id="audio-player" style="display:none;"></audio>

        <button id="enable-audio">Enable audio</button>

        <script>
          const imgEl = document.getElementById('waifu-img');
          const textEl = document.getElementById('scold-text');
          const statusEl = document.getElementById('status-text');
          const audioEl = document.getElementById('audio-player');
          const enableAudioBtn = document.getElementById('enable-audio');

          // Prevent an older playback attempt from updating the UI
          // after a newer clip has replaced it.
          let playbackVersion = 0;

          function attemptPlayback(version) {
            audioEl.play().then(() => {
              if (version !== playbackVersion) {
                return;
              }

              enableAudioBtn.style.display = 'none';
              statusEl.style.display = 'none';
            }).catch(err => {
              if (
                version !== playbackVersion ||
                err.name === 'AbortError'
              ) {
                return;
              }

              console.error(
                'Audio playback failed:',
                err.name,
                err.message
              );

              if (err.name === 'NotAllowedError') {
                enableAudioBtn.style.display = 'block';
                statusEl.textContent =
                  'Click Enable audio to allow speech.';
              } else {
                enableAudioBtn.style.display = 'none';
                statusEl.textContent =
                  'Audio failed: ' + err.message;
              }

              statusEl.style.display = 'block';
            });
          }

          enableAudioBtn.addEventListener('click', () => {
            // Playback is called directly from the user's click.
            attemptPlayback(playbackVersion);
          });

          imgEl.addEventListener('error', () => {
            console.error('Image failed to load:', imgEl.src);
            imgEl.alt = 'Image could not load. Check your media folder.';
          });

          window.addEventListener('message', event => {
            const message = event.data;

            if (!message || message.type !== 'SCOLD') {
              return;
            }

            statusEl.style.display = 'none';

            // Display the image and caption independently of audio.
            imgEl.src = message.imgUri;
            imgEl.style.display = 'block';

            textEl.textContent = message.text;
            textEl.style.display = 'block';

            // Invalidate old playback attempts and stop the old clip.
            playbackVersion += 1;
            audioEl.pause();

            if (message.audioUri) {
              audioEl.src = message.audioUri;

              // Reload to start from the beginning, even if the same
              // audio file was randomly selected again.
              audioEl.load();

              attemptPlayback(playbackVersion);
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  public async scold(errorMsg: string): Promise<void> {
    if (!this._view || !this._view.visible) {
      return;
    }

    try {
      const webview = this._view.webview;

      // Every listed image must exist inside media/.
      const images = [
        '1.png',
        '2.png',
        '3.png',
        '4.png',
        '5.png',
        'bob.png'
      ];

      const randomImage =
        images[Math.floor(Math.random() * images.length)];

      const imgUri = webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._extensionUri,
          'media',
          randomImage
        )
      ).toString();

      // Every listed recording must exist inside media/audio/.
      const scolds = [
        {
          file: '1.mp3',
          text: "H-Hmph! Another error? You’re really testing my patience, baka…"
        },
        {
          file: '2.mp3',
          text: "Your code needs attention. A-And it’s not like I care if you do too or anything…!"
        },
        {
          file: '3.mp3',
          text: "I-I believed in you… Then I saw this mess. Don’t look so happy about it!"
        },
        {
          file: '4.mp3',
          text: "Take a breath and check your code again. I-It’s not like I’m worried or anything…"
        },
        {
          file: '5.mp3',
          text: "You forgot something. Let’s just pretend this was intentional… idiot."
        },
        {
          file: '6.mp3',
          text: "I-I’m not fixing this for you! …Okay, maybe I’ll give you one tiny hint. Don’t get the wrong idea!"
        }
      ];

      const selectedScold =
        scolds[Math.floor(Math.random() * scolds.length)];

      const audioUri = webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._extensionUri,
          'media',
          'audio',
          selectedScold.file
        )
      ).toString();

      await webview.postMessage({
        type: 'SCOLD',
        imgUri,
        audioUri,
        text: `${selectedScold.text}\n\nError: ${errorMsg}`
      });
    } catch (err: unknown) {
      console.error(
        'Failed to display scold:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}