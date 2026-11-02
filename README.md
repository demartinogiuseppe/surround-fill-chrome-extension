# Surround Fill 5.1 / 7.1

Estensione per Chrome/Edge che copia l'audio stereo del browser sugli altri canali di un impianto 5.1 o 7.1: posteriori, laterali (7.1), centrale e subwoofer. Lavora dentro la pagina con la Web Audio API: nessun driver, nessun programma da installare, nessun ritardo aggiunto.

## Cosa fa

- **Posteriori**: anteriore sinistro → posteriore sinistro, anteriore destro → posteriore destro
- **Laterali** (solo 7.1): anteriore sinistro → laterale sinistro, anteriore destro → laterale destro
- **Centrale**: (sinistro + destro) / 2 → centrale
- **Subwoofer**: (sinistro + destro) / 2, solo i bassi sotto 120 Hz → LFE
- Rileva da solo se l'uscita è 5.1 o 7.1 e lo mostra nel popup
- Quattro interruttori indipendenti; la scritta sull'icona mostra cosa è acceso (`P`, `L`, `C`, `S` e combinazioni)
- Funziona su tutti i siti con video/audio normali (YouTube, Twitch, Vimeo, siti di notizie…)

## Limiti

- **Siti con DRM** (Netflix, Prime Video, Disney+, Spotify): il browser non permette di elaborarne l'audio. L'estensione li riconosce e li lascia in stereo normale.
- File audio/video serviti da altri domini senza CORS vengono saltati per lo stesso motivo.
- Windows deve essere impostato su **5.1 o 7.1** (Pannello di controllo → Audio → Configura), altrimenti il browser vede solo 2 canali. Dopo aver cambiato configurazione, riavvia il browser.
- Dopo la prima attivazione, l'audio di quel video resta instradato dall'estensione anche da spenta (in stereo normale). Ricaricare la pagina ripristina tutto.

- Se l'amplificatore o il driver fa già la gestione dei bassi (bass management), attivare anche il subwoofer qui può raddoppiare i bassi: in quel caso lascialo spento.

## Installazione

1. Scarica o clona questo repository.
2. Apri `chrome://extensions` (Edge: `edge://extensions`) e attiva **Modalità sviluppatore**.
3. **Carica estensione non pacchettizzata** → seleziona la cartella `extension/`.
4. Fissa l'icona nella barra.

## Risoluzione problemi

- Video muto dopo l'attivazione → clicca una volta nella pagina (il browser può tenere l'audio sospeso finché non interagisci).
- Canali aggiunti muti → F12 → Console, cerca righe che iniziano con `[Surround Fill]`.

## Alternative

Esistono estensioni più complete che fanno upmix stereo → surround, ad esempio *Audio Booster: Real Surround, EQ & Spatial Sound* (Chrome) e *Stereo to 7.1 Surround Upmixer* (Firefox). Questa è volutamente minimale: copia diretta dei canali, quattro interruttori, nessuna elaborazione oltre al filtro del subwoofer.

## Licenza

MIT
