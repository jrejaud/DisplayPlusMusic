import spotifyPresenter from './presenter/spotifyPresenter';
import { eventHandler } from './presenter/eventPresenter';
import { enableMobileConsole } from './Scripts/debugConsole';
import { fetchLyrics } from './model/lyricsModel';
import pollingPresenter from './presenter/pollingPresenter';
import viewPresenter from './presenter/viewPresenter';
import playbackOffsetModel from './model/playbackOffsetModel';
import { seedDevConfig } from './utils/devSeed';

async function main() {
    // enableMobileConsole();
    console.log("App starting...");

    // Simulator gallery for the lens UI gate. DEV is statically false in production builds,
    // so neither the gallery nor its fixtures ship in the .ehpk.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('lensGate')) {
        const [{ startLensGateGallery }, { waitForEvenAppBridge }] = await Promise.all([
            import('./dev/lens-gate-app'),
            import('@evenrealities/even_hub_sdk'),
        ]);
        await startLensGateGallery(await waitForEvenAppBridge());
        return;
    }

    await seedDevConfig();

    viewPresenter.initListeners();

    await playbackOffsetModel.init();
    await spotifyPresenter.initActiveSource();

    pollingPresenter.startPolling();

    eventHandler();

    const currentSong = await spotifyPresenter.fetchCurrentSong();
    await fetchLyrics(currentSong);
}

main();
