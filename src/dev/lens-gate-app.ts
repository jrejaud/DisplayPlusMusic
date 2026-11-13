/**
 * Simulator gallery for `ui-gate --surface glasses` (even-frontend skill).
 *
 * Only runs when the page is opened with `?lensGate=<control-url>`; production builds never
 * reach it. Each state seeds the presenters the real view reads, then calls the real
 * `createView()` on the gate's traced bridge — so every frame is the app's own drawing code.
 */
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { runLensGate, type LensGateState } from './lens-gate-client';
import Song from '../model/songModel';
import placeholderArtUrl from '../Assets/placeholder_art.jpg';
import { downloadImageAsGrayscalePng } from '../model/imageModel';
import { createView, setViewBridge } from '../view/GlassesView';
import spotifyPresenter from '../presenter/spotifyPresenter';
import lyricsPresenter from '../presenter/lyricsPresenter';
import navidromeModel from '../model/navidromeModel';

type GalleryState = {
    controllable: boolean;
    playing: boolean;
    mini: boolean;
    idle: boolean;
};

const BUTTONS = { previous: '◁◁', playPause: '▷ll', next: '▷▷' };

let art: Uint8Array = new Uint8Array();

function songFor(s: GalleryState): Song {
    const song = new Song();
    if (s.idle) {
        song.addTitle('');
        song.addArtist('No song found');
        song.addAlbum(' ');
        song.addID('0');
        song.addProgressSeconds(0);
        song.addDurationSeconds(0);
        song.addisPlaying(false);
        return song;
    }
    song.addTitle('Teardrop');
    song.addArtist('Massive Attack');
    song.addAlbum('Mezzanine');
    song.addID('gallery-teardrop');
    song.addProgressSeconds(83);
    song.addDurationSeconds(331);
    song.addisPlaying(s.playing);
    if (art.length > 0) song.addArtRaw(art);
    return song;
}

function seed(s: GalleryState): void {
    // The view reads these singletons directly; the gallery sets them the way a live
    // Jellyfin session would (source = the Subsonic shim, control per selected player).
    (spotifyPresenter as unknown as { activeSource: string }).activeSource = 'navidrome';
    spotifyPresenter.isMiniMode = s.mini;
    (navidromeModel as unknown as { selectedCanControl: boolean; selectedSessionId: string }).selectedCanControl = s.controllable && !s.idle;
    (navidromeModel as unknown as { selectedSessionId: string }).selectedSessionId = s.controllable ? 'gallery-session' : '';
    lyricsPresenter.currentLineWords = [];
    lyricsPresenter.currentLine = s.idle ? '' : 'Love, love is a verb';
    lyricsPresenter.nextLine = s.idle ? '' : 'Love is a doing word';
}

async function render(bridge: EvenAppBridge, s: GalleryState): Promise<void> {
    setViewBridge(bridge);
    seed(s);
    const song = songFor(s);
    spotifyPresenter.currentSong = song;
    await createView(song);
    // A layout change returns right after the rebuild; one more pass lands the text upgrade.
    await createView(song);
}

/** Mirrors eventPresenter's routing as a pure reducer: no network, same decisions. */
function onEvent(s: GalleryState, raw: unknown): GalleryState | null {
    const e = raw as {
        listEvent?: { containerName?: string; currentSelectItemName?: string };
        menuItemClickEvent?: { itemID?: number };
    };
    if (e.listEvent?.containerName === 'buttons') {
        if (!s.controllable || s.idle) return null;
        if (e.listEvent.currentSelectItemName?.trim() === BUTTONS.playPause) return { ...s, playing: !s.playing };
        return null; // previous/next only change the remote player; the lens follows on the next poll
    }
    if (e.menuItemClickEvent?.itemID === 1 || e.menuItemClickEvent?.itemID === 2) return { ...s, mini: !s.mini };
    return null; // double tap exits the app from this root screen
}

const STATES: LensGateState<GalleryState>[] = [
    {
        name: '01-controllable',
        lookingFor: 'Jellyfin player that supports remote control: album art left, title/artist/album, the three transport buttons, progress bar and the current lyric line.',
        root: true,
        state: { controllable: true, playing: true, mini: false, idle: false },
    },
    {
        name: '02-view-only',
        lookingFor: 'Jellyfin player that cannot be remote-controlled (e.g. a phone app): NO transport buttons, song info widened into their space.',
        root: true,
        state: { controllable: false, playing: true, mini: false, idle: false },
    },
    {
        name: '03-paused',
        lookingFor: 'Controllable player, paused: same layout as 01 with the paused state shown.',
        root: true,
        state: { controllable: true, playing: false, mini: false, idle: false },
    },
    {
        name: '04-mini',
        lookingFor: 'Mini mode: one marquee line with title, artist and time, then the lyric lines; no art, no buttons.',
        root: true,
        state: { controllable: true, playing: true, mini: true, idle: false },
    },
    {
        name: '05-idle',
        lookingFor: 'Nothing playing on any Jellyfin player: "No song found", no buttons.',
        root: true,
        state: { controllable: false, playing: false, mini: false, idle: true },
    },
];

export async function startLensGateGallery(bridge: EvenAppBridge): Promise<boolean> {
    try {
        art = await downloadImageAsGrayscalePng(placeholderArtUrl, 144, 144);
    } catch (e) {
        console.warn('[gallery] placeholder art unavailable', e);
    }
    return runLensGate<GalleryState>({
        bridge,
        states: STATES,
        boot: (b) => render(b, STATES[0].state),
        render,
        onEvent,
        screenOf: (s) => (s.idle ? 'idle' : s.mini ? 'mini' : s.controllable ? 'player:control' : 'player:view'),
    });
}
